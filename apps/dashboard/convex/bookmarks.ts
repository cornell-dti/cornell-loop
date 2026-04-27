import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

type HydratedBookmark = {
  bookmark: Doc<"bookmarks">;
  event: Doc<"events">;
  orgs: Doc<"orgs">[];
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

export const bookmark = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "You must be signed in to bookmark an event.",
      });
    }

    const existing = await findBookmark(ctx, userId, args.eventId);
    if (existing !== null) {
      // Idempotent: already bookmarked.
      return null;
    }

    await ctx.db.insert("bookmarks", {
      userId,
      eventId: args.eventId,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const unbookmark = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "You must be signed in to remove a bookmark.",
      });
    }

    const existing = await findBookmark(ctx, userId, args.eventId);
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const isBookmarked = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return false;
    }
    const existing = await findBookmark(ctx, userId, args.eventId);
    return existing !== null;
  },
});

export const myBookmarks = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args): Promise<BookmarkPage> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

    const result = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);

    const hydrated: HydratedBookmark[] = [];
    for (const row of result.page) {
      const event = await ctx.db.get(row.eventId);
      if (event === null) continue;
      const orgs = await loadOrgsForEvent(ctx, event._id);
      hydrated.push({ bookmark: row, event, orgs });
    }

    return {
      page: hydrated,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
