/**
 * TokenStorage over chrome.storage.local so Gmail and Calendar share one
 * session. Content-script localStorage would be per-origin (mail.google.com
 * vs calendar.google.com vs the dashboard), which is why dashboard sign-out
 * cannot clear an extension session and why Gmail stayed signed in after
 * signing out on the web app.
 */
import type { TokenStorage } from "@convex-dev/auth/react";

function extensionContextAlive(): boolean {
  try {
    return (
      typeof chrome.runtime?.id === "string" && chrome.runtime.id.length > 0
    );
  } catch {
    return false;
  }
}

function isInvalidatedContextError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Extension context invalidated")
  );
}

async function ignoreIfInvalidated(run: () => Promise<void>): Promise<void> {
  if (!extensionContextAlive()) return;
  try {
    await run();
  } catch (error) {
    if (isInvalidatedContextError(error)) return;
    throw error;
  }
}

/** Writer tab skips its own chrome.storage.onChanged (refresh remount loop). */
let lastLocalWriteMs = 0;

function markLocalWrite(): void {
  lastLocalWriteMs = Date.now();
}

export function wasRecentLocalStorageWrite(): boolean {
  return Date.now() - lastLocalWriteMs < 1500;
}

function isPresent(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

/** True when JWT appears or disappears — not when it is merely refreshed. */
export function jwtPresenceFlipped(
  changes: Record<string, chrome.storage.StorageChange>,
): boolean {
  for (const [key, change] of Object.entries(changes)) {
    if (!key.startsWith("__convexAuthJWT")) continue;
    return isPresent(change.oldValue) !== isPresent(change.newValue);
  }
  return false;
}

export const extensionStorage: TokenStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!extensionContextAlive()) return null;
    try {
      const result = await chrome.storage.local.get(key);
      const value = result[key];
      return typeof value === "string" ? value : null;
    } catch (error) {
      if (isInvalidatedContextError(error)) return null;
      throw error;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    markLocalWrite();
    await ignoreIfInvalidated(async () => {
      await chrome.storage.local.set({ [key]: value });
    });
  },
  async removeItem(key: string): Promise<void> {
    markLocalWrite();
    await ignoreIfInvalidated(async () => {
      await chrome.storage.local.remove(key);
    });
  },
};
