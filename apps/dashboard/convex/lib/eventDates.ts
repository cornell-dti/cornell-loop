// convex/lib/eventDates.ts
//
// Calendar maths for parsed event dates. The AI parser reports dates as the
// parts it read off the email ("October 15", "6pm") and leaves the year null
// unless the email stated one, because listserv mail almost never does.
// Resolving that year and converting to epoch milliseconds happens here, on
// the server, where it is anchored to the email's own received date rather
// than to whatever year the model's training data was from.

/** Fixed for Cornell's campus, since the source emails never state one. */
export const SOURCE_TIMEZONE = "America/New_York";

/**
 * How far before the received date a year-less date may land before it is read
 * as next year instead. Wide enough that a December email about a January
 * event rolls over, narrow enough that a recap of last week's event stays in
 * the current year.
 */
const ROLLOVER_GRACE_DAYS = 60;

const MS_PER_DAY = 86_400_000;

export type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/**
 * The wall-clock parts of `timestamp` in {@link SOURCE_TIMEZONE}. Inverse of
 * {@link localPartsToEpochMs}.
 */
export function epochMsToLocalParts(timestamp: number): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SOURCE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

/**
 * Epoch milliseconds for wall-clock `parts` in {@link SOURCE_TIMEZONE}.
 *
 * Treats the parts as UTC first, then subtracts the zone's offset at that
 * instant. The offset is itself re-read at the corrected instant because a
 * date within a few hours of a daylight-saving transition can sit on the
 * other side of the change from where the first guess landed.
 */
export function localPartsToEpochMs(parts: LocalDateParts): number {
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  const firstGuess = asUtc - zoneOffsetMs(asUtc);
  return asUtc - zoneOffsetMs(firstGuess);
}

/**
 * The year a date with `month`/`day` refers to.
 *
 * The year of `receivedAt` is the baseline, rolled forward when the resulting
 * date would otherwise sit well in the past — which is what makes a December
 * email about a January event land correctly.
 *
 * A year the email stated wins, but only if it is not in the past relative to
 * the email: no listserv advertises an event in a year that has already gone,
 * so a stale stated year is the model hallucinating one rather than reading
 * it, and the baseline is the better answer.
 */
export function resolveYear(
  date: { statedYear: number | null; month: number; day: number },
  receivedAt: number,
): number {
  const received = epochMsToLocalParts(receivedAt);
  if (date.statedYear !== null && date.statedYear >= received.year) {
    return date.statedYear;
  }

  const candidate = localPartsToEpochMs({
    year: received.year,
    month: date.month,
    day: date.day,
    hour: 12,
    minute: 0,
  });

  const graceMs = ROLLOVER_GRACE_DAYS * MS_PER_DAY;
  return candidate < receivedAt - graceMs ? received.year + 1 : received.year;
}

/** The {@link SOURCE_TIMEZONE} UTC offset in milliseconds at `timestamp`. */
function zoneOffsetMs(timestamp: number): number {
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: SOURCE_TIMEZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(timestamp))
    .find((part) => part.type === "timeZoneName")?.value;

  // "GMT-05:00", or a bare "GMT" at a zero offset.
  const match = offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  if (!match) return 0;

  const [, sign, hours, minutes] = match;
  const magnitude = (Number(hours) * 60 + Number(minutes)) * 60_000;
  return sign === "-" ? -magnitude : magnitude;
}
