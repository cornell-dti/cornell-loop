import { test, expect } from "./helpers/fixtures";
import { signInAs } from "./helpers/auth";
import { clearDb, resetUserState } from "./helpers/seed";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { getConvexUrl } from "./helpers/env";

const ERROR_EMAIL = "loop-errors@cornell.edu";

test.describe("Error states", () => {
  test("non-Cornell sign-in shows the inline error banner", async ({
    page,
  }) => {
    // Real Google OAuth can't be driven from a headless browser; the auth
    // callback throws ConvexError({ code: "NON_CORNELL_EMAIL" }) which the
    // Landing page surfaces by setting `?error=non-cornell`. We assert the
    // resulting banner directly to keep the spec hermetic.
    await page.goto("/?error=non-cornell");
    await expect(page.getByRole("alert")).toContainText(
      /Loop is open to Cornell students only/i,
    );
  });

  test("empty feed surfaces a proper user-facing empty state", async ({
    page,
  }) => {
    await clearDb();
    await resetUserState(ERROR_EMAIL);
    const { token } = await signInAs(page, ERROR_EMAIL);

    // Mark onboarded so /home renders without redirecting.
    const client = new ConvexHttpClient(getConvexUrl());
    client.setAuth(token);
    await client.mutation(api.users.completeOnboarding, {});

    await page.goto("/home");

    // Empty feed for an authed-but-following-nothing user shows the
    // "Your feed is empty" copy with a link to /subscriptions. No dev-only
    // seed CTA — that's a developer escape hatch wired into the auto-login
    // entry point, not a user-facing empty state.
    await expect(
      page.getByRole("heading", { name: /Your feed is empty/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("link", { name: /Subscriptions/i }),
    ).toBeVisible();
  });
});
