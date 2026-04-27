#!/usr/bin/env node
/**
 * Screenshot the search experience in its three states.
 *
 * 1. default — input focused, "Recent" dropdown showing
 * 2. typed   — input has a query, live-suggestions dropdown showing
 * 3. results — Enter pressed, Top/Events/Orgs toggle + result feed
 *
 * Outputs: specs/iterations/search-{state}-{viewport}.png
 *
 * Usage: node scripts/screenshot-search.mjs [label]
 *   label: optional prefix, default "search"
 *
 * Requires the dev server to be running at SEARCH_URL (default
 * http://localhost:5174). Override via env vars HOME_URL / SEARCH_URL.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "specs", "iterations");

const label = process.argv[2] ?? "search";
const homeUrl = process.env.HOME_URL ?? "http://localhost:5174/home";
const searchUrl = process.env.SEARCH_URL ?? "http://localhost:5174/search";

// Figma frame is 1280×832. Search experience is desktop-first.
const viewports = [{ name: "1280", width: 1280, height: 832 }];

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();

    // ── State 1: default (focused, empty) ────────────────────────────────
    await page.goto(homeUrl, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForTimeout(300);
    const searchInput = page.getByRole("searchbox").first();
    await searchInput.click();
    await page.waitForTimeout(200);
    const file1 = path.join(outDir, `${label}-default-${vp.name}.png`);
    await page.screenshot({ path: file1, fullPage: false });
    console.log("wrote", file1);

    // ── State 2: typed ───────────────────────────────────────────────────
    await searchInput.fill("horse");
    await page.waitForTimeout(200);
    const file2 = path.join(outDir, `${label}-typed-${vp.name}.png`);
    await page.screenshot({ path: file2, fullPage: false });
    console.log("wrote", file2);

    // ── State 3: results (deep-link to /search?q=horses) ─────────────────
    await page.goto(`${searchUrl}?q=horses`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    // Click somewhere neutral so the input isn't auto-focused/dropdown open.
    await page.mouse.click(2, 2);
    await page.waitForTimeout(300);
    const file3 = path.join(outDir, `${label}-results-${vp.name}.png`);
    await page.screenshot({ path: file3, fullPage: false });
    console.log("wrote", file3);

    const file3full = path.join(outDir, `${label}-results-${vp.name}-full.png`);
    await page.screenshot({ path: file3full, fullPage: true });
    console.log("wrote", file3full);

    await ctx.close();
  }
} finally {
  await browser.close();
}
