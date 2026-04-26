/**
 * Sample data for /subscriptions preview.
 *
 * Convex schema currently only carries auth tables, so subscription rows
 * are stubbed here. These constants feed Subscriptions.tsx via the
 * RoutedSubscriptions wrapper in App.tsx.
 *
 * Mailing-list addresses follow a plausible Cornell pattern (`*-l@cornell.edu`).
 * Content is original placeholder copy (not taken from the Figma mockup).
 */

import type { SubscriptionItem } from "../pages/Subscriptions";

export const SAMPLE_SUBSCRIPTIONS: SubscriptionItem[] = [
  {
    orgName: "Cornell Outing Club",
    isVerified: true,
    emailsReceived: 43,
    emailAddress: "cornell-outing-l@cornell.edu",
  },
  {
    orgName: "WICC",
    isVerified: true,
    emailsReceived: 28,
    emailAddress: "wicc-l@cornell.edu",
  },
  {
    orgName: "Cornell Fintech Club",
    isVerified: true,
    emailsReceived: 17,
    emailAddress: "fintech-l@cornell.edu",
  },
  {
    orgName: "CUAUV",
    isVerified: true,
    emailsReceived: 9,
    emailAddress: "cuauv-l@cornell.edu",
  },
  {
    orgName: "Big Red Robotics",
    isVerified: false,
    emailsReceived: 12,
    emailAddress: "bigred-robotics-l@cornell.edu",
  },
  {
    orgName: "Entrepreneurship at Cornell",
    isVerified: true,
    emailsReceived: 54,
    emailAddress: "eship-l@cornell.edu",
  },
  {
    orgName: "Cornell Data Science",
    isVerified: true,
    emailsReceived: 21,
    emailAddress: "cds-l@cornell.edu",
  },
  {
    orgName: "Cornell AI",
    isVerified: false,
    emailsReceived: 6,
    emailAddress: "cornell-ai-l@cornell.edu",
  },
  {
    orgName: "ACSU",
    isVerified: true,
    emailsReceived: 33,
    emailAddress: "acsu-l@cornell.edu",
  },
];
