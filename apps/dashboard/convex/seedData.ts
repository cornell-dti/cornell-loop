/**
 * Dev-only seed data. Every row written from here is tagged isSeed: true.
 * Production deploys must NEVER run convex/seed.ts seedAll. The seed
 * mutation is `internalMutation` so it's only callable via
 * `bunx convex run seed:seedAll` against the dev deployment, or via
 * the DEV-gated `dev.triggerSeed` mutation. See `convex/dev.ts`.
 */

// Schema-aligned types (without Convex Id values, since seed source data
// has no real ids until insert time).

export type SeedHostKind = "club" | "company" | "external_org";
export type SeedHostRole = "primary" | "cohost" | "sponsor";

export type SeedHost = {
  name: string;
  kind: SeedHostKind;
  role: SeedHostRole;
};

export type SeedDateType = "start" | "end" | "deadline" | "single";

export type SeedDate = {
  /** Days from seed time `Date.now()`. Translated to absolute timestamp at insert. */
  dayOffset: number;
  /** Hour of the day (0-23). */
  hour: number;
  /** Minute of the hour (0-59). */
  minute: number;
  type: SeedDateType;
};

export type SeedLinkType =
  | "registration"
  | "application"
  | "rsvp"
  | "info"
  | "social";

export type SeedLink = {
  url: string;
  type: SeedLinkType;
  label?: string;
};

export type SeedContactType = "email" | "instagram" | "website";

export type SeedContact = {
  type: SeedContactType;
  value: string;
};

export type SeedTargetAudience =
  | "all"
  | "first_year"
  | "women_nonbinary"
  | "international"
  | "graduate";

export type SeedPerk = "food" | "swag" | "prizes" | "travel_covered" | "paid";

export type SeedEventType =
  | "event"
  | "opportunity"
  | "hackathon"
  | "courses"
  | "fundraiser"
  | "info";

export type SeedLocation = {
  displayText: string;
  address?: string;
  isVirtual: boolean;
  buildingCode?: string;
};

export type SeedOrg = {
  slug: string;
  name: string;
  description: string;
  tags: string[];
  isVerified: boolean;
  websiteUrl?: string;
  email?: string;
  loopSummary?: string;
};

export type SeedEvent = {
  /** Stable key used in SEED_EVENT_HOST_SLUGS to wire eventOrgs joins. */
  key: string;
  title: string;
  description: string;
  aiDescription: string;
  eventType: SeedEventType;
  hosts: SeedHost[];
  dates: SeedDate[];
  isRecurring: boolean;
  recurrenceNote?: string;
  location?: SeedLocation;
  links: SeedLink[];
  contacts: SeedContact[];
  tags: string[];
  targetAudience?: SeedTargetAudience;
  perks: SeedPerk[];
};

// ─── Listserv parent row ──────────────────────────────────────────────────────

export const SEED_LISTSERV_NAME = "seed-listserv";
export const SEED_LISTSERV_SECTION = "On-Campus";

// ─── Orgs (parity with src/data/sampleOrgs.ts + sampleHome.ts) ────────────────

