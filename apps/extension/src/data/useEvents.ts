/**
 * Data hooks for the extension.
 *
 * All hooks call the shared Convex backend (same deployment as the dashboard).
 * Raw Convex results are mapped through mapper.ts before being returned;
 * UI components only ever see EventItem, never Convex Doc types.
 */

import { useMemo } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@app/convex/_generated/api";
import type { Doc } from "@app/convex/_generated/dataModel";
import type { PublicEvent } from "@app/convex/events";
import type { PublicOrg } from "@app/convex/orgs";
import { mapHydratedEventToEventItem } from "./mapper";
import type { EventId, EventItem } from "./types";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrgSection {
  /** Stable key — primary org _id, or orgName when no org is linked. */
  orgId: string;
  orgName: string;
  events: EventItem[];
}

/** Outcome of an email-content lookup, mirroring api.events.getEmailContent. */
export type EmailContent = FunctionReturnType<
  typeof api.events.getEmailContent
>;

// ── Feed ───────────────────────────────────────────────────────────────────

/**
 * Events from followed orgs in the last 14 days, grouped by org.
 * Falls back to an empty array while loading.
 */
export function useFeedSections(): OrgSection[] {
  const { isAuthenticated } = useConvexAuth();
  // All hook calls must precede any early returns.
  // eslint-disable-next-line react-hooks/purity
  const cutoff = useMemo(() => Date.now() - TWO_WEEKS_MS, []);

  const result = useQuery(
    api.events.feed,
    isAuthenticated
      ? {
          paginationOpts: { numItems: 50, cursor: null },
          scope: "followed",
        }
      : "skip",
  );

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
 * Up to 4 recent events from the last 14 days, recency-ordered.
 * Shown in the "New This Week" section of FeedView.
 * Falls back to an empty array while loading.
 */
export function useTrendingEvents(): EventItem[] {
  const { isAuthenticated } = useConvexAuth();
  // All hook calls must precede any early returns.
  // eslint-disable-next-line react-hooks/purity
  const cutoff = useMemo(() => Date.now() - TWO_WEEKS_MS, []);

  const result = useQuery(
    api.events.feed,
    isAuthenticated
      ? {
          paginationOpts: { numItems: 20, cursor: null },
          scope: "all",
        }
      : "skip",
  );

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
  const { isAuthenticated } = useConvexAuth();
  const result = useQuery(
    api.events.searchEvents,
    isAuthenticated && query.trim().length >= 2 ? { q: query } : "skip",
  );

  if (result === undefined) return [];
  return result.map(mapHydratedEventToEventItem);
}

// ── Bookmarks ──────────────────────────────────────────────────────────────

type HydratedBookmark = {
  bookmark: Doc<"bookmarks">;
  event: PublicEvent;
  orgs: PublicOrg[];
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
  const { isAuthenticated } = useConvexAuth();
  const result = useQuery(
    api.bookmarks.myBookmarks,
    isAuthenticated
      ? { paginationOpts: { numItems: 100, cursor: null } }
      : "skip",
  );

  if (result === undefined) return { ids: new Set(), events: [] };

  const events = result.page.map(mapBookmark);
  const ids = new Set<string>(result.page.map((b) => b.event._id));
  return { ids, events };
}

// ── Email content ──────────────────────────────────────────────────────────

/**
 * Fetches raw email content for OriginalEmailView.
 * Returns undefined while loading; otherwise a tagged EmailContent whose
 * status distinguishes a successful load from "noEmail" and "unavailable".
 */
export function useEmailContent(
  eventId: EventId | undefined,
): EmailContent | undefined {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(
    api.events.getEmailContent,
    isAuthenticated && eventId !== undefined ? { eventId } : "skip",
  );
}
