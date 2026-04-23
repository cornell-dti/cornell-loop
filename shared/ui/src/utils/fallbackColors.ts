/**
 * Deterministic fallback colour palette for avatars without an image.
 * Drawn from design-system token values to keep things visually cohesive.
 *
 * Extracted into a standalone utility so component files that import it
 * do not trip the `react-refresh/only-export-components` lint rule.
 */

const FALLBACK_PALETTE: { bg: string; fg: string }[] = [
  { bg: "var(--color-primary-500)", fg: "var(--color-primary-800)" }, // peach / dark orange
  { bg: "var(--color-secondary-400)", fg: "var(--color-secondary-700)" }, // light blue / navy
  { bg: "var(--color-primary-400)", fg: "var(--color-primary-700)" }, // warm cream / brand orange
  { bg: "var(--color-secondary-300)", fg: "var(--color-secondary-600)" }, // pale blue / medium blue
  { bg: "var(--color-primary-600)", fg: "var(--color-primary-900)" }, // salmon / deep brown
  { bg: "var(--color-secondary-500)", fg: "var(--color-secondary-900)" }, // sky blue / dark navy
];

/** Simple string hash -> palette index so the same name always gets the same colour. */
export function fallbackColorsForName(name: string): {
  bg: string;
  fg: string;
} {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}
