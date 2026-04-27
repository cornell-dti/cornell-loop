/**
 * Data hooks for the extension.
 *
 * All hooks return EventItem[] (or grouped OrgSection[]) derived from mock data.
 * When Convex queries are ready, swap MOCK_EVENTS for useQuery(api.events.list, ...)
 * and keep the same grouping/filtering logic here — nothing in the view layer changes.
 *
 * Import path for Convex (when ready):
 *   import { useQuery } from "convex/react";
 *   import { api } from "@app/convex/_generated/api";
 */

import { MOCK_EVENTS } from "./mockData";
import type { EventItem } from "./types";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrgSection {
  orgName: string;
  /** All events for this org (sorted newest first). FeedView slices to 3. */
  events: EventItem[];
}

// ── Feed ───────────────────────────────────────────────────────────────────

/**
 * Returns events from the last 14 days, sorted newest first, grouped by org.
 * Each OrgSection.events is sorted newest-first within the org.
 * The section order mirrors the first event's sentAt (org with freshest email first).
 */
export function useFeedSections(): OrgSection[] {
  const cutoff = Date.now() - TWO_WEEKS_MS;

  const recent = [...MOCK_EVENTS]
    .filter((e) => e.sentAt != null && e.sentAt >= cutoff)
    .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0));

  // Group preserving insertion order (= newest org first)
  const orgMap = new Map<string, EventItem[]>();
  for (const event of recent) {
    const existing = orgMap.get(event.orgName) ?? [];
    orgMap.set(event.orgName, [...existing, event]);
  }

  return Array.from(orgMap.entries()).map(([orgName, events]) => ({
    orgName,
    events,
  }));
}

/**
 * Returns trending events (last 14 days, newest-first, limited to 4).
 * Shows as standalone cards (not grouped) in the Trending section.
 * In production this will use bookmark/view counts; for now it's recency-based.
 */
export function useTrendingEvents(): EventItem[] {
  const cutoff = Date.now() - TWO_WEEKS_MS;
  return [...MOCK_EVENTS]
    .filter((e) => e.sentAt != null && e.sentAt >= cutoff)
    .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0))
    .slice(0, 4);
}

// ── Search ─────────────────────────────────────────────────────────────────

/**
 * Simple client-side search over all events.
 * Matches against title, orgName, and tags (case-insensitive).
 * Returns sorted newest-first.
 *
 * When Convex search is ready: replace body with
 *   return useQuery(api.search.search, { query }) ?? [];
 */
export function useSearchResults(query: string): EventItem[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return [...MOCK_EVENTS]
    .filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.orgName.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)),
    )
    .sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0));
}

// ── All events (for bookmark view) ────────────────────────────────────────

/**
 * Returns all events sorted newest-first.
 * BookmarkView filters this to the set of bookmarked IDs.
 */
export function useAllEvents(): EventItem[] {
  return [...MOCK_EVENTS].sort((a, b) => (b.sentAt ?? 0) - (a.sentAt ?? 0));
}
