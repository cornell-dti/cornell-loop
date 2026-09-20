/**
 * Playwright seed helpers. Seed/clear run through the Convex CLI (deploy key)
 * against internal `seed:*` mutations. Per-user reset uses
 * `internal.dev.resetUserState`, which requires TEST_AUTH_ENABLED on the
 * dev deployment.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { convexRun } from "./convexRun";
import { getConvexUrl } from "./env";

/**
 * `orgs.getBySlug` / `events.byOrg` are `authedQuery` (anonymous reads are
 * locked), so these lookup helpers need a signed-in caller's token — pass the
 * `token` returned by `signInAs`.
 */
function authedClient(token: string): ConvexHttpClient {
  const c = new ConvexHttpClient(getConvexUrl());
  c.setAuth(token);
  return c;
}

function isClearSeedResult(
  value: unknown,
): value is { done: boolean; deleted: number } {
  if (typeof value !== "object" || value === null) return false;
  if (!("done" in value) || !("deleted" in value)) return false;
  return typeof value.done === "boolean" && typeof value.deleted === "number";
}

export async function seedDb(): Promise<void> {
  await convexRun("seed:seedAll", {});
}

/**
 * Drains every `isSeed: true` row across the dev DB. The underlying mutation
 * paginates via `scheduler.runAfter` when a batch fills up; we re-run until it
 * reports `done: true` so the test can rely on a fully-empty DB before the
 * next assertion.
 */
export async function clearDb(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    const result = await convexRun("seed:clearSeed", {});
    if (!isClearSeedResult(result)) {
      throw new Error("seed:clearSeed returned an unexpected value");
    }
    if (result.done) return;
  }
}

/**
 * Wipes the per-user state (profile / follows / bookmarks / rsvps) for the
 * given email. Lets each spec start with a known onboarding posture for the
 * same test user without churning auth tokens.
 */
export async function resetUserState(email: string): Promise<void> {
  await convexRun("internal.dev.resetUserState", { email });
}

export async function orgIdForSlug(
  token: string,
  slug: string,
): Promise<Id<"orgs"> | null> {
  const result = await authedClient(token).query(api.orgs.getBySlug, {
    slug,
  });
  if (result.org === null) return null;
  return result.org._id;
}

export async function firstSeedEventId(
  token: string,
): Promise<Id<"events"> | null> {
  const page = await authedClient(token).query(api.events.byOrg, {
    slug: "wicc",
    paginationOpts: { numItems: 1, cursor: null },
  });
  const first = page.page[0];
  if (first === undefined) return null;
  return first.event._id;
}
