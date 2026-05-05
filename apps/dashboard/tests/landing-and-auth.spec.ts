import { test, expect } from "./helpers/fixtures";

test.describe("Landing + auth gates", () => {
  test("renders the marketing landing with the headline + CTA", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Less inbox/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Add to your inbox/i }).first(),
    ).toBeVisible();
    // Scroll cue copy is "Stay in the loop"
    await expect(page.getByText("Stay in the loop").first()).toBeVisible();
  });

  test("scroll cue scrolls the page", async ({ page }) => {
    await page.goto("/");
    const initial = await page.evaluate(() => window.scrollY);
    await page.getByRole("button", { name: /Stay in the loop/i }).click();
    // Smooth scroll — wait briefly for the animation, then assert.
    await page.waitForFunction(
      (start) => window.scrollY > start + 100,
      initial,
    );
  });

  test("?error=non-cornell renders the inline error banner", async ({
    page,
  }) => {
    await page.goto("/?error=non-cornell");
    await expect(page.getByRole("alert")).toContainText(
      /Loop is open to Cornell students only/i,
    );
  });
});
