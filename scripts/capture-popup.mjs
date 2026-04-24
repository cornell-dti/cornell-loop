import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 3200 } });
await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

// Find the extension popup preview element and screenshot it
const popup = page.locator('[data-testid="extension-popup"]');
if ((await popup.count()) > 0) {
  await popup.screenshot({
    path: "apps/dashboard/src/assets/landing/extension-popup.png",
    scale: "device",
  });
  console.log("Extension popup captured");
} else {
  console.log("No popup element found, trying full page approach");
}

await browser.close();
