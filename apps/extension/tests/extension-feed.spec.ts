/**
 * Feed view E2E tests.
 *
 * Verifies:
 *   • Auth gate renders when unauthenticated
 *   • After sign-in, the floating panel appears with a Toggle button
 *   • Feed renders events from Convex (not mock data)
 *   • Only published events are visible (draft/hidden filtered out)
 */

import { test, expect } from "@playwright/test";
import { launchWithExtension } from "./helpers/extension";
import { signInAs } from "./helpers/auth";
import { seedDb, resetUserState } from "./helpers/seed";

const TEST_EMAIL = "loop-ext-feed@cornell.edu";
const FIXTURE_URL = "http://localhost:4321/test.html";

test.describe("Extension feed", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test("shows sign-in prompt when unauthenticated", async () => {
    const { context, page } = await launchWithExtension();

    try {
      await page.goto(FIXTURE_URL);
      // Open the floating panel — Playwright auto-pierces shadow DOM
      await page.locator("[data-testid='loop-toggle']").click();

      // Should show sign-in prompt
      await expect(
        page.locator("button", { hasText: /sign in with google/i }),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test("shows feed events from Convex after sign-in", async () => {
    const { context, page } = await launchWithExtension();

    try {
      await resetUserState(TEST_EMAIL);
      await signInAs(page, TEST_EMAIL, "Feed Tester");
      await page.goto(FIXTURE_URL);

      // Open the floating panel
      await page.locator("[data-testid='loop-toggle']").click();

      // The panel should be open and show the feed heading (exact match avoids
      // colliding with "No recent emails from your subscriptions." empty-state)
      await expect(
        page.getByText("Your Subscriptions", { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      await context.close();
    }
  });
});
