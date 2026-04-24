/**
 * Landing-page screenshot tool for the Figma alignment loop.
 *
 * Usage:
 *   bun screenshot.mjs <iter>
 *
 * Writes:
 *   /tmp/landing-iter-<iter>/full.png   — fullPage, 1280×auto (Figma width)
 *   /tmp/landing-iter-<iter>/hero.png   — hero viewport (0, 0, 1280, 900)
 *   /tmp/landing-iter-<iter>/stats.png  — stats + banner block
 *   /tmp/landing-iter-<iter>/features.png — features section
 *   /tmp/landing-iter-<iter>/final.png  — final CTA
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const iter = process.argv[2] ?? '0';
const outDir = `/tmp/landing-iter-${iter}`;
mkdirSync(outDir, { recursive: true });

const PORTS = [5173, 5174, 5175, 5176, 5177];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    console.log(`[${msg.type()}] ${msg.text()}`);
  }
});
page.on('pageerror', (err) => console.log(`[pageerror] ${err.message}`));
page.on('requestfailed', (req) => {
  console.log(`[req-failed] ${req.url()} — ${req.failure()?.errorText}`);
});

let url = null;
for (const p of PORTS) {
  const candidate = `http://localhost:${p}`;
  try {
    await page.goto(candidate, { timeout: 3000, waitUntil: 'networkidle' });
    url = candidate;
    break;
  } catch {
    /* try next */
  }
}
if (!url) throw new Error('No dev server found on ports 5173–5177');

// Wait for fonts + async images
await page.waitForTimeout(1500);
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(500);

// Full page
await page.screenshot({ path: `${outDir}/full.png`, fullPage: true });

// Measure document height
const height = await page.evaluate(() => document.documentElement.scrollHeight);
console.log(`page height: ${height}px`);

// Use fullPage + clip for section shots (no viewport resize reflow)
async function sliceAt(name, y, h) {
  if (y >= height) return;
  const hh = Math.min(h, height - y);
  await page.screenshot({
    path: `${outDir}/${name}.png`,
    fullPage: true,
    clip: { x: 0, y, width: 1280, height: hh },
  });
}

// Auto-find section offsets via DOM — pad slightly to overlap floating decorations
const offsets = await page.evaluate(() => {
  const sections = document.querySelectorAll('section');
  return Array.from(sections).map((s) => ({
    top: s.offsetTop,
    height: s.offsetHeight,
    label: (s.textContent ?? '').slice(0, 20).replace(/\s+/g, '_').toLowerCase(),
  }));
});
console.log('sections:', JSON.stringify(offsets, null, 2));

// Take individual full-height section shots (no clipping issues) at viewport 1280×section-height
for (let i = 0; i < offsets.length; i++) {
  const { top, height: h, label } = offsets[i];
  await sliceAt(`s${i}-${label}`, top, h);
}

console.log(`Iter ${iter} screenshots → ${outDir} (source: ${url})`);
await browser.close();
