import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  isCornellListAddress,
  isJoinConfirmationMail,
  listNameFromAddress,
  listNameFromConfirmationSender,
  simplelistsAddressForList,
} from "./lib/cornellLists";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

declare const process: { env: Record<string, string | undefined> };

const GMAIL_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_MESSAGES_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GMAIL_HISTORY_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/history";
const GMAIL_PROFILE_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const GMAIL_BATCH_ENDPOINT = "https://www.googleapis.com/batch/gmail/v1";
const HISTORY_STATE_KEY = "gmail_history_id";
const MESSAGES_PER_PAGE = 100;
const MAX_BOOTSTRAP_MESSAGES = 250;
/**
 * Upper bound on one steady-state poll. Anything beyond this is picked up by
 * the next run ten minutes later, because `markIngestionSucceeded` advances the
 * cursor only to the history id Gmail reported for the page we actually read.
 */
const MAX_HISTORY_MESSAGES = 250;
const BATCH_SIZE = 50;
/**
 * Messages per `storeParsedMessages` call. Each carries its full `bodyText` and
 * `bodyHtml`, and mutation arguments are size-limited, so the whole fetched set
 * cannot be passed at once.
 */
const STORE_CHUNK_SIZE = 25;

type GmailHeader = { name?: string; value?: string };

type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
  headers?: GmailHeader[];
};

type GmailFullMessage = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

type GmailListResponse = {
  messages?: Array<{ id: string; threadId?: string }>;
  nextPageToken?: string;
};

type GmailHistoryResponse = {
  history?: Array<{
    messagesAdded?: Array<{ message?: { id?: string } }>;
  }>;
  nextPageToken?: string;
  historyId?: string;
};

type GmailProfileResponse = {
  historyId?: string;
};

type ParsedEmail = {
  gmailMessageId: string;
  threadId?: string;
  sender: string;
  senderEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  receivedAt: number;
  bodyText: string;
  bodyHtml: string;
  headers: Array<{ name: string; value: string }>;
};

type StoredParsedEmail = ParsedEmail & {
  listservId?: Id<"listservs">;
  organizationId?: Id<"orgs">;
};

type MatchableListserv = {
  _id: Id<"listservs">;
  organizationId?: Id<"orgs">;
  listEmail: string;
  senderEmails: string[];
};

type ListservMatch = {
  listservId?: Id<"listservs">;
  organizationId?: Id<"orgs">;
  /**
   * Set when a Simplelists confirmation named a list we have no row for. The
   * caller turns these into candidates rather than guessing at an owner.
   */
  unknownListAddress?: string;
};

type IngestionRunResult = {
  fetched: number;
  unseen: number;
  stored: number;
};

/**
 * Reason recorded on candidates raised from an unmatched confirmation.
 * Exported so the reconciliation report in listservAdmin.ts can identify
 * these rows without duplicating the string.
 */
export const UNKNOWN_LIST_REASON = "confirmation received for unknown list";

/**
 * A subscription confirmation is direct evidence the list exists and that we
 * asked to join it, so these rank above pattern-matched discovery candidates.
 */
const UNKNOWN_LIST_CONFIDENCE = 90;

type FetchedMessageIds = {
  messageIds: string[];
  historyId?: string;
};

type IngestionStateSnapshot = {
  value?: string;
};

type GmailConnectionSnapshot = {
  email: string;
  refreshToken: string;
};

