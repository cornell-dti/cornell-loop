/**
 * Sample data for /home preview.
 *
 * Convex schema currently only carries auth tables
 * (apps/dashboard/convex/schema.ts), so posts/events are not persisted yet.
 * These constants let us preview the feed against the DashboardPost and
 * HomeSidePanel shapes exported from shared/ui and apps/dashboard/src/pages/Home.tsx.
 *
 * Content here is original placeholder copy (not taken from the Figma mockup).
 */

import type { DashboardPostProps } from "@app/ui";
import type { HomeSidePanelProps } from "../pages/Home";

export const SAMPLE_POSTS: DashboardPostProps[] = [
  {
    organizations: [{ name: "Cornell Outing Club" }],
    postedAt: "Apr 21",
    title: "Sunrise hike at Taughannock Falls",
    datetime: "April 27, 5:30am - 8:30am",
    location: "Taughannock Falls trailhead",
    description:
      "Start the weekend early with a guided sunrise hike along the gorge trail. We'll meet at the trailhead, watch the sun come up over the falls, and be back in time for brunch. All experience levels welcome — we'll keep the pace easygoing.",
    descriptionTruncated: true,
    tags: [
      { label: "Outdoors" },
      { label: "Just for Fun" },
    ],
  },
  {
    organizations: [
      { name: "WICC" },
      { name: "CUAUV" },
    ],
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
    organizations: [{ name: "Cornell Fintech Club" }],
    postedAt: "Apr 18",
    title: "Portfolio construction workshop",
    datetime: "April 24, 4:30pm - 6:00pm",
    location: "Statler Hall 265",
    description:
      "A hands-on session on building and rebalancing a long-only equity portfolio. No finance background required — we'll walk through the math and run through a paper-trading exercise together.",
    descriptionTruncated: true,
    tags: [
      { label: "Mentorship" },
      { label: "Finance" },
    ],
  },
  {
    organizations: [{ name: "Big Red Robotics" }],
    postedAt: "Apr 15",
    title: "Open lab night: meet the team",
    datetime: "April 23, 7:00pm - 9:30pm",
    location: "Upson Hall B17",
    description:
      "Drop by the lab for a tour of our current build, chat with sub-team leads, and see live demos of the drivetrain and vision stack. Pizza while it lasts.",
    descriptionTruncated: true,
    tags: [
      { label: "Recruitment" },
      { label: "Tech" },
    ],
  },
];

export const SAMPLE_SIDE_PANELS: HomeSidePanelProps[] = [
  {
    title: "This week",
    items: [
      {
        title: "Sunrise hike at Taughannock",
        orgName: "Cornell Outing Club",
        isForYou: true,
      },
      {
        title: "Portfolio construction workshop",
        orgName: "Cornell Fintech Club",
      },
      {
        title: "Open lab night",
        orgName: "Big Red Robotics",
        hasIndicator: true,
      },
    ],
  },
  {
    title: "Trending",
    items: [
      {
        title: "Spring industry mixer",
        orgName: "WICC",
        isForYou: true,
        hasIndicator: true,
      },
      {
        title: "Intro to quantum computing talk",
        orgName: "Cornell Physics Society",
      },
      {
        title: "Campus community cleanup",
        orgName: "Cornell Sustainability",
        isForYou: false,
      },
    ],
  },
];
