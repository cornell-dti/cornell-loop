/**
 * DEV-only auto sign-in helper.
 *
 * In production this component is tree-shaken to nothing — it's only mounted
 * when `import.meta.env.DEV` is true. When mounted and no Convex Auth tokens
 * are present in localStorage, it:
 *
 *   1. Calls `api.dev.triggerDevAutoLogin` (a server-side action gated by
 *      `assertDev()`) which:
 *      - Idempotently runs `seed:seedAll` to ensure orgs/events exist.
 *      - Mints a real Convex Auth session for `dev@cornell.edu`.
 *      - Seeds that user's profile + 4 follows + 2 bookmarks so Home,
 *        Bookmarks, and Subscriptions all have content immediately.
 *   2. Writes the returned JWT + refresh token into localStorage under the
 *      keys `@convex-dev/auth/react` looks for (`__convexAuthJWT_<ns>` and
 *      `__convexAuthRefreshToken_<ns>`, where `<ns>` is the deployment URL
 *      with all non-alphanumerics stripped).
 *   3. Reloads the page so the auth provider boots with the new identity.
 *
 * If tokens are already present (e.g. from a prior dev session, or because
 * Playwright planted them via `page.addInitScript`), this component does
 * nothing.
 *
 * If the auto-login fails for any reason (e.g. Convex deployment isn't
 * running yet) we surface a tiny dev-only banner in the top-right corner so
 * the failure isn't silently swallowed. Production builds never render this
 * component, so the banner is impossible there.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { Button } from "@app/ui";
import { api } from "../../convex/_generated/api";

const JWT_KEY = "__convexAuthJWT";
const REFRESH_KEY = "__convexAuthRefreshToken";

function authStorageNamespace(convexUrl: string): string {
  return convexUrl.replace(/[^a-zA-Z0-9]/g, "");
}

function tokensPresent(namespace: string): boolean {
  return (
    window.localStorage.getItem(`${JWT_KEY}_${namespace}`) !== null &&
    window.localStorage.getItem(`${REFRESH_KEY}_${namespace}`) !== null
  );
}

export function DevAutoSignIn() {
  // Guard against React 18 strict-mode double-invocation racing two
  // simultaneous sign-in actions.
  const ranRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const runAutoLogin = useCallback(() => {
    const convexUrl = import.meta.env.VITE_CONVEX_URL;
    if (typeof convexUrl !== "string" || convexUrl.length === 0) return;

    const namespace = authStorageNamespace(convexUrl);
    if (tokensPresent(namespace)) return;

    void (async () => {
      try {
        const client = new ConvexHttpClient(convexUrl);
        const result = await client.action(api.dev.triggerDevAutoLogin, {});
        window.localStorage.setItem(`${JWT_KEY}_${namespace}`, result.token);
        window.localStorage.setItem(
          `${REFRESH_KEY}_${namespace}`,
          result.refreshToken,
        );
        // Reload so ConvexProviderWithAuth re-bootstraps with the new tokens.
        window.location.reload();
      } catch (err) {
        // Surface a tiny dev-only banner so the failure isn't silently lost
        // — but keep `console.warn` for the full diagnostic.
        console.warn("[DevAutoSignIn] auto-login skipped:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    })();
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (ranRef.current) return;
    ranRef.current = true;
    runAutoLogin();
  }, [runAutoLogin]);

  if (!import.meta.env.DEV || error === null) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        "fixed top-[var(--space-4)] right-[var(--space-4)] z-50",
        "flex items-center gap-[var(--space-3)]",
        "max-w-[20rem]",
        "rounded-[var(--radius-card)]",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "px-[var(--space-3)] py-[var(--space-2)]",
        "shadow-[var(--shadow-1)]",
      ].join(" ")}
    >
      <span
        className={[
          "font-[family-name:var(--font-body)] font-medium",
          "text-[length:var(--font-size-body3)] leading-[var(--line-height-body2)]",
          "tracking-[var(--letter-spacing-body3)]",
          "text-[var(--color-neutral-900)]",
        ].join(" ")}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Dev auto-login failed
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setError(null);
          runAutoLogin();
        }}
      >
        Retry
      </Button>
    </div>
  );
}
