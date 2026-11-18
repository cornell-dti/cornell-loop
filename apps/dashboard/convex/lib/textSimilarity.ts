// convex/lib/textSimilarity.ts
//
// Fuzzy string comparison shared by the admin's near-duplicate checks: one for
// organizations being created, one for drafts being stored. Both ask the same
// question — are these two names the same thing written differently? — so they
// ask it the same way.
//
// Pure module: no `convex/server`, no `_generated/*`, no Node APIs.

/** Lowercased, alphanumeric-only — for comparing names irrespective of punctuation/casing. */
export function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Classic edit-distance, computed with a rolling single row (no 2D array indexing to trip strict mode). */
export function levenshteinDistance(a: string, b: string): number {
  let previousRow: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    const currentRow: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      const insertion = (currentRow[j - 1] ?? Infinity) + 1;
      const deletion = (previousRow[j] ?? Infinity) + 1;
      const substitution = (previousRow[j - 1] ?? Infinity) + substitutionCost;
      currentRow.push(Math.min(insertion, deletion, substitution));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length] ?? Math.max(a.length, b.length);
}

/**
 * True when two already-normalized names differ only by the kind of small
 * edit that separates one writing of a title from another — a typo, a plural,
 * a dropped word ending. The tolerance scales with the shorter name so that
 * "CS GBM" and "CS BBQ" stay distinct while a long title survives a typo.
 *
 * Short names are compared exactly: at four characters or fewer a single edit
 * is the difference between two unrelated acronyms.
 */
export function isCloseSpelling(a: string, b: string): boolean {
  if (a === b) return a.length > 0;
  if (a.length < 4 || b.length < 4) return false;

  const distance = levenshteinDistance(a, b);
  const threshold = Math.max(1, Math.floor(Math.min(a.length, b.length) / 4));
  return distance > 0 && distance <= threshold;
}
