import { test, expect } from "./helpers/fixtures";
import { signInAs } from "./helpers/auth";
import { resetUserState, seedDb } from "./helpers/seed";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { getConvexUrl } from "./helpers/env";

const SEARCH_EMAIL = "loop-search@cornell.edu";

test.describe("Search", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test('typing "WICC" updates ?q= and renders Events + Organizations', async ({
    page,
  }) => {
    await resetUserState(SEARCH_EMAIL);
    const { token } = await signInAs(page, SEARCH_EMAIL);
    const client = new ConvexHttpClient(getConvexUrl());
    client.setAuth(token);
    await client.mutation(api.users.completeOnboarding, {});

    await page.goto("/search");

    // Hint state is shown when q < 2 chars.
    await expect(
      page.getByText(/Type at least 2 characters to search/i),
    ).toBeVisible();

    const searchBox = page.getByRole("searchbox").first();
    await searchBox.fill("WICC");

    await expect(page).toHaveURL(/\?q=WICC/);
    await expect(
      page.getByRole("heading", { name: "Events", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: "Organizations", exact: true }),
    ).toBeVisible();
    // The org card for WICC should show in the Organizations grid.
    await expect(
      page.getByRole("heading", { name: /Women in Computing at Cornell/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Clear the input — hint state returns. SearchBar exposes a "Clear
    // search" button when the value is non-empty.
    await page.getByRole("button", { name: /Clear search/i }).click();
    await expect(
      page.getByText(/Type at least 2 characters to search/i),
    ).toBeVisible();
  });
});