export const pollListservInbox = internalAction({
  args: {
    trigger: v.optional(v.union(v.literal("cron"), v.literal("manual"))),
  },
  handler: async (ctx, args): Promise<IngestionRunResult> => {
    const runId: Id<"ingestionRuns"> = await ctx.runMutation(
      internal.ingestion.startIngestionRun,
      { trigger: args.trigger ?? "cron" },
    );

    await ctx.runMutation(internal.ingestion.markIngestionRunning, {
      key: HISTORY_STATE_KEY,
    });

    // Hoisted so a failure partway through still reports how far the run
    // actually got — recording `fetched: 0` on every failed run made it
    // impossible to tell "Gmail auth failed before fetching anything" from
    // "fetched 400 messages, then the store step blew up" in the run history.
    let fetchedCount = 0;
    let unseenCount = 0;
    let stored = 0;

    try {
      const accessToken = await refreshAccessToken(ctx);
      const state = (await ctx.runQuery(internal.ingestion.getIngestionState, {
        key: HISTORY_STATE_KEY,
      })) as IngestionStateSnapshot | null;

      const fetched: FetchedMessageIds = await fetchMessageIds(
        accessToken,
        state?.value,
      );
      fetchedCount = fetched.messageIds.length;

      const unseenIds = (await ctx.runQuery(
        internal.ingestion.filterUnseenMessages,
        {
          gmailMessageIds: fetched.messageIds,
        },
      )) as string[];
      unseenCount = unseenIds.length;

      if (unseenIds.length > 0) {
        const [messages, listservs] = (await Promise.all([
          batchFetchMessages(unseenIds, accessToken),
          ctx.runQuery(internal.ingestion.getMatchableListservs),
        ])) as [GmailFullMessage[], MatchableListserv[]];

        const unknownListAddresses = new Set<string>();
        const parsed: StoredParsedEmail[] = messages.flatMap(
          (message: GmailFullMessage) => {
            const email = parseGmailMessage(message);
            if (!email) return [];

            const { unknownListAddress, ...sourceMatch } = matchListserv(
              email,
              listservs,
            );
            if (unknownListAddress)
              unknownListAddresses.add(unknownListAddress);
            return [{ ...email, ...sourceMatch }];
          },
        );

        if (unknownListAddresses.size > 0) {
          await ctx.runMutation(
            internal.ingestion.recordUnknownListCandidates,
            { addresses: [...unknownListAddresses] },
          );
        }

        // Chunked because every message carries its full text and HTML body,
        // and the whole set used to be handed to one mutation as a single
        // argument. Past the argument size limit that throws *after* the Gmail
        // fetch but *before* the cursor advances, so the next run refetched the
        // same oversized set and wedged permanently.
        for (let i = 0; i < parsed.length; i += STORE_CHUNK_SIZE) {
          const result = await ctx.runMutation(
            internal.ingestion.storeParsedMessages,
            { messages: parsed.slice(i, i + STORE_CHUNK_SIZE) },
          );
          stored += result.stored;
        }
      }

      if (fetched.historyId) {
        await ctx.runMutation(internal.ingestion.markIngestionSucceeded, {
          key: HISTORY_STATE_KEY,
          value: fetched.historyId,
        });
      } else {
        await ctx.runMutation(internal.ingestion.markIngestionSucceeded, {
          key: HISTORY_STATE_KEY,
        });
      }

      const result = {
        fetched: fetchedCount,
        unseen: unseenCount,
        stored,
      };

      await ctx.runMutation(internal.ingestion.finishIngestionRun, {
        runId,
        status: "completed",
        ...result,
      });

      return result;
    } catch (error) {
      await ctx.runMutation(internal.ingestion.finishIngestionRun, {
        runId,
        status: "failed",
        fetched: fetchedCount,
        unseen: unseenCount,
        stored,
        error: formatError(error),
      });
      await ctx.runMutation(internal.ingestion.markIngestionFailed, {
        key: HISTORY_STATE_KEY,
        error: formatError(error),
      });
      throw error;
    }
  },
});

export const getIngestionState = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("listservIngestionState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
  },
});

/** Reads both matchable statuses via `by_status` instead of scanning the whole table and filtering in memory. */
async function matchableListservRows(ctx: QueryCtx) {
  const [active, joining] = await Promise.all([
    ctx.db
      .query("listservs")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .take(MATCHABLE_LISTSERV_LIMIT),
    ctx.db
      .query("listservs")
      .withIndex("by_status", (q) => q.eq("status", "joining"))
      .take(MATCHABLE_LISTSERV_LIMIT),
  ]);
  return [...active, ...joining];
}

/** Upper bound per status in {@link matchableListservRows}; well above the table's real size today. */
const MATCHABLE_LISTSERV_LIMIT = 1000;

export const getMatchableListservs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const listservs = await matchableListservRows(ctx);
    return listservs.map((listserv) => ({
      _id: listserv._id,
      organizationId: listserv.organizationId,
      listEmail: listserv.listEmail,
      senderEmails: listserv.senderEmails,
    }));
  },
});

