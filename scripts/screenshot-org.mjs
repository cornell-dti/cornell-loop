#!/usr/bin/env node
/**
 * Screenshot /orgs/:slug across multiple desktop widths for visual QA.
 *
 * Usage: node scripts/screenshot-org.mjs [label] [slug]
 *   label: prefix for output filenames, e.g. "00-baseline" (default: "current")
 *   slug:  org slug to load    (default: "acsu" or env ORG_SLUG)
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
const slug = process.argv[3] ?? process.env.ORG_SLUG ?? "acsu";
const baseUrl = process.env.ORG_BASE_URL ?? "http://localhost:5174";
const url = `${baseUrl}/orgs/${slug}`;

// Figma frame is 1280×832. Capture 1280 and 1440.
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

    const viewportFile = path.join(
      outDir,
      `org-${label}-${slug}-${vp.name}.png`,
    );
    await page.screenshot({ path: viewportFile, fullPage: false });
    console.log("wrote", viewportFile);

    const fullFile = path.join(
      outDir,
      `org-${label}-${slug}-${vp.name}-full.png`,
    );
    await page.screenshot({ path: fullFile, fullPage: true });
    console.log("wrote", fullFile);

    await ctx.close();
  }
} finally {
  await browser.close();
}
