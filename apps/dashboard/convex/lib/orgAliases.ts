// convex/lib/orgAliases.ts
//
// Org abbreviations ("WICC", "SWIB", "URMC") and the single string the search
// index reads them from. Students search by the acronym far more often than by
// the written-out name, and an org's name frequently contains neither.
//
// Pure module: no `convex/server`, no `_generated/*`, no Node APIs.

/**
 * The stored form of an org's abbreviations: trimmed, blank-free, and
 * deduplicated case-insensitively while keeping the casing whoever typed it
 * used ("WICC", not "wicc").
 *
 * `aliasSearch` is the same list as one space-joined string, because a Convex
 * search index covers a single string field rather than an array. It is only
 * ever written alongside `aliases`, so the two cannot drift.
 */
export function normalizeAliases(values: ReadonlyArray<string> | undefined): {
  aliases: string[] | undefined;
  aliasSearch: string | undefined;
} {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of values ?? []) {
    const cleaned = value.trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    aliases.push(cleaned);
  }
  if (aliases.length === 0) {
    return { aliases: undefined, aliasSearch: undefined };
  }
  return { aliases, aliasSearch: aliases.join(" ") };
}
