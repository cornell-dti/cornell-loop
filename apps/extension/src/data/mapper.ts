/**
 * mapper.ts — converts Convex HydratedEvent shapes into extension EventItem.
 *
 * Only this file and useEvents.ts import Convex types; all UI components
 * work with EventItem exclusively.
 */

import type { Doc } from "@app/convex/_generated/dataModel";
import type { EventItem } from "./types";

export type HydratedEventInput = {
  event: Doc<"events">;
  orgs: Doc<"orgs">[];
  isBookmarked: boolean;
  sentAt?: number;
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function mapHydratedEventToEventItem(
  hydrated: HydratedEventInput,
): EventItem {
  const { event } = hydrated;

  // Org display: first org in eventOrgs → primary host in hosts array → listserv name
  const primaryOrg = hydrated.orgs[0];
  const primaryHost = event.hosts.find((h) => h.role === "primary");
  const orgName =
    primaryOrg?.name ??
    primaryHost?.name ??
    event.hosts[0]?.name ??
    event.listserv;
  const orgAvatarUrl = primaryOrg?.avatarUrl;

  // Dates
  const startDate = event.dates.find(
    (d) => d.type === "start" || d.type === "single",
  );
  const endDate = event.dates.find((d) => d.type === "end");
  const deadlineDate = event.dates.find((d) => d.type === "deadline");
  const displayDate = startDate ?? deadlineDate;

  // Date badge: events, hackathons, and course series show a date thumbnail
  const hasDateBadge =
    event.eventType === "event" ||
    event.eventType === "hackathon" ||
    event.eventType === "courses";

  const thumbnailVariant: "date" | "news" =
    hasDateBadge && displayDate !== undefined ? "date" : "news";

  let day: number | string | undefined;
  let month: string | undefined;
  if (thumbnailVariant === "date" && displayDate !== undefined) {
    const d = new Date(displayDate.timestamp);
    day = d.getDate();
    month = MONTH_SHORT[d.getMonth()];
  }

  // Subtitle: time + location array for timed events; aiDescription otherwise
  let subtitle: string | string[] | undefined;
  if (
    startDate !== undefined &&
    (event.eventType === "event" || event.eventType === "hackathon")
  ) {
    const parts: string[] = [];
    if (endDate !== undefined) {
      parts.push(
        `${formatTime(startDate.timestamp)}–${formatTime(endDate.timestamp)}`,
      );
    } else {
      parts.push(formatTime(startDate.timestamp));
    }
    if (event.location?.displayText) {
      parts.push(event.location.displayText);
    }
    subtitle = parts.length > 0 ? parts : event.aiDescription || undefined;
  } else if (event.aiDescription) {
    subtitle = event.aiDescription;
  }

  // Calendar event for "Add to Calendar" — only when we have a timed event
  let calendarEvent: EventItem["calendarEvent"];
  if (
    startDate !== undefined &&
    (event.eventType === "event" || event.eventType === "hackathon")
  ) {
    calendarEvent = {
      title: event.title,
      startISO: new Date(startDate.timestamp).toISOString(),
      endISO:
        endDate !== undefined
          ? new Date(endDate.timestamp).toISOString()
          : undefined,
      location: event.location?.displayText,
    };
  }

  const PRIMARY_CTA_TYPES = new Set<string>([
    "rsvp",
    "application",
    "registration",
  ]);
  const hasCta = event.links.some((l) => PRIMARY_CTA_TYPES.has(l.type));
  const isEdgeCase = calendarEvent === undefined && !hasCta;

  return {
    id: event._id,
    orgName,
    orgAvatarUrl,
    thumbnailVariant,
    day,
    month,
    title: event.title,
    subtitle,
    tags: event.tags,
    links: event.links.map((l) => ({
      url: l.url,
      type: l.type,
      label: l.label,
    })),
    calendarEvent,
    isEdgeCase: isEdgeCase || undefined,
    sentAt: hydrated.sentAt,
  };
}
