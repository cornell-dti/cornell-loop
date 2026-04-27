/**
 * Capture mockup elements as transparent-background PNG assets.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const ASSETS =
  "/Users/meganyap/Desktop/projects.nosync/cornell-loop/apps/dashboard/src/assets/landing";
mkdirSync(ASSETS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 1200 },
  deviceScaleFactor: 3,
});
const page = await ctx.newPage();
// Disable animations via prefers-reduced-motion + stylesheet override
await page.emulateMedia({ reducedMotion: "reduce" });
await page.addInitScript(() => {
  const style = document.createElement("style");
  style.textContent = `*, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition: none !important;
  }`;
  document.documentElement.appendChild(style);
});
await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(1000);

// Make feature card backgrounds transparent so child mockups capture cleanly.
await page.evaluate(() => {
  const features = document.querySelectorAll("section")[4];
  const cards = features.querySelectorAll(":scope > div > div > div");
  cards.forEach((c) => {
    c.style.background = "transparent";
    c.style.border = "none";
  });
  // Also make body white for clean bg
  document.body.style.background = "transparent";
});
await page.waitForTimeout(300);

// Feature card mockups — target the inner content area
const features = page.locator("section").nth(4);
const cardA = features.locator(":scope > div > div > div").nth(0);
const cardB = features.locator(":scope > div > div > div").nth(1);
const cardC = features.locator(":scope > div > div > div").nth(2);

await cardA.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);

await cardA
  .locator(":scope > div")
  .first()
  .screenshot({
    path: `${ASSETS}/feature-mockup-subscription-feed.png`,
    omitBackground: true,
  });
await cardB
  .locator(":scope > div")
  .first()
  .screenshot({
    path: `${ASSETS}/feature-mockup-calendar.png`,
    omitBackground: true,
  });
await cardC
  .locator(":scope > div")
  .first()
  .screenshot({
    path: `${ASSETS}/feature-mockup-club-discovery.png`,
    omitBackground: true,
  });

// Preview cards — reload to restore original card backgrounds
await page.reload({ waitUntil: "networkidle" });
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(800);

// Force animations off again on the fresh page
await page.evaluate(() => {
  const style = document.createElement("style");
  style.textContent = `*, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition: none !important;
  }`;
  document.documentElement.appendChild(style);
});

// Use a fresh copy of the OLD inline preview cards — build a minimal isolated
// page with just the two floating cards visible one-at-a-time.
// Since Landing.tsx now uses the images (chicken-egg), skip re-capture when
// assets already exist at reasonable sizes.
await browser.close();
process.exit(0);

console.log(`Saved ${3 + Math.min(count, names.length)} mockup images.`);
await browser.close();