export const filterUnseenMessages = internalQuery({
  args: { gmailMessageIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    // Convex has no "WHERE id IN (...)" — but the per-ID lookups are
    // independent, so firing them concurrently rather than one at a time in
    // a `for` loop turns N sequential round trips into N parallel ones.
    const existing = await Promise.all(
      args.gmailMessageIds.map((id) =>
        ctx.db
          .query("listservMessages")
          .withIndex("by_gmail_message_id", (q) => q.eq("gmailMessageId", id))
          .unique(),
      ),
    );

    return args.gmailMessageIds.filter((_, index) => !existing[index]);
  },
});

export const startIngestionRun = internalMutation({
  args: { trigger: v.union(v.literal("cron"), v.literal("manual")) },
  handler: async (ctx, args) => {
    return ctx.db.insert("ingestionRuns", {
      trigger: args.trigger,
      status: "running",
      startedAt: Date.now(),
      fetched: 0,
      unseen: 0,
      stored: 0,
    });
  },
});

export const finishIngestionRun = internalMutation({
  args: {
    runId: v.id("ingestionRuns"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    fetched: v.number(),
    unseen: v.number(),
    stored: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: args.status,
      finishedAt: Date.now(),
      fetched: args.fetched,
      unseen: args.unseen,
      stored: args.stored,
      error: args.error,
    });
  },
});

export const markIngestionRunning = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("listservIngestionState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "running",
        lastStartedAt: now,
        lastError: undefined,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("listservIngestionState", {
      key: args.key,
      status: "running",
      lastStartedAt: now,
      updatedAt: now,
    });
  },
});

export const markIngestionSucceeded = internalMutation({
  args: { key: v.string(), value: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("listservIngestionState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    const patch = {
      value: args.value ?? existing?.value,
      status: "idle" as const,
      lastSucceededAt: now,
      lastError: undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return;
    }

    await ctx.db.insert("listservIngestionState", {
      key: args.key,
      ...patch,
    });
  },
});

export const markIngestionFailed = internalMutation({
  args: { key: v.string(), error: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("listservIngestionState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "failed",
        lastError: args.error,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("listservIngestionState", {
      key: args.key,
      status: "failed",
      lastError: args.error,
      updatedAt: now,
    });
  },
});

export const storeParsedMessages = internalMutation({
  args: {
    messages: v.array(
      v.object({
        gmailMessageId: v.string(),
        threadId: v.optional(v.string()),
        listservId: v.optional(v.id("listservs")),
        organizationId: v.optional(v.id("orgs")),
        sender: v.string(),
        senderEmail: v.string(),
        to: v.array(v.string()),
        cc: v.array(v.string()),
        subject: v.string(),
        receivedAt: v.number(),
        bodyText: v.string(),
        bodyHtml: v.string(),
        headers: v.array(v.object({ name: v.string(), value: v.string() })),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let stored = 0;

    for (const message of args.messages) {
      const existing = await ctx.db
        .query("listservMessages")
        .withIndex("by_gmail_message_id", (q) =>
          q.eq("gmailMessageId", message.gmailMessageId),
        )
        .unique();

      if (existing) continue;

      await ctx.db.insert("listservMessages", {
        ...message,
        processingStatus: "new",
        createdAt: now,
      });

      if (message.listservId) {
        const listserv = await ctx.db.get(message.listservId);
        const patch = buildListservIngestionPatch(message, now, listserv);
        await ctx.db.patch(message.listservId, patch);
      }

      stored += 1;
    }

    return { stored };
  },
});

/**
 * Raise a candidate for a Simplelists list we received a confirmation from but
 * have no row for. This is the normal case, not an error: the confirmation is
 * for `<LIST>@lists.cornell.edu`, while an existing org row commonly holds the
 * org's own From address. Guessing that the two are the same would overwrite a
 * real value, so the address becomes an actionable Sources-tab item instead.
 */
export const recordUnknownListCandidates = internalMutation({
  args: { addresses: v.array(v.string()) },
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const address of args.addresses) {
      const result = await recordUnknownListCandidate(ctx, address);
      if (result === "inserted") inserted += 1;
      if (result === "updated") updated += 1;
    }
    return { inserted, updated };
  },
});

async function recordUnknownListCandidate(ctx: MutationCtx, address: string) {
  const email = normalizeEmail(address);
  const listName = listNameFromAddress(email);
  if (!listName) return "skipped";

  const now = Date.now();
  const existing = await ctx.db
    .query("listservCandidates")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();

  if (existing) {
    if (
      existing.status !== "candidate" ||
      existing.matchedReasons.includes(UNKNOWN_LIST_REASON)
    ) {
      return "skipped";
    }
    await ctx.db.patch(existing._id, {
      confidence: Math.max(existing.confidence, UNKNOWN_LIST_CONFIDENCE),
      matchedReasons: [...existing.matchedReasons, UNKNOWN_LIST_REASON],
      updatedAt: now,
    });
    return "updated";
  }

  await ctx.db.insert("listservCandidates", {
    email,
    displayName: listName.toUpperCase(),
    source: "manual",
    status: "candidate",
    confidence: UNKNOWN_LIST_CONFIDENCE,
    matchedReasons: [UNKNOWN_LIST_REASON],
    notes:
      "Raised automatically from a Simplelists subscription confirmation. Attach it to the right organization, or reject it if we should not be subscribed.",
    createdAt: now,
    updatedAt: now,
  });
  return "inserted";
}

/**
 * Re-run source matching over messages that were never attributed to an org.
 *
 * New matching logic only affects future ingestion, so messages parked before
 * it landed stay parked. Admin-triggered rather than automatic, bounded per
 * run, and idempotent — a message that still matches nothing is simply left
 * alone.
 */
export const rematchUnassignedMessages = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    scanned: v.number(),
    matched: v.number(),
    candidatesRaised: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);

    const listservs: MatchableListserv[] = (
      await matchableListservRows(ctx)
    ).map((listserv) => ({
      _id: listserv._id,
      organizationId: listserv.organizationId,
      listEmail: listserv.listEmail,
      senderEmails: listserv.senderEmails,
    }));

    const messages = await ctx.db
      .query("listservMessages")
      .withIndex("by_organization", (q) => q.eq("organizationId", undefined))
      .take(limit);

    let matched = 0;
    let candidatesRaised = 0;
    const seenAddresses = new Set<string>();

    for (const message of messages) {
      const { unknownListAddress, ...match } = matchListserv(
        message,
        listservs,
      );

      if (unknownListAddress && !seenAddresses.has(unknownListAddress)) {
        seenAddresses.add(unknownListAddress);
        const result = await recordUnknownListCandidate(
          ctx,
          unknownListAddress,
        );
        if (result === "inserted") candidatesRaised += 1;
      }

      if (!match.listservId) continue;

      await ctx.db.patch(message._id, {
        listservId: match.listservId,
        organizationId: match.organizationId,
      });
      matched += 1;
    }

    return { scanned: messages.length, matched, candidatesRaised };
  },
});

