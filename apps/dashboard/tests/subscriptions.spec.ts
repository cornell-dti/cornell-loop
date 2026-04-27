import { test, expect } from "./helpers/fixtures";
import { signInAs } from "./helpers/auth";
import { resetUserState, seedDb } from "./helpers/seed";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { getConvexUrl } from "./helpers/env";

const SUBS_EMAIL = "loop-subs@cornell.edu";

async function followOrgs(token: string, slugs: string[]) {
  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  for (const slug of slugs) {
    const orgId = await client.query(api.dev.triggerOrgIdForSlug, { slug });
    if (orgId !== null) await client.mutation(api.follows.follow, { orgId });
  }
  await client.mutation(api.users.completeOnboarding, {});
}

test.describe("Subscriptions", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test("followed orgs render; unsubscribe removes the row", async ({
    page,
  }) => {
    await resetUserState(SUBS_EMAIL);
    const { token } = await signInAs(page, SUBS_EMAIL);
    await followOrgs(token, ["wicc", "acsu", "cuauv"]);

    await page.goto("/subscriptions");

    await expect(
      page.getByRole("heading", { name: /Email Subscriptions/i }),
    ).toBeVisible();
    // All three follows should appear, one Unsubscribe button per row.
    // Anchor the regex so we only match the inner Button (whose aria-label
    // starts with "Unsubscribe from"), not the outer clickable row whose
    // accessible name concatenates the org name first.
    const unsubscribeButtons = page.getByRole("button", {
      name: /^Unsubscribe from /i,
    });
    await expect(unsubscribeButtons).toHaveCount(3, { timeout: 15_000 });

    // Click the first row's Unsubscribe → confirm modal → confirm.
    await unsubscribeButtons.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^Unsubscribe$/ }).click();

    await expect(unsubscribeButtons).toHaveCount(2, { timeout: 15_000 });
  });
});
