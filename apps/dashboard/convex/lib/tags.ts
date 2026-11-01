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
  "Competitions",
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
  application: "Recruitment",
  applications: "Recruitment",
  signups: "Recruitment",
  "project team": "Recruitment",
  "student organization": "Recruitment",
  internship: "Internships",
  "summer internship": "Internships",
  career: "Early Career",
  careers: "Early Career",
  "career development": "Early Career",
  "professional development": "Early Career",
  networking: "Early Career",
  jobs: "Early Career",
  job: "Early Career",
  "job opportunity": "Early Career",
  "career prep": "Early Career",
  "career fair": "Early Career",
  resumes: "Early Career",
  interviews: "Early Career",
  leadership: "Early Career",
  alumni: "Early Career",
  fellowship: "Early Career",
  skills: "Early Career",
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
  robotics: "Tech",
  "combat robotics": "Tech",
  "web development": "Tech",
  "physical ai": "Tech",
  "product management": "Tech",
  bigredhacks: "Tech",
  "hacker house": "Tech",
  business: "Finance",
  investing: "Finance",
  investment: "Finance",
  banking: "Finance",
  consulting: "Finance",
  economics: "Finance",
  fintech: "Finance",
  trading: "Finance",
  marketing: "Finance",
  sales: "Finance",
  management: "Finance",
  "real estate": "Finance",
  cpg: "Finance",
  wellness: "Health",
  "mental health": "Health",
  healthcare: "Health",
  medicine: "Health",
  fitness: "Health",
  medtech: "Health",
  "health tech": "Health",
  "women's health": "Health",
  "pediatric therapy": "Health",
  "drug development": "Health",
  academic: "Education",
  academics: "Education",
  workshop: "Education",
  learning: "Education",
  teaching: "Education",
  seminar: "Education",
  course: "Education",
  "project team courses": "Education",
  conference: "Education",
  keynote: "Education",
  summit: "Education",
  advising: "Education",
  admissions: "Education",
  scholarships: "Education",
  outdoor: "Outdoors",
  hiking: "Outdoors",
  nature: "Outdoors",
  beekeeping: "Outdoors",
  "hive inspection": "Outdoors",
  mentoring: "Mentorship",
  mentor: "Mentorship",
  social: "Just for Fun",
  fun: "Just for Fun",
  party: "Just for Fun",
  games: "Just for Fun",
  food: "Just for Fun",
  dinner: "Just for Fun",
  brunch: "Just for Fun",
  "happy hour": "Just for Fun",
  festival: "Just for Fun",
  game: "Just for Fun",
  "social week": "Just for Fun",
  cultural: "Just for Fun",
  startup: "Entrepreneurship",
  startups: "Entrepreneurship",
  venture: "Entrepreneurship",
  "venture capital": "Entrepreneurship",
  vc: "Entrepreneurship",
  innovation: "Entrepreneurship",
  accelerator: "Entrepreneurship",
  founders: "Entrepreneurship",
  "co-founder": "Entrepreneurship",
  cofounder: "Entrepreneurship",
  funding: "Entrepreneurship",
  investors: "Entrepreneurship",
  fundraising: "Entrepreneurship",
  crowdfunding: "Entrepreneurship",
  pitch: "Entrepreneurship",
  demo: "Entrepreneurship",
  showcase: "Entrepreneurship",
  competition: "Competitions",
  "case competition": "Competitions",
  "pitch competition": "Competitions",
  "pitch challenge": "Competitions",
  challenge: "Competitions",
  prize: "Competitions",
  awards: "Competitions",
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
  volunteers: "Service",
  "public service": "Service",
  "research opportunity": "Research",
  "research award": "Research",
  science: "Research",
  biology: "Research",
  "evolutionary biology": "Research",
  evolution: "Research",
  ecology: "Research",
  biodiversity: "Research",
  neuroscience: "Research",
  "life sciences": "Research",
  "clinical research": "Research",
  "translational science": "Research",
  postdoc: "Research",
};

/**
 * Lower-cased canonical tag → canonical tag, for case-insensitive lookup.
 * Assumes no two CANONICAL_TAGS differ only by case; if they did, the later
 * entry would silently shadow the earlier one.
 */
const CANONICAL_BY_LOWER: ReadonlyMap<string, CanonicalTag> = new Map(
  CANONICAL_TAGS.map((tag) => [tag.toLowerCase(), tag]),
);

/** Lower-case and collapse whitespace/underscores so variants share one key. */
export function tagKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, " ");
}

/** Map one free-form tag onto the canonical set, or null if it has no match. */
export function toCanonicalTag(raw: string): CanonicalTag | null {
  const key = tagKey(raw);
  if (!key) return null;
  const canonical = CANONICAL_BY_LOWER.get(key);
  if (canonical !== undefined) return canonical;
  return Object.hasOwn(TAG_ALIASES, key) ? TAG_ALIASES[key] : null;
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
