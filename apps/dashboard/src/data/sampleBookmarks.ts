/**
 * Sample data for /bookmarks preview.
 *
 * Convex schema currently only carries auth tables, so the bookmark list and
 * right-panel sections are not persisted yet. These constants let us preview
 * the page against the DashboardPost shape and the SidePanelSectionProps type
 * exported from Bookmarks.tsx.
 *
 * Content here is original placeholder copy distinct from sampleHome.ts so we
 * can visually distinguish the two routes during dogfooding.
 */

import type { DashboardPostProps, TagItem } from "@app/ui";

/**
 * Single source of truth for org metadata used when hydrating post headers.
 * Mirrors the ORG_PROFILES pattern from sampleHome.ts so subscriptions / hover
 * cards stay consistent across pages.
 */
const ORG_PROFILES: Record<
  string,
  { id?: string; description: string; tags?: TagItem[]; following?: boolean }
> = {
  WICC: {
    id: "wicc",
    description:
      "Women in Computing at Cornell — mentorship circles, tech talks, and social events for women and non-binary folks in CS.",
    tags: [{ label: "For you", color: "blue" }, { label: "Tech" }],
    following: true,
  },
  "Cornell Fintech Club": {
    id: "fintech",
    description:
      "Workshops, speaker events, and project groups exploring quantitative finance, trading systems, and payments infrastructure.",
    tags: [{ label: "Finance" }, { label: "Mentorship" }],
    following: true,
  },
  "Entrepreneurship at Cornell": {
    id: "eship",
    description:
      "Campus-wide entrepreneurship hub — fireside chats, accelerator office hours, and pitch nights for student founders.",
    tags: [{ label: "Entrepreneurship" }, { label: "Mentorship" }],
    following: true,
  },
  CUAUV: {
    id: "cuauv",
    description:
      "Cornell University Autonomous Underwater Vehicle — project team designing and building AUVs for the international RoboSub competition.",
    tags: [{ label: "Project team" }, { label: "Robotics" }],
    following: false,
  },
  "Cornell Design & Tech Initiative": {
    id: "dti",
    description:
      "Cross-disciplinary product team building software for the Cornell community — designers, engineers, and PMs collaborating each semester.",
    tags: [{ label: "Project team" }, { label: "Tech" }],
    following: true,
  },
  "Cornell Data Science": {
    id: "cds",
    description:
      "Cornell Data Science — applied ML project teams, weekly workshops, and an annual hackathon focused on real-world data problems.",
    tags: [{ label: "Tech" }, { label: "Mentorship" }],
    following: false,
  },
};

const hydrateOrg = (name: string) => ({ name, ...ORG_PROFILES[name] });

export const SAMPLE_BOOKMARKED_POSTS: DashboardPostProps[] = [
  {
    organizations: [
      hydrateOrg("WICC"),
      hydrateOrg("CUAUV"),
      hydrateOrg("Cornell Data Science"),
    ],
    postedAt: "Feb 12",
    title: "How to Land an Engineering Internship 101",
    datetime: "February 25, 5:30pm - 6:30pm",
    location: "Snee Hall 2154",
    description:
      "Looking to land your first internship? Join us for a panel featuring upperclassmen who've been through the process and successfully secured internships. They'll share real experiences, practical tips, and advice on applications, interviews, and making the most of your internship.",
    truncateDescription: true,
    tags: [
      { label: "You're free!", color: "blue" },
      { label: "Internships" },
      { label: "Early Career" },
      { label: "Tech" },
    ],
    bookmarked: true,
  },
  {
    organizations: [hydrateOrg("Entrepreneurship at Cornell")],
    postedAt: "Mar 23",
    title: "Jennifer Tegan: How NYS Supports Startups Through Investment",
    datetime: "April 16, 12:00pm - 1:00pm",
    location: "Online",
    description:
      "Join us for a fireside chat featuring Jennifer Tegan, Managing Director of New York Ventures for Empire State Development. Learn how NYS deploys capital into early-stage companies and what that means for student founders building in Ithaca.",
    truncateDescription: true,
    tags: [
      { label: "You're free!", color: "blue" },
      { label: "Entrepreneurship" },
      { label: "Guest Speaker" },
      { label: "Tech" },
    ],
    bookmarked: true,
  },
  {
    organizations: [hydrateOrg("CUAUV")],
    postedAt: "Mar 22",
    title: "CUAUV x Bonsai Robotics info session",
    datetime: "Week of April 12 (tentative)",
    location: "Online",
    description:
      "CUAUV is hosting an information session with Bonsai Robotics. Attending will be their Head of Perception, an Engineer, and a Recruiter — a great chance to learn about an AgTech robotics startup and ask candid questions about life on the team.",
    truncateDescription: true,
    tags: [{ label: "Recruitment" }, { label: "Robotics" }, { label: "Tech" }],
    bookmarked: true,
  },
  {
    organizations: [hydrateOrg("Cornell Fintech Club")],
    postedAt: "Mar 18",
    title: "Coffee chats with quant alumni",
    datetime: "April 5, 2:00pm - 5:00pm",
    location: "Gimme! Coffee, College Ave",
    description:
      "Sign up for a 20-minute coffee chat with a Cornell alum working at a quant trading firm. Slots are split between New York, Chicago, and London desks — bring questions about interview prep, daily work, and the trader vs. researcher split.",
    truncateDescription: true,
    tags: [{ label: "Mentorship" }, { label: "Finance" }],
    bookmarked: true,
  },
  {
    organizations: [hydrateOrg("Cornell Design & Tech Initiative")],
    postedAt: "Mar 14",
    title: "Spring product showcase + open house",
    datetime: "April 19, 6:00pm - 8:30pm",
    location: "Bill & Melinda Gates Hall G01",
    description:
      "Each subteam demos what they shipped this semester — from a new campus dining app to a redesigned course-review site. Stick around afterwards for snacks, Q&A with team leads, and a peek at next semester's recruitment timeline.",
    truncateDescription: true,
    tags: [{ label: "Recruitment" }, { label: "Tech" }],
    bookmarked: true,
  },
];
