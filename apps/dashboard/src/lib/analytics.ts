/**
 * analytics — the single typed entry point for every PostHog event the web
 * dashboard sends.
 *
 * Everything funnels through `track()`, whose overload is keyed off
 * `AnalyticsEventProperties` from `@app/analytics`. Adding an event means
 * adding a key there; the compiler then refuses any call with a misspelled
 * name or the wrong property shape, which is what keeps the definitions in
 * PostHog aligned with the code — and keeps the extension sending the same
 * shapes as the web app.
 *
 * Privacy: we identify people by their Convex `users` id and nothing else. No
 * email, name, major, grad year, or raw search text is ever attached to an
 * event — see `search_performed`, which sends `query_length` instead of the
 * query itself.
 */

import posthog from "posthog-js";
import type {
  AnalyticsEventName,
  AnalyticsEventProperties,
  AnalyticsPlatform,
  IdentityProperties,
} from "@app/analytics";

export type {
  AnalyticsEventName,
  AnalyticsEventProperties,
  AnalyticsPlatform,
  AnalyticsSurface,
  IdentityProperties,
} from "@app/analytics";

const posthogKey: string | undefined = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost: string | undefined = import.meta.env.VITE_POSTHOG_HOST;

/**
 * PostHog only runs when a key is configured. Preview builds and contributors
 * without the env var get a silent no-op rather than a console full of errors
 * or, worse, a crash on a deployed page.
 */
let initialized = false;

export function initAnalytics(): boolean {
  if (initialized) return true;
  if (typeof posthogKey !== "string" || posthogKey.length === 0) return false;

  posthog.init(posthogKey, {
    api_host: posthogHost,
    defaults: "2026-05-30",
    // React Router navigations are history changes, not page loads.
    capture_pageview: "history_change",
  });

  posthog.register({
    platform: "web" satisfies AnalyticsPlatform,
    environment: import.meta.env.DEV ? "development" : "production",
  });

  initialized = true;
  return true;
}

export function track<K extends AnalyticsEventName>(
  name: K,
  properties: AnalyticsEventProperties[K],
): void {
  if (!initialized) return;
  posthog.capture(name, properties);
}

export function identifyUser(
  userId: string,
  setOnce: IdentityProperties,
): void {
  if (!initialized) return;
  posthog.identify(userId, undefined, setOnce);
}

/**
 * Registered on every subsequent event so first-time and returning behaviour
 * can be split with a single breakdown.
 */
export function registerSessionProperties(properties: {
  is_first_session: boolean;
  onboarded: boolean;
}): void {
  if (!initialized) return;
  posthog.register(properties);
}

/** Clears the identified person so the next user doesn't inherit this one. */
export function resetAnalytics(): void {
  if (!initialized) return;
  posthog.reset();
}

// ─── Local flags ─────────────────────────────────────────────────────────────
// Storage access is wrapped because Safari private browsing and embedded
// webviews throw on `localStorage`. Analytics must never break the page, so a
// throw degrades to "treat it as already seen" rather than bubbling up.

const SEEN_KEY = "loop.analytics.seen";
const FIRST_ACTION_KEY = "loop.analytics.first_action_done";

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return true;
  }
}

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Nothing to do — the flag just won't persist.
  }
}

/**
 * True the first time this browser ever sees Loop, false afterwards. Reading
 * it marks the browser as seen, so call it once per app load.
 */
export function consumeFirstSession(): boolean {
  const seen = readFlag(SEEN_KEY);
  if (!seen) writeFlag(SEEN_KEY);
  return !seen;
}

/**
 * True for the user's very first meaningful interaction (RSVP, bookmark, or
 * follow) and false forever after. Stamped onto those events as
 * `is_first_action` so time-to-activation is a single query in PostHog
 * instead of a join across event types.
 */
export function consumeFirstAction(): boolean {
  const done = readFlag(FIRST_ACTION_KEY);
  if (!done) writeFlag(FIRST_ACTION_KEY);
  return !done;
}
