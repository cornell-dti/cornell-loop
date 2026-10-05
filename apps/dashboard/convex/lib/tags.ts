/**
 * Canonical event tag set — the single vocabulary shared by the parser, the
 * admin editor, onboarding interests, and the dashboard/extension filter
 * bars. Event tags outside this list are dropped on write, so filtering and
 * interest-based recommendations always compare like with like.
 */
export const CANONICAL_TAGS = [
  "Recruitment",
  "Internships",
  "Early Career",
  "Tech",
  "Finance",
  "Health",
  "Education",
  "Outdoors",
  "Mentorship",
  "Just for Fun",
  "Entrepreneurship",
  "Arts",
  "Sports",
  "Service",
  "Research",
] as const;

export type CanonicalTag = (typeof CANONICAL_TAGS)[number];

/** Filter-bar tags shown to users who haven't customised their bar. */
export const DEFAULT_FILTER_TAGS: readonly CanonicalTag[] = [
  "Recruitment",
  "Early Career",
  "Tech",
  "Mentorship",
  "Just for Fun",
];

/**
 * Common free-form variants (lower-cased) mapped onto the canonical set.
 * Exact case-insensitive matches of canonical tags are handled separately.
 */
const TAG_ALIASES: Readonly<Record<string, CanonicalTag>> = {
  recruiting: "Recruitment",
  hiring: "Recruitment",
  "info session": "Recruitment",
  "information session": "Recruitment",
  internship: "Internships",
  "summer internship": "Internships",
  career: "Early Career",
  careers: "Early Career",
  "career development": "Early Career",
  "professional development": "Early Career",
  networking: "Early Career",
  jobs: "Early Career",
  job: "Early Career",
  technology: "Tech",
  "computer science": "Tech",
  cs: "Tech",
  software: "Tech",
  engineering: "Tech",
  coding: "Tech",
  programming: "Tech",
  ai: "Tech",
  hackathon: "Tech",
  "data science": "Tech",
  business: "Finance",
  investing: "Finance",
  banking: "Finance",
  consulting: "Finance",
  economics: "Finance",
  wellness: "Health",
  "mental health": "Health",
  healthcare: "Health",
  medicine: "Health",
  fitness: "Health",
  academic: "Education",
  academics: "Education",
  workshop: "Education",
  learning: "Education",
  teaching: "Education",
  outdoor: "Outdoors",
  hiking: "Outdoors",
  nature: "Outdoors",
  mentoring: "Mentorship",
  mentor: "Mentorship",
  social: "Just for Fun",
  fun: "Just for Fun",
  party: "Just for Fun",
  games: "Just for Fun",
  food: "Just for Fun",
  startup: "Entrepreneurship",
  startups: "Entrepreneurship",
  venture: "Entrepreneurship",
  art: "Arts",
  music: "Arts",
  dance: "Arts",
  theatre: "Arts",
  theater: "Arts",
  film: "Arts",
  "performing arts": "Arts",
  design: "Arts",
  sport: "Sports",
  athletics: "Sports",
  "community service": "Service",
  volunteering: "Service",
  volunteer: "Service",
  "public service": "Service",
  "research opportunity": "Research",
  science: "Research",
};

const CANONICAL_BY_LOWER: ReadonlyMap<string, CanonicalTag> = new Map(
  CANONICAL_TAGS.map((tag) => [tag.toLowerCase(), tag]),
);

/** Map one free-form tag onto the canonical set, or null if it has no match. */
export function toCanonicalTag(raw: string): CanonicalTag | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (!key) return null;
  return CANONICAL_BY_LOWER.get(key) ?? TAG_ALIASES[key] ?? null;
}

/** Canonicalise a tag list: map aliases, drop unknowns, dedupe, keep order. */
export function normalizeTags(raw: readonly string[]): CanonicalTag[] {
  const out: CanonicalTag[] = [];
  for (const tag of raw) {
    const canonical = toCanonicalTag(tag);
    if (canonical !== null && !out.includes(canonical)) out.push(canonical);
  }
  return out;
}
