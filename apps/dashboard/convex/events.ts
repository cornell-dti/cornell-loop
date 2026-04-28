import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";

type FeedSource = "subscribed" | "recommended";

type HydratedEvent = {
  event: Doc<"events">;
  orgs: Doc<"orgs">[];
  isBookmarked: boolean;
  source: FeedSource;
  /** Epoch-ms of the parent email. Used by the extension for 14-day windowing. */
  sentAt?: number;
};

type FeedPage = {
  page: HydratedEvent[];
  isDone: boolean;
  continueCursor: string;
};

// Target floor for the home feed: even if a user follows zero orgs (or all of
// their followed orgs have no upcoming events), we backfill with recommended
// events so the page never renders empty.
const FEED_MIN_ITEMS = 20;
// Bounded pool size when pulling recommended events to dedupe + backfill from.
const RECOMMENDED_POOL_SIZE = 50;
// Bounded scan sizes for the interest-personalised recommendation pass. Kept
// small so the feed query stays cheap; the full ranking model lives on a
// separate branch and will replace this stub.
const RECOMMENDED_ORG_SCAN = 100;
const RECOMMENDED_EVENTS_PER_ORG = 10;

async function loadOrgsForEvent(
  ctx: QueryCtx,
  eventId: Id<"events">,
): Promise<Doc<"orgs">[]> {
  const joins = await ctx.db
    .query("eventOrgs")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(8);

  const orgs: Doc<"orgs">[] = [];
  for (const join of joins) {
    const org = await ctx.db.get(join.orgId);
    if (org !== null) {
      orgs.push(org);
    }
  }
  return orgs;
}

async function isEventBookmarked(
  ctx: QueryCtx,
  userId: Id<"users"> | null,
  eventId: Id<"events">,
): Promise<boolean> {
  if (userId === null) {
    return false;
  }
  const row = await ctx.db
    .query("bookmarks")
    .withIndex("by_user_and_event", (q) =>
      q.eq("userId", userId).eq("eventId", eventId),
    )
    .unique();
  return row !== null;
}

/**
 * Resolves the epoch-ms timestamp of the parent listserv email for an event.
 * Primary: sourceMessageId → listservMessages.receivedAt (ingestion pipeline).
 * Fallback: listservEmailId → listservEmails.sentAt (legacy path).
 */
async function loadSentAt(
  ctx: QueryCtx,
  event: Doc<"events">,
): Promise<number | undefined> {
  if (event.sourceMessageId !== undefined) {
    const msg = await ctx.db.get(event.sourceMessageId);
    if (msg !== null) return msg.receivedAt;
  }
  if (event.listservEmailId !== undefined) {
    const email = await ctx.db.get(event.listservEmailId);
    if (email !== null) return email.sentAt;
  }
  return undefined;
}

/** Returns true for events that should be visible to students. */
function isPublished(event: Doc<"events">): boolean {
  return event.visibility !== "draft" && event.visibility !== "hidden";
}

async function hydrateEvent(
  ctx: QueryCtx,
  event: Doc<"events">,
  userId: Id<"users"> | null,
  source: FeedSource,
): Promise<HydratedEvent> {
  const orgs = await loadOrgsForEvent(ctx, event._id);
  const isBookmarked = await isEventBookmarked(ctx, userId, event._id);
  const sentAt = await loadSentAt(ctx, event);
  return { event, orgs, isBookmarked, source, sentAt };
}

