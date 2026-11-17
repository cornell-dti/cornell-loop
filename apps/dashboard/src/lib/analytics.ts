/**
 * analytics — the single typed entry point for every PostHog event Loop sends.
 *
 * Everything funnels through `track()`, whose overload is keyed off
 * `AnalyticsEventProperties`. Adding an event means adding a key there; the
 * compiler then refuses any call with a misspelled name or the wrong property
 * shape, which is what keeps the dashboard definitions in PostHog aligned with
 * the code.
 *
 * Privacy: we identify people by their Convex `users` id and nothing else. No
 * email, name, major, grad year, or raw search text is ever attached to an
 * event — see `search_performed`, which sends `query_length` instead of the
 * query itself.
 */

import posthog from "posthog-js";

/** Where in the product an interaction happened. */
export type AnalyticsSurface =
  | "onboarding"
  | "feed"
  | "bookmarks"
  | "search"
  | "org_page"
  | "hovercard"
  | "subscriptions";

/**
 * Which client sent the event. Registered as a super property so every event
 * carries it; the extension phase sets `"extension"` from the same schema.
 */
export type AnalyticsPlatform = "web" | "extension";

type ToggleAction = "add" | "remove";

/**
 * Event name → property shape. The source of truth for both `track()` and the
 * event definitions configured in PostHog.
 *
 * `is_first_action` marks the first meaningful interaction a user ever takes
 * (RSVP, bookmark, or follow). Paired with `onboarding_completed`, it's what
 * makes time-to-activation measurable.
 */
export interface AnalyticsEventProperties {
  app_opened: {
    is_first_session: boolean;
    onboarded: boolean;
  };
  /**
   * Captured server-side from `convex/analytics.ts` so it fires exactly once,
   * on true account creation. Listed here so the schema stays complete and the
   * PostHog definitions can be generated from one place.
   */
  account_created: {
    signup_method: "google";
  };
  onboarding_started: {
    entry_point: "wizard";
  };
  onboarding_step_completed: {
    step: number;
    step_name: string;
    duration_ms: number;
    clubs_followed: number;
  };
  onboarding_completed: {
    total_duration_ms: number;
    clubs_followed: number;
  };
  onboarding_skipped: {
    at_step: number;
    /**
     * `exit` — left the wizard before finishing.
     * `profile_modal` — `users.updateProfile` auto-completed onboarding from
     * the profile modal, so the wizard was never walked through.
     */
    via: "exit" | "profile_modal";
  };
  event_viewed: {
    event_id: string;
    org_ids: string[];
    surface: AnalyticsSurface;
  };
  event_rsvp: {
    event_id: string;
    org_ids: string[];
    surface: AnalyticsSurface;
    status: "going";
    is_first_action: boolean;
  };
  event_bookmarked: {
    event_id: string;
    org_ids: string[];
    surface: AnalyticsSurface;
    action: ToggleAction;
    is_first_action: boolean;
  };
  listserv_subscribed: {
    org_id: string;
    surface: AnalyticsSurface;
    action: "subscribe" | "unsubscribe";
  };
  search_performed: {
    /** Length only — the raw query is deliberately never sent. */
    query_length: number;
    result_count: number | null;
    surface: AnalyticsSurface;
  };
  filter_used: {
    tag: string;
    /**
     * `select`/`deselect` narrow the feed. `pin`/`unpin` change which tags
     * the bar offers at all, which is a different signal: it says which
     * categories a student cares about even when they aren't filtering.
     */
    action: "select" | "deselect" | "pin" | "unpin";
    surface: AnalyticsSurface;
  };
  club_viewed: {
    org_id: string;
    slug: string;
    surface: AnalyticsSurface;
  };
  club_followed: {
    org_id: string;
    surface: AnalyticsSurface;
    action: "follow" | "unfollow";
    is_first_action: boolean;
  };
  /**
   * Club Communities surface — defined so the schema is complete, but not yet
   * instrumented because the UI doesn't exist.
   */
  post_viewed: {
    post_id: string;
    org_id: string;
    surface: AnalyticsSurface;
  };
  /** Club Communities surface — see `post_viewed`. */
  post_engaged: {
    post_id: string;
    org_id: string;
    engagement: "like" | "comment" | "share" | "link_click";
    surface: AnalyticsSurface;
  };
  /** Extension phase — fired from `chrome.runtime.onInstalled`. */
  extension_installed: {
    version: string;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventProperties;

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

/**
 * Person properties set on first identify. `$set_once` means a returning user
 * keeps their original values — important here because analytics launched
 * after Loop already had real users, and `pre_analytics` is how we exclude
 * them from acquisition and retention cohorts that would otherwise be wrong.
 */
export interface IdentityProperties {
  cohort: "pre_analytics" | "post_analytics";
  first_seen_at: string;
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
