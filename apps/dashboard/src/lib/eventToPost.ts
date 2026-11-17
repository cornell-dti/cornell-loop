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
import type { Doc, Id } from "../../convex/_generated/dataModel";
import type { PublicEvent } from "../../convex/events";
import type { PublicOrg } from "../../convex/orgs";

export interface HydratedEvent {
  event: PublicEvent;
  orgs: PublicOrg[];
  isBookmarked: boolean;
}

export interface HydratedRsvp {
  rsvp: Doc<"rsvps">;
  event: PublicEvent;
  orgs: PublicOrg[];
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
 *   "April 27, 5:30am - 8:30am"           (start + end, same day)
 *   "April 27, 5:30am – April 29, 8:30am" (start + end, different days)
 *   "April 27, 5:30am"                    (start only)
 *   "Deadline April 30"                   (deadline)
 *   ""                                    (no usable date)
 */
function formatEventDatetime(event: PublicEvent): string {
  const start = event.dates.find(
    (d) => d.type === "start" || d.type === "single",
  );
  const end = event.dates.find((d) => d.type === "end");
  const deadline = event.dates.find((d) => d.type === "deadline");

  if (start) {
    const startDatePart = formatDateLong(start.timestamp);
    const startTime = formatTime(start.timestamp);
    if (end) {
      const endDatePart = formatDateLong(end.timestamp);
      const endTime = formatTime(end.timestamp);
      // Multi-day: end falls on a different calendar day than start — render
      // both dates so the range isn't silently truncated to the start date.
      if (endDatePart !== startDatePart) {
        return `${startDatePart}, ${startTime} \u2013 ${endDatePart}, ${endTime}`;
      }
      return `${startDatePart}, ${startTime} - ${endTime}`;
    }
    return `${startDatePart}, ${startTime}`;
  }

  if (deadline) {
    return `Deadline ${formatDateLong(deadline.timestamp)}`;
  }

  return "";
}

// ─── RSVP button label + primary link resolution ─────────────────────────────

type EventLink = PublicEvent["links"][number];
type EventLinkType = EventLink["type"];
type EventType = PublicEvent["eventType"];

/** Preferred link `type`s to surface as the primary action, per event type.
 * `info` events never get a primary link (schema: "no clear CTA, catch-all"). */
const LINK_TYPE_PREFERENCE: Record<EventType, EventLinkType[]> = {
  event: ["rsvp", "registration", "info"],
  hackathon: ["registration", "rsvp", "info"],
  courses: ["registration", "rsvp", "info"],
  opportunity: ["application", "registration", "info"],
  fundraiser: ["registration", "info"],
  info: [],
};

/** Default button label per event type when the link itself has no `label`. */
function defaultRsvpLabel(eventType: EventType): string | undefined {
  switch (eventType) {
    case "event":
      return "RSVP";
    case "hackathon":
    case "courses":
      return "Register";
    case "opportunity":
      return "Apply";
    case "fundraiser":
      return "Donate";
    case "info":
      return undefined;
  }
}

/** Picks the single best link to treat as the card's primary action, per
 * `LINK_TYPE_PREFERENCE`; falls back to the first link if none match. */
function resolvePrimaryLink(event: PublicEvent): EventLink | undefined {
  if (event.links.length === 0 || event.eventType === "info") return undefined;
  for (const type of LINK_TYPE_PREFERENCE[event.eventType]) {
    const match = event.links.find((l) => l.type === type);
    if (match) return match;
  }
  return event.links[0];
}

/** Button label: explicit link label → per-type default → hidden (info). */
function resolveRsvpLabel(
  event: PublicEvent,
  link: EventLink | undefined,
): string | undefined {
  return link?.label ?? defaultRsvpLabel(event.eventType);
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

// ─── Right-rail mappers ──────────────────────────────────────────────────────

const RSVP_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", { day: "numeric" });
const RSVP_MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
});

function getStartTimestamp(event: PublicEvent): number | null {
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
export function orgsToClubs(orgs: PublicOrg[] | undefined): Club[] {
  if (!orgs) return [];
  return orgs.map((org) => ({
    id: org.slug,
    name: org.name,
    avatarUrl: org.avatarUrl,
    description: org.description,
  }));
}

/**
 * Fills in `following` + `onToggleFollow` on a mapped `Organization[]` using
 * the real `PublicOrg._id` from the parallel `orgs` array `eventToPost()` was
 * built from (same index alignment as `hydrated.orgs`). `follows.follow` /
 * `unfollow` need a real `Id<"orgs">`, but `Organization.id` is the org slug
 * — this is the one place that resolves the real id so every page can wire
 * follow/unfollow the same way instead of re-deriving it ad hoc.
 */
export function stampFollowState(
  organizations: Organization[],
  orgs: readonly PublicOrg[],
  followedOrgIdSet: ReadonlySet<Id<"orgs">>,
  onToggle: (orgId: Id<"orgs">, currentlyFollowing: boolean) => void,
): Organization[] {
  return organizations.map((org, i) => {
    const matched = orgs[i];
    if (matched === undefined) return org;
    const following = followedOrgIdSet.has(matched._id);
    return {
      ...org,
      following,
      onToggleFollow: () => onToggle(matched._id, following),
    };
  });
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

  const primaryLink = resolvePrimaryLink(event);

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
    rsvpLabel: resolveRsvpLabel(event, primaryLink),
    rsvpUrl: primaryLink?.url,
  };
}
