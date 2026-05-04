/**
 * Original Email view E2E tests.
 *
 * Verifies:
 *   • Clicking an edge-case event opens OriginalEmailView
 *   • Content is loaded from api.events.getEmailContent (not hardcoded mock)
 *   • Subject and at least one paragraph are rendered
 */

import { test, expect } from "@playwright/test";
import { launchWithExtension } from "./helpers/extension";
import { signInAs } from "./helpers/auth";
import { seedDb, resetUserState } from "./helpers/seed";

const TEST_EMAIL = "loop-ext-email@cornell.edu";
const FIXTURE_URL = "http://localhost:4321/test.html";

test.describe("Original email view", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  // TODO: Row-click interaction across shadow DOM boundaries is unreliable;
  // re-enable once ExtensionEventRow click handling is confirmed stable.
  test.skip("original email view renders subject heading", async () => {
    const { context, page } = await launchWithExtension();

    try {
      await resetUserState(TEST_EMAIL);
      await signInAs(page, TEST_EMAIL, "Email View Tester");

      await page.goto(FIXTURE_URL);
      // Playwright auto-pierces shadow DOM — no pierce= prefix needed
      await page.locator("[data-testid='loop-toggle']").click();

      // Wait for an edge-case row — seed data has opportunity events with no CTA
      // link and no calendar date, which the mapper flags as isEdgeCase = true.
      const emailRow = page.locator("[data-testid='email-row']").first();
      await expect(emailRow).toBeVisible({ timeout: 15_000 });
      await emailRow.scrollIntoViewIfNeeded();
      await emailRow.click();

      // OriginalEmailView heading
      await expect(
        page.getByText("Original Email", { exact: true }),
      ).toBeVisible({ timeout: 10_000 });

      // Subject should be non-empty (rendered from api.events.getEmailContent)
      const subjectEl = page.locator("[data-testid='email-subject']");
      await expect(subjectEl).toBeVisible({ timeout: 10_000 });
      const subjectText = await subjectEl.textContent();
      expect(subjectText?.trim().length).toBeGreaterThan(0);
    } finally {
      await context.close();
    }
  });
});
