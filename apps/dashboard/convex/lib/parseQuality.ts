// convex/lib/parseQuality.ts
//
// How good is one AI-parsed feed item? The model's own `confidence` answers a
// different question — how sure it feels — and in practice barely moves. What
// an admin reviewing drafts actually needs to know is whether the item has the
// things a student would act on: when it happens, where, and how to sign up.
//
// Scored here rather than in the parser so the parse writer, the rescore
// backfill, and the admin page can never disagree about what a number means.
//
// Pure module: no `convex/server`, no `_generated/*`, no Node APIs.

import { epochMsToLocalParts } from "./eventDates";

/**
 * The scored fields. Deliberately structural rather than tied to
 * `Doc<"events">` or the parser's `ParsedItem`, since both shapes satisfy it
 * and both need scoring.
 */
export type QualityItem = {
  eventType:
    | "event"
    | "opportunity"
    | "hackathon"
    | "courses"
    | "fundraiser"
    | "info";
  description: string;
  dates: ReadonlyArray<{ timestamp: number }>;
  links: ReadonlyArray<{ url: string }>;
  location?: { displayText: string } | undefined;
  hosts: ReadonlyArray<{ name: string }>;
  tags: ReadonlyArray<string>;
};

export type QualityFlags = {
  /** A date the parser had to throw away, e.g. "February 30". */
  droppedDate?: boolean;
};

export type ParseQuality = {
  /** 0-100, stored on `events.parseConfidence`. */
  confidence: number;
  /** Short phrases naming what is missing, for the admin UI. */
  reasons: string[];
};

/**
 * Types whose date is a deadline rather than a start: a time of day adds
 * nothing, and the link is the whole point of the item.
 */
const DEADLINE_TYPES: ReadonlySet<QualityItem["eventType"]> = new Set([
  "opportunity",
  "courses",
]);

/** Types that happen somewhere, so a missing location is a real gap. */
const PLACE_TYPES: ReadonlySet<QualityItem["eventType"]> = new Set([
  "event",
  "hackathon",
  "fundraiser",
]);

const MIN_DESCRIPTION_CHARS = 80;

/** Deducted from completeness when the parser dropped an impossible date. */
const DROPPED_DATE_PENALTY = 15;

/**
 * Ceiling for an item with neither a date nor a link. However well-formed the
 * rest of it is, there is nothing for a student to do with it.
 */
const UNACTIONABLE_CAP = 40;

/** How much of the final score comes from the model's own confidence. */
const MODEL_WEIGHT = 0.25;

/**
 * Score `item` out of 100.
 *
 * Completeness is measured as a share of the points *applicable to this event
 * type*, not of a fixed total: an `opportunity` with a deadline and an
 * application link is complete, and marking it down for having no location
 * would make the score say "poorly parsed" when it means "no venue, correctly".
 */
export function scoreParseQuality(
  item: QualityItem,
  modelConfidence: number,
  flags: QualityFlags = {},
): ParseQuality {
  const isDeadline = DEADLINE_TYPES.has(item.eventType);
  const hasDate = item.dates.length > 0;

  const checks: ReadonlyArray<{
    points: number;
    applies: boolean;
    earned: boolean;
    reason: string;
  }> = [
    {
      points: 30,
      applies: true,
      earned: hasDate,
      reason: isDeadline ? "no deadline" : "no date",
    },
    {
      points: 10,
      applies: !isDeadline,
      earned: hasDate && hasStatedTime(item.dates),
      reason: "no start time",
    },
    {
      points: isDeadline ? 25 : 20,
      applies: true,
      earned: item.links.length > 0,
      reason: isDeadline ? "no application link" : "no registration link",
    },
    {
      points: 15,
      applies: PLACE_TYPES.has(item.eventType),
      earned: (item.location?.displayText ?? "").trim().length > 0,
      reason: "no location",
    },
    {
      points: 5,
      applies: true,
      earned: item.hosts.length > 0,
      reason: "no host named",
    },
    {
      points: 10,
      applies: true,
      earned: item.description.trim().length >= MIN_DESCRIPTION_CHARS,
      reason: "very short description",
    },
    {
      points: 5,
      applies: true,
      earned: item.tags.length > 0,
      reason: "no tags",
    },
  ];

  let applicable = 0;
  let earned = 0;
  const reasons: string[] = [];
  for (const check of checks) {
    if (!check.applies) continue;
    applicable += check.points;
    if (check.earned) earned += check.points;
    else reasons.push(check.reason);
  }

  let completeness = applicable === 0 ? 0 : (earned / applicable) * 100;
  if (flags.droppedDate) {
    completeness -= DROPPED_DATE_PENALTY;
    reasons.push("a date could not be read");
  }
  completeness = clamp(completeness, 0, 100);

  const blended =
    completeness * (1 - MODEL_WEIGHT) +
    clamp(modelConfidence, 0, 100) * MODEL_WEIGHT;

  const unactionable = !hasDate && item.links.length === 0;
  return {
    confidence: Math.round(
      unactionable ? Math.min(blended, UNACTIONABLE_CAP) : blended,
    ),
    reasons,
  };
}

/**
 * Rescale a model-reported confidence onto 0-100.
 *
 * The parser asked for `"confidence": number` without naming a scale for long
 * enough that stored values are a mix of fractions (0.9) and percentages (85),
 * so anything at or below 1 is read as a fraction. A model that genuinely
 * meant "1% confident" is indistinguishable here, and it makes no practical
 * difference: either reading leaves the item far below any useful threshold.
 */
export function normalizeModelConfidence(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return clamp(value <= 1 ? value * 100 : value, 0, 100);
}

/**
 * True when at least one date carries a time the email actually stated.
 *
 * The parser defaults a date with no time to local noon, so noon-on-the-dot is
 * read as "no time given". A real event that starts at exactly 12:00 is scored
 * slightly low as a result, which is the cheaper error: the alternative is
 * storing a separate flag on every date for the sake of one edge case.
 */
function hasStatedTime(dates: ReadonlyArray<{ timestamp: number }>): boolean {
  return dates.some((date) => {
    const parts = epochMsToLocalParts(date.timestamp);
    return parts.hour !== 12 || parts.minute !== 0;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
