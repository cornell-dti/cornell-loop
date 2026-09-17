import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/auth";

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

export const follow = authedMutation({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, args) => {
    const existing = await findFollow(ctx, ctx.user._id, args.orgId);
    if (existing !== null) {
      return null;
    }

    await ctx.db.insert("follows", {
      userId: ctx.user._id,
      orgId: args.orgId,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const unfollow = authedMutation({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, args) => {
    const existing = await findFollow(ctx, ctx.user._id, args.orgId);
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const isFollowing = authedQuery({
  args: { orgId: v.id("orgs") },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await findFollow(ctx, ctx.user._id, args.orgId);
    return existing !== null;
  },
});

export const myFollows = authedQuery({
  args: {},
  handler: async (ctx): Promise<Id<"orgs">[]> => {
    const rows = await ctx.db
      .query("follows")
      .withIndex("by_user", (q) => q.eq("userId", ctx.user._id))
      .take(100);

    return rows.map((row) => row.orgId);
  },
});
