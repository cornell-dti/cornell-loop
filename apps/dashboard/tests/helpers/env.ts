/**
 * Reads the Convex deployment URL the test suite should target.
 *
 * Vite's `envDir` is the monorepo root (`../../` from `apps/dashboard`), so
 * the canonical `.env.local` lives at the repo root. Read it once and cache
 * the result. We deliberately do *not* depend on `dotenv` — bun supports a
 * subset out of the box, but Playwright runs through Node and reads files
 * synchronously here is simpler than wiring a loader.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

let cached: string | null = null;

function readEnvFile(): Record<string, string> {
  // Resolve relative to this file: tests/helpers/env.ts → repo root.
  const envPath = resolve(HERE, "..", "..", "..", "..", ".env.local");
  let raw = "";
  try {
    raw = readFileSync(envPath, "utf8");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip inline comments like `dev:foo # team: x` and surrounding quotes.
    const hashIdx = value.indexOf(" #");
    if (hashIdx !== -1) value = value.slice(0, hashIdx).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function getConvexUrl(): string {
  if (cached !== null) return cached;
  const fromProcess = process.env.VITE_CONVEX_URL;
  if (typeof fromProcess === "string" && fromProcess.length > 0) {
    cached = fromProcess;
    return cached;
  }
  const fromFile = readEnvFile().VITE_CONVEX_URL;
  if (typeof fromFile === "string" && fromFile.length > 0) {
    cached = fromFile;
    return cached;
  }
  throw new Error(
    "VITE_CONVEX_URL is not set. Configure .env.local or pass it via env.",
  );
}

/**
 * The localStorage namespace `@convex-dev/auth` derives from the Convex
 * deployment URL. The library strips all non-alphanumeric chars, then suffixes
 * each storage key with `_<namespace>`. We mirror that exactly so the tokens
 * we plant under `__convexAuthJWT_<ns>` etc. are picked up by the React
 * provider on page load.
 */
export function authStorageNamespace(): string {
  return getConvexUrl().replace(/[^a-zA-Z0-9]/g, "");
}
