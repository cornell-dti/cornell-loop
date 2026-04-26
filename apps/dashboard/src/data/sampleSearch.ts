/**
 * Sample data for the search experience.
 *
 * Convex schema currently doesn't carry search index/recents, so these
 * constants drive the empty-state ("Recent"), typing-state (live suggestions),
 * and results-state (matched orgs/events) inside the SearchOverlay.
 *
 * Content here is original placeholder copy.
 */

import type { DashboardPostProps } from "@app/ui";
import { SAMPLE_POSTS } from "./sampleHome";

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

export const SAMPLE_RECENT_SEARCHES: RecentSearch[] = [
  { id: "r1", kind: "query", label: "WICC" },
  { id: "r2", kind: "query", label: "Free things to do" },
  { id: "r3", kind: "query", label: "Mentors" },
  { id: "r4", kind: "org", label: "Cornell Outing Club" },
];

// ─── Typing-state suggestions ────────────────────────────────────────────────
//
// A flat list of searchable items the overlay filters substring-style as the
// user types. `kind` drives the leading icon: events get a newspaper glyph,
// orgs get a round avatar dot. Mirrors the Figma "typed" state which mixes
// event suggestions with one org suggestion.

export interface SearchSuggestion {
  id: string;
  label: string;
  kind: "event" | "org";
  /** Optional secondary line (e.g. org name for an event suggestion). */
  meta?: string;
}

export const SAMPLE_SUGGESTIONS: SearchSuggestion[] = [
  {
    id: "s1",
    label: "Sunrise hike at Taughannock Falls",
    kind: "event",
    meta: "Cornell Outing Club",
  },
  {
    id: "s2",
    label: "Spring industry mixer with alumni engineers",
    kind: "event",
    meta: "WICC, CUAUV",
  },
  {
    id: "s3",
    label: "Open lab night: meet the team",
    kind: "event",
    meta: "Big Red Robotics",
  },
  {
    id: "s4",
    label: "Portfolio construction workshop",
    kind: "event",
    meta: "Cornell Fintech Club",
  },
  {
    id: "s5",
    label: "Free horse riding sessions",
    kind: "event",
    meta: "Equestrian Team",
  },
  {
    id: "s6",
    label: "Meet horses on Ag Quad",
    kind: "event",
    meta: "Cornell Outing Club",
  },
  { id: "s7", label: "Horse Riding at Cornell", kind: "org" },
  { id: "s8", label: "Cornell Outing Club", kind: "org" },
  { id: "s9", label: "WICC", kind: "org" },
  { id: "s10", label: "Big Red Robotics", kind: "org" },
];

// ─── Results-state ───────────────────────────────────────────────────────────

export interface SearchOrgResult {
  id: string;
  name: string;
  /** Short blurb shown on the result card. */
  description: string;
  /** Tags shown on the result card (uses Tag component colours). */
  tags: { label: string; color?: "neutral" | "blue" }[];
  /** Whether the current user follows this org. */
  following: boolean;
  avatarUrl?: string;
}

export const SAMPLE_ORG_RESULTS: SearchOrgResult[] = [
  {
    id: "horse-riding",
    name: "Horse Riding at Cornell",
    description: "We ride horses!",
    tags: [
      { label: "For you", color: "blue" },
      { label: "Just for Fun" },
      { label: "Animals" },
    ],
    following: false,
  },
  {
    id: "outing",
    name: "Cornell Outing Club",
    description:
      "Student-run outdoor club running weekly hikes, climbing trips, and backcountry weekends across the Finger Lakes.",
    tags: [{ label: "Outdoors" }, { label: "Just for Fun" }],
    following: true,
  },
];

/**
 * Posts shown in the results feed. We re-use the SAMPLE_POSTS shape from
 * sampleHome and tweak titles to feel like search hits — keeps the search
 * page visually consistent with the regular feed.
 */
export const SAMPLE_RESULT_POSTS: DashboardPostProps[] = SAMPLE_POSTS.map(
  (p, i) => {
    if (i === 0) return { ...p, title: "Horses 101" };
    if (i === 1) return { ...p, title: "Neighhh horses!" };
    return p;
  },
);
