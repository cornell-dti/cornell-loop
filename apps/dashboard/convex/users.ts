import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

const ALLOWED_EMAIL_DOMAIN = "@cornell.edu";

type CurrentUserResult = {
  user: Doc<"users"> | null;
  profile: Doc<"userProfiles"> | null;
  isOnboarded: boolean;
  rejectedDomain: boolean;
};

async function loadProfile(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"userProfiles"> | null> {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

function isCornellEmail(email: string | undefined): boolean {
  return (
    typeof email === "string" &&
    email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)
  );
}

export const currentUser = query({
  args: {},
  handler: async (ctx): Promise<CurrentUserResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return {
        user: null,
        profile: null,
        isOnboarded: false,
        rejectedDomain: false,
      };
    }

    const user = await ctx.db.get(userId);
    if (user === null) {
      return {
        user: null,
        profile: null,
        isOnboarded: false,
        rejectedDomain: false,
      };
    }

    if (!isCornellEmail(user.email)) {
      return {
        user,
        profile: null,
        isOnboarded: false,
        rejectedDomain: true,
      };
    }

    const profile = await loadProfile(ctx, userId);
    const isOnboarded =
      profile !== null && typeof profile.onboardingCompletedAt === "number";

    return {
      user,
      profile,
      isOnboarded,
      rejectedDomain: false,
    };
  },
});

export const updateProfile = mutation({
  args: {
    major: v.optional(v.string()),
    gradYear: v.optional(v.string()),
    minor: v.optional(v.string()),
    interests: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "You must be signed in to update your profile.",
      });
    }

    const user = await ctx.db.get(userId);
    if (user === null || !isCornellEmail(user.email)) {
      throw new ConvexError({
        code: "NON_CORNELL_EMAIL",
        message: "Loop is open to Cornell students only.",
      });
    }

    const existing = await loadProfile(ctx, userId);

    const nextMajor = args.major !== undefined ? args.major : existing?.major;
    const nextInterests =
      args.interests !== undefined
        ? args.interests
        : (existing?.interests ?? []);

    const shouldCompleteOnboarding =
      (existing === null || existing.onboardingCompletedAt === undefined) &&
      typeof nextMajor === "string" &&
      nextMajor.length > 0 &&
      nextInterests.length > 0;

    if (existing === null) {
      await ctx.db.insert("userProfiles", {
        userId,
        major: args.major,
        gradYear: args.gradYear,
        minor: args.minor,
        interests: args.interests ?? [],
        onboardingCompletedAt: shouldCompleteOnboarding
          ? Date.now()
          : undefined,
      });
      return null;
    }

    const patch: Partial<Doc<"userProfiles">> = {};
    if (args.major !== undefined) patch.major = args.major;
    if (args.gradYear !== undefined) patch.gradYear = args.gradYear;
    if (args.minor !== undefined) patch.minor = args.minor;
    if (args.interests !== undefined) patch.interests = args.interests;
    if (shouldCompleteOnboarding) patch.onboardingCompletedAt = Date.now();

    await ctx.db.patch(existing._id, patch);
    return null;
  },
});

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "You must be signed in to complete onboarding.",
      });
    }

    const user = await ctx.db.get(userId);
    if (user === null || !isCornellEmail(user.email)) {
      throw new ConvexError({
        code: "NON_CORNELL_EMAIL",
        message: "Loop is open to Cornell students only.",
      });
    }

    const existing = await loadProfile(ctx, userId);
    const now = Date.now();

    if (existing === null) {
      await ctx.db.insert("userProfiles", {
        userId,
        interests: [],
        onboardingCompletedAt: now,
      });
      return null;
    }

    await ctx.db.patch(existing._id, { onboardingCompletedAt: now });
    return null;
  },
});