export const feed = query({
  args: {
    paginationOpts: paginationOptsValidator,
    scope: v.optional(v.union(v.literal("all"), v.literal("followed"))),
    // Placeholder filters - ignored for now. Real filtering lands separately.
    tag: v.optional(v.string()),
    timeRange: v.optional(
      v.union(v.literal("upcoming"), v.literal("this_week"), v.literal("past")),
    ),
  },
  handler: async (ctx, args): Promise<FeedPage> => {
    const userId = await getAuthUserId(ctx);
    const scope = args.scope ?? "all";
    const numItems = args.paginationOpts.numItems;
    // Floor the requested page size so a small numItems still yields a feed
    // that never feels empty on the home page.
    const targetItems = Math.max(numItems, FEED_MIN_ITEMS);

    // Helper: recency-ordered pool of published events, used as a fallback
    // when we have no signal to personalise recommendations.
    const fetchRecencyPool = async (
      excluded: ReadonlySet<Id<"events">>,
      limit: number,
    ): Promise<Doc<"events">[]> => {
      const pool = await ctx.db
        .query("events")
        .filter((q) =>
          q.and(
            q.neq(q.field("visibility"), "draft"),
            q.neq(q.field("visibility"), "hidden"),
          ),
        )
        .order("desc")
        .take(RECOMMENDED_POOL_SIZE);
      const out: Doc<"events">[] = [];
      for (const event of pool) {
        if (excluded.has(event._id)) continue;
        out.push(event);
        if (out.length >= limit) break;
      }
      return out;
    };

    const loadInterests = async (
      uid: Id<"users"> | null,
    ): Promise<ReadonlySet<string>> => {
      if (uid === null) return new Set<string>();
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .unique();
      if (profile === null) return new Set<string>();
      return new Set<string>(profile.interests);
    };

    const fetchRecommendedPool = async (
      excluded: ReadonlySet<Id<"events">>,
      limit: number,
    ): Promise<Doc<"events">[]> => {
      const interests = await loadInterests(userId);
      if (interests.size === 0) {
        return await fetchRecencyPool(excluded, limit);
      }

      const orgs = await ctx.db.query("orgs").take(RECOMMENDED_ORG_SCAN);
      const scoredOrgs: { org: Doc<"orgs">; score: number }[] = [];
      for (const org of orgs) {
        let score = 0;
        for (const tag of org.tags) {
          if (interests.has(tag)) score += 1;
        }
        if (score > 0) scoredOrgs.push({ org, score });
      }
      if (scoredOrgs.length === 0) {
        return await fetchRecencyPool(excluded, limit);
      }
      scoredOrgs.sort((a, b) => b.score - a.score);

      // Pull recent events for each scoring org and combine scores
      // (org-tag overlap + event-tag overlap with interests).
      const candidateById = new Map<
        Id<"events">,
        { event: Doc<"events">; score: number }
      >();
      for (const { org, score: orgScore } of scoredOrgs) {
        const joins = await ctx.db
          .query("eventOrgs")
          .withIndex("by_org", (q) => q.eq("orgId", org._id))
          .order("desc")
          .take(RECOMMENDED_EVENTS_PER_ORG);
        for (const join of joins) {
          if (excluded.has(join.eventId)) continue;
          const event = await ctx.db.get(join.eventId);
          if (event === null) continue;
          if (!isPublished(event)) continue;
          let eventTagScore = 0;
          for (const tag of event.tags) {
            if (interests.has(tag)) eventTagScore += 1;
          }
          const total = orgScore + eventTagScore;
          const prev = candidateById.get(event._id);
          if (prev === undefined || prev.score < total) {
            candidateById.set(event._id, { event, score: total });
          }
        }
      }

      const ranked = [...candidateById.values()].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.event._creationTime - a.event._creationTime;
      });
      const personalised = ranked.slice(0, limit).map((r) => r.event);

      if (personalised.length >= limit) return personalised;
      const seen = new Set<Id<"events">>(excluded);
      for (const e of personalised) seen.add(e._id);
      const remaining = limit - personalised.length;
      const recent = await fetchRecencyPool(seen, remaining);
      return [...personalised, ...recent];
    };

    if (scope === "all" || userId === null) {
      const result = await ctx.db
        .query("events")
        .filter((q) =>
          q.and(
            q.neq(q.field("visibility"), "draft"),
            q.neq(q.field("visibility"), "hidden"),
          ),
        )
        .order("desc")
        .paginate(args.paginationOpts);

      const hydrated: HydratedEvent[] = [];
      for (const event of result.page) {
        hydrated.push(await hydrateEvent(ctx, event, userId, "recommended"));
      }
      return {
        page: hydrated,
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }

    // scope === "followed"
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);

    const seenEventIds = new Set<Id<"events">>();
    const subscribedEvents: Doc<"events">[] = [];

    for (const follow of follows) {
      const joins = await ctx.db
        .query("eventOrgs")
        .withIndex("by_org", (q) => q.eq("orgId", follow.orgId))
        .order("desc")
        .take(targetItems);

      for (const join of joins) {
        if (seenEventIds.has(join.eventId)) continue;
        seenEventIds.add(join.eventId);
        const event = await ctx.db.get(join.eventId);
        if (event === null) continue;
        if (!isPublished(event)) continue;
        subscribedEvents.push(event);
      }
    }

    subscribedEvents.sort((a, b) => b._creationTime - a._creationTime);
    const subscribedSlice = subscribedEvents.slice(0, targetItems);

    const remaining = targetItems - subscribedSlice.length;
    const recommendedSlice =
      remaining > 0 ? await fetchRecommendedPool(seenEventIds, remaining) : [];

    const hydrated: HydratedEvent[] = [];
    for (const event of subscribedSlice) {
      hydrated.push(await hydrateEvent(ctx, event, userId, "subscribed"));
    }
    for (const event of recommendedSlice) {
      hydrated.push(await hydrateEvent(ctx, event, userId, "recommended"));
    }

    return {
      page: hydrated,
      isDone: true,
      continueCursor: "",
    };
  },
});

