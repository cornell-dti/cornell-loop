import type { CalendarEvent } from "../data/types";

/**
 * Builds a Google Calendar "add event" URL pre-filled from a CalendarEvent.
 *
 * Format: https://calendar.google.com/calendar/render?action=TEMPLATE&...
 * GCal accepts dates in YYYYMMDDTHHmmss (local) or YYYYMMDDTHHmmssZ (UTC).
 * We always send UTC: startISO/endISO come from `toISOString()`, so dropping
 * the trailing Z would make GCal read UTC wall-clock as the user's local time
 * (e.g. a 4pm ET event showing up at 9pm).
 */
export function buildGCalUrl(event: CalendarEvent): string {
  const fmt = (iso: string) =>
    // Normalize to UTC, then strip dashes, colons, and milliseconds (keep Z)
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");

  const start = fmt(event.startISO);
  const end = event.endISO ? fmt(event.endISO) : start;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
  });

  if (event.location) {
    params.set("location", event.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
