import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";

async function isFollowingOrg(
  ctx: QueryCtx,
  userId: Id<"users">,
  orgId: Id<"orgs">,
): Promise<boolean> {
  const row = await ctx.db
    .query("follows")
    .withIndex("by_user_and_org", (q) =>
      q.eq("userId", userId).eq("orgId", orgId),
    )
    .unique();
  return row !== null;
}

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ org: Doc<"orgs"> | null; isFollowing: boolean }> => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (org === null) {
      return { org: null, isFollowing: false };
    }

    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { org, isFollowing: false };
    }

    const isFollowing = await isFollowingOrg(ctx, userId, org._id);
    return { org, isFollowing };
  },
});

export const listAll = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orgs")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const searchOrgs = query({
  args: { q: v.string() },
  handler: async (ctx, args): Promise<Doc<"orgs">[]> => {
    if (args.q.length < 2) {
      return [];
    }

    const byName = await ctx.db
      .query("orgs")
      .withSearchIndex("search_orgs_name", (q) => q.search("name", args.q))
      .take(20);

    const byDesc = await ctx.db
      .query("orgs")
      .withSearchIndex("search_orgs_desc", (q) =>
        q.search("description", args.q),
      )
      .take(20);

    const seen = new Set<Id<"orgs">>();
    const merged: Doc<"orgs">[] = [];
    for (const org of [...byName, ...byDesc]) {
      if (seen.has(org._id)) continue;
      seen.add(org._id);
      merged.push(org);
      if (merged.length >= 25) break;
    }
    return merged;
  },
});

export const listFollowed = query({
  args: {},
  handler: async (ctx): Promise<Doc<"orgs">[]> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    const follows = await ctx.db
      .query("follows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);

    const sorted = [...follows].sort((a, b) => b.createdAt - a.createdAt);

    const orgs: Doc<"orgs">[] = [];
    for (const follow of sorted) {
      const org = await ctx.db.get(follow.orgId);
      if (org !== null) {
        orgs.push(org);
      }
    }
    return orgs;
  },
});

export const getSuggestedForOnboarding = query({
  args: {},
  handler: async (ctx): Promise<Doc<"orgs">[]> => {
    // Placeholder ranking: most recently created orgs.
    // Real tag-overlap ranking lands on a separate branch.
    const orgs = await ctx.db.query("orgs").order("desc").take(12);
    return orgs;
  },
});
