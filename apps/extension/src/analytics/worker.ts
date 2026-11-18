/**
 * PostHog transport, service-worker side.
 *
 * Everything here has to survive the worker being torn down after ~30s idle,
 * so there is no module-level mutable state and no `setTimeout`: identity, the
 * opt-out flag, and the retry queue all live in `chrome.storage.local` and are
 * re-read on every event. Events are posted with plain `fetch` to the capture
 * API — the same approach as `convex/analytics.ts` — which keeps the extension
 * free of remotely hosted code, as MV3 and the Web Store require.
 *
 * Privacy: the only identifier sent is the Convex user id (or a random local
 * UUID before sign-in). No email, name, page URL, or Gmail content.
 */

import type { AnalyticsPlatform } from "@app/analytics";
import {
  IDENTIFY_MESSAGE,
  OPT_OUT_KEY,
  RESET_MESSAGE,
  TRACK_MESSAGE,
  type AnalyticsMessage,
  type AnalyticsPropertyValue,
  type IdentifyMessage,
  type TrackMessage,
} from "./messages";

const DEFAULT_HOST = "https://us.i.posthog.com";

const ANON_ID_KEY = "loop.analytics.anon_id";
const DISTINCT_ID_KEY = "loop.analytics.distinct_id";
const QUEUE_KEY = "loop.analytics.queue";

/** Keeps a long offline stretch from growing storage without bound. */
const MAX_QUEUED_EVENTS = 50;

interface CapturePayload {
  event: string;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, AnalyticsPropertyValue>;
}

const posthogKey: string | undefined = import.meta.env.VITE_POSTHOG_KEY;
const posthogHost: string = (
  import.meta.env.VITE_POSTHOG_HOST ?? DEFAULT_HOST
).replace(/\/$/, "");

/** False for contributor builds with no key, which makes every call a no-op. */
function configured(): boolean {
  return typeof posthogKey === "string" && posthogKey.length > 0;
}

// ─── Storage helpers ─────────────────────────────────────────────────────────
// chrome.storage throws once the extension context is invalidated (reload or
// update while a tab is still open). Analytics must never surface that, so
// reads fall back to a safe default and writes are dropped.

async function readLocal(key: string): Promise<unknown> {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key];
  } catch {
    return undefined;
  }
}

async function writeLocal(key: string, value: unknown): Promise<void> {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch {
    // Nothing to do — the value just won't persist.
  }
}

async function optedOut(): Promise<boolean> {
  return (await readLocal(OPT_OUT_KEY)) === true;
}

/**
 * The pre-sign-in identifier. Persisted so a student's activity before and
 * after signing in belongs to one person rather than two.
 */
async function anonymousId(): Promise<string> {
  const existing = await readLocal(ANON_ID_KEY);
  if (typeof existing === "string" && existing.length > 0) return existing;
  const generated = crypto.randomUUID();
  await writeLocal(ANON_ID_KEY, generated);
  return generated;
}

async function distinctId(): Promise<string> {
  const identified = await readLocal(DISTINCT_ID_KEY);
  if (typeof identified === "string" && identified.length > 0) {
    return identified;
  }
  return anonymousId();
}

// ─── Super properties ────────────────────────────────────────────────────────

function extensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return "unknown";
  }
}

function superProperties(): Record<string, AnalyticsPropertyValue> {
  return {
    platform: "extension" satisfies AnalyticsPlatform,
    environment: import.meta.env.DEV ? "development" : "production",
    extension_version: extensionVersion(),
  };
}

// ─── Queue ───────────────────────────────────────────────────────────────────
// A failed send is retried on the next event rather than from a chrome.alarms
// timer, which would mean adding the `alarms` permission and re-prompting
// every existing user for approval. Analytics is not worth that.

function isCapturePayload(value: unknown): value is CapturePayload {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return (
    typeof record["event"] === "string" &&
    typeof record["distinct_id"] === "string" &&
    typeof record["timestamp"] === "string" &&
    typeof record["properties"] === "object" &&
    record["properties"] !== null
  );
}

