/**
 * events — the PostHog event schema shared by every Loop client.
 *
 * Types only, no runtime dependency on posthog-js, because the two clients
 * send events in completely different ways: the dashboard uses posthog-js in
 * the page, the extension posts to the capture API from its service worker.
 * What they must agree on is the shape of each event, which is what lives
 * here.
 *
 * Privacy: people are identified by their Convex `users` id and nothing else.
 * No email, name, major, grad year, or raw search text is ever attached to an
 * event — see `search_performed`, which sends `query_length` instead of the
 * query itself.
 */

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
 * carries it, which is what makes "extension vs web" a single breakdown.
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
  /**
   * Leaving Loop for an org's own RSVP, application, or registration page.
   * Deliberately separate from `event_rsvp`: we only know the student opened
   * the link, not that they went. Folding the two together would overstate
   * RSVPs on whichever surface happens to show outbound links.
   */
  event_link_clicked: {
    event_id: string;
    org_ids: string[];
    link_type: "rsvp" | "application" | "registration" | "other";
    surface: AnalyticsSurface;
  };
  /** Opening the Google Calendar "add event" page for an event. */
  event_added_to_calendar: {
    event_id: string;
    org_ids: string[];
    surface: AnalyticsSurface;
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
  /** Fired once from the extension's `chrome.runtime.onInstalled`. */
  extension_installed: {
    version: string;
  };
}

export type AnalyticsEventName = keyof AnalyticsEventProperties;

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

/**
 * Anyone whose account predates analytics can never produce an
 * `account_created` or `onboarding_*` event, so they'd read as a silently
 * broken funnel. Tagging them `pre_analytics` lets every acquisition and
 * retention insight filter them out.
 *
 * Set to the ship date of the analytics integration.
 */
export const ANALYTICS_LAUNCH_AT = Date.parse("2026-11-17T00:00:00Z");
