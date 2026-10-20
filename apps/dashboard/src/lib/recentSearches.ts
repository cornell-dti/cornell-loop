import type { RecentSearch } from "../data/sampleSearch";

/**
 * Client-local (per-browser, not per-account) persistence for Home's
 * "Recent" search dropdown. A server-persisted table would need a schema
 * change; this is the pragmatic version until that's worth doing.
 */
const STORAGE_KEY = "loop:recentSearches";
const MAX_RECENTS = 6;

function isRecentSearch(value: unknown): value is RecentSearch {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.label === "string" &&
    (candidate.kind === "query" || candidate.kind === "org")
  );
}

/** Reads persisted recent searches. Returns `[]` on any parse/storage error
 * (private browsing, corrupted value, storage disabled, etc). */
export function loadRecentSearches(): RecentSearch[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentSearch).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

/** Persists recent searches. Silently no-ops if storage is unavailable. */
export function saveRecentSearches(recents: readonly RecentSearch[]): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(recents.slice(0, MAX_RECENTS)),
    );
  } catch {
    // Storage disabled/full — recents just won't persist this session.
  }
}
