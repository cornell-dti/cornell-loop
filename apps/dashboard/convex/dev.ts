import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

// Convex runtime exposes process.env. The dashboard tsconfig (bundler/browser
// types) doesn't include @types/node, so declare the slice we need locally.
declare const process: { env: Record<string, string | undefined> };

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Throws if the current Convex deployment explicitly identifies itself as prod.
 * Convex does not automatically expose the local `.env.local` deployment marker
 * to function runtime env, so an unset value must still be allowed for dev.
 */
function assertDev(): void {
  const deployment = process.env.CONVEX_DEPLOYMENT;
  if (deployment?.startsWith("prod:")) {
    throw new ConvexError({
      code: "DEV_ONLY",
      message: "Refusing to run dev mutation against a production deployment.",
    });
  }
}

type SeedSummary = {
  listservEmails: number;
  orgs: number;
  events: number;
  eventOrgs: number;
};

export const triggerSeed = mutation({
  args: {},
  handler: async (ctx): Promise<SeedSummary> => {
    assertDev();
    const summary: SeedSummary = await ctx.runMutation(
      internal.seed.seedAll,
      {},
    );
    return summary;
  },
});

/**
 * Public-but-DEV-gated wrapper around `seed.clearSeed`. Used by Playwright
 * fixtures via `ConvexHttpClient` so each spec can start from a known empty
 * state (real data has no `isSeed: true` rows so clearing is safe in dev).
 */
export const triggerClearSeed = mutation({
  args: {},
  handler: async (ctx): Promise<{ done: boolean; deleted: number }> => {
    assertDev();
    return await ctx.runMutation(internal.seed.clearSeed, {});
  },
});

/**
 * Inserts a row in `users` with the given email if no row by_email exists.
 * Returns the userId either way. Used only by Playwright fixtures via
 * ConvexHttpClient.
 *
 * NOTE: This only creates the user row; it does NOT create an auth session.
 * Use `createSession` next to mint a session for tests. Phase 3G will wire
 * these into a Playwright helper that injects the session token.
 */
export const fakeSignIn = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<Id<"users">> => {
    assertDev();
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email))
      .unique();
    if (existing !== null) {
      return existing._id;
    }
    return await ctx.db.insert("users", {
      email: args.email,
    });
  },
});

/**
 * Creates an `authSessions` row for the given user with a 30-day expiration.
 * Phase 3G will combine this with @convex-dev/auth's token machinery (or a
 * direct refresh-token mint) to fully authenticate Playwright requests.
 */
export const createSession = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Id<"authSessions">> => {
    assertDev();
    return await ctx.db.insert("authSessions", {
      userId: args.userId,
      expirationTime: Date.now() + SESSION_DURATION_MS,
    });
  },
});

/**
 * Internal mutation to upsert a Cornell user by email. Used by the
 * `signInForTest` action below. Returns the user id.
 */
