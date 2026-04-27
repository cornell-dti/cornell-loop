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

async function hydrateEvent(
  ctx: QueryCtx,
  event: Doc<"events">,
  userId: Id<"users"> | null,
  source: FeedSource,
): Promise<HydratedEvent> {
  const orgs = await loadOrgsForEvent(ctx, event._id);
  const isBookmarked = await isEventBookmarked(ctx, userId, event._id);
  return { event, orgs, isBookmarked, source };
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

    // Helper: recency-ordered pool, used as a fallback when we have no signal
    // to personalise recommendations (signed-out, no profile, no matching
    // interests). Bounded by RECOMMENDED_POOL_SIZE.
    const fetchRecencyPool = async (
      excluded: ReadonlySet<Id<"events">>,
      limit: number,
    ): Promise<Doc<"events">[]> => {
      const pool = await ctx.db
        .query("events")
        .withIndex("by_creation_time")
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

    // Pull the user's profile so we can rank recommendations by interest
    // overlap with org and event tags. Major / gradYear are not used as ranking
    // signals yet — the production algo lives on a separate branch and will
    // factor in major + cohort + collaborative filtering.
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

    // Helper: build a pool of recommended events ranked by interest tag overlap
    // with the user's profile. Falls back to recency when the profile is empty
    // or no orgs match.
    const fetchRecommendedPool = async (
      excluded: ReadonlySet<Id<"events">>,
      limit: number,
    ): Promise<Doc<"events">[]> => {
      const interests = await loadInterests(userId);
      if (interests.size === 0) {
        return await fetchRecencyPool(excluded, limit);
      }

      // Bounded scan of orgs; score each by tag overlap with interests.
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

      // Backfill with recency if we still came up short.
      if (personalised.length >= limit) return personalised;
      const seen = new Set<Id<"events">>(excluded);
      for (const e of personalised) seen.add(e._id);
      const remaining = limit - personalised.length;
      const recent = await fetchRecencyPool(seen, remaining);
      return [...personalised, ...recent];
    };

    // "all" scope or signed-out: paginate over all events with by_creation_time
    // ordering, then opportunistically backfill the first page with
    // recommended events if the page comes up short. We tag every event with
    // source = "recommended" because the user has no follow context.
    if (scope === "all" || userId === null) {
      const result = await ctx.db
        .query("events")
        .withIndex("by_creation_time")
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

    // scope === "followed": gather events from followed orgs first, then
    // backfill with recommended events so the home feed is never empty.
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
        if (event !== null) {
          subscribedEvents.push(event);
        }
      }
    }

    // Recency-rank subscribed events and trim to the page target.
    subscribedEvents.sort((a, b) => b._creationTime - a._creationTime);
    const subscribedSlice = subscribedEvents.slice(0, targetItems);

    // Backfill: if the subscribed slice is below the floor, pull recommended
    // events from the global recency pool, dedupe against subscribed ids, and
    // pad up to targetItems. Subscribed events render first.
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

    // Followed-scope is a single-page snapshot: ranking + cursor pagination
    // for the subscribed/recommended union lands with the recommendation algo
    // branch. Mark the page as done so the client doesn't try to advance.
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
      // Org page: every event is "subscribed" from the org's perspective.
      hydrated.push(await hydrateEvent(ctx, event, userId, "subscribed"));
    }

    return {
      page: hydrated,
      isDone: joinPage.isDone,
      continueCursor: joinPage.continueCursor,
    };
  },
});
