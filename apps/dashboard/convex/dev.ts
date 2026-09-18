import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation } from "./_generated/server";

// Convex runtime exposes process.env. The dashboard tsconfig (bundler/browser
// types) doesn't include @types/node, so declare the slice we need locally.
declare const process: { env: Record<string, string | undefined> };

/**
 * Fail-closed kill switch for leftover test-session minting. Absence means
 * refuse — including on production, where this env var must stay unset.
 */
function assertTestAuthEnabled(): void {
  if (process.env.TEST_AUTH_ENABLED !== "true") {
    throw new Error("Test auth is not enabled on this deployment.");
  }
}

type SignInForTestResult = {
  token: string;
  refreshToken: string;
  userId: Id<"users">;
};

const signInForTestResultValidator = v.object({
  token: v.string(),
  refreshToken: v.string(),
  userId: v.id("users"),
});

/**
 * Upsert a user by email. Used only by `signInForTest`.
 */
export const ensureUser = internalMutation({
  args: { email: v.string(), name: v.optional(v.string()) },
  returns: v.id("users"),
  handler: async (ctx, args): Promise<Id<"users">> => {
    assertTestAuthEnabled();
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (existing !== null) {
      if (args.name !== undefined && existing.name === undefined) {
        await ctx.db.patch(existing._id, { name: args.name });
      }
      return existing._id;
    }
    return await ctx.db.insert("users", {
      email: args.email,
      name: args.name,
    });
  },
});

/**
 * Wipes profile/follow/bookmark/rsvp rows for the given email so Playwright
 * specs can start from a known onboarding posture. Internal-only; invoke via
 * `bunx convex run internal.dev.resetUserState`.
 */
export const resetUserState = internalMutation({
  args: { email: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    assertTestAuthEnabled();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (user === null) return { ok: true };
    const userId = user._id;

    const profiles = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(50);
    for (const row of profiles) await ctx.db.delete(row._id);

    const follows = await ctx.db
      .query("follows")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(200);
    for (const row of follows) await ctx.db.delete(row._id);

    const bookmarks = await ctx.db
      .query("bookmarks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(200);
    for (const row of bookmarks) await ctx.db.delete(row._id);

    const rsvps = await ctx.db
      .query("rsvps")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(200);
    for (const row of rsvps) await ctx.db.delete(row._id);

    return { ok: true };
  },
});

/**
 * Mints a real Convex Auth session + JWT for the given email. Reachable only
 * via the Convex CLI (`bunx convex run internal.dev.signInForTest`) when
 * TEST_AUTH_ENABLED=true on the deployment.
 */
export const signInForTest = internalAction({
  args: { email: v.string(), name: v.optional(v.string()) },
  returns: signInForTestResultValidator,
  handler: async (ctx, args): Promise<SignInForTestResult> => {
    assertTestAuthEnabled();
    const userId: Id<"users"> = await ctx.runMutation(internal.dev.ensureUser, {
      email: args.email,
      name: args.name,
    });

    const raw = await ctx.runMutation(internal.auth.store, {
      args: {
        type: "signIn",
        userId,
        generateTokens: true,
      },
    });
    if (
      raw === null ||
      typeof raw !== "object" ||
      !("tokens" in raw) ||
      raw.tokens === null ||
      typeof raw.tokens !== "object" ||
      !("token" in raw.tokens) ||
      !("refreshToken" in raw.tokens) ||
      typeof raw.tokens.token !== "string" ||
      typeof raw.tokens.refreshToken !== "string"
    ) {
      throw new ConvexError({
        code: "DEV_ONLY",
        message: "Convex Auth did not return tokens for the test session.",
      });
    }
    return {
      token: raw.tokens.token,
      refreshToken: raw.tokens.refreshToken,
      userId,
    };
  },
});
