#!/usr/bin/env node
/**
 * Screenshot /bookmarks across multiple desktop widths for visual QA.
 *
 * Usage: node scripts/screenshot-bookmarks.mjs [label]
 *   label: prefix for output filenames, e.g. "00-baseline" (default: "current")
 *
 * Outputs go to specs/iterations/.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "specs", "iterations");

const label = process.argv[2] ?? "current";
const url = process.env.BOOKMARKS_URL ?? "http://localhost:5174/bookmarks";

// Figma frame is 1280×832. Sweep 1280 and 1440 per spec.
const viewports = [
  { name: "1280", width: 1280, height: 832 },
  { name: "1440", width: 1440, height: 900 },
];

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
    // Let fonts settle
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    const viewportFile = path.join(outDir, `bookmarks-${label}-${vp.name}.png`);
    await page.screenshot({ path: viewportFile, fullPage: false });
    console.log("wrote", viewportFile);

    const fullFile = path.join(
      outDir,
      `bookmarks-${label}-${vp.name}-full.png`,
    );
    await page.screenshot({ path: fullFile, fullPage: true });
    console.log("wrote", fullFile);

    await ctx.close();
  }
} finally {
  await browser.close();
}