function buildListservIngestionPatch(
  message: {
    receivedAt: number;
    senderEmail: string;
    subject: string;
    bodyText: string;
    bodyHtml?: string;
  },
  now: number,
  listserv: Pick<Doc<"listservs">, "joinStatus" | "status"> | null,
) {
  if (isJoinConfirmationMail(message)) {
    return {
      lastReceivedAt: message.receivedAt,
      joinStatus:
        listserv?.joinStatus === "joined"
          ? ("joined" as const)
          : ("awaiting_confirmation" as const),
      updatedAt: now,
    };
  }

  // `paused` is the one state incoming mail must never override: it is set by
  // an admin explicitly ignoring a source, and silently un-ignoring it on the
  // next message would undo that decision.
  if (listserv?.status === "paused") {
    return {
      lastReceivedAt: message.receivedAt,
      updatedAt: now,
    };
  }

  // Otherwise, receiving genuine list traffic is the strongest evidence we
  // have that the subscription went through — including for lists we were
  // added to by hand, where no confirmation mail ever arrives.
  if (listserv?.joinStatus !== "joined") {
    return {
      lastReceivedAt: message.receivedAt,
      joinStatus: "joined" as const,
      status: "active" as const,
      updatedAt: now,
    };
  }

  return {
    lastReceivedAt: message.receivedAt,
    updatedAt: now,
  };
}

async function refreshAccessToken(ctx: ActionCtx) {
  const connection = (await ctx.runQuery(
    internal.gmailConnection.getConnection,
    {},
  )) as GmailConnectionSnapshot | null;

  if (!connection) {
    throw new Error(
      "Gmail is not connected. Use the admin page to connect Gmail first.",
    );
  }

  const refreshToken = connection.refreshToken;
  const clientId = process.env.ADMIN_GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.ADMIN_GOOGLE_OAUTH_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error(
      "Admin ingestion Google OAuth client env vars are not configured.",
    );
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(GMAIL_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = `Token refresh failed (${response.status}): ${await response.text()}`;
    await ctx.runMutation(internal.gmailConnection.markInvalid, { error });
    throw new Error(error);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token)
    throw new Error("Token refresh returned no access_token.");

  return data.access_token;
}

