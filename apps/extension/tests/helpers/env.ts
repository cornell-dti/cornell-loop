/**
 * Reads VITE_CONVEX_URL from apps/extension/.env.local for Playwright test
 * helpers that need a direct ConvexHttpClient connection (seeding, auth).
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

let cachedUrl: string | null = null;
let cachedNamespace: string | null = null;

function readEnvFile(): Record<string, string> {
  // tests/helpers → tests → apps/extension → .env.local
  const envPath = resolve(HERE, "..", "..", ".env.local");
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
  if (cachedUrl !== null) return cachedUrl;
  const fromProcess = process.env["VITE_CONVEX_URL"];
  if (typeof fromProcess === "string" && fromProcess.length > 0) {
    cachedUrl = fromProcess;
    return cachedUrl;
  }
  const fromFile = readEnvFile()["VITE_CONVEX_URL"];
  if (typeof fromFile === "string" && fromFile.length > 0) {
    cachedUrl = fromFile;
    return cachedUrl;
  }
  throw new Error(
    "VITE_CONVEX_URL is not set. Configure apps/extension/.env.local.",
  );
}

/**
 * Auth storage namespace: @convex-dev/auth stores tokens under
 * __convexAuthJWT_<namespace> where namespace is the Convex URL with all
 * non-alphanumeric chars stripped.
 */
export function authStorageNamespace(): string {
  if (cachedNamespace !== null) return cachedNamespace;
  cachedNamespace = getConvexUrl().replace(/[^a-zA-Z0-9]/g, "");
  return cachedNamespace;
}
