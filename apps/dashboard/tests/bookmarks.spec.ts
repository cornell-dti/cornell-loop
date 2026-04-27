import { test, expect } from "./helpers/fixtures";
import { signInAs } from "./helpers/auth";
import { resetUserState, seedDb } from "./helpers/seed";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { getConvexUrl } from "./helpers/env";
import type { Id } from "../convex/_generated/dataModel";

const BOOKMARKS_EMAIL = "loop-bookmarks@cornell.edu";

async function bookmarkFirstEvent(token: string): Promise<Id<"events">> {
  const client = new ConvexHttpClient(getConvexUrl());
  client.setAuth(token);
  const eventId = await client.query(api.dev.triggerFirstEventId, {});
  if (eventId === null) throw new Error("No seed events found");
  await client.mutation(api.bookmarks.bookmark, { eventId });
  await client.mutation(api.users.completeOnboarding, {});
  return eventId;
}

test.describe("Bookmarks", () => {
  test.beforeAll(async () => {
    await seedDb();
  });

  test("a bookmarked post shows on /bookmarks; unbookmarking clears it", async ({
    page,
  }) => {
    await resetUserState(BOOKMARKS_EMAIL);
    const { token } = await signInAs(page, BOOKMARKS_EMAIL);
    await bookmarkFirstEvent(token);

    await page.goto("/bookmarks");

    // Bookmark page should render the bookmarked event with a "Remove
    // bookmark" button (since the row is, by definition, bookmarked).
    const removeButton = page
      .getByRole("button", { name: /Remove bookmark/i })
      .first();
    await expect(removeButton).toBeVisible({ timeout: 15_000 });

    // Unbookmark — click should remove the row after a refresh.
    await removeButton.click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: /Remove bookmark/i }),
    ).toHaveCount(0, { timeout: 15_000 });
  });
});
