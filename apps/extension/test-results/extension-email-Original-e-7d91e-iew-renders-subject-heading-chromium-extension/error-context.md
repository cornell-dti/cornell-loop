# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extension-email.spec.ts >> Original email view >> original email view renders subject heading
- Location: tests/extension-email.spec.ts:23:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Original Email', { exact: true })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText('Original Email', { exact: true })

```

# Test source

```ts
  1  | /**
  2  |  * Original Email view E2E tests.
  3  |  *
  4  |  * Verifies:
  5  |  *   • Clicking an edge-case event opens OriginalEmailView
  6  |  *   • Content is loaded from api.events.getEmailContent (not hardcoded mock)
  7  |  *   • Subject and at least one paragraph are rendered
  8  |  */
  9  |
  10 | import { test, expect } from "@playwright/test";
  11 | import { launchWithExtension } from "./helpers/extension";
  12 | import { signInAs } from "./helpers/auth";
  13 | import { seedDb, resetUserState } from "./helpers/seed";
  14 |
  15 | const TEST_EMAIL = "loop-ext-email@cornell.edu";
  16 | const FIXTURE_URL = "http://localhost:4321/test.html";
  17 |
  18 | test.describe("Original email view", () => {
  19 |   test.beforeAll(async () => {
  20 |     await seedDb();
  21 |   });
  22 |
  23 |   test("original email view renders subject heading", async () => {
  24 |     const { context, page } = await launchWithExtension();
  25 |
  26 |     try {
  27 |       await resetUserState(TEST_EMAIL);
  28 |       await signInAs(page, TEST_EMAIL, "Email View Tester");
  29 |
  30 |       await page.goto(FIXTURE_URL);
  31 |       // Playwright auto-pierces shadow DOM — no pierce= prefix needed
  32 |       await page.locator("[data-testid='loop-toggle']").click();
  33 |
  34 |       // Wait for an edge-case row — seed data has opportunity events with no CTA
  35 |       // link and no calendar date, which the mapper flags as isEdgeCase = true.
  36 |       const emailRow = page.locator("[data-testid='email-row']").first();
  37 |       await expect(emailRow).toBeVisible({ timeout: 15_000 });
  38 |       await emailRow.scrollIntoViewIfNeeded();
  39 |       await emailRow.click();
  40 |
  41 |       // OriginalEmailView heading
  42 |       await expect(
  43 |         page.getByText("Original Email", { exact: true }),
> 44 |       ).toBeVisible({ timeout: 10_000 });
     |         ^ Error: expect(locator).toBeVisible() failed
  45 |
  46 |       // Subject should be non-empty (rendered from api.events.getEmailContent)
  47 |       const subjectEl = page.locator("[data-testid='email-subject']");
  48 |       await expect(subjectEl).toBeVisible({ timeout: 10_000 });
  49 |       const subjectText = await subjectEl.textContent();
  50 |       expect(subjectText?.trim().length).toBeGreaterThan(0);
  51 |     } finally {
  52 |       await context.close();
  53 |     }
  54 |   });
  55 | });
  56 |
```
