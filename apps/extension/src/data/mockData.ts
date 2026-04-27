/**
 * Mock event data for extension UI development.
 *
 * Coverage goals:
 *   ✓ eventType: event, opportunity, hackathon, courses, fundraiser, info
 *   ✓ link types: rsvp, application, registration, info, social
 *   ✓ with and without calendarEvent (Add to Calendar)
 *   ✓ edge-case subtitle → OriginalEmailView
 *   ✓ multi-tag and single-tag events
 *   ✓ 4 events from same org (Cornell DTI) → tests 3/org collapse
 *   ✓ sentAt within last 14 days for feed ordering
 *
 * Calendar dates are computed relative to today so they always fall in the
 * current/upcoming GCal week view — this ensures the GCal grid hover overlay
 * can find the right day column.
 */

import type { EventItem } from "./types";

const now = Date.now();
const daysAgo = (n: number) => now - n * 24 * 60 * 60 * 1000;

// ── Calendar date helpers ──────────────────────────────────────────────────

const today = new Date();

function addDays(n: number): Date {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(d: Date, hour: number, minute = 0): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${y}-${m}-${dd}T${h}:${mm}:00`;
}

function dayNum(d: Date): number {
  return d.getDate();
}

function monthStr(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" });
}

// Upcoming dates (so they appear in current/next GCal week view)
const d2 = addDays(2); // 2 days from now
const d4 = addDays(4); // 4 days from now
const d6 = addDays(6); // 6 days from now
const d9 = addDays(9); // 9 days from now

export const MOCK_EVENTS: EventItem[] = [
  // ── Cornell DTI (4 events → tests 3/org collapse) ────────────────────────

  {
    id: "1",
    orgName: "Cornell DTI",
    thumbnailVariant: "date",
    day: dayNum(d2),
    month: monthStr(d2),
    title: "Datadog x DTI Recruitment Info Session",
    subtitle: ["4:00 pm – 5:30 pm", "Hollister Hall 312"],
    tags: ["Tech", "Internships", "Early career"],
    links: [
      { url: "https://forms.gle/datadog-rsvp", type: "rsvp", label: "RSVP" },
    ],
    calendarEvent: {
      title: "Datadog x DTI Recruitment Info Session",
      startISO: toISO(d2, 16),
      endISO: toISO(d2, 17, 30),
      location: "Hollister Hall 312",
    },
    sentAt: daysAgo(2),
  },

  {
    id: "2",
    orgName: "Cornell DTI",
    thumbnailVariant: "date",
    day: dayNum(d4),
    month: monthStr(d4),
    title: "DTI Spring Charity Auction",
    subtitle: ["6:00 pm – 8:00 pm", "Statler Hotel, Carrion Ballroom"],
    tags: ["Just for fun", "Early career"],
    links: [
      {
        url: "https://cornellloop.com/dti-auction",
        type: "info",
        label: "Learn More",
      },
    ],
    calendarEvent: {
      title: "DTI Spring Charity Auction",
      startISO: toISO(d4, 18),
      endISO: toISO(d4, 20),
      location: "Statler Hotel",
    },
    sentAt: daysAgo(6),
  },

  {
    id: "3",
    orgName: "Cornell DTI",
    thumbnailVariant: "news",
    title: "DTI Product Sprint Demo Night",
    subtitle: "See what our teams shipped this semester — all are welcome",
    tags: ["Tech", "Just for fun"],
    links: [
      { url: "https://cornelldti.org/demo", type: "info", label: "Learn More" },
    ],
    sentAt: daysAgo(9),
  },

  {
    // 4th DTI event — hidden behind "View more" in FeedView
    id: "4",
    orgName: "Cornell DTI",
    thumbnailVariant: "date",
    day: dayNum(d9),
    month: monthStr(d9),
    title: "DTI End of Year Celebration",
    subtitle: ["7:00 pm – 10:00 pm", "Duffield Hall Atrium"],
    tags: ["Just for fun"],
    links: [],
    calendarEvent: {
      title: "DTI End of Year Celebration",
      startISO: toISO(d9, 19),
      endISO: toISO(d9, 22),
      location: "Duffield Hall Atrium",
    },
    sentAt: daysAgo(10),
  },

  // ── WICC (2 events) ───────────────────────────────────────────────────────

  {
    // opportunity type: application link, no calendar
    id: "5",
    orgName: "WICC",
    thumbnailVariant: "news",
    title: "Jane Street Summer Internship Applications",
    subtitle:
      "For women and non-binary engineers interested in trading and technology",
    tags: ["Internships"],
    links: [
      {
        url: "https://www.janestreet.com/internships",
        type: "application",
        label: "Apply",
      },
      { url: "https://instagram.com/cornellwicc", type: "social" },
    ],
    sentAt: daysAgo(3),
  },

  {
    // event type: rsvp + calendar, multi-tag
    id: "6",
    orgName: "WICC",
    thumbnailVariant: "date",
    day: dayNum(d6),
    month: monthStr(d6),
    title: "WICC x Meta Fireside Chat",
    subtitle: ["5:00 pm – 6:30 pm", "Bloomberg Center 161"],
    tags: ["Tech", "Early career", "Mentorship"],
    links: [
      { url: "https://forms.gle/wicc-meta", type: "rsvp", label: "RSVP" },
    ],
    calendarEvent: {
      title: "WICC x Meta Fireside Chat",
      startISO: toISO(d6, 17),
      endISO: toISO(d6, 18, 30),
      location: "Bloomberg Center 161",
    },
    sentAt: daysAgo(8),
  },

  // ── BigRed Hacks (hackathon type) ─────────────────────────────────────────

  {
    id: "7",
    orgName: "BigRed Hacks",
    thumbnailVariant: "date",
    day: dayNum(d6),
    month: monthStr(d6),
    title: "BigRed//Hacks 2026",
    subtitle: [
      `${monthStr(d6)} ${dayNum(d6)} – ${monthStr(d9)} ${dayNum(d9)}`,
      "Gates Hall",
    ],
    tags: ["Tech", "Just for fun"],
    links: [
      {
        url: "https://bigredhacks.com/register",
        type: "registration",
        label: "Register",
      },
      { url: "https://bigredhacks.com", type: "info" },
    ],
    calendarEvent: {
      title: "BigRed//Hacks 2026",
      startISO: toISO(d6, 18),
      endISO: toISO(d9, 12),
    },
    sentAt: daysAgo(5),
  },

  // ── Cornell Entrepreneurship (courses/recurring + edge-case) ─────────────

  {
    // courses type: recurring, info link only
    id: "8",
    orgName: "Cornell Entrepreneurship",
    thumbnailVariant: "news",
    title: "Startup Hours – Weekly Builder Meetups",
    subtitle: "Every Thursday 7:30–9 PM at eHub Collegetown, 3rd floor",
    tags: ["Mentorship", "Just for fun"],
    links: [{ url: "https://eship.cornell.edu/startup-hours", type: "info" }],
    sentAt: daysAgo(1),
  },

  {
    // info type (edge case): no parseable CTA — shows raw email view
    id: "9",
    orgName: "Cornell Entrepreneurship",
    thumbnailVariant: "news",
    title: "Startup Hours – This Thursday",
    subtitle: "Click to see original email",
    tags: ["Mentorship"],
    links: [],
    isEdgeCase: true,
    emailId: "email-9",
    rawEmailTitle: "Startup Hours – This Thursday at eHub",
    rawEmailParagraphs: [
      "Hello Eship,",
      "",
      "For Cornell builders, aspiring VCs, and startup enthusiasts: Startup Hours is being held from 7:30–9pm Thursday, on the third floor of eHub Collegetown. Startup Hours is a student-run event where you can come by to work on your projects, meet with VCs and mentors for funding, and catch up with other builders and early-stage investors.",
      "",
      "Startup Hours is backed by Entrepreneurship at Cornell, along with VCs like Contrary Capital, Dorm Room Fund, .406 Ventures, and General Catalyst.",
      "",
      "Please fill out this form for catering by Wednesday 5pm so we have a proper headcount.",
      "",
      "Best,",
      "Alli",
    ],
    sentAt: daysAgo(4),
  },

  // ── AppDev (opportunity: multi-link) ─────────────────────────────────────

  {
    id: "10",
    orgName: "AppDev",
    thumbnailVariant: "news",
    title: "Contrary Capital Scout Applications Open",
    subtitle:
      "For students interested in early-stage venture capital and startup investing",
    tags: ["Internships", "Tech", "Early career"],
    links: [
      { url: "https://contrary.com/scout", type: "application" },
      { url: "https://contrary.com", type: "info" },
      { url: "https://instagram.com/contraryvc", type: "social" },
    ],
    sentAt: daysAgo(7),
  },
];
