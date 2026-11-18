/**
 * Safe, user-facing text for a caught Convex query/mutation/action failure.
 *
 * Only trusts the message carried by a `ConvexError` we threw ourselves on
 * the server (e.g. `authedAction`'s UNAUTHENTICATED/NON_CORNELL_EMAIL, or
 * `gmailMatches.scanRecentSenders`'s GMAIL_ACCOUNT_MISMATCH) — never an
 * arbitrary thrown `Error`'s `.message`, which can carry internal details
 * (upstream API response bodies, stack traces, Convex's own unredacted dev
 * deployment error text) that shouldn't reach the client.
 */

import { ConvexError } from "convex/values";

function readableMessage(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  if (!("message" in data)) return null;
  const { message } = data;
  return typeof message === "string" ? message : null;
}

export function convexErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const message = readableMessage(err.data);
    if (message !== null) return message;
  }
  return fallback;
}
