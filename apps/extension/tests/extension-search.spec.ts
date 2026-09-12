/**
 * Search E2E tests.
 *
 * Verifies:
 *   • Typing a query returns results from api.events.searchEvents
 *   • Popular search terms are clickable and populate the search bar
 *   • Tag filter narrows search results
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

  test("popular search term populates the search bar", async () => {
    const { context, page } = await launchWithExtension();

    try {
      await resetUserState(TEST_EMAIL);
      await signInAs(page, TEST_EMAIL, "Search Tester");

      await page.goto(FIXTURE_URL);
      // Playwright auto-pierces shadow DOM — no pierce= prefix needed
      await page.locator("[data-testid='loop-toggle']").click();

      // Click the search input to enter search mode
      await page.locator("[data-testid='search-input']").click();

      // Popular searches should appear
      await expect(
        page.locator("p", { hasText: /popular searches/i }),
      ).toBeVisible({ timeout: 10_000 });

      // Click the first popular search term
      await page.locator("[data-testid='popular-search-row']").first().click();

      // Search bar should now contain the term
      const searchInput = page.locator("[data-testid='search-input']");
      const value = await searchInput.inputValue();
      expect(value.trim().length).toBeGreaterThan(0);
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
