/**
 * analytics — the typed entry point the panel UI uses to send PostHog events.
 *
 * Mirrors the dashboard's `src/lib/analytics.ts` API so a call site reads the
 * same in both clients, but nothing here touches the network: each call posts
 * a message to the service worker, which owns identity and the capture
 * request. See `messages.ts` for why.
 *
 * Privacy: people are identified by Convex user id only. `search_performed`
 * sends `query_length`, never the query itself.
 */

import type {
  AnalyticsEventName,
  AnalyticsEventProperties,
  IdentityProperties,
} from "@app/analytics";
import {
  IDENTIFY_MESSAGE,
  OPT_OUT_KEY,
  RESET_MESSAGE,
  toTrackMessage,
  type AnalyticsMessage,
} from "./messages";

const SEEN_KEY = "loop.analytics.seen";
const FIRST_ACTION_KEY = "loop.analytics.first_action_done";

/**
 * `chrome.runtime.sendMessage` rejects when the worker is asleep mid-wake or
 * the extension context has been invalidated by a reload. Neither is worth
 * surfacing: a dropped analytics event must never break the panel.
 */
function post(message: AnalyticsMessage): void {
  try {
    if (typeof chrome.runtime?.id !== "string") return;
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    // Extension context gone.
  }
}

export function track<K extends AnalyticsEventName>(
  name: K,
  properties: AnalyticsEventProperties[K],
): void {
  post(toTrackMessage(name, properties, Date.now()));
}

export function identifyUser(
  userId: string,
  setOnce: IdentityProperties,
): void {
  post({ type: IDENTIFY_MESSAGE, userId, setOnce });
}

export function resetAnalytics(): void {
  post({ type: RESET_MESSAGE });
}

// ─── Local flags ─────────────────────────────────────────────────────────────
// `chrome.storage` is async, but event handlers are not, so the two one-shot
// flags are hydrated once when the panel mounts and read synchronously after
// that. A click in the few milliseconds before hydration reads as "not the
// first time", which undercounts rather than inventing a first action.

interface FlagState {
  hydrated: boolean;
  seen: boolean;
  firstActionDone: boolean;
}

const flags: FlagState = {
  hydrated: false,
  seen: true,
  firstActionDone: true,
};

export async function hydrateAnalyticsFlags(): Promise<void> {
  if (flags.hydrated) return;
  try {
    const stored = await chrome.storage.local.get([SEEN_KEY, FIRST_ACTION_KEY]);
    flags.seen = stored[SEEN_KEY] === true;
    flags.firstActionDone = stored[FIRST_ACTION_KEY] === true;
  } catch {
    // Storage unavailable — keep the conservative defaults.
  }
  flags.hydrated = true;
}

function markFlag(key: string): void {
  try {
    void chrome.storage.local.set({ [key]: true }).catch(() => undefined);
  } catch {
    // Nothing to do — the flag just won't persist.
  }
}

/**
 * True the first time this browser ever opens the Loop panel. Reading it
 * marks the browser as seen, so call it once per panel mount.
 */
export function consumeFirstSession(): boolean {
  if (flags.seen) return false;
  flags.seen = true;
  markFlag(SEEN_KEY);
  return true;
}

/**
 * True for the student's very first meaningful interaction (bookmark, RSVP,
 * or follow) and false forever after, so time-to-activation is one query in
 * PostHog instead of a join across event types.
 */
export function consumeFirstAction(): boolean {
  if (flags.firstActionDone) return false;
  flags.firstActionDone = true;
  markFlag(FIRST_ACTION_KEY);
  return true;
}

// ─── Opt-out ─────────────────────────────────────────────────────────────────

export async function readOptOut(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(OPT_OUT_KEY);
    return stored[OPT_OUT_KEY] === true;
  } catch {
    return false;
  }
}

export async function writeOptOut(optedOut: boolean): Promise<void> {
  try {
    await chrome.storage.local.set({ [OPT_OUT_KEY]: optedOut });
  } catch {
    // Nothing to do — the preference just won't persist.
  }
}
