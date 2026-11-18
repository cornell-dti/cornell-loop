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

/**
 * True when every date on an item is already behind `now`: the event or
 * deadline it describes has happened. An item with no dates is never past,
 * since there is nothing to say it is over.
 */
export function isPastEvent(
  dates: ReadonlyArray<{ timestamp: number }>,
  now: number,
): boolean {
  return dates.length > 0 && dates.every((date) => date.timestamp < now);
}

/**
 * Assumed length of an event whose email gave a start time but no end time.
 * Listserv mail says "GBM at 5pm" far more often than it says when the thing
 * finishes, and an hour is both the common case and short enough that a
 * calendar entry built from it doesn't swallow the rest of someone's evening.
 */
export const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

/**
 * True when `timestamp` carries a time the email actually stated.
 *
 * The parser defaults a date with no time to local noon, so noon-on-the-dot is
 * read as "no time given". A real event that starts at exactly 12:00 is read
 * slightly wrong as a result, which is the cheaper error: the alternative is
 * storing a separate flag on every date for the sake of one edge case.
 */
export function hasStatedClockTime(timestamp: number): boolean {
  const parts = epochMsToLocalParts(timestamp);
  return parts.hour !== 12 || parts.minute !== 0;
}

/**
 * When an item's range ends, falling back to {@link DEFAULT_EVENT_DURATION_MS}
 * after the start when the email never said.
 *
 * The default is deliberately narrow. It applies only to a `start` — a
 * `single` date means a one-off with no end, and a `deadline` is an instant,
 * so neither gains anything from an invented range. A start with no stated
 * clock time is left alone too, since the parser's noon placeholder would
 * otherwise render as a confident "12 – 1pm".
 */
export function effectiveEndTimestamp(
  dates: ReadonlyArray<{ timestamp: number; type: string }>,
): number | undefined {
  const end = dates.find((date) => date.type === "end");
  if (end) return end.timestamp;
  if (dates.some((date) => date.type === "deadline")) return undefined;

  const start = dates.find((date) => date.type === "start");
  if (!start || !hasStatedClockTime(start.timestamp)) return undefined;
  return start.timestamp + DEFAULT_EVENT_DURATION_MS;
}

/** An email older than this, with no date on its item, is considered stale. */
export const STALE_EMAIL_DAYS = 30;

/**
 * - `current`: still worth reviewing.
 * - `passed`: confidently over; filed with the past drafts.
 * - `uncertain`: probably stale, but the item could still be live (a program
 *   or recurring series), so it is flagged for a human before being hidden.
 */
export type DraftStaleness = "current" | "passed" | "uncertain";

type StalenessInput = {
  dates: ReadonlyArray<{ timestamp: number; type: string }>;
  eventType: string;
  title: string;
  description: string;
  isRecurring: boolean;
  recurrenceNote?: string;
  links: ReadonlyArray<{ type: string }>;
  /** Years the email stated with no month/day ("2027–2028 program"). */
  statedYears?: ReadonlyArray<number>;
  /** Set once an admin has restored the draft; it is never re-filed. */
  keptActiveAt?: number;
};

/**
 * Whether the item names a year that hasn't ended, either as a year-only date
 * kept at parse time or written in its text ("2026–2027 academic year").
 */
function mentionsCurrentOrFutureYear(
  draft: StalenessInput,
  now: number,
): boolean {
  const currentYear = epochMsToLocalParts(now).year;
  if ((draft.statedYears ?? []).some((year) => year >= currentYear)) {
    return true;
  }
  const text = `${draft.title} ${draft.description} ${draft.recurrenceNote ?? ""}`;
  return Array.from(text.matchAll(/\b(20\d{2})\b/g)).some(
    (match) => Number(match[1]) >= currentYear,
  );
}

/**
 * Sorts a draft into current / passed / uncertain.
 *
 * A future date keeps an item current, since programs and deadlines carry
 * their own timestamps. An item whose dates are all past is passed, except a
 * recurring series with no stated end, which may still be running and goes to
 * review. An undated item is judged by the age of its source email
 * (`receivedAt`): older than {@link STALE_EMAIL_DAYS} it is passed, unless it
 * looks like something that outlives one email — recurring, a course or
 * opportunity, a registration/application link, or a year that hasn't ended —
 * in which case it is `uncertain`. With no known email date there is nothing
 * to judge by, so it stays current.
 */
export function classifyDraftStaleness(
  draft: StalenessInput,
  receivedAt: number | undefined,
  now: number,
): DraftStaleness {
  if (draft.keptActiveAt !== undefined) return "current";
  const recurring =
    draft.isRecurring || (draft.recurrenceNote ?? "").length > 0;
  if (draft.dates.length > 0) {
    if (!isPastEvent(draft.dates, now)) return "current";
    const openEnded = !draft.dates.some((date) => date.type === "end");
    return recurring && openEnded ? "uncertain" : "passed";
  }
  if (receivedAt === undefined) return "current";
  if (now - receivedAt <= STALE_EMAIL_DAYS * MS_PER_DAY) return "current";

  const mayOutliveEmail =
    recurring ||
    mentionsCurrentOrFutureYear(draft, now) ||
    draft.eventType === "opportunity" ||
    draft.eventType === "courses" ||
    draft.links.some(
      (link) => link.type === "registration" || link.type === "application",
    );
  return mayOutliveEmail ? "uncertain" : "passed";
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
