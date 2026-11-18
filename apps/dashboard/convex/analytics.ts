/**
 * Server-side PostHog capture.
 *
 * `account_created` has to come from the server. The client can't tell a first
 * sign-in from any other one — by the time React mounts, the user row already
 * exists — whereas `createOrUpdateUser` in `auth.ts` runs exactly once per
 * account. Scheduling from there gives a signup count that can't drift.
 *
 * Events are posted with plain `fetch` rather than `posthog-node` so this
 * stays in Convex's default runtime: no `"use node"`, no cold starts, and no
 * SDK background flush queue to reason about in a short-lived action.
 *
 * `distinct_id` is the Convex user id, matching `posthog.identify()` on the
 * client so server and browser events land on the same person. No email or
 * name is ever sent.
 */

import { v } from "convex/values";
import {
  internalAction,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";

// Convex exposes process.env, but the dashboard tsconfig has no @types/node.
declare const process: { env: Record<string, string | undefined> };

const DEFAULT_HOST = "https://us.i.posthog.com";

interface PostHogConfig {
  key: string;
  host: string;
}

/**
 * Returns null when no key is configured, which is the normal state for a
 * fresh dev deployment. Analytics is never allowed to fail a signup, so every
 * caller treats null as "skip".
 */
function posthogConfig(): PostHogConfig | null {
  const key = process.env.POSTHOG_KEY;
  if (typeof key !== "string" || key.length === 0) return null;
  const host = process.env.POSTHOG_HOST;
  return {
    key,
    host: (typeof host === "string" && host.length > 0
      ? host
      : DEFAULT_HOST
    ).replace(/\/$/, ""),
  };
}

interface CaptureEvent {
  event: string;
  distinctId: string;
  properties: Record<string, string | number | boolean>;
  timestampMs: number;
}

async function sendBatch(
  config: PostHogConfig,
  events: CaptureEvent[],
  /**
   * Tells PostHog the timestamps are deliberately in the past. Without it,
   * backfilled events are treated as live and distort "new users today".
   */
  historical: boolean,
): Promise<void> {
  if (events.length === 0) return;

  const response = await fetch(`${config.host}/batch/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: config.key,
      historical_migration: historical,
      batch: events.map((e) => ({
        event: e.event,
        distinct_id: e.distinctId,
        timestamp: new Date(e.timestampMs).toISOString(),
        properties: { ...e.properties, platform: "server" },
      })),
    }),
  });

  if (!response.ok) {
    // Thrown so the failure is visible in Convex logs. The caller is always a
    // scheduled action, so nothing user-facing is affected.
    throw new Error(
      `PostHog capture failed: ${response.status} ${await response.text()}`,
    );
  }
}

/**
 * Scheduled from `createOrUpdateUser` the moment a new `users` row is
 * inserted.
 */
export const captureAccountCreated = internalAction({
  args: {
    userId: v.id("users"),
    createdAtMs: v.number(),
  },
  handler: async (_ctx: ActionCtx, args): Promise<null> => {
    const config = posthogConfig();
    if (config === null) return null;

    await sendBatch(
      config,
      [
        {
          event: "account_created",
          distinctId: args.userId,
          properties: { signup_method: "google" },
          timestampMs: args.createdAtMs,
        },
      ],
      false,
    );
    return null;
  },
});

// ─── One-off backfill ────────────────────────────────────────────────────────

const BACKFILL_PAGE_SIZE = 100;

export const listUsersForBackfill = internalQuery({
  args: {
    cursor: v.union(v.string(), v.null()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("users")
      .paginate({ numItems: args.limit, cursor: args.cursor });
    return {
      users: page.page.map((user: Doc<"users">) => ({
        id: user._id,
        createdAtMs: user._creationTime,
      })),
      cursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});

/**
 * Backfills `account_created` for everyone who signed up before analytics
 * existed, stamped with their real signup time.
 *
 * Without this the acquisition funnel starts empty and every existing user
 * looks like they never had an account. Run once, manually, after the
 * PostHog keys are set:
 *
 *   npx convex run --prod analytics:backfillAccountCreated '{}'
 *
 * Re-running duplicates events — PostHog does not dedupe on its own — so
 * treat it as a single-shot migration.
 */
export const backfillAccountCreated = internalAction({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx: ActionCtx, args): Promise<{ sent: number }> => {
    const config = posthogConfig();
    if (config === null) return { sent: 0 };

    let cursor: string | null = args.cursor ?? null;
    let sent = 0;

    for (;;) {
      const page: {
        users: { id: string; createdAtMs: number }[];
        cursor: string;
        isDone: boolean;
      } = await ctx.runQuery(internal.analytics.listUsersForBackfill, {
        cursor,
        limit: BACKFILL_PAGE_SIZE,
      });

      await sendBatch(
        config,
        page.users.map((user) => ({
          event: "account_created",
          distinctId: user.id,
          properties: { signup_method: "google", backfilled: true },
          timestampMs: user.createdAtMs,
        })),
        true,
      );
      sent += page.users.length;

      if (page.isDone) break;
      cursor = page.cursor;
    }

    return { sent };
  },
});
