import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { type QueryCtx } from "./_generated/server";
import { authedQuery } from "./lib/auth";

/**
 * Public projection of an `orgs` doc. Drops internal/admin-only fields
 * (seed markers, admin org classification, timestamps) that the UI never
 * reads.
 */
export type PublicOrg = Pick<
  Doc<"orgs">,
  | "_id"
  | "slug"
  | "name"
  | "avatarUrl"
  | "description"
  | "tags"
  | "coverImageUrl"
  | "websiteUrl"
  | "email"
  | "isVerified"
  | "loopSummary"
>;

export function projectOrg(org: Doc<"orgs">): PublicOrg {
  return {
    _id: org._id,
    slug: org.slug,
    name: org.name,
    avatarUrl: org.avatarUrl,
    description: org.description,
    tags: org.tags,
    coverImageUrl: org.coverImageUrl,
    websiteUrl: org.websiteUrl,
    email: org.email,
    isVerified: org.isVerified,
    loopSummary: org.loopSummary,
  };
}

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

export const getBySlug = authedQuery({
  args: { slug: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ org: PublicOrg | null; isFollowing: boolean }> => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();

    if (org === null) {
      return { org: null, isFollowing: false };
    }

    const userId = ctx.user._id;
    const isFollowing = await isFollowingOrg(ctx, userId, org._id);
    return { org: projectOrg(org), isFollowing };
  },
});

export const listAll = authedQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (
    ctx,
    args,
  ): Promise<{
    page: PublicOrg[];
    isDone: boolean;
    continueCursor: string;
  }> => {
    const result = await ctx.db
      .query("orgs")
      .filter((q) => q.neq(q.field("orgStatus"), "hidden"))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      page: result.page.map(projectOrg),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const searchOrgs = authedQuery({
  args: { q: v.string() },
  handler: async (ctx, args): Promise<PublicOrg[]> => {
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
    return merged.map(projectOrg);
  },
});

export const listFollowed = authedQuery({
  args: {},
  handler: async (ctx): Promise<PublicOrg[]> => {
    const userId = ctx.user._id;

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
    return orgs.map(projectOrg);
  },
});

export const getSuggestedForOnboarding = authedQuery({
  args: {},
  handler: async (ctx): Promise<PublicOrg[]> => {
    // Placeholder ranking: most recently created orgs.
    // Real tag-overlap ranking lands on a separate branch.
    const orgs = await ctx.db.query("orgs").order("desc").take(12);
    return orgs.map(projectOrg);
  },
});
