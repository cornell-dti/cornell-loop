/**
 * Display casing for event action buttons ("RSVP", "Apply here", …).
 *
 * Link labels come from the AI parser and are stored in whatever case the
 * model chose ("rsvp here", "apply now"). The dashboard and extension cards
 * both format at render time, so every stored event displays consistently.
 */

/** Words always shown upper-case on a button, whatever case they arrive in. */
const ACRONYMS: ReadonlyMap<string, string> = new Map([
  ["rsvp", "RSVP"],
  ["faq", "FAQ"],
]);

/**
 * Sentence-cases a label: capitalizes the first letter and upper-cases known
 * acronyms. Other words keep their case, so names like "Cornell DTI" survive.
 */
export function formatActionLabel(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  return words
    .map((word, index) => {
      const acronym = ACRONYMS.get(word.toLowerCase().replace(/[^a-z]/g, ""));
      if (acronym) {
        return word.replace(/[a-z]+/i, acronym);
      }
      return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    })
    .join(" ");
}
