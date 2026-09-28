import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { authedQuery } from "./lib/auth";

// Bounds on the per-org scans below. Real data today tops out around 62
// `listservs` rows (Entrepreneurship's mis-attributed personal senders) and
// far fewer messages than this per org — generous enough to be exact in
// practice while still satisfying the no-unbounded-`.collect()` rule.
const MAX_LISTSERVS_PER_ORG = 200;
const MAX_MESSAGES_PER_ORG = 1000;

export type SubscriptionInfo = {
  orgId: Id<"orgs">;
  /**
   * The org's real listserv address, resolved with no domain/pattern
   * guessing:
   *   - exactly one non-paused `listservs` row → that row's `listEmail`
   *   - zero rows → `null` ("No email on file")
   *   - multiple rows → the one marked `isPrimary`, else `null`
   */
  email: string | null;
  /** Real count of ingested emails for this org, not a tag-count proxy. */
  emailsReceived: number;
};

/** Resolves the single canonical listserv email for an org, per the
 * count-based rule described on `SubscriptionInfo.email` — never falls back
 * to `org.email` or fabricates one from `org.slug`. */
async function resolveOrgEmail(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
): Promise<string | null> {
  const rows = await ctx.db
    .query("listservs")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .take(MAX_LISTSERVS_PER_ORG);

  const active: Doc<"listservs">[] = rows.filter(
    (row) => row.status !== "paused",
  );

  if (active.length === 1) {
    return active[0]!.listEmail;
  }
  if (active.length === 0) {
    return null;
  }
  // Multiple rows (e.g. mis-attributed personal senders sharing one org) —
  // only trust an explicitly-marked primary.
  const primary = active.find((row) => row.isPrimary === true);
  return primary?.listEmail ?? null;
}

async function countOrgMessages(
  ctx: QueryCtx,
  orgId: Id<"orgs">,
): Promise<number> {
  const messages = await ctx.db
    .query("listservMessages")
    .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
    .take(MAX_MESSAGES_PER_ORG);
  return messages.length;
}

/**
 * Real subscription display data for the Subscriptions page — the
 * org's actual listserv email (not fabricated from its slug) and a real
 * count of received emails (not `org.tags.length`).
 */
export const getSubscriptionInfoByOrgIds = authedQuery({
  args: { orgIds: v.array(v.id("orgs")) },
  returns: v.array(
    v.object({
      orgId: v.id("orgs"),
      email: v.union(v.string(), v.null()),
      emailsReceived: v.number(),
    }),
  ),
  handler: async (ctx, args): Promise<SubscriptionInfo[]> => {
    const results: SubscriptionInfo[] = [];
    for (const orgId of args.orgIds) {
      const [email, emailsReceived] = await Promise.all([
        resolveOrgEmail(ctx, orgId),
        countOrgMessages(ctx, orgId),
      ]);
      results.push({ orgId, email, emailsReceived });
    }
    return results;
  },
});
