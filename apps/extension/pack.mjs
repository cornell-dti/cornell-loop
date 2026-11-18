import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(root, ".env.production");
const distDir = path.join(root, "dist");
const zipPath = path.join(root, "dist.zip");

function readEnvFile(filePath) {
  const values = {};
  if (!existsSync(filePath)) return values;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    values[key] = value;
  }
  return values;
}

const env = readEnvFile(envPath);
const convexUrl = env.VITE_CONVEX_URL ?? "";
const convexSite = env.VITE_CONVEX_SITE_URL ?? "";

if (convexUrl.length === 0 || convexSite.length === 0) {
  console.error(
    "Set VITE_CONVEX_URL and VITE_CONVEX_SITE_URL in .env.production to the production Convex deployment, then re-run pack.",
  );
  process.exit(1);
}

if (
  convexUrl.includes("laudable-butterfly") ||
  convexSite.includes("laudable-butterfly")
) {
  console.error(
    "Refusing to pack with the dev Convex deployment (laudable-butterfly). Use production URLs.",
  );
  process.exit(1);
}

// Analytics is silently dead without a key, and a shipped build with no
// metrics is only discovered weeks later, so fail loudly here instead.
if ((env.VITE_POSTHOG_KEY ?? "").length === 0) {
  console.error(
    "Set VITE_POSTHOG_KEY in .env.production to the production PostHog project key, then re-run pack.",
  );
  process.exit(1);
}

// The Store requires a privacy policy once analytics ship, and the in-panel
// link is the user-facing half of that promise.
if ((env.VITE_PRIVACY_POLICY_URL ?? "").length === 0) {
  console.error(
    "Set VITE_PRIVACY_POLICY_URL in .env.production to the published privacy policy URL, then re-run pack.",
  );
  process.exit(1);
}

if (existsSync(distDir)) rmSync(distDir, { recursive: true });

const build = spawnSync("bunx", ["vite", "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});
if (build.status !== 0) process.exit(build.status ?? 1);

if (existsSync(zipPath)) unlinkSync(zipPath);

const zip = spawnSync(
  "zip",
  ["-r", zipPath, ".", "-x", "*.DS_Store", "-x", "__MACOSX/*"],
  { cwd: distDir, stdio: "inherit" },
);
if (zip.status !== 0) process.exit(zip.status ?? 1);

console.log(`Wrote ${zipPath}`);
