/**
 * Data hooks for the extension.
 *
 * All hooks call the shared Convex backend (same deployment as the dashboard).
 * Raw Convex results are mapped through mapper.ts before being returned;
 * UI components only ever see EventItem, never Convex Doc types.
 */

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@app/convex/_generated/api";
import type { Id } from "@app/convex/_generated/dataModel";
import type { Doc } from "@app/convex/_generated/dataModel";
import { mapHydratedEventToEventItem } from "./mapper";
import type { EventItem } from "./types";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrgSection {
  /** Stable key — primary org _id, or orgName when no org is linked. */
  orgId: string;
  orgName: string;
  events: EventItem[];
}

/**
 * Type predicate that narrows a string to Id<"events">.
 * All EventItem.id values originate from event._id in the mapper, so the
 * narrowing is sound even though the brand cannot be checked at runtime.
 */
function isEventId(id: string): id is Id<"events"> {
  return id.length > 0;
}

// ── Feed ───────────────────────────────────────────────────────────────────

/**
 * Events from followed orgs in the last 14 days, grouped by org.
 * Falls back to an empty array while loading.
 */
export function useFeedSections(): OrgSection[] {
  // All hook calls must precede any early returns.
  // eslint-disable-next-line react-hooks/purity
  const cutoff = useMemo(() => Date.now() - TWO_WEEKS_MS, []);

  const result = useQuery(api.events.feed, {
    paginationOpts: { numItems: 50, cursor: null },
    scope: "followed",
  });

  if (result === undefined) return [];

  const orgMap = new Map<string, { orgName: string; events: EventItem[] }>();
  for (const hydrated of result.page) {
    if (hydrated.sentAt !== undefined && hydrated.sentAt < cutoff) continue;

    const item = mapHydratedEventToEventItem(hydrated);
    // Group by primary org _id for stable keys (not display name strings)
    const orgKey = hydrated.orgs[0]?._id ?? item.orgName;
    const section = orgMap.get(orgKey) ?? { orgName: item.orgName, events: [] };
    section.events.push(item);
    orgMap.set(orgKey, section);
  }

  return Array.from(orgMap.entries()).map(([orgId, { orgName, events }]) => ({
    orgId,
    orgName,
    events,
  }));
}

/**
 * Up to 4 trending events from the last 14 days, recency-ordered.
 * Falls back to an empty array while loading.
 */
export function useTrendingEvents(): EventItem[] {
  // All hook calls must precede any early returns.
  // eslint-disable-next-line react-hooks/purity
  const cutoff = useMemo(() => Date.now() - TWO_WEEKS_MS, []);

  const result = useQuery(api.events.feed, {
    paginationOpts: { numItems: 20, cursor: null },
    scope: "all",
  });

  if (result === undefined) return [];

  return result.page
    .filter((h) => h.sentAt === undefined || h.sentAt >= cutoff)
    .slice(0, 4)
    .map(mapHydratedEventToEventItem);
}

// ── Search ─────────────────────────────────────────────────────────────────

/**
 * Full-text search results from api.events.searchEvents.
 * Returns an empty array when query is < 2 chars or while loading.
 */
export function useSearchResults(query: string): EventItem[] {
  const result = useQuery(
    api.events.searchEvents,
    query.trim().length >= 2 ? { q: query } : "skip",
  );

  if (result === undefined) return [];
  return result.map(mapHydratedEventToEventItem);
}

// ── Bookmarks ──────────────────────────────────────────────────────────────

type HydratedBookmark = {
  bookmark: Doc<"bookmarks">;
  event: Doc<"events">;
  orgs: Doc<"orgs">[];
};

function mapBookmark(b: HydratedBookmark): EventItem {
  return mapHydratedEventToEventItem({
    event: b.event,
    orgs: b.orgs,
    isBookmarked: true,
  });
}

/**
 * Returns { ids, events } derived from the user's Convex bookmark list.
 * ids  — Set<string> for fast lookup in feed/search rows.
 * events — full EventItem list for BookmarkView.
 * Falls back to empty while loading or unauthenticated.
 */
export function useBookmarks(): { ids: Set<string>; events: EventItem[] } {
  const result = useQuery(api.bookmarks.myBookmarks, {
    paginationOpts: { numItems: 100, cursor: null },
  });

  if (result === undefined) return { ids: new Set(), events: [] };

  const events = result.page.map(mapBookmark);
  const ids = new Set(result.page.map((b) => b.event._id as string));
  return { ids, events };
}

// ── Email content ──────────────────────────────────────────────────────────

/**
 * Fetches raw email content for OriginalEmailView.
 * Returns undefined while loading, null when no content is found.
 */
export function useEmailContent(
  eventId: string | undefined,
): { subject: string; paragraphs: string[] } | null | undefined {
  const typedId =
    eventId !== undefined && isEventId(eventId) ? eventId : undefined;
  return useQuery(
    api.events.getEmailContent,
    typedId !== undefined ? { eventId: typedId } : "skip",
  );
}
