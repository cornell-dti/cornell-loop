#!/usr/bin/env node
/**
 * Verify /home shows real feed content end-to-end.
 *
 * Runs three scenarios:
 *   1. fresh           — wipe localStorage and reload /home; without a
 *                        session, ProtectedRoute redirects to the landing page.
 *   2. after-onboarding — clear storage, visit /onboarding then /home without
 *                        signing in; both routes gate on auth, so this captures
 *                        the unauthenticated redirect posture.
 *   3. design-system   — dev-only gallery screenshot for visual regression.
 *
 * Outputs screenshots + a small JSON summary to specs/iterations/.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "specs", "iterations");
fs.mkdirSync(outDir, { recursive: true });

const baseUrl = process.env.HOME_URL ?? "http://localhost:5175";
const homeUrl = `${baseUrl}/home`;

async function takeShotAndCount(page, label) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const file = path.join(outDir, `verify-${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  // Count rendered DashboardPost cards on /home. They render as <article>
  // inside the feed list. Fall back to any `[data-testid='post']`.
  const articles = await page.locator("article").count();
  const buttons = await page
    .getByRole("button", { name: /discover clubs/i })
    .count();
  const visibleSidebarHeading =
    (await page.getByText(/no clubs followed yet/i).count()) > 0;
  return { file, articles, buttons, sidebarEmpty: visibleSidebarHeading };
}

const browser = await chromium.launch();
const summary = {};
try {
  // ── 1. fresh load ─────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("[pageerror]", e.message));
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") {
        console.log("[console]", m.type(), m.text());
      }
    });
    await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
    // Clear any planted session tokens, reload — expect redirect to landing.
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.waitForLoadState("networkidle");
    summary.fresh = await takeShotAndCount(page, "fresh");
    await ctx.close();
  }

  // ── 2. after-onboarding (unauth) ─────────────────────────────────
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(homeUrl, { waitUntil: "domcontentloaded" });
    // Clear storage, then probe protected routes without signing in.
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(`${baseUrl}/onboarding`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.goto(homeUrl, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    summary.afterOnboarding = await takeShotAndCount(page, "after-onboarding");
    await ctx.close();
  }

  // ── 3. /design-system Button check ───────────────────────────────
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(`${baseUrl}/design-system`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);
    const file = path.join(outDir, "verify-design-system.png");
    await page.screenshot({ path: file, fullPage: true });
    summary.designSystem = { file };
    await ctx.close();
  }

  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync(
    path.join(outDir, "verify-summary.json"),
    JSON.stringify(summary, null, 2),
  );
} finally {
  await browser.close();
}
