import { defineConfig } from "@playwright/test";
import path from "node:path";

const CONFIG_DIR = import.meta.dirname;
const FIXTURE_DIR = path.join(CONFIG_DIR, "tests/fixtures");
const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Extension Playwright config.
 *
 * Key differences from the dashboard config:
 *  - No webServer Vite process — the extension injects into an HTML fixture
 *    served from tests/fixtures/ via a simple static file server.
 *  - Uses launchPersistentContext (via each test's fixture) to load the
 *    unpacked extension from dist/. The global-setup step builds the
 *    test variant (PLAYWRIGHT=true) automatically.
 *  - Chromium only. Extensions are not supported in other browsers.
 *  - fullyParallel: false / workers: 1 — tests share the dev Convex
 *    deployment and seed state; parallel runs would cause flaky races.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 1 : 0,
  workers: 1,
  reporter: process.env["CI"] ? "github" : [["list"]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-extension",
    },
  ],
  webServer: {
    command: `bunx serve -p ${PORT} ${FIXTURE_DIR}`,
    url: BASE_URL,
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
  },
  globalSetup: "./tests/global-setup.ts",
});
