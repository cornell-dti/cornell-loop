#!/usr/bin/env node
/**
 * Screenshot /profile across multiple desktop widths and capture both states:
 *   • default — the editable profile-setup modal
 *   • saved   — the "Recalibrating your feed…" confirmation that appears after
 *               clicking "Save changes"
 *
 * Usage: node scripts/screenshot-profile.mjs [label]
 *   label: prefix for output filenames (default: "profile")
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

const label = process.argv[2] ?? "profile";
const url = process.env.PROFILE_URL ?? "http://localhost:5174/profile";

const viewports = [
  { name: "1280", width: 1280, height: 832 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
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
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    // Default state
    const defaultFile = path.join(outDir, `${label}-default-${vp.name}.png`);
    await page.screenshot({ path: defaultFile, fullPage: false });
    console.log("wrote", defaultFile);

    // Trigger saved state by clicking the "Save changes" button
    await page.getByRole("button", { name: "Save changes" }).click();
    // The progress bar animates over ~1.2s; capture at ~500 ms in to land
    // mid-fill (matches Figma's ~46% reference).
    await page.waitForTimeout(500);

    const savedFile = path.join(outDir, `${label}-saved-${vp.name}.png`);
    await page.screenshot({ path: savedFile, fullPage: false });
    console.log("wrote", savedFile);

    await ctx.close();
  }
} finally {
  await browser.close();
}
