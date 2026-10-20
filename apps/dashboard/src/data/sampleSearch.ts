/**
 * Type contracts for the search experience (Home's live-typing dropdown +
 * SearchOverlay). These used to ship with hardcoded fixture data; Home now
 * sources real data instead — recents from `localStorage`
 * (`../lib/recentSearches`), and suggestions from `api.events.searchEvents` /
 * `api.orgs.searchOrgs` — so only the shared shapes live here.
 */

// ─── Recent searches (empty state) ────────────────────────────────────────────

export interface RecentSearch {
  /** Stable id used as React key and for removal. */
  id: string;
  /** Display label. */
  label: string;
  /**
   * Visual hint:
   *   `query` — generic past query (history icon)
   *   `org`   — past visit to an org (round avatar dot)
   */
  kind: "query" | "org";
}

// ─── Typing-state suggestions ────────────────────────────────────────────────
//
// A flat list of searchable items the overlay renders while the user types.
// `kind` drives the leading icon: events get a newspaper glyph, orgs get a
// round avatar dot.

export interface SearchSuggestion {
  id: string;
  label: string;
  kind: "event" | "org";
  /** Optional secondary line (e.g. org name for an event suggestion). */
  meta?: string;
}
