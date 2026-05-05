/**
 * eventToPost — pure mapper from a hydrated Convex event document to the
 * `DashboardPostProps` shape consumed by the design-system <DashboardPost>.
 *
 * Phase 2F: Org.tsx and Search.tsx both feed Convex `HydratedEvent` rows into
 * the same UI component used by Home / Bookmarks. Centralising the mapping
 * here keeps every page's post header + event card consistent.
 *
 * Pure function, no side effects.
 */

import type {
  Club,
  DashboardPostProps,
  Organization,
  RsvpGroup,
} from "@app/ui";
import type { Doc } from "../../convex/_generated/dataModel";

export interface HydratedEvent {
  event: Doc<"events">;
  orgs: Doc<"orgs">[];
  isBookmarked: boolean;
}

export interface HydratedRsvp {
  rsvp: Doc<"rsvps">;
  event: Doc<"events">;
  orgs: Doc<"orgs">[];
}

export interface MyRsvpsResult {
  today: HydratedRsvp[];
  thisWeek: HydratedRsvp[];
}

// ─── Date formatting ─────────────────────────────────────────────────────────

const POSTED_AT_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const DATE_PART_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
});

const TIME_PART_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatPostedAt(timestampMs: number): string {
  return POSTED_AT_FORMATTER.format(new Date(timestampMs));
}

function formatDateLong(timestampMs: number): string {
  return DATE_PART_FORMATTER.format(new Date(timestampMs));
}

function formatTime(timestampMs: number): string {
  // Lowercase the AM/PM segment so "5:30 PM" → "5:30pm" to match the existing
  // sample data convention used throughout the dashboard.
  return TIME_PART_FORMATTER.format(new Date(timestampMs))
    .replace(/\s/g, "")
    .toLowerCase();
}

/**
 * Picks the most relevant timestamp(s) from an event's `dates[]` for the
 * "datetime" line shown on the event card. Prefers a start timestamp; falls
 * back to "single", then "deadline".
 *
 * Returns a formatted string like:
 *   "April 27, 5:30am - 8:30am"  (start + end same day)
 *   "April 27, 5:30am"           (start only)
 *   "Deadline April 30"          (deadline)
 *   ""                           (no usable date)
 */
function formatEventDatetime(event: Doc<"events">): string {
  const start = event.dates.find(
    (d) => d.type === "start" || d.type === "single",
  );
  const end = event.dates.find((d) => d.type === "end");
  const deadline = event.dates.find((d) => d.type === "deadline");

  if (start) {
    const datePart = formatDateLong(start.timestamp);
    const startTime = formatTime(start.timestamp);
    if (end) {
      const endTime = formatTime(end.timestamp);
      return `${datePart}, ${startTime} - ${endTime}`;
    }
    return `${datePart}, ${startTime}`;
  }

  if (deadline) {
    return `Deadline ${formatDateLong(deadline.timestamp)}`;
  }

  return "";
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

// ─── Right-rail mappers ──────────────────────────────────────────────────────

const RSVP_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", { day: "numeric" });
const RSVP_MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
});

function getStartTimestamp(event: Doc<"events">): number | null {
  for (const date of event.dates) {
    if (date.type === "start" || date.type === "single") {
      return date.timestamp;
    }
  }
  return null;
}

function hydratedRsvpToEvent(hydrated: HydratedRsvp) {
  const start = getStartTimestamp(hydrated.event);
  const date = start !== null ? new Date(start) : null;
  return {
    day: date ? Number(RSVP_DAY_FORMATTER.format(date)) : 0,
    month: date ? RSVP_MONTH_FORMATTER.format(date) : "",
    title: hydrated.event.title,
    description: hydrated.event.aiDescription || hydrated.event.description,
  };
}

/**
 * Convert the `api.rsvps.myRsvps` payload into the `RsvpGroup[]` shape
 * consumed by <SearchPanel>. Empty groups are omitted so the panel doesn't
 * render an empty period header.
 */
export function rsvpsToRsvpGroups(
  result: MyRsvpsResult | undefined,
): RsvpGroup[] {
  if (!result) return [];
  const groups: RsvpGroup[] = [];
  if (result.today.length > 0) {
    groups.push({
      period: "Today",
      events: result.today.map(hydratedRsvpToEvent),
    });
  }
  if (result.thisWeek.length > 0) {
    groups.push({
      period: "This week",
      events: result.thisWeek.map(hydratedRsvpToEvent),
    });
  }
  return groups;
}

/**
 * Convert a list of org docs (e.g. from `api.orgs.listFollowed`) into the
 * `Club[]` shape consumed by <SearchPanel>'s "Your Clubs" grid.
 */
export function orgsToClubs(orgs: Doc<"orgs">[] | undefined): Club[] {
  if (!orgs) return [];
  return orgs.map((org) => ({
    id: org.slug,
    name: org.name,
    avatarUrl: org.avatarUrl,
    description: org.description,
  }));
}

// ─── Event → Post ────────────────────────────────────────────────────────────

export function eventToPost(hydrated: HydratedEvent): DashboardPostProps {
  const { event, orgs, isBookmarked } = hydrated;

  const organizations: Organization[] = orgs.map((org) => ({
    id: org.slug,
    name: org.name,
    avatarUrl: org.avatarUrl,
    description: org.description,
    tags: org.tags.map((label) => ({ label })),
  }));

  return {
    organizations,
    postedAt: formatPostedAt(event._creationTime),
    title: event.title,
    datetime: formatEventDatetime(event),
    location: event.location?.displayText ?? "",
    description: event.description,
    truncateDescription: true,
    tags: event.tags.map((label) => ({ label })),
    bookmarked: isBookmarked,
  };
}
