import { test, expect } from "./helpers/fixtures";
import { signInAs } from "./helpers/auth";
import { resetUserState } from "./helpers/seed";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { getConvexUrl } from "./helpers/env";

const PROFILE_EMAIL = "loop-profile@cornell.edu";

test.describe("Profile modal", () => {
  test("changing the major persists across reload", async ({ page }) => {
    await resetUserState(PROFILE_EMAIL);
    const { token } = await signInAs(page, PROFILE_EMAIL);

    // Seed an initial profile so the modal lands with the user already
    // onboarded (and "Computer Science" preselected as the starting major).
    const client = new ConvexHttpClient(getConvexUrl());
    client.setAuth(token);
    await client.mutation(api.users.updateProfile, {
      major: "Computer Science",
      gradYear: "2027",
      interests: ["Tech"],
    });
    await client.mutation(api.users.completeOnboarding, {});

    await page.goto("/profile");

    const majorTrigger = page.getByRole("button", { name: /^Major: / });
    await expect(majorTrigger).toBeVisible({ timeout: 15_000 });
    await expect(majorTrigger).toContainText("Computer Science");

    await majorTrigger.click();
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    // Pick a different option — Economics is a stable, non-CS major. The
    // listbox caps height at 14rem so we scroll the option into view first.
    const economics = listbox.getByRole("option", {
      name: "Economics",
      exact: true,
    });
    await economics.scrollIntoViewIfNeeded();
    await economics.click();

    // Save changes — Profile dialog renders the button as "Save changes".
    await page.getByRole("button", { name: /Save changes/i }).click();

    // The "Recalibrating your feed…" confirmation animates and dismisses.
    // Wait for the modal to disappear before reloading.
    await expect(page.getByText(/Recalibrating your feed/i)).toBeVisible({
      timeout: 5_000,
    });

    // Reload /profile and confirm the new major is shown.
    await page.goto("/profile");
    await expect(
      page.getByRole("button", { name: /^Major: Economics/ }),
    ).toBeVisible({ timeout: 15_000 });
  });
});
