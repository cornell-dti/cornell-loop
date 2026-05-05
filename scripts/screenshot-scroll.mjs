#!/usr/bin/env node
/**
 * Screenshot /home scrolled halfway down, to verify sidebar stickiness.
 */
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "specs", "iterations");

const label = process.argv[2] ?? "scroll";
const url = process.env.HOME_URL ?? "http://localhost:5174/home";

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 832 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(400);

  // Scroll both the window and any scrollable <main> region.
  await page.evaluate(() => {
    window.scrollTo(0, 600);
    const main = document.querySelector("main");
    if (main) main.scrollTop = 600;
  });
  await page.waitForTimeout(200);

  const out = path.join(outDir, `${label}-1280.png`);
  await page.screenshot({ path: out, fullPage: false });
  console.log("wrote", out);
} finally {
  await browser.close();
}
