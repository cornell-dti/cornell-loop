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
 * query itself, and `sanitizeCapture`, which strips query strings out of the
 * URLs posthog-js attaches on its own.
 */

import posthog, { type CaptureResult, type Properties } from "posthog-js";
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

// ─── URL sanitisation ────────────────────────────────────────────────────────
// posthog-js stamps the current address onto every event and onto the initial
// person properties. Search lives at `/search?q=…`, so the raw query — the one
// thing `search_performed` deliberately reduces to a length — would still
// reach PostHog through `$current_url`, `$initial_current_url`,
// `$session_entry_url`, or `$referrer`. Dropping the query string and fragment
// from every URL-bearing property closes that path. The pathname survives, so
// pageview reports are unaffected.

const URL_PROPERTY_PATTERN = /url|referrer/i;

function stripQueryAndFragment(value: string): string {
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

function isPropertyBag(value: unknown): value is Properties {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeUrlProperties(properties: Properties): Properties {
  const sanitized: Properties = {};
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === "string" && URL_PROPERTY_PATTERN.test(key)) {
      sanitized[key] = stripQueryAndFragment(value);
    } else if (
      (key === "$set" || key === "$set_once") &&
      isPropertyBag(value)
    ) {
      sanitized[key] = sanitizeUrlProperties(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Runs on every event, including ones posthog-js captures on its own, which is
 * why this belongs in `init` rather than in `track()`.
 */
function sanitizeCapture(result: CaptureResult | null): CaptureResult | null {
  if (result === null) return null;

  const sanitized: CaptureResult = {
    ...result,
    properties: sanitizeUrlProperties(result.properties),
  };
  if (isPropertyBag(result.$set)) {
    sanitized.$set = sanitizeUrlProperties(result.$set);
  }
  if (isPropertyBag(result.$set_once)) {
    sanitized.$set_once = sanitizeUrlProperties(result.$set_once);
  }
  return sanitized;
}

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
    before_send: sanitizeCapture,
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
