import { test, expect } from "./helpers/fixtures";
import { signInAs } from "./helpers/auth";
import { resetUserState, seedDb } from "./helpers/seed";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { getConvexUrl } from "./helpers/env";

const ORG_EMAIL = "loop-org@cornell.edu";

async function markOnboarded(token: string) {
  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  await client.mutation(api.users.completeOnboarding, {});
}

test.describe("Org page", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test("/orgs/wicc renders org name + ≥1 event; follow toggle persists", async ({
    page,
  }) => {
    await resetUserState(ORG_EMAIL);
    const { token } = await signInAs(page, ORG_EMAIL);
    await markOnboarded(token);

    await page.goto("/orgs/wicc");

    await expect(
      page.getByRole("heading", { name: /Women in Computing at Cornell/i }),
    ).toBeVisible({ timeout: 15_000 });

    // ≥1 event card — DashboardPost renders Bookmark buttons for each event.
    const bookmarks = page.getByRole("button", { name: /^Bookmark$/ });
    await expect(bookmarks.first()).toBeVisible();

    // Follow toggle starts as "Follow"; click should flip to "Following".
    // Scope to the page's main content (not the OrgHoverCard floating inside
    // the post header) so .first() reliably hits the org-action button.
    const main = page.getByRole("main");
    const followBtn = main.getByRole("button", { name: /^Follow$/ }).first();
    await expect(followBtn).toBeVisible();
    await followBtn.click();

    await expect(
      main.getByRole("button", { name: /^Following$/ }).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Verify the follow mutation actually landed on the server before
    // reloading — the click handler is optimistic, so the button can flip
    // before the WebSocket round-trip completes. Polling via the API gives
    // us a deterministic gate that doesn't rely on arbitrary sleeps.
    const verifyClient = new ConvexHttpClient(getConvexUrl());
    verifyClient.setAuth(token);
    await expect
      .poll(
        async () => {
          const orgId = await verifyClient.query(api.dev.triggerOrgIdForSlug, {
            slug: "wicc",
          });
          if (orgId === null) return false;
          return await verifyClient.query(api.follows.isFollowing, { orgId });
        },
        { timeout: 15_000 },
      )
      .toBe(true);

    // Reload — the followed state persists from Convex.
    await page.reload();
    await expect(
      page
        .getByRole("main")
        .getByRole("button", { name: /^Following$/ })
        .first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