export const SEED_ORGS: SeedOrg[] = [
  {
    slug: "acsu",
    name: "Association of Computer Science Undergraduates (ACSU)",
    description: "CS organization for undergrads looking to find community.",
    tags: ["Tech", "Mentorship"],
    isVerified: true,
    websiteUrl: "https://acsu.cornell.edu",
    email: "acsu@cornell.edu",
    loopSummary:
      "ACSU often posts about tech events, mentorship, and community. They host weekly events for students.",
  },
  {
    slug: "cuauv",
    name: "Cornell University Autonomous Underwater Vehicle (CUAUV)",
    description:
      "Project team designing and building autonomous underwater vehicles for the international RoboSub competition.",
    tags: ["Project team", "Robotics"],
    isVerified: true,
    websiteUrl: "https://cuauv.org",
    email: "cuauv@cornell.edu",
    loopSummary:
      "CUAUV posts about pool tests, sub-team recruitment, and travel updates from RoboSub. Expect technical deep-dives and behind-the-scenes build progress.",
  },
  {
    slug: "outing",
    name: "Cornell Outing Club",
    description:
      "Student-run outdoor club running weekly hikes, climbing trips, and backcountry weekends across the Finger Lakes.",
    tags: ["Outdoors", "Just for Fun"],
    isVerified: true,
    websiteUrl: "https://cornelloutingclub.org",
    email: "outing@cornell.edu",
    loopSummary:
      "The Outing Club posts about weekly trips, gear swaps, and trip-leader trainings. Most events are open to first-timers and gear is loanable.",
  },
  {
    slug: "wicc",
    name: "Women in Computing at Cornell (WICC)",
    description:
      "Women in Computing at Cornell — mentorship circles, tech talks, and social events for women and non-binary folks in CS.",
    tags: ["Tech", "Mentorship"],
    isVerified: true,
    websiteUrl: "https://wicc.cornell.edu",
    email: "wicc@cornell.edu",
    loopSummary:
      "WICC runs mentorship circles, tech talks, and social events for women and non-binary folks in CS.",
  },
  {
    slug: "fintech",
    name: "Cornell Fintech Club",
    description:
      "Workshops, speaker events, and project groups exploring quantitative finance, trading systems, and payments infrastructure.",
    tags: ["Finance", "Mentorship"],
    isVerified: true,
    websiteUrl: "https://cornellfintechclub.com",
    email: "fintech@cornell.edu",
    loopSummary:
      "Cornell Fintech Club runs workshops and project groups across quant finance, trading systems, and payments infrastructure.",
  },
  {
    slug: "brr",
    name: "Big Red Robotics",
    description:
      "Undergraduate robotics team building competition robots and running open lab nights for newcomers each semester.",
    tags: ["Tech", "Project team"],
    isVerified: true,
    websiteUrl: "https://bigredrobotics.org",
    email: "brr@cornell.edu",
    loopSummary:
      "Big Red Robotics builds competition robots and hosts open lab nights for newcomers each semester.",
  },
  {
    slug: "cds",
    name: "Cornell Data Science (CDS)",
    description:
      "Cornell Data Science — ML project teams, workshops, and an annual hackathon focused on applied data science.",
    tags: ["Tech", "Project team"],
    isVerified: true,
    websiteUrl: "https://cornelldata.science",
    email: "cds@cornell.edu",
    loopSummary:
      "CDS runs ML project teams, workshops, and an annual hackathon focused on applied data science.",
  },
  {
    slug: "cai",
    name: "Cornell AI",
    description:
      "Student group exploring artificial-intelligence research, reading groups, and applied AI projects across disciplines.",
    tags: ["Tech", "Research"],
    isVerified: false,
    websiteUrl: "https://cornellai.org",
    email: "cai@cornell.edu",
    loopSummary:
      "Cornell AI runs reading groups and applied AI projects across disciplines.",
  },
];

// ─── Events (~16 spread across orgs) ──────────────────────────────────────────

