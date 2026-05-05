import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 3G Playwright config.
 *
 * Notes:
 *   • Vite dev server falls back from 5173 → 5174 if 5173 is busy. We pin
 *     a stable port via the `PLAYWRIGHT_PORT` env override defaulting to
 *     5173. CI starts a fresh server; locally we reuse a running one.
 *   • Single chromium project — design system is desktop-first and the
 *     dashboard layout assumes ≥ 1280 px width (see `vite.config.ts`).
 *   • Tests assume the Convex dev deployment configured in
 *     `.env.local` (`VITE_CONVEX_URL`) is online and accessible. Spec
 *     fixtures handle seeding/clearing the dev DB before each suite.
 */

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? "5173");
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Run vite directly from the dashboard package so workspace aliases
    // resolve. Vite's `envDir` (`../../`) still loads `.env.local` from the
    // monorepo root.
    command: `bunx vite --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
