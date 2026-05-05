import { test, expect } from "./helpers/fixtures";
import { signInAs } from "./helpers/auth";
import { resetUserState, seedDb } from "./helpers/seed";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { getConvexUrl } from "./helpers/env";

const HOME_EMAIL = "loop-home@cornell.edu";

async function followAndOnboard(token: string, slugs: string[]) {
  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  for (const slug of slugs) {
    const orgId = await client.query(api.dev.triggerOrgIdForSlug, { slug });
    if (orgId !== null) {
      await client.mutation(api.follows.follow, { orgId });
    }
  }
  await client.mutation(api.users.completeOnboarding, {});
}

test.describe("Home feed", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test("renders ≥1 event, bookmark persists, org-name navigates", async ({
    page,
  }) => {
    await resetUserState(HOME_EMAIL);
    const { token } = await signInAs(page, HOME_EMAIL, "Loop Home");
    // Follow the seed orgs whose events make up the feed.
    await followAndOnboard(token, ["wicc", "acsu", "cuauv", "outing"]);

    await page.goto("/home");

    // Wait for at least one DashboardPost to render. We rely on the
    // RSVP / Bookmark buttons inside each card as a stable selector.
    const bookmarkButtons = page.getByRole("button", { name: /^Bookmark$/ });
    await expect(bookmarkButtons.first()).toBeVisible({ timeout: 15_000 });

    // Capture the post title above the first bookmark so we can re-find it
    // after reload — Convex may re-paginate but seeded titles are stable.
    const firstCard = page.locator("article, div").filter({
      has: bookmarkButtons.first(),
    });
    void firstCard; // selector retained for documentation/debug only

    // Click bookmark on the first post.
    await bookmarkButtons.first().click();

    // After the click the same button flips to "Remove bookmark".
    await expect(
      page.getByRole("button", { name: /Remove bookmark/i }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Reload — the bookmark state should hydrate from Convex.
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Remove bookmark/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // Click an org name in a post header — should navigate to /orgs/<slug>.
    const orgLink = page.getByRole("link", { name: /^Open / }).first();
    await expect(orgLink).toBeVisible();
    await orgLink.click();
    await page.waitForURL(/\/orgs\//);
    expect(page.url()).toMatch(/\/orgs\/[a-z0-9-]+/);
  });
});
