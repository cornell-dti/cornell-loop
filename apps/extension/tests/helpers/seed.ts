/**
 * Seed helpers for extension Playwright tests.
 * Thin wrappers around the dashboard dev mutations — the extension shares the
 * same Convex deployment so the same seed data is visible to both.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../dashboard/convex/_generated/api";
import { getConvexUrl } from "./env";

let _client: ConvexHttpClient | null = null;
function client(): ConvexHttpClient {
  if (_client === null) _client = new ConvexHttpClient(getConvexUrl());
  return _client;
}

/** Idempotently inserts seed orgs and events. */
export async function seedDb(): Promise<void> {
  await client().mutation(api.dev.triggerSeed, {});
}

/** Removes all isSeed: true rows without touching real data. */
export async function clearDb(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    const result = await client().mutation(api.dev.triggerClearSeed, {});
    if (result.done) return;
  }
}

/** Wipes per-user state (profile / follows / bookmarks / rsvps) for the email. */
export async function resetUserState(email: string): Promise<void> {
  await client().mutation(api.dev.resetUserState, { email });
}
