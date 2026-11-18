// Scans the signed-in user's own recent Gmail for senders that match a known
// Loop listserv, and suggests following the matching orgs. Unlike
// `ingestion.ts` (which ingests mail into a single shared admin inbox), this
// never persists anything from the user's inbox — only the final matched
// `orgId`s the user actually acts on (via `follows` or
// `orgSuggestionDismissals`) ever reach the database.

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { authedAction, authedMutation } from "./lib/auth";
import {
  batchFetchMessages,
  extractEmailAddress,
  gmailFetch,
} from "./lib/gmailBatch";
import { projectOrg, type PublicOrg } from "./orgs";

const GMAIL_MESSAGES_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GMAIL_PROFILE_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";

/** Keeps the scan to recent subscriptions instead of a student's whole inbox history. */
const SCAN_QUERY = "newer_than:12m";
const MESSAGES_PER_PAGE = 500;
/** Safety cap (~5000 messages) so a very large inbox can't run away in one action call. */
const MAX_PAGES = 10;
const BATCH_SIZE = 100;

type GmailListResponse = {
  messages?: Array<{ id: string }>;
  nextPageToken?: string;
};

type GmailProfileResponse = {
  emailAddress?: string;
};

type GmailMetadataMessage = {
  id?: string;
  payload?: { headers?: Array<{ name?: string; value?: string }> };
};

async function fetchRecentMessageIds(accessToken: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;

  do {
    const url = new URL(GMAIL_MESSAGES_URL);
    url.searchParams.set("maxResults", String(MESSAGES_PER_PAGE));
    url.searchParams.set("q", SCAN_QUERY);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await gmailFetch<GmailListResponse>(
      url.toString(),
      accessToken,
    );
    ids.push(...(response.messages?.map((message) => message.id) ?? []));
    pages += 1;
    pageToken = pages < MAX_PAGES ? response.nextPageToken : undefined;
  } while (pageToken);

  return [...new Set(ids)];
}

function senderFromMessage(message: GmailMetadataMessage): string | null {
  const fromHeader = message.payload?.headers?.find(
    (header) => header.name?.toLowerCase() === "from",
  );
  return fromHeader?.value ? extractEmailAddress(fromHeader.value) : null;
}

/**
 * Scans the last 12 months of the caller's Gmail for unique `From` senders and
 * matches them against known listserv addresses (same exact-match logic as
 * `ingestion.ts`'s sender matching). Returns orgs the user isn't already
 * following and hasn't already dismissed a suggestion for; the raw sender
 * list is discarded once matching is done.
 */
export const scanRecentSenders = authedAction({
  args: { accessToken: v.string() },
  handler: async (ctx, args): Promise<PublicOrg[]> => {
    const profile = await gmailFetch<GmailProfileResponse>(
      GMAIL_PROFILE_URL,
      args.accessToken,
    );
    if (profile.emailAddress?.toLowerCase() !== ctx.user.email?.toLowerCase()) {
      throw new ConvexError({
        code: "GMAIL_ACCOUNT_MISMATCH",
        message:
          "The Gmail account you granted access to doesn't match your signed-in account.",
      });
    }

    const messageIds = await fetchRecentMessageIds(args.accessToken);
    const messages = await batchFetchMessages<GmailMetadataMessage>(
      messageIds,
      args.accessToken,
      { format: "metadata", metadataHeaders: ["From"], batchSize: BATCH_SIZE },
    );

    const senders = new Set<string>();
    for (const message of messages) {
      const sender = senderFromMessage(message);
      if (sender) senders.add(sender);
    }

    const listservs = await ctx.runQuery(
      internal.ingestion.getMatchableListservs,
      {},
    );

    const matchedOrgIds = new Set<Id<"orgs">>();
    for (const listserv of listservs) {
      if (!listserv.organizationId) continue;
      const addresses = [listserv.listEmail, ...listserv.senderEmails].map(
        (address) => address.toLowerCase(),
      );
      if (addresses.some((address) => senders.has(address))) {
        matchedOrgIds.add(listserv.organizationId);
      }
    }

    if (matchedOrgIds.size === 0) return [];

    return await ctx.runQuery(internal.gmailMatches.filterUnseenOrgs, {
      userId: ctx.user._id,
      orgIds: [...matchedOrgIds],
    });
  },
});

/**
 * Drops orgs the user already follows or already dismissed a suggestion for,
 * and projects the rest. Runs as a query (rather than inline in the action)
 * because actions have no `ctx.db` of their own.
 */
export const filterUnseenOrgs = internalQuery({
  args: { userId: v.id("users"), orgIds: v.array(v.id("orgs")) },
  handler: async (ctx, args): Promise<PublicOrg[]> => {
    const results: PublicOrg[] = [];

    for (const orgId of args.orgIds) {
      const [follow, dismissal] = await Promise.all([
        ctx.db
          .query("follows")
          .withIndex("by_user_and_org", (q) =>
            q.eq("userId", args.userId).eq("orgId", orgId),
          )
          .unique(),
        ctx.db
          .query("orgSuggestionDismissals")
          .withIndex("by_user_and_org", (q) =>
            q.eq("userId", args.userId).eq("orgId", orgId),
          )
          .unique(),
      ]);
      if (follow !== null || dismissal !== null) continue;

      const org = await ctx.db.get(orgId);
      if (org !== null && org.orgStatus !== "hidden") {
        results.push(projectOrg(org));
      }
    }

    return results;
  },
});

/** Records that the user said they're not a member of a suggested org, so future scans stop suggesting it. */
export const dismissSuggestion = authedMutation({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orgSuggestionDismissals")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", ctx.user._id).eq("orgId", args.orgId),
      )
      .unique();
    if (existing !== null) return null;

    await ctx.db.insert("orgSuggestionDismissals", {
      userId: ctx.user._id,
      orgId: args.orgId,
      createdAt: Date.now(),
    });
    return null;
  },
});
