/**
 * Extension auth helper for Playwright tests.
 *
 * Mirrors apps/dashboard/tests/helpers/auth.ts: mints a real Convex Auth
 * session via `internal.dev.signInForTest` (CLI) and injects the JWT + refresh
 * token into the page's localStorage before each test navigation.
 */

import type { Page } from "@playwright/test";
import { signInAs as dashboardSignInAs } from "../../../dashboard/tests/helpers/auth";
import { authStorageNamespace } from "./env";

const JWT_KEY = "__convexAuthJWT";
const REFRESH_KEY = "__convexAuthRefreshToken";

export interface SignInResult {
  token: string;
  refreshToken: string;
}

export async function signInAs(
  page: Page,
  email: string,
  name?: string,
): Promise<SignInResult> {
  const result = await dashboardSignInAs(page, email, name);
  return { token: result.token, refreshToken: result.refreshToken };
}

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
