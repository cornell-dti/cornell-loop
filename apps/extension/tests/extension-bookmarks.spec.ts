/**
 * Bookmark persistence E2E tests.
 *
 * Verifies:
 *   • Bookmarking an event from the feed persists to Convex
 *   • The bookmark survives a page reload (fetched from api.bookmarks.myBookmarks)
 *   • Unbookmarking removes the event from the bookmark view
 */

import { test, expect } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../dashboard/convex/_generated/api";
import { launchWithExtension } from "./helpers/extension";
import { signInAs } from "./helpers/auth";
import { seedDb, resetUserState } from "./helpers/seed";
import { getConvexUrl } from "./helpers/env";

const TEST_EMAIL = "loop-ext-bookmarks@cornell.edu";
const FIXTURE_URL = "http://localhost:4321/test.html";

test.describe("Extension bookmarks", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test("bookmark persists in Convex across reload", async () => {
    const { context, page } = await launchWithExtension();

    try {
      await resetUserState(TEST_EMAIL);
      const { token } = await signInAs(page, TEST_EMAIL, "Bookmark Tester");

      await page.goto(FIXTURE_URL);
      // Playwright auto-pierces shadow DOM — no pierce= prefix needed
      await page.locator("[data-testid='loop-toggle']").click();

      // Wait for feed to render at least one event card
      const bookmarkButton = page
        .locator("[data-testid='bookmark-button']")
        .first();
      await expect(bookmarkButton).toBeVisible({ timeout: 15_000 });

      // Click bookmark
      await bookmarkButton.click();

      // Poll Convex until the mutation propagates (async — may take a few seconds)
      const client = new ConvexHttpClient(getConvexUrl());
      client.setAuth(token);
      await expect
        .poll(
          async () => {
            const bookmarks = await client.query(api.bookmarks.myBookmarks, {
              paginationOpts: { numItems: 10, cursor: null },
            });
            return bookmarks.page.length;
          },
          { timeout: 10_000, intervals: [500, 1000, 2000, 3000] },
        )
        .toBeGreaterThan(0);

      // Reload the page — bookmark state should hydrate from Convex
      await page.reload();
      await page.locator("[data-testid='loop-toggle']").click();

      // Navigate to Bookmarks tab
      await page.locator("[data-testid='tab-bookmarks']").click();

      // Should show the bookmarked event
      await expect(
        page.locator("[data-testid='bookmark-card']").first(),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });

  test("unbookmark removes event from bookmark view", async () => {
    const { context, page } = await launchWithExtension();

    try {
      await resetUserState(TEST_EMAIL);
      await signInAs(page, TEST_EMAIL, "Bookmark Tester");

      await page.goto(FIXTURE_URL);
      await page.locator("[data-testid='loop-toggle']").click();

      // Bookmark an event
      const bookmarkButton = page
        .locator("[data-testid='bookmark-button']")
        .first();
      await expect(bookmarkButton).toBeVisible({ timeout: 15_000 });
      await bookmarkButton.click();

      // Navigate to Bookmarks tab
      await page.locator("[data-testid='tab-bookmarks']").click();

      // Unbookmark
      const card = page.locator("[data-testid='bookmark-card']").first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      await card.locator("[data-testid='unbookmark-button']").click();

      // Bookmark list should now be empty
      await expect(
        page.locator("p", {
          hasText: /bookmark events from the feed/i,
        }),
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await context.close();
    }
  });
});
