import type { CalendarEvent } from "../data/types";

/**
 * Builds a Google Calendar "add event" URL pre-filled from a CalendarEvent.
 *
 * Format: https://calendar.google.com/calendar/render?action=TEMPLATE&...
 * GCal accepts dates in YYYYMMDDTHHmmss (local) or YYYYMMDDTHHmmssZ (UTC).
 */
export function buildGCalUrl(event: CalendarEvent): string {
  const fmt = (iso: string) =>
    // Strip dashes, colons, milliseconds, and trailing Z for local time
    iso
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")
      .replace("Z", "");

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
