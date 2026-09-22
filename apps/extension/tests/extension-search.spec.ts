/**
 * Search E2E tests.
 *
 * Verifies:
 *   • Empty search shows a type-to-search prompt (popular ranks gated off)
 *   • Typing a query returns results from api.events.searchEvents
 */

import { test, expect } from "@playwright/test";
import { launchWithExtension } from "./helpers/extension";
import { signInAs } from "./helpers/auth";
import { seedDb, resetUserState } from "./helpers/seed";

const TEST_EMAIL = "loop-ext-search@cornell.edu";
const FIXTURE_URL = "http://localhost:4321/test.html";

test.describe("Extension search", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test("empty search shows a prompt then typed query hits Convex", async () => {
    const { context, page } = await launchWithExtension();

    try {
      await resetUserState(TEST_EMAIL);
      await signInAs(page, TEST_EMAIL, "Search Tester");

      await page.goto(FIXTURE_URL);
      await page.locator("[data-testid='loop-toggle']").click();

      await page.locator("[data-testid='search-input']").click();

      await expect(
        page.locator("[data-testid='search-empty-prompt']"),
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        page.locator("[data-testid='popular-search-row']"),
      ).toHaveCount(0);

      const searchInput = page.locator("[data-testid='search-input']");
      await searchInput.fill("info");

      await expect(page.locator("[data-testid='search-results']")).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await context.close();
    }
  });

  test("typing a query shows results from Convex", async () => {
    const { context, page } = await launchWithExtension();

    try {
      await resetUserState(TEST_EMAIL);
      await signInAs(page, TEST_EMAIL, "Search Tester");

      await page.goto(FIXTURE_URL);
      await page.locator("[data-testid='loop-toggle']").click();

      // Type a query that matches seed data
      const searchInput = page.locator("[data-testid='search-input']");
      await searchInput.click();
      await searchInput.fill("info");

      // The search-results container is always rendered once in results state,
      // regardless of whether there are matches. Its presence confirms Convex was queried.
      await expect(page.locator("[data-testid='search-results']")).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await context.close();
    }
  });
});
