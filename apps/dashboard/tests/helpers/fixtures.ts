/**
 * Shared Playwright test fixtures.
 *
 * Each test gets:
 *   • A unique-per-suite Cornell email so concurrent specs don't collide on
 *     the same `users` row.
 *   • A `signInAndOnboard` helper that signs the user in, marks them as
 *     onboarded via the API (skipping the wizard for specs that don't test
 *     onboarding directly), and seeds the dev DB if it is empty.
 */

import { test as base, expect as baseExpect } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { getConvexUrl } from "./env";
import { resetUserState, seedDb } from "./seed";
import { signInAs } from "./auth";

export const TEST_USER_EMAIL = "loop-test@cornell.edu";
export const TEST_USER_NAME = "Loop Tester";

/**
 * Hits `users.completeOnboarding` directly so specs that don't exercise the
 * onboarding flow can land on `/home` immediately. Requires a signed-in
 * client; we mint a temporary HTTP client with a real token.
 */
export async function markOnboardedViaApi(token: string): Promise<void> {
  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  await client.mutation(api.users.completeOnboarding, {});
}

export const test = base;
export const expect = baseExpect;

export { signInAs, resetUserState, seedDb };
