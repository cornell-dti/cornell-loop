/**
 * Extension Google sign-in.
 *
 * `useAuthActions().signIn("google")` assigns window.location unless
 * navigator.product is ReactNative, which would navigate Gmail/Calendar away.
 * We call auth:signIn through the Convex client, then open a normal tab
 * (launchWebAuthFlow cannot load accounts.google.com).
 */

import type { ConvexReactClient } from "convex/react";
import { api } from "@app/convex/_generated/api";
import { extensionStorage } from "./extensionStorage";

interface SignInActions {
  signIn: (
    provider: string,
    params?: { code?: string; redirectTo?: string },
  ) => Promise<{ signingIn: boolean; redirect?: URL }>;
}

function convexAuthVerifierKey(): string {
  const raw = import.meta.env.VITE_CONVEX_URL;
  const namespace =
    typeof raw === "string" ? raw.replace(/[^a-zA-Z0-9]/g, "") : "";
  return `__convexAuthOAuthVerifier_${namespace}`;
}

function isRedirectStart(value: unknown): value is {
  redirect: string;
  verifier: string;
} {
  if (typeof value !== "object" || value === null) return false;
  if (!("redirect" in value) || !("verifier" in value)) return false;
  return (
    typeof value.redirect === "string" && typeof value.verifier === "string"
  );
}

function readRedirectTo(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  if (!("redirectTo" in value) || typeof value.redirectTo !== "string") {
    return null;
  }
  return value.redirectTo;
}

function readOAuthResponse(value: unknown): {
  ok: boolean;
  redirectUrl?: string;
  error?: string;
} {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "empty background response" };
  }
  const ok = "ok" in value && value.ok === true;
  const redirectUrl =
    "redirectUrl" in value && typeof value.redirectUrl === "string"
      ? value.redirectUrl
      : undefined;
  const error =
    "error" in value && typeof value.error === "string"
      ? value.error
      : undefined;
  return { ok, redirectUrl, error };
}

function codeFromRedirectUrl(redirectUrl: string): string | null {
  try {
    const parsed = new URL(redirectUrl);
    const code = parsed.searchParams.get("code");
    return code !== null && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}

export async function signInWithGoogle(args: {
  convex: ConvexReactClient;
  signIn: SignInActions["signIn"];
}): Promise<void> {
  const { convex, signIn } = args;

  const redirectLookup = await chrome.runtime.sendMessage({
    type: "LOOP_GET_REDIRECT_URL",
  });
  const redirectTo = readRedirectTo(redirectLookup);
  if (redirectTo === null) {
    throw new Error("Could not read chrome.identity redirect URL");
  }

  const start = await convex.action(api.auth.signIn, {
    provider: "google",
    params: { redirectTo },
  });

  if (!isRedirectStart(start)) {
    throw new Error("auth:signIn did not return a redirect URL");
  }

  await extensionStorage.setItem(convexAuthVerifierKey(), start.verifier);

  const raw = await chrome.runtime.sendMessage({
    type: "LOOP_START_OAUTH",
    url: start.redirect,
    redirectTo,
  });
  const oauth = readOAuthResponse(raw);
  if (!oauth.ok || oauth.redirectUrl === undefined) {
    throw new Error(oauth.error ?? "Sign-in tab failed");
  }

  const code = codeFromRedirectUrl(oauth.redirectUrl);
  if (code === null) {
    throw new Error("No code on chromiumapp redirect");
  }

  await signIn("google", { code });
}
