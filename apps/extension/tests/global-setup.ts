/**
 * Playwright global setup — builds the extension with localhost injection
 * before the test suite runs. Uses bun which is available in this repo.
 */

import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

export default function globalSetup() {
  console.log("[loop-ext] Building extension for Playwright tests…");
  execSync("bun run build:test", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT: "true" },
  });
  console.log("[loop-ext] Extension built.");
}
