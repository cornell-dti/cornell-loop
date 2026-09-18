import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { type PublicEvent, projectEvent } from "./events";
import { authedMutation, authedQuery } from "./lib/auth";
import { type PublicOrg, projectOrg } from "./orgs";

type HydratedBookmark = {
  bookmark: Doc<"bookmarks">;
  event: PublicEvent;
  orgs: PublicOrg[];
};

type BookmarkPage = {
  page: HydratedBookmark[];
  isDone: boolean;
  continueCursor: string;
};

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

async function findBookmark(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  eventId: Id<"events">,
): Promise<Doc<"bookmarks"> | null> {
  return await ctx.db
    .query("bookmarks")
    .withIndex("by_user_and_event", (q) =>
      q.eq("userId", userId).eq("eventId", eventId),
    )
    .unique();
}

function isPublished(event: Doc<"events">): boolean {
  return event.visibility !== "draft" && event.visibility !== "hidden";
}

export const bookmark = authedMutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (event === null || !isPublished(event)) {
      throw new ConvexError({
        code: "EVENT_NOT_FOUND",
        message: "This event is not available to bookmark.",
      });
    }

    const existing = await findBookmark(ctx, ctx.user._id, args.eventId);
    if (existing !== null) {
      // Idempotent: already bookmarked.
      return null;
    }

    await ctx.db.insert("bookmarks", {
      userId: ctx.user._id,
      eventId: args.eventId,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const unbookmark = authedMutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const existing = await findBookmark(ctx, ctx.user._id, args.eventId);
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const isBookmarked = authedQuery({
  args: { eventId: v.id("events") },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await findBookmark(ctx, ctx.user._id, args.eventId);
    return existing !== null;
  },
});

export const myBookmarks = authedQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<BookmarkPage> => {
    const result = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .order("desc")
      .paginate(args.paginationOpts);

    const hydrated: HydratedBookmark[] = [];
    for (const row of result.page) {
      const event = await ctx.db.get(row.eventId);
      if (event === null) continue;
      if (!isPublished(event)) continue;
      const orgs = await loadOrgsForEvent(ctx, event._id);
      hydrated.push({
        bookmark: row,
        event: projectEvent(event),
        orgs: orgs.map(projectOrg),
      });
    }

    return {
      page: hydrated,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
