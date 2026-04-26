/**
 * Sample data for /orgs/:slug preview.
 *
 * Convex schema currently only carries auth tables, so org profiles aren't
 * persisted yet. These typed fixtures hydrate the Org page until backend
 * tables exist.
 *
 * Each profile is keyed by URL slug and matches the props consumed by the
 * Org page — see apps/dashboard/src/pages/Org.tsx.
 */

import type { DashboardPostProps } from "@app/ui";
import type { OrgTag } from "../pages/Org";

export interface OrgProfile {
  slug: string;
  orgName: string;
  orgDescription: string;
  orgAvatarUrl?: string;
  coverImageUrl?: string;
  isVerified: boolean;
  orgTags: OrgTag[];
  loopSummary: string;
  isFollowing: boolean;
  /** External website opened by the globe button. */
  websiteUrl: string;
  /** Email address opened (mailto:) by the mail button. */
  email: string;
  posts: DashboardPostProps[];
}

// ─── Org profiles ─────────────────────────────────────────────────────────────

export const SAMPLE_ORGS: Record<string, OrgProfile> = {
  acsu: {
    slug: "acsu",
    orgName: "Association of Computer Science Undergraduates (ACSU)",
    orgDescription: "CS organization for undergrads looking to find community.",
    isVerified: true,
    orgTags: [
      { label: "Tech", variant: "neutral" },
      { label: "For you", variant: "primary" },
    ],
    loopSummary:
      "ACSU often posts about tech events, mentorship, and community. They host weekly events for students.",
    isFollowing: false,
    websiteUrl: "https://acsu.cornell.edu",
    email: "acsu@cornell.edu",
    posts: [
      {
        organizations: [
          {
            id: "acsu",
            name: "ACSU",
            description:
              "Association of Computer Science Undergraduates — the umbrella CS org running mentorship, recruiting, and community events at Cornell.",
            following: false,
            tags: [{ label: "Tech" }, { label: "For you", color: "blue" }],
          },
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
      },
      {
        organizations: [
          {
            id: "acsu",
            name: "ACSU",
            description:
              "Association of Computer Science Undergraduates — the umbrella CS org running mentorship, recruiting, and community events at Cornell.",
            following: false,
            tags: [{ label: "Tech" }, { label: "For you", color: "blue" }],
          },
        ],
        postedAt: "Feb 6",
        title: "Spring mentorship kickoff",
        datetime: "February 14, 6:00pm - 7:30pm",
        location: "Gates Hall G01",
        description:
          "Meet your spring mentor and the rest of your cohort. We'll do a quick round of intros, share goals for the semester, and break into small groups for office-hour planning. Pizza on us.",
        truncateDescription: true,
        tags: [{ label: "Mentorship" }, { label: "Tech" }],
      },
      {
        organizations: [
          {
            id: "acsu",
            name: "ACSU",
            description:
              "Association of Computer Science Undergraduates — the umbrella CS org running mentorship, recruiting, and community events at Cornell.",
            following: false,
            tags: [{ label: "Tech" }, { label: "For you", color: "blue" }],
          },
        ],
        postedAt: "Jan 30",
        title: "Resume review with industry alumni",
        datetime: "February 4, 4:00pm - 6:00pm",
        location: "Duffield Hall Atrium",
        description:
          "Drop in for a 1:1 resume review with Cornell CS alumni currently working at startups, FAANG, and quant firms. No appointments — first come, first served.",
        truncateDescription: true,
        tags: [{ label: "Early Career" }, { label: "Tech" }],
      },
    ],
  },

  cuauv: {
    slug: "cuauv",
    orgName: "Cornell University Autonomous Underwater Vehicle (CUAUV)",
    orgDescription:
      "Project team designing and building autonomous underwater vehicles for the international RoboSub competition.",
    isVerified: true,
    orgTags: [
      { label: "Project team", variant: "neutral" },
      { label: "Robotics", variant: "neutral" },
    ],
    loopSummary:
      "CUAUV posts about pool tests, sub-team recruitment, and travel updates from RoboSub. Expect technical deep-dives and behind-the-scenes build progress.",
    isFollowing: true,
    websiteUrl: "https://cuauv.org",
    email: "cuauv@cornell.edu",
    posts: [
      {
        organizations: [
          {
            id: "cuauv",
            name: "CUAUV",
            description:
              "Project team designing and building autonomous underwater vehicles for the international RoboSub competition.",
            following: true,
            tags: [{ label: "Project team" }, { label: "Robotics" }],
          },
        ],
        postedAt: "Apr 22",
        title: "Pool test #4 — RoboSub prep",
        datetime: "April 28, 7:00pm - 10:00pm",
        location: "Teagle Hall pool",
        description:
          "We're running our fourth pool test of the semester to validate the new vision pipeline against the RoboSub gate task. Spectators welcome — wear pool-deck-friendly shoes and bring earplugs.",
        truncateDescription: true,
        tags: [{ label: "Robotics" }, { label: "Project team" }],
      },
      {
        organizations: [
          {
            id: "cuauv",
            name: "CUAUV",
            description:
              "Project team designing and building autonomous underwater vehicles for the international RoboSub competition.",
            following: true,
            tags: [{ label: "Project team" }, { label: "Robotics" }],
          },
        ],
        postedAt: "Apr 18",
        title: "Sub-team recruitment info session",
        datetime: "April 25, 5:00pm - 6:30pm",
        location: "Upson Hall B17",
        description:
          "Curious about joining mech, electrical, or software for the next build cycle? We'll walk through the application process, sub-team scopes, and answer questions over snacks.",
        truncateDescription: true,
        tags: [{ label: "Recruitment" }, { label: "Robotics" }],
      },
    ],
  },

  outing: {
    slug: "outing",
    orgName: "Cornell Outing Club",
    orgDescription:
      "Student-run outdoor club running weekly hikes, climbing trips, and backcountry weekends across the Finger Lakes.",
    isVerified: true,
    orgTags: [
      { label: "Outdoors", variant: "neutral" },
      { label: "Just for Fun", variant: "neutral" },
      { label: "For you", variant: "primary" },
    ],
    loopSummary:
      "The Outing Club posts about weekly trips, gear swaps, and trip-leader trainings. Most events are open to first-timers and gear is loanable.",
    isFollowing: true,
    websiteUrl: "https://cornelloutingclub.org",
    email: "outing@cornell.edu",
    posts: [
      {
        organizations: [
          {
            id: "outing",
            name: "Cornell Outing Club",
            description:
              "Student-run outdoor club running weekly hikes, climbing trips, and backcountry weekends across the Finger Lakes.",
            following: true,
            tags: [{ label: "Outdoors" }, { label: "Just for Fun" }],
          },
        ],
        postedAt: "Apr 21",
        title: "Sunrise hike at Taughannock Falls",
        datetime: "April 27, 5:30am - 8:30am",
        location: "Taughannock Falls trailhead",
        description:
          "Start the weekend early with a guided sunrise hike along the gorge trail. We'll meet at the trailhead, watch the sun come up over the falls, and be back in time for brunch. All experience levels welcome.",
        truncateDescription: true,
        tags: [{ label: "Outdoors" }, { label: "Just for Fun" }],
      },
      {
        organizations: [
          {
            id: "outing",
            name: "Cornell Outing Club",
            description:
              "Student-run outdoor club running weekly hikes, climbing trips, and backcountry weekends across the Finger Lakes.",
            following: true,
            tags: [{ label: "Outdoors" }, { label: "Just for Fun" }],
          },
        ],
        postedAt: "Apr 16",
        title: "Spring gear swap & free repair clinic",
        datetime: "April 24, 12:00pm - 4:00pm",
        location: "Bailey Hall lawn",
        description:
          "Bring outdoor gear you no longer need and trade for something new. On-site mending and tune-ups available — bring boots, packs, and bikes for a free check-up.",
        truncateDescription: true,
        tags: [{ label: "Outdoors" }, { label: "Community" }],
      },
      {
        organizations: [
          {
            id: "outing",
            name: "Cornell Outing Club",
            description:
              "Student-run outdoor club running weekly hikes, climbing trips, and backcountry weekends across the Finger Lakes.",
            following: true,
            tags: [{ label: "Outdoors" }, { label: "Just for Fun" }],
          },
        ],
        postedAt: "Apr 10",
        title: "Trip leader training weekend",
        datetime: "May 3, 9:00am - May 4, 5:00pm",
        location: "Connecticut Hill",
        description:
          "Two-day backcountry training for prospective trip leaders. Covers navigation, risk management, and group facilitation. Camping gear provided.",
        truncateDescription: true,
        tags: [{ label: "Outdoors" }, { label: "Leadership" }],
      },
    ],
  },
};
