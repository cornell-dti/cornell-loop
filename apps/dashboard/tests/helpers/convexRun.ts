/**
 * Invoke internal Convex functions from Playwright via the CLI deploy key,
 * not the public HTTP API.
 */

import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const DASHBOARD_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

function parseConvexRunOutput(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    throw new Error("convex run produced empty stdout");
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const arrayStart = trimmed.indexOf("[");
    let jsonStart = start;
    if (arrayStart !== -1 && (start === -1 || arrayStart < start)) {
      jsonStart = arrayStart;
    }
    if (jsonStart === -1) {
      throw new Error(
        `convex run did not print JSON: ${trimmed.slice(0, 200)}`,
      );
    }
    return JSON.parse(trimmed.slice(jsonStart));
  }
}

export async function convexRun(
  functionName: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  const { stdout, stderr } = await execFileAsync(
    "bunx",
    ["convex", "run", functionName, JSON.stringify(args)],
    {
      cwd: DASHBOARD_ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (stderr.trim().length > 0) {
    console.warn(`[convex run ${functionName}]`, stderr.trim());
  }
  return parseConvexRunOutput(stdout);
}
