/**
 * Sample data for /home preview.
 *
 * Convex schema currently only carries auth tables
 * (apps/dashboard/convex/schema.ts), so posts/events are not persisted yet.
 * These constants let us preview the feed against the DashboardPost and
 * SearchPanel shapes exported from shared/ui.
 *
 * Content here is original placeholder copy (not taken from the Figma mockup).
 */

import type { DashboardPostProps, RsvpGroup, Club, TagItem } from "@app/ui";

/**
 * Single source of truth for org metadata used when hydrating post headers.
 * Keeps SAMPLE_POSTS and SAMPLE_CLUBS descriptions in sync without
 * duplicating copy across the file.
 */
const ORG_PROFILES: Record<
  string,
  { description: string; tags?: TagItem[]; following?: boolean }
> = {
  "Cornell Outing Club": {
    description:
      "Student-run outdoor club running weekly hikes, climbing trips, and backcountry weekends across the Finger Lakes.",
    tags: [{ label: "Outdoors" }, { label: "Just for Fun" }],
    following: true,
  },
  WICC: {
    description:
      "Women in Computing at Cornell — mentorship circles, tech talks, and social events for women and non-binary folks in CS.",
    tags: [{ label: "For you", color: "blue" }, { label: "Tech" }],
    following: true,
  },
  CUAUV: {
    description:
      "Cornell University Autonomous Underwater Vehicle — project team designing and building AUVs for the international RoboSub competition.",
    tags: [{ label: "Project team" }, { label: "Robotics" }],
    following: false,
  },
  "Cornell Fintech Club": {
    description:
      "Workshops, speaker events, and project groups exploring quantitative finance, trading systems, and payments infrastructure.",
    tags: [{ label: "Finance" }, { label: "Mentorship" }],
    following: true,
  },
  "Big Red Robotics": {
    description:
      "Undergraduate robotics team building competition robots and running open lab nights for newcomers each semester.",
    tags: [{ label: "Tech" }, { label: "Project team" }],
    following: false,
  },
};

const hydrateOrg = (name: string) => ({ name, ...ORG_PROFILES[name] });

export const SAMPLE_POSTS: DashboardPostProps[] = [
  {
    organizations: [hydrateOrg("Cornell Outing Club")],
    postedAt: "Apr 21",
    title: "Sunrise hike at Taughannock Falls",
    datetime: "April 27, 5:30am - 8:30am",
    location: "Taughannock Falls trailhead",
    description:
      "Start the weekend early with a guided sunrise hike along the gorge trail. We'll meet at the trailhead, watch the sun come up over the falls, and be back in time for brunch. All experience levels welcome — we'll keep the pace easygoing.",
    descriptionTruncated: true,
    tags: [{ label: "Outdoors" }, { label: "Just for Fun" }],
  },
  {
    organizations: [hydrateOrg("WICC"), hydrateOrg("CUAUV")],
    postedAt: "Apr 20",
    title: "Spring industry mixer with alumni engineers",
    datetime: "April 29, 6:00pm - 8:00pm",
    location: "Duffield Hall Atrium",
    description:
      "Meet Cornell engineering alumni working at early-stage startups and mid-sized tech companies. Casual format — snacks, drinks, and roundtables grouped by discipline. Bring questions about the first two years of an engineering career.",
    descriptionTruncated: true,
    tags: [
      { label: "You're free!", color: "blue" },
      { label: "Early Career" },
      { label: "Tech" },
    ],
  },
  {
    organizations: [hydrateOrg("Cornell Fintech Club")],
    postedAt: "Apr 18",
    title: "Portfolio construction workshop",
    datetime: "April 24, 4:30pm - 6:00pm",
    location: "Statler Hall 265",
    description:
      "A hands-on session on building and rebalancing a long-only equity portfolio. No finance background required — we'll walk through the math and run through a paper-trading exercise together.",
    descriptionTruncated: true,
    tags: [{ label: "Mentorship" }, { label: "Finance" }],
  },
  {
    organizations: [hydrateOrg("Big Red Robotics")],
    postedAt: "Apr 15",
    title: "Open lab night: meet the team",
    datetime: "April 23, 7:00pm - 9:30pm",
    location: "Upson Hall B17",
    description:
      "Drop by the lab for a tour of our current build, chat with sub-team leads, and see live demos of the drivetrain and vision stack. Pizza while it lasts.",
    descriptionTruncated: true,
    tags: [{ label: "Recruitment" }, { label: "Tech" }],
  },
];

export const SAMPLE_RSVP_GROUPS: RsvpGroup[] = [
  {
    period: "Today",
    events: [
      {
        day: 23,
        month: "Apr",
        title: "Open lab night: meet the team",
        description:
          "Drop by Upson B17 for a tour of the build, subteam demos, and pizza.",
      },
    ],
  },
  {
    period: "This week",
    events: [
      {
        day: 24,
        month: "Apr",
        title: "Portfolio construction workshop",
        description:
          "Hands-on session on building and rebalancing a long-only equity portfolio.",
      },
      {
        day: 27,
        month: "Apr",
        title: "Sunrise hike at Taughannock Falls",
        description:
          "Guided sunrise hike along the gorge trail. All experience levels welcome.",
      },
      {
        day: 29,
        month: "Apr",
        title: "Spring industry mixer",
        description:
          "Meet Cornell engineering alumni at Duffield Hall Atrium — snacks and roundtables.",
      },
    ],
  },
];

export const SAMPLE_CLUBS: Club[] = [
  {
    id: "outing",
    name: "Cornell Outing Club",
    notificationCount: 2,
    description:
      "Student-run outdoor club running weekly hikes, climbing trips, and backcountry weekends across the Finger Lakes.",
  },
  {
    id: "wicc",
    name: "WICC",
    notificationCount: 5,
    description:
      "Women in Computing at Cornell — mentorship circles, tech talks, and social events for women and non-binary folks in CS.",
  },
  {
    id: "cuauv",
    name: "CUAUV",
    description:
      "Cornell University Autonomous Underwater Vehicle — project team designing and building AUVs for the international RoboSub competition.",
  },
  {
    id: "fintech",
    name: "Cornell Fintech Club",
    notificationCount: 1,
    description:
      "Workshops, speaker events, and project groups exploring quantitative finance, trading systems, and payments infrastructure.",
  },
  {
    id: "brr",
    name: "Big Red Robotics",
    description:
      "Undergraduate robotics team building competition robots and running open lab nights for newcomers each semester.",
  },
  {
    id: "cds",
    name: "CDS",
    description:
      "Cornell Data Science — ML project teams, workshops, and an annual hackathon focused on applied data science.",
  },
  {
    id: "cai",
    name: "Cornell AI",
    description:
      "Student group exploring artificial-intelligence research, reading groups, and applied AI projects across disciplines.",
  },
];