export const getById = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args): Promise<HydratedEvent | null> => {
    const event = await ctx.db.get(args.eventId);
    if (event === null) {
      return null;
    }
    const userId = await getAuthUserId(ctx);
    return await hydrateEvent(ctx, event, userId, "recommended");
  },
});

export const searchEvents = query({
  args: { q: v.string() },
  handler: async (ctx, args): Promise<HydratedEvent[]> => {
    if (args.q.length < 2) {
      return [];
    }

    const byTitle = await ctx.db
      .query("events")
      .withSearchIndex("search_events_title", (q) => q.search("title", args.q))
      .take(20);

    const byDesc = await ctx.db
      .query("events")
      .withSearchIndex("search_events_desc", (q) =>
        q.search("description", args.q),
      )
      .take(20);

    const seen = new Set<Id<"events">>();
    const merged: Doc<"events">[] = [];
    for (const event of [...byTitle, ...byDesc]) {
      if (seen.has(event._id)) continue;
      if (!isPublished(event)) continue;
      seen.add(event._id);
      merged.push(event);
      if (merged.length >= 25) break;
    }

    const userId = await getAuthUserId(ctx);
    const hydrated: HydratedEvent[] = [];
    for (const event of merged) {
      hydrated.push(await hydrateEvent(ctx, event, userId, "recommended"));
    }
    return hydrated;
  },
});

export const byOrg = query({
  args: { slug: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<FeedPage> => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (org === null) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const userId = await getAuthUserId(ctx);

    const joinPage = await ctx.db
      .query("eventOrgs")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .paginate(args.paginationOpts);

    const hydrated: HydratedEvent[] = [];
    for (const join of joinPage.page) {
      const event = await ctx.db.get(join.eventId);
      if (event === null) continue;
      if (!isPublished(event)) continue;
      hydrated.push(await hydrateEvent(ctx, event, userId, "subscribed"));
    }

    return {
      page: hydrated,
      isDone: joinPage.isDone,
      continueCursor: joinPage.continueCursor,
    };
  },
});

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Returns the raw email content for OriginalEmailView.
 * Prefers the ingestion pipeline path (listservMessages); falls back to the
 * legacy listservEmails table. Returns null when no email body is available.
 */
export const getEmailContent = query({
  args: { eventId: v.id("events") },
  handler: async (
    ctx,
    args,
  ): Promise<{ subject: string; paragraphs: string[] } | null> => {
    const event = await ctx.db.get(args.eventId);
    if (event === null) return null;

    if (event.sourceMessageId !== undefined) {
      const msg = await ctx.db.get(event.sourceMessageId);
      if (msg !== null) {
        return {
          subject: msg.subject,
          paragraphs: splitIntoParagraphs(msg.bodyText),
        };
      }
    }

    if (event.listservEmailId !== undefined) {
      const email = await ctx.db.get(event.listservEmailId);
      if (email !== null) {
        const raw = email.rawText ?? email.rawHtml ?? "";
        return {
          subject: event.title,
          paragraphs: splitIntoParagraphs(raw),
        };
      }
    }

    return null;
  },
});
