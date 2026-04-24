#!/usr/bin/env node
/**
 * Hover over the first org name in a post header and capture the OrgHoverCard.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, "..", "specs", "iterations");
fs.mkdirSync(outDir, { recursive: true });

const label = process.argv[2] ?? "hover-post";
const url = process.env.HOME_URL ?? "http://localhost:5174/home";

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 832 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(400);

  // Target the post-header trigger (has hover:underline class). The same
  // text also appears inside the hidden OrgHoverCard DOM, so we must scope.
  const trigger = page.locator("span.hover\\:underline", {
    hasText: "Cornell Outing Club",
  });
  await trigger.first().hover();
  await page.waitForTimeout(250);

  const out = path.join(outDir, `${label}-1280.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log("wrote", out);
} finally {
  await browser.close();
}