/**
 * Picks the incremental or bootstrap fetch, and recovers from an expired
 * cursor.
 *
 * Gmail retains `startHistoryId` for about a week and then answers 404. That
 * used to fail the run before `markIngestionSucceeded` could write, so the stale
 * cursor was kept and every subsequent poll 404'd identically — ingestion
 * stopped permanently and the only fix was editing the row by hand in the Convex
 * dashboard. Falling back to the bootstrap fetch re-derives a fresh history id
 * from the profile, which then overwrites the stale one. Already-seen messages
 * are filtered by `by_gmail_message_id`, so the recovery run stores no
 * duplicates; it is just larger than usual.
 */
async function fetchMessageIds(
  accessToken: string,
  historyId: string | undefined,
): Promise<FetchedMessageIds> {
  if (!historyId) return await fetchRecentMessages(accessToken);

  try {
    return await fetchMessagesSinceHistory(accessToken, historyId);
  } catch (error) {
    if (!(error instanceof GmailApiError) || error.status !== 404) throw error;
    console.warn(
      `Gmail history id ${historyId} has expired; falling back to a bootstrap fetch.`,
    );
    return await fetchRecentMessages(accessToken);
  }
}

async function fetchMessagesSinceHistory(
  accessToken: string,
  historyId: string,
) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  let latestHistoryId: string | undefined;

  do {
    const url = new URL(GMAIL_HISTORY_URL);
    url.searchParams.set("startHistoryId", historyId);
    url.searchParams.set("historyTypes", "messageAdded");
    url.searchParams.set("maxResults", String(MESSAGES_PER_PAGE));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await gmailFetch<GmailHistoryResponse>(
      url.toString(),
      accessToken,
    );
    if (response.historyId) latestHistoryId = response.historyId;

    for (const historyItem of response.history ?? []) {
      for (const added of historyItem.messagesAdded ?? []) {
        if (added.message?.id) ids.push(added.message.id);
      }
    }

    // Capped the same way the bootstrap path is. Without a bound, a gap in
    // polling — a paused deploy, a run of failures, or a batch of newly joined
    // lists all going live at once — returns thousands of ids in one run, and
    // every downstream stage is sized off this array.
    pageToken =
      ids.length < MAX_HISTORY_MESSAGES ? response.nextPageToken : undefined;
  } while (pageToken);

  return { messageIds: [...new Set(ids)], historyId: latestHistoryId };
}

/**
 * Restricts the first-run bootstrap to mail Gmail already categorizes as
 * bulk/list traffic (its "Forums" and "Updates" tabs), rather than every
 * message in the inbox. Without this, a fresh deployment's first poll
 * ingests whatever personal mail happens to be sitting in the dedicated
 * ingestion inbox alongside real listserv traffic. `fetchMessagesSinceHistory`
 * does not need this: after the first run, ingestion only ever sees messages
 * that arrived after that point, which is a much smaller and more relevant
 * set to begin with.
 */
const BOOTSTRAP_QUERY = "category:forums OR category:updates";

async function fetchRecentMessages(accessToken: string) {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(GMAIL_MESSAGES_URL);
    url.searchParams.set("maxResults", String(MESSAGES_PER_PAGE));
    url.searchParams.set("q", BOOTSTRAP_QUERY);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await gmailFetch<GmailListResponse>(
      url.toString(),
      accessToken,
    );
    ids.push(...(response.messages?.map((message) => message.id) ?? []));
    pageToken =
      ids.length < MAX_BOOTSTRAP_MESSAGES ? response.nextPageToken : undefined;
  } while (pageToken);

  const profile = await gmailFetch<GmailProfileResponse>(
    GMAIL_PROFILE_URL,
    accessToken,
  );
  return { messageIds: [...new Set(ids)], historyId: profile.historyId };
}