export const SEED_EVENTS: SeedEvent[] = [
  {
    key: "acsu-internship-101",
    title: "How to Land an Engineering Internship 101",
    description:
      "Looking to land your first internship? Join us for a panel featuring upperclassmen who've been through the process and successfully secured internships. They'll share real experiences, practical tips, and advice on applications, interviews, and making the most of your internship.",
    aiDescription:
      "ACSU panel with upperclassmen sharing internship search tips and interview advice.",
    eventType: "event",
    hosts: [{ name: "ACSU", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 2, hour: 17, minute: 30, type: "start" },
      { dayOffset: 2, hour: 18, minute: 30, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Snee Hall 2154",
      isVirtual: false,
      buildingCode: "Snee 2154",
    },
    links: [],
    contacts: [{ type: "email", value: "acsu@cornell.edu" }],
    tags: ["Internships", "Early Career", "Tech"],
    targetAudience: "all",
    perks: [],
  },
  {
    key: "acsu-mentorship-kickoff",
    title: "Spring mentorship kickoff",
    description:
      "Meet your spring mentor and the rest of your cohort. We'll do a quick round of intros, share goals for the semester, and break into small groups for office-hour planning. Pizza on us.",
    aiDescription:
      "ACSU spring mentorship kickoff with cohort intros and small-group planning.",
    eventType: "event",
    hosts: [{ name: "ACSU", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 4, hour: 18, minute: 0, type: "start" },
      { dayOffset: 4, hour: 19, minute: 30, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Gates Hall G01",
      isVirtual: false,
      buildingCode: "Gates G01",
    },
    links: [],
    contacts: [{ type: "email", value: "acsu@cornell.edu" }],
    tags: ["Mentorship", "Tech"],
    targetAudience: "all",
    perks: ["food"],
  },
  {
    key: "acsu-resume-review",
    title: "Resume review with industry alumni",
    description:
      "Drop in for a 1:1 resume review with Cornell CS alumni currently working at startups, FAANG, and quant firms. No appointments — first come, first served.",
    aiDescription:
      "Drop-in 1:1 resume reviews with Cornell CS alumni from startups, FAANG, and quant firms.",
    eventType: "event",
    hosts: [{ name: "ACSU", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 6, hour: 16, minute: 0, type: "start" },
      { dayOffset: 6, hour: 18, minute: 0, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Duffield Hall Atrium",
      isVirtual: false,
      buildingCode: "Duffield",
    },
    links: [],
    contacts: [{ type: "email", value: "acsu@cornell.edu" }],
    tags: ["Early Career", "Tech"],
    targetAudience: "all",
    perks: [],
  },
  {
    key: "cuauv-pool-test-4",
    title: "Pool test #4 — RoboSub prep",
    description:
      "We're running our fourth pool test of the semester to validate the new vision pipeline against the RoboSub gate task. Spectators welcome — wear pool-deck-friendly shoes and bring earplugs.",
    aiDescription:
      "CUAUV pool test validating the new vision pipeline ahead of RoboSub.",
    eventType: "event",
    hosts: [{ name: "CUAUV", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 1, hour: 19, minute: 0, type: "start" },
      { dayOffset: 1, hour: 22, minute: 0, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Teagle Hall pool",
      isVirtual: false,
      buildingCode: "Teagle",
    },
    links: [],
    contacts: [{ type: "email", value: "cuauv@cornell.edu" }],
    tags: ["Robotics", "Project team"],
    targetAudience: "all",
    perks: [],
  },
  {
    key: "cuauv-recruitment",
    title: "Sub-team recruitment info session",
    description:
      "Curious about joining mech, electrical, or software for the next build cycle? We'll walk through the application process, sub-team scopes, and answer questions over snacks.",
    aiDescription:
      "CUAUV sub-team recruitment info session covering mech, electrical, and software.",
    eventType: "opportunity",
    hosts: [{ name: "CUAUV", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 3, hour: 17, minute: 0, type: "start" },
      { dayOffset: 3, hour: 18, minute: 30, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Upson Hall B17",
      isVirtual: false,
      buildingCode: "Upson B17",
    },
    links: [
      {
        url: "https://cuauv.org/apply",
        type: "application",
        label: "Apply here",
      },
    ],
    contacts: [{ type: "email", value: "cuauv@cornell.edu" }],
    tags: ["Recruitment", "Robotics"],
    targetAudience: "all",
    perks: ["food"],
  },
  {
    key: "outing-sunrise-hike",
    title: "Sunrise hike at Taughannock Falls",
    description:
      "Start the weekend early with a guided sunrise hike along the gorge trail. We'll meet at the trailhead, watch the sun come up over the falls, and be back in time for brunch. All experience levels welcome.",
    aiDescription:
      "Guided sunrise hike along the gorge trail at Taughannock Falls.",
    eventType: "event",
    hosts: [{ name: "Cornell Outing Club", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 5, hour: 5, minute: 30, type: "start" },
      { dayOffset: 5, hour: 8, minute: 30, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Taughannock Falls trailhead",
      isVirtual: false,
    },
    links: [],
    contacts: [{ type: "email", value: "outing@cornell.edu" }],
    tags: ["Outdoors", "Just for Fun"],
    targetAudience: "all",
    perks: [],
  },
  {
    key: "outing-gear-swap",
    title: "Spring gear swap & free repair clinic",
    description:
      "Bring outdoor gear you no longer need and trade for something new. On-site mending and tune-ups available — bring boots, packs, and bikes for a free check-up.",
    aiDescription:
      "Outdoor gear swap and free repair clinic on the Bailey Hall lawn.",
    eventType: "event",
    hosts: [{ name: "Cornell Outing Club", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 7, hour: 12, minute: 0, type: "start" },
      { dayOffset: 7, hour: 16, minute: 0, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Bailey Hall lawn",
      isVirtual: false,
      buildingCode: "Bailey",
    },
    links: [],
    contacts: [{ type: "email", value: "outing@cornell.edu" }],
    tags: ["Outdoors", "Community"],
    targetAudience: "all",
    perks: [],
  },
  {
    key: "outing-trip-leader-training",
    title: "Trip leader training weekend",
    description:
      "Two-day backcountry training for prospective trip leaders. Covers navigation, risk management, and group facilitation. Camping gear provided.",
    aiDescription:
      "Two-day backcountry training for prospective trip leaders. Camping gear provided.",
    eventType: "opportunity",
    hosts: [{ name: "Cornell Outing Club", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 10, hour: 9, minute: 0, type: "start" },
      { dayOffset: 11, hour: 17, minute: 0, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Connecticut Hill",
      isVirtual: false,
    },
    links: [],
    contacts: [{ type: "email", value: "outing@cornell.edu" }],
    tags: ["Outdoors", "Leadership"],
    targetAudience: "all",
    perks: [],
  },
  {
    key: "wicc-cuauv-industry-mixer",
    title: "Spring industry mixer with alumni engineers",
    description:
      "Meet Cornell engineering alumni working at early-stage startups and mid-sized tech companies. Casual format — snacks, drinks, and roundtables grouped by discipline. Bring questions about the first two years of an engineering career.",
    aiDescription:
      "WICC and CUAUV co-host an alumni mixer with discipline-grouped roundtables.",
    eventType: "event",
    hosts: [
      { name: "WICC", kind: "club", role: "primary" },
      { name: "CUAUV", kind: "club", role: "cohost" },
    ],
    dates: [
      { dayOffset: 7, hour: 18, minute: 0, type: "start" },
      { dayOffset: 7, hour: 20, minute: 0, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Duffield Hall Atrium",
      isVirtual: false,
      buildingCode: "Duffield",
    },
    links: [],
    contacts: [{ type: "email", value: "wicc@cornell.edu" }],
    tags: ["Early Career", "Tech"],
    targetAudience: "women_nonbinary",
    perks: ["food"],
  },
  {
    key: "wicc-coffee-chat",
    title: "Weekly coffee chat",
    description:
      "Drop by for a casual coffee chat — meet other women and non-binary folks in CS, swap class recs, and talk about the semester so far. New faces always welcome.",
    aiDescription: "WICC weekly coffee chat in Gates G01 — casual and drop-in.",
    eventType: "event",
    hosts: [{ name: "WICC", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 2, hour: 16, minute: 0, type: "start" },
      { dayOffset: 2, hour: 17, minute: 30, type: "end" },
    ],
    isRecurring: true,
    recurrenceNote: "Every Wednesday 4-5:30pm",
    location: {
      displayText: "Gates Hall G01",
      isVirtual: false,
      buildingCode: "Gates G01",
    },
    links: [],
    contacts: [{ type: "email", value: "wicc@cornell.edu" }],
    tags: ["Community", "Tech"],
    targetAudience: "women_nonbinary",
    perks: [],
  },
  {
    key: "fintech-portfolio-workshop",
    title: "Portfolio construction workshop",
    description:
      "A hands-on session on building and rebalancing a long-only equity portfolio. No finance background required — we'll walk through the math and run through a paper-trading exercise together.",
    aiDescription:
      "Hands-on workshop on building and rebalancing a long-only equity portfolio.",
    eventType: "event",
    hosts: [{ name: "Cornell Fintech Club", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 3, hour: 16, minute: 30, type: "start" },
      { dayOffset: 3, hour: 18, minute: 0, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Statler Hall 265",
      isVirtual: false,
      buildingCode: "Statler 265",
    },
    links: [],
    contacts: [{ type: "email", value: "fintech@cornell.edu" }],
    tags: ["Mentorship", "Finance"],
    targetAudience: "all",
    perks: [],
  },
  {
    key: "fintech-quant-speaker",
    title: "Quant trading speaker night",
    description:
      "Hear from a working quant trader on systematic strategy design, intraday risk management, and the day-to-day of a trading desk. Q&A and refreshments after.",
    aiDescription:
      "Speaker night with a working quant trader covering systematic strategy and risk.",
    eventType: "event",
    hosts: [{ name: "Cornell Fintech Club", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 8, hour: 18, minute: 30, type: "start" },
      { dayOffset: 8, hour: 20, minute: 0, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Sage Hall B08",
      isVirtual: false,
      buildingCode: "Sage B08",
    },
    links: [],
    contacts: [{ type: "email", value: "fintech@cornell.edu" }],
    tags: ["Finance", "Speaker"],
    targetAudience: "all",
    perks: ["food"],
  },
  {
    key: "brr-open-lab",
    title: "Open lab night: meet the team",
    description:
      "Drop by the lab for a tour of our current build, chat with sub-team leads, and see live demos of the drivetrain and vision stack. Pizza while it lasts.",
    aiDescription:
      "Big Red Robotics open lab night with build tour and live drivetrain demos.",
    eventType: "event",
    hosts: [{ name: "Big Red Robotics", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 1, hour: 19, minute: 0, type: "start" },
      { dayOffset: 1, hour: 21, minute: 30, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Upson Hall B17",
      isVirtual: false,
      buildingCode: "Upson B17",
    },
    links: [],
    contacts: [{ type: "email", value: "brr@cornell.edu" }],
    tags: ["Recruitment", "Tech"],
    targetAudience: "all",
    perks: ["food"],
  },
  {
    key: "cds-spring-hackathon",
    title: "BigRed//Hacks Spring 2026",
    description:
      "CDS's flagship 24-hour hackathon focused on applied data science. Form teams, build a prototype against the year's dataset, and demo to alumni judges. Travel reimbursements available for off-campus participants.",
    aiDescription:
      "CDS 24-hour applied data science hackathon with alumni judges and prizes.",
    eventType: "hackathon",
    hosts: [{ name: "Cornell Data Science", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 12, hour: 9, minute: 0, type: "start" },
      { dayOffset: 13, hour: 9, minute: 0, type: "end" },
    ],
    isRecurring: false,
    location: {
      displayText: "Statler Hall ballroom",
      isVirtual: false,
      buildingCode: "Statler",
    },
    links: [
      {
        url: "https://cornelldata.science/hackathon",
        type: "registration",
        label: "Register",
      },
    ],
    contacts: [{ type: "email", value: "cds@cornell.edu" }],
    tags: ["Tech", "Hackathon"],
    targetAudience: "all",
    perks: ["food", "prizes", "swag"],
  },
  {
    key: "cds-ml-fellowship-apps",
    title: "ML Fellowship — Spring applications",
    description:
      "Applications are open for the CDS ML Fellowship, a one-semester program pairing fellows with applied research projects in NLP, vision, and recsys. Stipend provided for accepted fellows.",
    aiDescription:
      "Applications open for the CDS ML Fellowship — applied research with a stipend.",
    eventType: "opportunity",
    hosts: [{ name: "Cornell Data Science", kind: "club", role: "primary" }],
    dates: [{ dayOffset: 9, hour: 23, minute: 59, type: "deadline" }],
    isRecurring: false,
    links: [
      {
        url: "https://cornelldata.science/fellowship",
        type: "application",
        label: "Apply",
      },
    ],
    contacts: [{ type: "email", value: "cds@cornell.edu" }],
    tags: ["Tech", "Research"],
    targetAudience: "all",
    perks: ["paid"],
  },
  {
    key: "cai-reading-group",
    title: "Reading group: scaling laws",
    description:
      "Discussion of the past month's papers on neural scaling laws and emergent capabilities. Bring a laptop and a paper recommendation. No prior reading required, but it helps.",
    aiDescription:
      "Cornell AI reading group discussing neural scaling laws and emergent capabilities.",
    eventType: "event",
    hosts: [{ name: "Cornell AI", kind: "club", role: "primary" }],
    dates: [
      { dayOffset: 4, hour: 19, minute: 0, type: "start" },
      { dayOffset: 4, hour: 20, minute: 30, type: "end" },
    ],
    isRecurring: true,
    recurrenceNote: "Every other Thursday 7-8:30pm",
    location: {
      displayText: "Gates Hall 114",
      isVirtual: false,
      buildingCode: "Gates 114",
    },
    links: [],
    contacts: [{ type: "email", value: "cai@cornell.edu" }],
    tags: ["Tech", "Research"],
    targetAudience: "all",
    perks: [],
  },
];

/**
 * Mapping from each event's stable `key` to the slugs of orgs that host or
 * co-host the event. Drives the eventOrgs join writes during seedAll.
 */
export const SEED_EVENT_HOST_SLUGS: Record<string, string[]> = {
  "acsu-internship-101": ["acsu"],
  "acsu-mentorship-kickoff": ["acsu"],
  "acsu-resume-review": ["acsu"],
  "cuauv-pool-test-4": ["cuauv"],
  "cuauv-recruitment": ["cuauv"],
  "outing-sunrise-hike": ["outing"],
  "outing-gear-swap": ["outing"],
  "outing-trip-leader-training": ["outing"],
  "wicc-cuauv-industry-mixer": ["wicc", "cuauv"],
  "wicc-coffee-chat": ["wicc"],
  "fintech-portfolio-workshop": ["fintech"],
  "fintech-quant-speaker": ["fintech"],
  "brr-open-lab": ["brr"],
  "cds-spring-hackathon": ["cds"],
  "cds-ml-fellowship-apps": ["cds"],
  "cai-reading-group": ["cai"],
};
