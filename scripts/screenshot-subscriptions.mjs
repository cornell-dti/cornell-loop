#!/usr/bin/env node
/**
 * Screenshot /subscriptions across multiple desktop widths for visual QA.
 *
 * Usage: node scripts/screenshot-subscriptions.mjs [label]
 *   label: prefix for output filenames, e.g. "00-baseline"
 *          (default: "current")
 *
 * Captures two states per viewport:
 *   • <label>-default-<width>.png         — page at rest
 *   • <label>-modal-<width>.png           — page after clicking the first
 *                                           "Unsubscribe" button (modal open)
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
const url = process.env.SUBS_URL ?? "http://localhost:5174/subscriptions";

// Figma frame is 1280×832. Also sweep standard desktop sizes.
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
    const defaultFile = path.join(
      outDir,
      `subscriptions-${label}-default-${vp.name}.png`,
    );
    await page.screenshot({ path: defaultFile, fullPage: false });
    console.log("wrote", defaultFile);

    const defaultFullFile = path.join(
      outDir,
      `subscriptions-${label}-default-${vp.name}-full.png`,
    );
    await page.screenshot({ path: defaultFullFile, fullPage: true });
    console.log("wrote", defaultFullFile);

    // Open modal — click the first "Unsubscribe" button on a row.
    const firstUnsubscribe = page.getByRole("button", {
      name: /^Unsubscribe from /,
    });
    await firstUnsubscribe.first().click();
    await page.waitForSelector("[role=dialog]", { timeout: 5_000 });
    await page.waitForTimeout(200);

    const modalFile = path.join(
      outDir,
      `subscriptions-${label}-modal-${vp.name}.png`,
    );
    await page.screenshot({ path: modalFile, fullPage: false });
    console.log("wrote", modalFile);

    await ctx.close();
  }
} finally {
  await browser.close();
}