async function batchFetchMessages(ids: string[], accessToken: string) {
  const messages: GmailFullMessage[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const boundary = `batch_${crypto.randomUUID()}`;
    const body =
      chunk
        .map(
          (id) =>
            `--${boundary}\r\nContent-Type: application/http\r\n\r\nGET /gmail/v1/users/me/messages/${id}?format=full HTTP/1.1\r\n\r\n`,
        )
        .join("") + `--${boundary}--`;

    const response = await fetch(GMAIL_BATCH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Gmail batch fetch failed (${response.status}): ${await response.text()}`,
      );
    }

    messages.push(...parseBatchResponse(await response.text()));
  }

  return messages;
}

async function gmailFetch<T>(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new GmailApiError(response.status, await response.text());
  }

  return (await response.json()) as T;
}

/**
 * Carries the HTTP status so callers can react to specific failures — notably
 * the 404 Gmail returns for an expired `startHistoryId`.
 */
class GmailApiError extends Error {
  readonly status: number;

  constructor(status: number, body: string) {
    super(`Gmail API error ${status}: ${body}`);
    this.name = "GmailApiError";
    this.status = status;
  }
}

function parseBatchResponse(responseText: string) {
  const results: GmailFullMessage[] = [];
  const parts = responseText.split(/--batch_[^\r\n]+/);

  for (const part of parts) {
    const jsonStart = part.indexOf("{");
    const jsonEnd = part.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) continue;

    try {
      const message = JSON.parse(
        part.slice(jsonStart, jsonEnd + 1),
      ) as GmailFullMessage;
      if (message.id) results.push(message);
    } catch {
      continue;
    }
  }

  return results;
}

function parseGmailMessage(message: GmailFullMessage): ParsedEmail | null {
  if (!message.id) return null;

  const headers = collectHeaders(message.payload);
  const headerMap = new Map(
    headers.map((header) => [header.name.toLowerCase(), header.value]),
  );
  const sender = headerMap.get("from") ?? "";
  const senderEmail = extractEmailAddress(sender);
  const subject = headerMap.get("subject") ?? "";
  const receivedAt =
    parseDate(headerMap.get("date")) ?? parseInternalDate(message.internalDate);
  if (!receivedAt) return null;

  const { text, html } = extractBodies(message.payload);

  return {
    gmailMessageId: message.id,
    threadId: message.threadId,
    sender,
    senderEmail,
    to: extractEmails(headerMap.get("to") ?? ""),
    cc: extractEmails(headerMap.get("cc") ?? ""),
    subject,
    receivedAt,
    bodyText: text,
    bodyHtml: html,
    headers,
  };
}

function collectHeaders(part: GmailMessagePart | undefined) {
  return (part?.headers ?? [])
    .filter((header) => header.name && header.value !== undefined)
    .map((header) => ({ name: header.name ?? "", value: header.value ?? "" }));
}

function matchListserv(
  email: ParsedEmail,
  listservs: MatchableListserv[],
): ListservMatch {
  // A Simplelists confirmation names its list in the sender address
  // (`<LIST>-account-manager@lists.cornell.edu`), so it resolves exactly and
  // is authoritative: we never fall through to the heuristics below for one.
  // Those match on local-part substrings and would happily attribute an
  // ACSU-L confirmation to the unrelated row holding ACSU's own From address.
  const listName = listNameFromConfirmationSender(email.senderEmail);
  const listAddress = listName ? simplelistsAddressForList(listName) : null;
  if (listAddress) {
    // In-memory rather than a `by_list_email` lookup because the candidate set
    // is already loaded; `find` also takes the first of any duplicate rows
    // instead of throwing the way a unique lookup would.
    const exact = listservs.find((listserv) =>
      [listserv.listEmail, ...listserv.senderEmails].some(
        (value) => value.toLowerCase() === listAddress,
      ),
    );
    if (exact) return toMatch(exact);
    return { unknownListAddress: listAddress };
  }

  // Recipients and the sender are kept apart, and recipients win.
  //
  // A student mailing `eship-l@lists.cornell.edu` is *from* a personal address
  // and *to* the list. Folding both into one set meant whichever row happened
  // to come first won, so once a per-student row existed the same list could
  // attribute to a different row from one message to the next. The address a
  // message was sent *to* is the authoritative statement of which list it
  // belongs to; the From address is only a fallback for direct mail that names
  // no list at all.
  const recipientSignals = new Set(
    [
      ...email.to,
      ...email.cc,
      ...extractEmails(headerValue(email.headers, "list-id")),
      ...extractEmails(headerValue(email.headers, "list-unsubscribe")),
      ...extractEmails(headerValue(email.headers, "delivered-to")),
    ].map((value) => value.toLowerCase()),
  );
  const senderSignal = email.senderEmail.toLowerCase();

  // `listEmail` ahead of `senderEmails`: an address recorded as a row's own
  // list address is a stronger claim to the message than the same address
  // showing up in some other row's observed-alias list.
  const byRecipientListEmail = listservs.find((listserv) =>
    recipientSignals.has(listserv.listEmail.toLowerCase()),
  );
  if (byRecipientListEmail) return toMatch(byRecipientListEmail);

  const byRecipientAlias = listservs.find((listserv) =>
    listserv.senderEmails.some((value) =>
      recipientSignals.has(value.toLowerCase()),
    ),
  );
  if (byRecipientAlias) return toMatch(byRecipientAlias);

  // Mail addressed to a Cornell list we have no row for stays unassigned
  // rather than falling through to the From address.
  //
  // `senderEmails` accumulates the personal addresses of everyone who posts to
  // a list, so sender matching would otherwise attribute a student's mail to
  // whichever list they last posted to — even when this message went somewhere
  // else entirely. Leaving it unassigned surfaces the unknown list in the
  // Sources tab, which is the outcome we want.
  if (
    [...recipientSignals].some((recipient) => isCornellListAddress(recipient))
  ) {
    return {};
  }

  const bySender = listservs.find((listserv) =>
    [listserv.listEmail, ...listserv.senderEmails].some(
      (value) => value.toLowerCase() === senderSignal,
    ),
  );
  if (bySender) return toMatch(bySender);

  // Retained for non-Cornell confirmations (Mailchimp, CampusGroups), which
  // have no deterministic list identifier to resolve against.
  const searchable = `${email.subject}\n${email.bodyText}`.toLowerCase();
  if (isJoinConfirmationMail(email)) {
    for (const listserv of listservs) {
      const localParts = [listserv.listEmail, ...listserv.senderEmails]
        .map((value) => value.toLowerCase().split("@")[0])
        .filter(Boolean);
      if (localParts.some((local) => searchable.includes(local))) {
        return toMatch(listserv);
      }
    }
  }

  return {};
}

function toMatch(listserv: MatchableListserv): ListservMatch {
  return { listservId: listserv._id, organizationId: listserv.organizationId };
}

function headerValue(
  headers: Array<{ name: string; value: string }>,
  name: string,
) {
  return (
    headers.find((header) => header.name.toLowerCase() === name)?.value ?? ""
  );
}

function extractEmailAddress(value: string) {
  const angleMatch = value.match(/<([^>]+)>/);
  if (angleMatch) return normalizeEmail(angleMatch[1]);

  const bareMatch = value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (bareMatch) return normalizeEmail(bareMatch[0]);

  return normalizeEmail(value);
}

function extractEmails(value: string) {
  const matches = value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi);
  return matches ? matches.map(normalizeEmail) : [];
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function parseInternalDate(value: string | undefined) {
  if (!value) return null;
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function extractBodies(part: GmailMessagePart | undefined) {
  const out = { text: "", html: "" };
  walkPart(part, out);
  if (!out.text && out.html) out.text = htmlToText(out.html);
  return out;
}

function walkPart(
  part: GmailMessagePart | undefined,
  out: { text: string; html: string },
) {
  if (!part) return;

  const mime = (part.mimeType ?? "").toLowerCase();
  if (part.body?.data && !part.parts?.length) {
    const decoded = decodeBase64Url(part.body.data);
    if (mime === "text/plain" && !out.text) out.text = decoded;
    if (mime === "text/html" && !out.html) out.html = decoded;
    return;
  }

  for (const child of part.parts ?? []) {
    walkPart(child, out);
  }
}

function htmlToText(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/?(p|div|section|article|header|footer|main|li|h[1-6]|blockquote|pre|table|tr|td|th)[^>]*>/gi,
      "\n",
    )
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeBase64Url(encoded: string) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );

  try {
    return new TextDecoder("utf-8").decode(
      Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)),
    );
  } catch {
    return "";
  }
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === "string") return error.slice(0, 500);
  return "Unknown ingestion error.";
}
