/**
 * Pure helpers used by SearchOverlay and its parent (Home) — extracted into
 * a separate module so the component file only exports React components
 * (keeps `react-refresh/only-export-components` happy).
 */

import type { RecentSearch, SearchSuggestion } from "../data/sampleSearch";

/**
 * Caps the suggestion pool shown in the dropdown. The pool itself is
 * already query-matched by the caller (real server search results, keyed
 * to the current/debounced query) — this just bounds how many rows render,
 * it does not re-filter by substring. Re-filtering here would be wrong: a
 * server match can be relevant without the query literally appearing
 * inside `label` (e.g. matched via description or org name).
 */
export function filterSuggestions(
  pool: SearchSuggestion[],
): SearchSuggestion[] {
  return pool.slice(0, 6);
}

/**
 * Helper for parents to derive the list length used by keyboard nav.
 * Keeps the index-clamping logic in one place.
 */
export function overlayRowCount(
  query: string,
  recents: RecentSearch[],
  suggestions: SearchSuggestion[],
): number {
  return query.trim().length === 0
    ? recents.length
    : filterSuggestions(suggestions).length;
}

/**
 * Resolve the label associated with a given row index — used when the
 * parent needs to commit on Enter.
 */
export function overlayLabelAt(
  index: number,
  query: string,
  recents: RecentSearch[],
  suggestions: SearchSuggestion[],
): string | undefined {
  if (index < 0) return undefined;
  if (query.trim().length === 0) return recents[index]?.label;
  return filterSuggestions(suggestions)[index]?.label;
}
