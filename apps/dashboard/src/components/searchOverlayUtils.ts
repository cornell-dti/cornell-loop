/**
 * Pure helpers used by SearchOverlay and its parent (Home) — extracted into
 * a separate module so the component file only exports React components
 * (keeps `react-refresh/only-export-components` happy).
 */

import type { RecentSearch, SearchSuggestion } from "../data/sampleSearch";

/** Substring + case-insensitive filter; the simplest "live search". */
export function filterSuggestions(
  q: string,
  pool: SearchSuggestion[],
): SearchSuggestion[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return pool.filter((s) => s.label.toLowerCase().includes(needle)).slice(0, 6);
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
    : filterSuggestions(query, suggestions).length;
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
  return filterSuggestions(query, suggestions)[index]?.label;
}
