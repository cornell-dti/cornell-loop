/**
 * Extension auth helper for Playwright tests.
 *
 * Mirrors apps/dashboard/tests/helpers/auth.ts: mints a real Convex Auth
 * session via the DEV-gated api.dev.triggerTestSignIn action and injects the
 * JWT + refresh token into the page's localStorage before each test navigation.
 *
 * The extension's ConvexAuthProvider (running as a content script in the page
 * context) reads from the page's localStorage, so this trick works the same
 * way as the dashboard tests.
 */

import type { Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { authStorageNamespace, getConvexUrl } from "./env";
// Node test helpers import directly from the dashboard convex folder.
// (The @app/convex alias is Vite-only; Playwright runs in Node.)
import { api } from "../../../dashboard/convex/_generated/api";

const JWT_KEY = "__convexAuthJWT";
const REFRESH_KEY = "__convexAuthRefreshToken";

export interface SignInResult {
  token: string;
  refreshToken: string;
}

/**
 * Mints a Convex Auth session for the given Cornell email and plants the
 * tokens in localStorage so the next page.goto() sees the user as signed in.
 */
export async function signInAs(
  page: Page,
  email: string,
  name?: string,
): Promise<SignInResult> {
  if (!email.toLowerCase().endsWith("@cornell.edu")) {
    throw new Error(
      `signInAs: "${email}" is not a Cornell address; the auth callback rejects it.`,
    );
  }
  const client = new ConvexHttpClient(getConvexUrl());
  const result = await client.action(api.dev.triggerTestSignIn, {
    email,
    name,
  });

  const namespace = authStorageNamespace();
  const tokenKey = `${JWT_KEY}_${namespace}`;
  const refreshKey = `${REFRESH_KEY}_${namespace}`;

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
    {
      tokenKey,
      refreshKey,
      token: result.token,
      refreshToken: result.refreshToken,
    },
  );

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
