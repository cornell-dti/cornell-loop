import { test, expect } from "./helpers/fixtures";
import { signInAs } from "./helpers/auth";
import { resetUserState, seedDb } from "./helpers/seed";

const ONBOARDING_EMAIL = "loop-onboarding@cornell.edu";

test.describe("Onboarding", () => {
  test.beforeAll(async () => {
    // Make sure orgs exist for the suggestion list.
    await seedDb();
  });

  test.beforeEach(async () => {
    // Each run starts from "fresh user with no profile / follows".
    await resetUserState(ONBOARDING_EMAIL);
  });

  test("redirects fresh user to /onboarding and walks through 3 steps", async ({
    page,
  }) => {
    await signInAs(page, ONBOARDING_EMAIL, "Loop Onboarder");

    // Hitting /home before onboarding bounces us to /onboarding.
    await page.goto("/home");
    await page.waitForURL("**/onboarding");

    // Step 1 — pick major + grad year + ≥1 interest.
    await expect(page.getByRole("heading", { name: /Welcome/i })).toBeVisible();

    // Major picker — open the listbox by clicking the trigger button labelled
    // "Major", then choose the first available option.
    await page.getByRole("button", { name: /^Major/i }).click();
    const majorListbox = page.getByRole("listbox");
    await expect(majorListbox).toBeVisible();
    await majorListbox.getByRole("option").first().click();

    await page.getByRole("button", { name: /^Grad Year/i }).click();
    const yearListbox = page.getByRole("listbox");
    await yearListbox.getByRole("option").first().click();

    // Add an interest tag — the field's "+" trigger is labelled "Add interest".
    await page.getByRole("button", { name: "Add interest" }).click();
    const interestDialog = page.getByRole("dialog", { name: "Add interest" });
    await interestDialog.locator("button").first().click();

    await page.getByRole("button", { name: /Continue/i }).click();

    // Step 2 — follow ≥3 clubs.
    await expect(
      page.getByRole("heading", { name: /Pick a few clubs/i }),
    ).toBeVisible();
    const followButtons = page.getByRole("button", { name: /^Follow$/ });
    await expect(followButtons.first()).toBeVisible();
    // Follow the first three Follow buttons in order.
    for (let i = 0; i < 3; i += 1) {
      await page
        .getByRole("button", { name: /^Follow$/ })
        .first()
        .click();
      // Wait for that button's label to flip to "Following" before continuing.
      await expect(
        page.getByRole("button", { name: /Following/i }).nth(i),
      ).toBeVisible();
    }

    // Continue is enabled once we hit 3 follows.
    await page.getByRole("button", { name: /Continue/i }).click();

    // Step 3 — done.
    await expect(
      page.getByRole("heading", { name: /You're all set/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Go to your feed/i }).click();

    await page.waitForURL("**/home");

    // Reload — we should stay on /home, not bounce back to /onboarding.
    await page.goto("/home");
    await expect(page).toHaveURL(/\/home$/);
  });
});
