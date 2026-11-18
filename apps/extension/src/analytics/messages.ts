/**
 * The message protocol between the panel UI (content script) and the service
 * worker, which is the only place that talks to PostHog.
 *
 * The panel runs inside Gmail's and Calendar's origins. Loading posthog-js
 * there would put cookies and localStorage on Google's pages, pull in the
 * remote recorder and surveys bundles that MV3 forbids, and give us a second
 * place where a tracking bug could break the host page. So the panel only
 * ever posts a plain message; the worker owns identity and the network call.
 */

import type {
  AnalyticsEventName,
  AnalyticsEventProperties,
  IdentityProperties,
} from "@app/analytics";

/**
 * Opt-out preference. Written by the panel's privacy toggle, read by the
 * worker before every send, so turning analytics off takes effect even for
 * events already sitting in a queue.
 */
export const OPT_OUT_KEY = "loop.analytics.opt_out";

export const TRACK_MESSAGE = "LOOP_TRACK";
export const IDENTIFY_MESSAGE = "LOOP_IDENTIFY";
export const RESET_MESSAGE = "LOOP_ANALYTICS_RESET";

/** Property values PostHog accepts without further encoding. */
export type AnalyticsPropertyValue = string | number | boolean | string[];

export interface TrackMessage {
  type: typeof TRACK_MESSAGE;
  name: AnalyticsEventName;
  properties: Record<string, AnalyticsPropertyValue>;
  /** Client clock, so a queued event keeps the time it actually happened. */
  timestampMs: number;
}

export interface IdentifyMessage {
  type: typeof IDENTIFY_MESSAGE;
  userId: string;
  setOnce: IdentityProperties;
}

export interface ResetMessage {
  type: typeof RESET_MESSAGE;
}

export type AnalyticsMessage = TrackMessage | IdentifyMessage | ResetMessage;

/**
 * Every event name the worker will forward. Typed as a full record of the
 * schema so adding an event to `@app/analytics` without listing it here is a
 * compile error, and messages from the content script — the least trusted
 * surface we have — are checked against it instead of being relayed blind.
 */
const KNOWN_EVENTS: Record<AnalyticsEventName, true> = {
  app_opened: true,
  account_created: true,
  onboarding_started: true,
  onboarding_step_completed: true,
  onboarding_completed: true,
  onboarding_skipped: true,
  event_viewed: true,
  event_rsvp: true,
  event_link_clicked: true,
  event_added_to_calendar: true,
  event_bookmarked: true,
  listserv_subscribed: true,
  search_performed: true,
  filter_used: true,
  club_viewed: true,
  club_followed: true,
  post_viewed: true,
  post_engaged: true,
  extension_installed: true,
};

function isEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === "string" && Object.hasOwn(KNOWN_EVENTS, value);
}

function isPropertyValue(value: unknown): value is AnalyticsPropertyValue {
  if (Array.isArray(value)) return value.every((v) => typeof v === "string");
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Copies an event's properties into a plain bag, dropping anything that isn't
 * a PostHog-safe scalar. Nothing in the schema is droppable today; this is how
 * we get from a typed payload to a serialisable one without a cast.
 */
function toPropertyBag(
  properties: object,
): Record<string, AnalyticsPropertyValue> {
  const bag: Record<string, AnalyticsPropertyValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (isPropertyValue(value)) bag[key] = value;
  }
  return bag;
}

function isPropertyBag(
  value: unknown,
): value is Record<string, AnalyticsPropertyValue> {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).every(isPropertyValue);
}

function readField(value: object, key: string): unknown {
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key) return entryValue;
  }
  return undefined;
}

/**
 * Narrows an untrusted `chrome.runtime.onMessage` payload. Returns null for
 * anything that isn't one of ours, including the OAuth messages the worker
 * also handles.
 */
export function parseAnalyticsMessage(raw: unknown): AnalyticsMessage | null {
  if (typeof raw !== "object" || raw === null) return null;
  const type = readField(raw, "type");

  if (type === TRACK_MESSAGE) {
    const name = readField(raw, "name");
    const properties = readField(raw, "properties");
    const timestampMs = readField(raw, "timestampMs");
    if (!isEventName(name)) return null;
    if (!isPropertyBag(properties)) return null;
    if (typeof timestampMs !== "number") return null;
    return { type: TRACK_MESSAGE, name, properties, timestampMs };
  }

  if (type === IDENTIFY_MESSAGE) {
    const userId = readField(raw, "userId");
    const setOnce = readField(raw, "setOnce");
    if (typeof userId !== "string" || userId.length === 0) return null;
    if (typeof setOnce !== "object" || setOnce === null) return null;
    const cohort = readField(setOnce, "cohort");
    const firstSeenAt = readField(setOnce, "first_seen_at");
    if (cohort !== "pre_analytics" && cohort !== "post_analytics") return null;
    if (typeof firstSeenAt !== "string") return null;
    return {
      type: IDENTIFY_MESSAGE,
      userId,
      setOnce: { cohort, first_seen_at: firstSeenAt },
    };
  }

  if (type === RESET_MESSAGE) return { type: RESET_MESSAGE };

  return null;
}

/** Compile-time guarantee that a tracked payload matches the shared schema. */
export function toTrackMessage<K extends AnalyticsEventName>(
  name: K,
  properties: AnalyticsEventProperties[K],
  timestampMs: number,
): TrackMessage {
  return {
    type: TRACK_MESSAGE,
    name,
    properties: toPropertyBag(properties),
    timestampMs,
  };
}
