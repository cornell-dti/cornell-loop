/**
 * /home screenshot for Figma alignment loop.
 * Usage: bun scripts/home-shot.mjs <iter>
 * Writes /tmp/home-iter-<iter>/full.png + header.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const iter = process.argv[2] ?? "0";
const outDir = `/tmp/home-iter-${iter}`;
mkdirSync(outDir, { recursive: true });

const PORTS = [5173, 5174, 5175, 5176, 5177];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 832 } });

page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    console.log(`[${msg.type()}] ${msg.text()}`);
  }
});
page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));

let url = null;
for (const p of PORTS) {
  const candidate = `http://localhost:${p}/home`;
  try {
    await page.goto(candidate, { timeout: 3000, waitUntil: "networkidle" });
    url = candidate;
    break;
  } catch {
    /* next */
  }
}
if (!url) throw new Error("No dev server on 5173–5177");

await page.waitForTimeout(1000);
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(400);

await page.screenshot({ path: `${outDir}/full.png`, fullPage: false });
await page.screenshot({
  path: `${outDir}/header.png`,
  fullPage: false,
  clip: { x: 0, y: 0, width: 1280, height: 260 },
});

console.log(`iter ${iter} → ${outDir} (source ${url})`);
await browser.close();