export const ensureUser = internalMutation({
  args: { email: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<"users">> => {
    assertDev();
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
 * Wipes all profile/follow/bookmark/rsvp rows belonging to the given user.
 * Lets each spec start from a "fresh" onboarding state for the same user.
 */
export const resetUserState = mutation({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    assertDev();
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

type SignInForTestResult = {
  token: string;
  refreshToken: string;
  userId: Id<"users">;
};

/**
 * Internal action that mints a real Convex Auth session + JWT for the given
 * email. Implementation strategy:
 *   1. Ensure a `users` row exists for the email.
 *   2. Call the Convex Auth `auth:store` internal mutation with
 *      `{ type: "signIn", userId, generateTokens: true }` — this creates an
 *      `authSessions` row and an `authRefreshTokens` row, then signs an RS256
 *      JWT scoped to that session using the same key the live OAuth flow uses.
 *
 * The Playwright auth helper writes the returned JWT + refresh token into
 * `localStorage` under the keys @convex-dev/auth's React provider expects, so
 * subsequent `useQuery`/`useMutation` calls run as the authenticated user.
 *
 * This is gated behind `assertDev()` so it can never run against a production
 * deployment.
 */
export const signInForTest = internalAction({
  args: { email: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, args): Promise<SignInForTestResult> => {
    assertDev();
    const userId: Id<"users"> = await ctx.runMutation(internal.dev.ensureUser, {
      email: args.email,
      name: args.name,
    });

    // The convexAuth() helper registers `store` as an internal mutation under
    // the `auth` module. From an action we can call it via `ctx.runMutation`.
    // The shape of the response is `{ userId, sessionId, tokens: { token,
    // refreshToken } | null }` — see
    // node_modules/@convex-dev/auth/dist/server/implementation/sessions.js.
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

/**
 * Internal dev-gated action that wraps `signInForTest`. Previously a public
 * `action` callable from Playwright fixtures; converted to `internalAction` so
 * it cannot be invoked over the public API. The higher-level public entry
 * point `triggerDevAutoLogin` is the supported wrapper for browser-side dev
 * auto-login flows.
 */
export const testSignIn = internalAction({
  args: { email: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, args): Promise<SignInForTestResult> => {
    assertDev();
    return await ctx.runAction(internal.dev.signInForTest, {
      email: args.email,
      name: args.name,
    });
  },
});

/**
 * Internal convenience query: look up an org id by slug. Previously public so
 * Playwright fixtures could call it directly; converted to `internalQuery` to
 * prevent dev surface area from leaking onto the public API. Callers should
 * route through a public dev-gated wrapper if direct API access is needed.
 */
export const orgIdForSlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<Id<"orgs"> | null> => {
    const org = await ctx.db
      .query("orgs")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return org?._id ?? null;
  },
});

/**
 * Internal query: returns the first seeded event id. Previously public so
 * tests could fetch a stable event id without walking the UI; converted to
 * `internalQuery` to keep dev helpers off the public API surface.
 */
export const firstEventId = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"events"> | null> => {
    const row: Doc<"events"> | null = await ctx.db
      .query("events")
      .withIndex("by_seed", (q) => q.eq("isSeed", true))
      .order("desc")
      .first();
    return row?._id ?? null;
  },
});

/**
 * Public DEV-gated wrappers around the internal dev helpers above. Playwright
 * fixtures call these over `ConvexHttpClient` to drive auth + lookups; routing
 * through these shims keeps the actual token-minting and seed-probing logic on
 * the internal API surface (so it cannot be invoked directly from a public
 * client) while still letting the test harness drive the supported flows.
 */
export const triggerTestSignIn = action({
  args: { email: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, args): Promise<SignInForTestResult> => {
    assertDev();
    return await ctx.runAction(internal.dev.testSignIn, {
      email: args.email,
      name: args.name,
    });
  },
});

export const triggerOrgIdForSlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args): Promise<Id<"orgs"> | null> => {
    assertDev();
    return await ctx.runQuery(internal.dev.orgIdForSlug, { slug: args.slug });
  },
});

export const triggerFirstEventId = query({
  args: {},
  handler: async (ctx): Promise<Id<"events"> | null> => {
    assertDev();
    return await ctx.runQuery(internal.dev.firstEventId, {});
  },
});

const DEV_FIXTURE_FOLLOW_SLUGS = ["wicc", "acsu", "fintech", "brr"] as const;

const DEV_FIXTURE_PROFILE = {
  major: "Computer Science",
  gradYear: "2027",
  minor: "Linguistics",
  interests: ["Tech", "Career", "Just for Fun"],
} as const;

/**
 * Internal mutation: ensures the given user has a complete onboarded profile,
 * follows a small set of seeded orgs, and has a couple of bookmarks. Idempotent.
 * Called by `triggerDevAutoLogin` to populate the dev fixture user so the app
 * has interesting content without manual onboarding.
 */
export const seedDevUserStateInternal = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    assertDev();
    const userId = args.userId;
    const now = Date.now();

    // Profile
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existingProfile === null) {
      await ctx.db.insert("userProfiles", {
        userId,
        major: DEV_FIXTURE_PROFILE.major,
        gradYear: DEV_FIXTURE_PROFILE.gradYear,
        minor: DEV_FIXTURE_PROFILE.minor,
        interests: [...DEV_FIXTURE_PROFILE.interests],
        onboardingCompletedAt: now,
      });
    } else if (existingProfile.onboardingCompletedAt === undefined) {
      await ctx.db.patch(existingProfile._id, {
        onboardingCompletedAt: now,
      });
    }

    // Follows for seeded orgs
    for (const slug of DEV_FIXTURE_FOLLOW_SLUGS) {
      const org = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (org === null) continue;
      const existing = await ctx.db
        .query("follows")
        .withIndex("by_user_and_org", (q) =>
          q.eq("userId", userId).eq("orgId", org._id),
        )
        .unique();
      if (existing !== null) continue;
      await ctx.db.insert("follows", {
        userId,
        orgId: org._id,
        createdAt: now,
      });
    }

    // Bookmarks: bookmark first two seeded events tied to followed orgs
    const events = await ctx.db
      .query("events")
      .withIndex("by_seed", (q) => q.eq("isSeed", true))
      .order("desc")
      .take(2);
    for (const evt of events) {
      const existing = await ctx.db
        .query("bookmarks")
        .withIndex("by_user_and_event", (q) =>
          q.eq("userId", userId).eq("eventId", evt._id),
        )
        .unique();
      if (existing !== null) continue;
      await ctx.db.insert("bookmarks", {
        userId,
        eventId: evt._id,
        createdAt: now,
      });
    }
  },
});

type DevAutoLoginResult = {
  token: string;
  refreshToken: string;
  userId: Id<"users">;
};

/**
 * Public DEV-gated action used by the frontend `DevAutoSignIn` component.
 * One-call setup for a developer hitting the app locally without going through
 * Google OAuth:
 *   1. Ensures the seed data is loaded (idempotent — no-op if already present).
 *   2. Signs in a fixture user (`dev@cornell.edu` by default) and mints real
 *      Convex Auth tokens.
 *   3. Populates that user's profile + follows + bookmarks so the feed,
 *      Subscriptions, and Bookmarks pages all have content immediately.
 *
 * Refuses to run against production deployments.
 */
export const triggerDevAutoLogin = action({
  args: { email: v.optional(v.string()), name: v.optional(v.string()) },
  handler: async (ctx, args): Promise<DevAutoLoginResult> => {
    assertDev();
    const email = args.email ?? "dev@cornell.edu";
    const name = args.name ?? "Dev User";

    // 1. Ensure seed data exists. seed:seedAll is idempotent.
    await ctx.runMutation(internal.seed.seedAll, {});

    // 2. Mint real auth tokens for the fixture user.
    const session: DevAutoLoginResult = await ctx.runAction(
      internal.dev.signInForTest,
      { email, name },
    );

    // 3. Populate that user's profile + follows + bookmarks.
    await ctx.runMutation(internal.dev.seedDevUserStateInternal, {
      userId: session.userId,
    });

    return session;
  },
});
