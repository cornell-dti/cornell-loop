/**
 * Playwright auth helper.
 *
 * Strategy
 * --------
 * Driving Google OAuth from a headless browser is impractical, so we mint a
 * real Convex Auth session server-side via a DEV-gated action and inject the
 * resulting JWT + refresh token into `localStorage` under the keys the
 * `@convex-dev/auth/react` provider expects.
 *
 *   1. `signInAs(page, email)` calls `api.dev.testSignIn` over the Convex HTTP
 *      client. This server-side action upserts a `users` row, invokes the
 *      `auth:store` internal mutation with `type: "signIn", generateTokens:
 *      true`, and returns a real RS256 JWT signed with the deployment's
 *      `JWT_PRIVATE_KEY` plus a refresh token.
 *   2. We use `page.addInitScript` so the next document load (and every
 *      subsequent one) sees the tokens already present in localStorage.
 *   3. The first navigation after `signInAs` triggers Convex's WebSocket
 *      handshake; the auth provider reads the token and `useQuery(api.users
 *      .currentUser)` resolves with the freshly-signed-in identity.
 *
 * Cleanup is handled by the test fixtures — `clearAuth(page)` wipes both
 * JWT and refresh-token keys so the next spec starts unauthenticated.
 */

import type { Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { authStorageNamespace, getConvexUrl } from "./env";

const JWT_KEY = "__convexAuthJWT";
const REFRESH_KEY = "__convexAuthRefreshToken";

export interface SignInResult {
  userId: Id<"users">;
  token: string;
  refreshToken: string;
}

/**
 * Signs the test user in by minting a Convex Auth session server-side and
 * planting the resulting tokens in `localStorage` for the next navigation.
 *
 * @param page  Playwright page that subsequent navigations will run on.
 * @param email Cornell-domain email; the helper asserts this matches the
 *              auth gate so a malformed email surfaces as a quick failure.
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
  const client = new ConvexHttpClient(getConvexUrl());
  const result = await client.action(api.dev.triggerTestSignIn, {
    email,
    name,
  });

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
