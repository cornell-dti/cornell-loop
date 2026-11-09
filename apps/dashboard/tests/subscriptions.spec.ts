import { test, expect } from "./helpers/fixtures";
import { signInAs } from "./helpers/auth";
import { orgIdForSlug, resetUserState, seedDb } from "./helpers/seed";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { getConvexUrl } from "./helpers/env";

const SUBS_EMAIL = "loop-subs@cornell.edu";

async function followOrgs(token: string, slugs: string[]) {
  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  for (const slug of slugs) {
    const orgId = await orgIdForSlug(token, slug);
    if (orgId !== null) await client.mutation(api.follows.follow, { orgId });
  }
  await client.mutation(api.users.completeOnboarding, {});
}

test.describe("Subscriptions", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test("followed orgs render; unfollow removes the row", async ({ page }) => {
    await resetUserState(SUBS_EMAIL);
    const { token } = await signInAs(page, SUBS_EMAIL);
    await followOrgs(token, ["wicc", "acsu", "cuauv"]);

    await page.goto("/subscriptions");

    await expect(
      page.getByRole("heading", { name: /Email Subscriptions/i }),
    ).toBeVisible();
    // All three follows should appear, one Unfollow button per row.
    // Anchor the regex so we only match the inner Button (whose aria-label
    // starts with "Unfollow "), not the outer clickable row whose accessible
    // name concatenates the org name first.
    const unfollowButtons = page.getByRole("button", {
      name: /^Unfollow /i,
    });
    await expect(unfollowButtons).toHaveCount(3, { timeout: 15_000 });

    // Click the first row's Unfollow → confirm modal → confirm.
    await unfollowButtons.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^Unfollow$/ }).click();

    await expect(unfollowButtons).toHaveCount(2, { timeout: 15_000 });
  });

  test("search filters rows; unfollow targets the filtered row", async ({
    page,
  }) => {
    await resetUserState(SUBS_EMAIL);
    const { token } = await signInAs(page, SUBS_EMAIL);
    await followOrgs(token, ["wicc", "acsu", "cuauv"]);

    await page.goto("/subscriptions");

    const unfollowButtons = page.getByRole("button", {
      name: /^Unfollow /i,
    });
    await expect(unfollowButtons).toHaveCount(3, { timeout: 15_000 });

    const search = page.getByRole("searchbox");
    await search.fill("women");
    await expect(unfollowButtons).toHaveCount(1);
    await expect(unfollowButtons.first()).toHaveAccessibleName(
      /Women in Computing at Cornell/,
    );

    await search.fill("no such club");
    await expect(page.getByText(/No subscriptions match/)).toBeVisible();

    // Unfollowing from a filtered list must remove that org, not whichever
    // org held the same position in the unfiltered list.
    await search.fill("cuauv");
    await unfollowButtons.first().click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Unfollow$/ })
      .click();

    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(unfollowButtons).toHaveCount(2, { timeout: 15_000 });
    await expect(
      page.getByRole("button", { name: /^Unfollow .*CUAUV/ }),
    ).toHaveCount(0);
  });
});
