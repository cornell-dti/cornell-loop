/**
 * Playwright auth helper.
 *
 * Driving Google OAuth from a headless browser is impractical, so we mint a
 * real Convex Auth session server-side via `internal.dev.signInForTest` and
 * inject the JWT + refresh token into `localStorage`. That function is
 * internal and fail-closed behind TEST_AUTH_ENABLED; the CLI deploy key is
 * what makes it reachable from this helper.
 */

import type { Page } from "@playwright/test";
import type { Id } from "../../convex/_generated/dataModel";
import { convexRun } from "./convexRun";
import { authStorageNamespace } from "./env";

const JWT_KEY = "__convexAuthJWT";
const REFRESH_KEY = "__convexAuthRefreshToken";

export interface SignInResult {
  userId: Id<"users">;
  token: string;
  refreshToken: string;
}

function isSignInResult(value: unknown): value is SignInResult {
  if (typeof value !== "object" || value === null) return false;
  if (
    !("token" in value) ||
    !("refreshToken" in value) ||
    !("userId" in value)
  ) {
    return false;
  }
  return (
    typeof value.token === "string" &&
    typeof value.refreshToken === "string" &&
    typeof value.userId === "string"
  );
}

/**
 * Signs the test user in by minting a Convex Auth session server-side and
 * planting the resulting tokens in `localStorage` for the next navigation.
 */
export async function signInAs(
  page: Page,
  email: string,
  name?: string,
): Promise<SignInResult> {
  if (!email.toLowerCase().endsWith("@cornell.edu")) {
    throw new Error(
      `signInAs: email "${email}" is not a Cornell address; the auth ` +
        "callback would reject it.",
    );
  }
  const args: Record<string, unknown> = { email };
  if (name !== undefined) args.name = name;
  const result = await convexRun("internal.dev.signInForTest", args);
  if (!isSignInResult(result)) {
    throw new Error("internal.dev.signInForTest returned an unexpected value");
  }

  const namespace = authStorageNamespace();
  const tokenKey = `${JWT_KEY}_${namespace}`;
  const refreshKey = `${REFRESH_KEY}_${namespace}`;
  const token = result.token;
  const refreshToken = result.refreshToken;

  await page.addInitScript(
    (payload: {
      tokenKey: string;
      refreshKey: string;
      token: string;
      refreshToken: string;
    }) => {
      window.localStorage.setItem(payload.tokenKey, payload.token);
      window.localStorage.setItem(payload.refreshKey, payload.refreshToken);
    },
    { tokenKey, refreshKey, token, refreshToken },
  );

  return result;
}

/**
 * Removes any locally-cached auth tokens so a subsequent navigation lands as
 * an unauthenticated user. Useful between specs to reset state.
 */
export async function clearAuth(page: Page): Promise<void> {
  const namespace = authStorageNamespace();
  const tokenKey = `${JWT_KEY}_${namespace}`;
  const refreshKey = `${REFRESH_KEY}_${namespace}`;
  await page.addInitScript(
    (payload: { tokenKey: string; refreshKey: string }) => {
      window.localStorage.removeItem(payload.tokenKey);
      window.localStorage.removeItem(payload.refreshKey);
    },
    { tokenKey, refreshKey },
  );
}