async function readQueue(): Promise<CapturePayload[]> {
  const stored = await readLocal(QUEUE_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isCapturePayload);
}

async function writeQueue(events: CapturePayload[]): Promise<void> {
  await writeLocal(QUEUE_KEY, events.slice(-MAX_QUEUED_EVENTS));
}

// ─── Sending ─────────────────────────────────────────────────────────────────

async function postBatch(events: CapturePayload[]): Promise<boolean> {
  if (events.length === 0) return true;
  if (typeof posthogKey !== "string") return false;

  try {
    const response = await fetch(`${posthogHost}/batch/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: posthogKey, batch: events }),
    });
    return response.ok;
  } catch {
    // Offline, or the request was blocked. Caller re-queues.
    return false;
  }
}

/**
 * Sends the event together with anything stranded by an earlier failure. On
 * failure the whole set goes back to the queue, so an event is never dropped
 * because the student happened to be offline when they bookmarked something.
 */
async function send(payload: CapturePayload): Promise<void> {
  const queued = await readQueue();
  const batch = [...queued, payload];

  if (await postBatch(batch)) {
    if (queued.length > 0) await writeQueue([]);
    return;
  }

  await writeQueue(batch);
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function handleTrack(message: TrackMessage): Promise<void> {
  await send({
    event: message.name,
    distinct_id: await distinctId(),
    timestamp: new Date(message.timestampMs).toISOString(),
    properties: { ...superProperties(), ...message.properties },
  });
}

/**
 * Ties the local anonymous id to the Convex user id. `$anon_distinct_id` is
 * what merges the two into one person in PostHog, so extension activity lands
 * on the same profile as the web dashboard's.
 */
async function handleIdentify(message: IdentifyMessage): Promise<void> {
  const previous = await readLocal(DISTINCT_ID_KEY);
  if (previous === message.userId) return;

  const anon = await anonymousId();
  await writeLocal(DISTINCT_ID_KEY, message.userId);

  await send({
    event: "$identify",
    distinct_id: message.userId,
    timestamp: new Date().toISOString(),
    properties: {
      ...superProperties(),
      $anon_distinct_id: anon,
      $set_once: JSON.stringify(message.setOnce),
    },
  });
}

/**
 * Forgets the signed-in person and the anonymous id behind them, so the next
 * student to sign in on a shared machine starts a new profile instead of
 * inheriting this one's history.
 */
async function handleReset(): Promise<void> {
  try {
    await chrome.storage.local.remove([DISTINCT_ID_KEY, ANON_ID_KEY]);
  } catch {
    // Context gone; the ids die with it.
  }
}

/**
 * Handles one parsed analytics message. Always resolves: a tracking failure
 * must never propagate into the panel or the OAuth flow the worker also runs.
 */
export async function handleAnalyticsMessage(
  message: AnalyticsMessage,
): Promise<void> {
  if (!configured()) return;

  try {
    if (message.type === RESET_MESSAGE) {
      await handleReset();
      return;
    }
    if (await optedOut()) return;
    if (message.type === IDENTIFY_MESSAGE) {
      await handleIdentify(message);
      return;
    }
    if (message.type === TRACK_MESSAGE) await handleTrack(message);
  } catch {
    // Best effort by design.
  }
}

/**
 * `extension_installed` is the only acquisition signal we get for the Chrome
 * Web Store listing, and it fires before anyone signs in — so it goes out
 * against the anonymous id and is merged into the person at identify time.
 */
export async function captureInstall(): Promise<void> {
  if (!configured()) return;
  if (await optedOut()) return;

  try {
    await send({
      event: "extension_installed",
      distinct_id: await anonymousId(),
      timestamp: new Date().toISOString(),
      properties: {
        ...superProperties(),
        version: extensionVersion(),
      },
    });
  } catch {
    // Best effort by design.
  }
}
