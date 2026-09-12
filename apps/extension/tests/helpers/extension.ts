/**
 * Helper for launching a persistent Chromium context with the Cornell Loop
 * extension loaded.
 *
 * Chrome extensions require a non-headless context in most scenarios.
 * Playwright v1.44+ supports --headless=new which allows extensions to run
 * in CI without a display.
 */

import { chromium } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import path from "node:path";

/** Directory of this file (ESM); avoids `node:url` + `fileURLToPath`. */
const HERE = import.meta.dirname;
const EXT_DIST = path.resolve(HERE, "../../dist");

export interface ExtensionContext {
  context: BrowserContext;
  page: Page;
}

/**
 * Launches Chromium with the built extension loaded.
 * Call bun run build:test before running tests so dist/ is up to date.
 *
 * headless: process.env.CI enables --headless=new in CI; stays headed locally
 * so developers can see the panel during development.
 */
export async function launchWithExtension(): Promise<ExtensionContext> {
  const headless = process.env["CI"] === "true";

  const context = await chromium.launchPersistentContext("", {
    headless,
    args: [
      `--disable-extensions-except=${EXT_DIST}`,
      `--load-extension=${EXT_DIST}`,
      ...(headless ? ["--headless=new"] : []),
    ],
  });

  const page = await context.newPage();
  return { context, page };
}
