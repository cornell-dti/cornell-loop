#!/usr/bin/env node
// Crops the "Discover new clubs" bento card from the landing page so the
// constellation layout can be inspected without scrolling through the full
// page screenshots. Outputs to specs/iterations/.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "specs", "iterations");

const label = process.argv[2] ?? "discover";
const url = process.env.LANDING_URL ?? "http://localhost:5174/";

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
    await page.waitForTimeout(500);

    // Find the third feature card (Discover new clubs is variant=secondary).
    const card = page
      .locator('h3:has-text("Discover new clubs")')
      .locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]");
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const file = path.join(outDir, `${label}-${vp.name}.png`);
    await card.screenshot({ path: file });
    console.log("wrote", file);
    await ctx.close();
  }
} finally {
  await browser.close();
}
