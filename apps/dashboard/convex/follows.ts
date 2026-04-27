import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

async function findFollow(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  orgId: Id<"orgs">,
) {
  return await ctx.db
    .query("follows")
    .withIndex("by_user_and_org", (q) =>
      q.eq("userId", userId).eq("orgId", orgId),
    )
    .unique();
}

export const follow = mutation({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "You must be signed in to follow an org.",
      });
    }

    const existing = await findFollow(ctx, userId, args.orgId);
    if (existing !== null) {
      return null;
    }

    await ctx.db.insert("follows", {
      userId,
      orgId: args.orgId,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const unfollow = mutation({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "You must be signed in to unfollow an org.",
      });
    }

    const existing = await findFollow(ctx, userId, args.orgId);
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const isFollowing = query({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, args): Promise<boolean> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return false;
    }
    const existing = await findFollow(ctx, userId, args.orgId);
    return existing !== null;
  },
});

export const myFollows = query({
  args: {},
  handler: async (ctx): Promise<Id<"orgs">[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    const rows = await ctx.db
      .query("follows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);

    return rows.map((row) => row.orgId);
  },
});
