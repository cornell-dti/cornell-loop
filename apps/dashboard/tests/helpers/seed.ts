/**
 * Playwright seed helpers — wrap the DEV-gated Convex mutations
 * `dev.triggerSeed` and `dev.triggerClearSeed` so each spec can put the dev
 * deployment into a known state without going through the UI.
 *
 * `clearDb()` and `seedDb()` are both idempotent and safe to call repeatedly:
 *   • `seedDb` is keyed by org slug + (listserv, title) inside `seed.seedAll`.
 *   • `clearDb` only deletes rows tagged `isSeed: true`, so any production-
 *     style data created during tests (e.g. a profile row created by an
 *     onboarding spec) is left alone — those are scrubbed by `resetUserState`
 *     instead.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getConvexUrl } from "./env";

let _client: ConvexHttpClient | null = null;
function client(): ConvexHttpClient {
  if (_client === null) _client = new ConvexHttpClient(getConvexUrl());
  return _client;
}

export async function seedDb(): Promise<void> {
  await client().mutation(api.dev.triggerSeed, {});
}

/**
 * Drains every `isSeed: true` row across the dev DB. The underlying mutation
 * paginates via `scheduler.runAfter` when a batch fills up; we re-run until it
 * reports `done: true` so the test can rely on a fully-empty DB before the
 * next assertion.
 */
export async function clearDb(): Promise<void> {
  // Loop a few times in case the underlying paginated delete reschedules.
  for (let i = 0; i < 10; i += 1) {
    const result = await client().mutation(api.dev.triggerClearSeed, {});
    if (result.done) return;
  }
}

/**
 * Wipes the per-user state (profile / follows / bookmarks / rsvps) for the
 * given email. Lets each spec start with a known onboarding posture for the
 * same test user without churning auth tokens.
 */
export async function resetUserState(email: string): Promise<void> {
  await client().mutation(api.dev.resetUserState, { email });
}

export async function orgIdForSlug(slug: string): Promise<Id<"orgs"> | null> {
  return await client().query(api.dev.triggerOrgIdForSlug, { slug });
}

export async function firstSeedEventId(): Promise<Id<"events"> | null> {
  return await client().query(api.dev.triggerFirstEventId, {});
}
