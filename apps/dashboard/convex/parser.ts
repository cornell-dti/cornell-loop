import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAdminToken } from "./_shared/adminToken";
import { isRecord } from "./lib/ai";
import { isListAdminNoise } from "./lib/cornellLists";
import {
  DEFAULT_EVENT_DURATION_MS,
  SOURCE_TIMEZONE,
  STALE_EMAIL_DAYS,
  classifyDraftStaleness,
  epochMsToLocalParts,
  hasStatedClockTime,
  isPastEvent,
  localPartsToEpochMs,
  resolveYear,
} from "./lib/eventDates";
import {
  normalizeModelConfidence,
  scoreParseQuality,
} from "./lib/parseQuality";
import {
  eventDocValidator,
  parseRunDocValidator,
  parsedItemValidator,
} from "./lib/docValidators";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { CANONICAL_TAGS, normalizeTags } from "./lib/tags";

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_OPENAI_PARSE_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_PARSE_MODEL = "gemini-2.5-flash";
const MAX_MESSAGES_PER_RUN = 10;
/** Bound on the "how many need assignment" estimate — see `overview`. */
const NEEDS_ASSIGNMENT_SCAN_LIMIT = 500;
/** Bound on the draft counts in `overview`; the list itself is paginated. */
const DRAFT_COUNT_SCAN_LIMIT = 1000;
/**
 * Drafts read (and so at most hidden) per sweep page, keeping one call well
 * inside a mutation's limits. Later pages run as scheduled follow-ups.
 */
const HIDE_PAST_BATCH = 500;

type AIProvider = "openai" | "gemini";
type AIConfig = {
  provider: AIProvider;
  model: string;
  fallback?: { provider: AIProvider; model: string };
};

type ParseResult = {
  messageType:
    | "events"
    | "opportunities"
    | "newsletter"
    | "admin"
    | "irrelevant";
  shouldPublish: boolean;
  summary: string;
  confidence: number;
  warnings: string[];
  items: ParsedItem[];
};

type ParsedItem = {
  title: string;
  description: string;
  aiDescription: string;
  eventType:
    | "event"
    | "opportunity"
    | "hackathon"
    | "courses"
    | "fundraiser"
    | "info";
  hosts: Array<{
    name: string;
    kind: "club" | "company" | "external_org";
    role: "primary" | "cohost" | "sponsor";
  }>;
  dates: Array<{
    timestamp: number;
    type: "start" | "end" | "deadline" | "single";
  }>;
  statedYears?: number[];
  isRecurring: boolean;
  recurrenceNote?: string;
  location?: {
    displayText: string;
    address?: string;
    isVirtual: boolean;
    buildingCode?: string;
  };
  links: Array<{
    url: string;
    type: "registration" | "application" | "rsvp" | "info" | "social";
    label?: string;
  }>;
  contacts: Array<{ type: "email" | "instagram" | "website"; value: string }>;
  tags: string[];
  targetAudience?:
    | "all"
    | "first_year"
    | "women_nonbinary"
    | "international"
    | "graduate";
  perks: Array<"food" | "swag" | "prizes" | "travel_covered" | "paid">;
  /** How complete this item's extraction is — see lib/parseQuality.ts. */
  confidence: number;
  /** This item's own warnings, plus the message-level ones. */
  warnings: string[];
};

type SourceMessage = Doc<"listservMessages"> & {
  listserv?: Doc<"listservs"> | null;
  organization?: Doc<"orgs"> | null;
};

type ParseRunSummary = {
  messagesScanned: number;
  messagesParsed: number;
  eventsCreated: number;
  eventsSkippedDuplicate: number;
  messagesIgnored: number;
};

const PARSE_RUN_SUMMARY_VALIDATOR = v.object({
  messagesScanned: v.number(),
  messagesParsed: v.number(),
  eventsCreated: v.number(),
  eventsSkippedDuplicate: v.number(),
  messagesIgnored: v.number(),
});

export const runParseNow = action({
  args: { token: v.string(), messageId: v.optional(v.id("listservMessages")) },
  returns: PARSE_RUN_SUMMARY_VALIDATOR,
  handler: async (ctx, args): Promise<ParseRunSummary> => {
    requireAdminToken(args.token);
    return await ctx.runAction(internal.parser.runParseInternal, {
      trigger: args.messageId ? "single_message" : "manual",
      messageId: args.messageId,
    });
  },
});

/**
 * The actual parse run, callable without an admin token so the cron can run
 * it directly. `runParseNow` (above) is the token-gated public entry point the
 * admin UI calls; both funnel through here so there is exactly one
 * implementation of the run loop.
 */
export const runParseInternal = internalAction({
  args: {
    trigger: v.union(
      v.literal("manual"),
      v.literal("cron"),
      v.literal("single_message"),
    ),
    messageId: v.optional(v.id("listservMessages")),
  },
  handler: async (ctx, args): Promise<ParseRunSummary> => {
    const aiConfig = getAIConfig();
    const runId: Id<"parseRuns"> = await ctx.runMutation(
      internal.parser.startParseRun,
      {
        trigger: args.trigger,
        provider: aiConfig.provider,
        model: aiConfig.model,
      },
    );

    let messagesScanned = 0;
    let messagesParsed = 0;
    let eventsCreated = 0;
    let eventsSkippedDuplicate = 0;
    let messagesIgnored = 0;

    try {
      const messages = (await ctx.runQuery(
        internal.parser.getMessagesForParsing,
        {
          messageId: args.messageId,
          limit: MAX_MESSAGES_PER_RUN,
        },
      )) as SourceMessage[];
      messagesScanned = messages.length;

      for (const message of messages) {
        if (shouldIgnoreMessage(message)) {
          await ctx.runMutation(internal.parser.markMessageIgnored, {
            messageId: message._id,
            reason: "Administrative or confirmation message.",
          });
          messagesIgnored += 1;
          continue;
        }

        try {
          const result = await parseMessageWithAI(message, aiConfig);
          const normalized = normalizeParseResult(result, message.receivedAt);
          if (
            normalized.items.length === 0 ||
            normalized.messageType === "irrelevant" ||
            normalized.messageType === "admin"
          ) {
            await ctx.runMutation(internal.parser.markMessageIgnored, {
              messageId: message._id,
              reason:
                normalized.warnings.join("; ") ||
                "No useful feed items extracted.",
            });
            messagesIgnored += 1;
            continue;
          }

          // Each item carries its own confidence and warnings, with the
          // message-level ones already merged in, so nothing message-wide is
          // passed separately.
          const stored = (await ctx.runMutation(
            internal.parser.storeParsedEvents,
            { messageId: message._id, items: normalized.items },
          )) as { created: number; skippedDuplicate: number };
          messagesParsed += 1;
          eventsCreated += stored.created;
          eventsSkippedDuplicate += stored.skippedDuplicate;
        } catch (error) {
          await ctx.runMutation(internal.parser.markMessageFailed, {
            messageId: message._id,
            error: formatError(error),
          });
        }
      }

      await ctx.runMutation(internal.parser.finishParseRun, {
        runId,
        status: "completed",
        messagesScanned,
        messagesParsed,
        eventsCreated,
        eventsSkippedDuplicate,
        messagesIgnored,
      });
      return {
        messagesScanned,
        messagesParsed,
        eventsCreated,
        eventsSkippedDuplicate,
        messagesIgnored,
      };
    } catch (error) {
      await ctx.runMutation(internal.parser.finishParseRun, {
        runId,
        status: "failed",
        messagesScanned,
        messagesParsed,
        eventsCreated,
        eventsSkippedDuplicate,
        messagesIgnored,
        error: formatError(error),
      });
      throw error;
    }
  },
});

export const publishEvent = mutation({
  args: { token: v.string(), eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await publishEventById(ctx, args.eventId);
    return null;
  },
});

/**
 * Publish several drafts in one call, so approving a parse run's worth of
 * items doesn't require one click per draft. Reuses `publishEventById` so the
 * `eventOrgs` write and the draft-only guard stay identical to the
 * single-event path.
 */
export const publishEvents = mutation({
  args: { token: v.string(), eventIds: v.array(v.id("events")) },
  returns: v.object({ published: v.number(), skipped: v.number() }),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    let published = 0;
    let skipped = 0;
    for (const eventId of args.eventIds) {
      if (await publishEventById(ctx, eventId)) {
        published += 1;
      } else {
        skipped += 1;
      }
    }
    return { published, skipped };
  },
});

/**
 * Publish one event, or no-op if it is not currently a draft. Returns whether
 * it published, so a bulk caller can report a per-item outcome.
 *
 * The guard matters because a `hidden` event is a decision an admin already
 * made — rejecting it — and without checking the current visibility a stale
 * client reference or a race with another admin tab could silently undo
 * that.
 */
async function publishEventById(ctx: MutationCtx, eventId: Id<"events">) {
  const event = await ctx.db.get(eventId);
  if (!event || event.visibility !== "draft") return false;

  const now = Date.now();
  await ctx.db.patch(eventId, {
    visibility: "published",
    updatedAt: now,
  });

  // Insert the eventOrgs join so the org name appears in the feed post header.
  // organizationId now points directly to `orgs`, so no cross-table sync needed.
  if (!event.organizationId) return true;

  const existing = await ctx.db
    .query("eventOrgs")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .filter((q) => q.eq(q.field("orgId"), event.organizationId!))
    .unique();

  if (existing === null) {
    await ctx.db.insert("eventOrgs", {
      eventId,
      orgId: event.organizationId,
      eventCreationTime: event._creationTime,
    });
  }
  return true;
}

/**
 * Move a message back to `processingStatus: "new"` so the next parse run
 * picks it up again. Without this, recovering a `failed` or `ignored`
 * message meant opening the Convex dashboard by hand.
 */
export const requeueMessage = mutation({
  args: { token: v.string(), messageId: v.id("listservMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found.");
    if (message.processingStatus === "new") return null;

    await ctx.db.patch(args.messageId, {
      processingStatus: "new",
      parseError: undefined,
      // An admin asked for this one, so the stale-email sweep must leave it.
      staleKeptAt: Date.now(),
    });
    return null;
  },
});

export const hideEvent = mutation({
  args: { token: v.string(), eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.eventId, {
      visibility: "hidden",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Hides every draft whose dates are all in the past, across the whole draft
 * backlog rather than only the page the admin has loaded. Drafts only, so
 * nothing already published is touched.
 *
 * Walks the draft index one page of {@link HIDE_PAST_BATCH} rows per call and
 * hands back the cursor, so a page with nothing to hide still advances the
 * sweep instead of re-reading the same rows forever.
 */
async function hidePassedDraftsPage(
  ctx: MutationCtx,
  cursor: string | null,
): Promise<{ hidden: number; continueCursor: string; isDone: boolean }> {
  const now = Date.now();
  const page = await ctx.db
    .query("events")
    .withIndex("by_visibility", (q) => q.eq("visibility", "draft"))
    .paginate({ numItems: HIDE_PAST_BATCH, cursor });

  // "uncertain" drafts are deliberately left for a human to decide.
  const passed = page.page.filter(
    (draft) =>
      classifyDraftStaleness(draft, draft.sourceReceivedAt, now) === "passed",
  );
  for (const draft of passed) {
    await ctx.db.patch(draft._id, {
      visibility: "hidden",
      autoHiddenAt: now,
      updatedAt: now,
    });
  }

  return {
    hidden: passed.length,
    continueCursor: page.continueCursor,
    isDone: page.isDone,
  };
}

/**
 * Manual button for the sweep. Hides the first page now and finishes the rest
 * of the backlog in the background; `continuing` says whether it is.
 */
export const hidePastDrafts = mutation({
  args: { token: v.string() },
  returns: v.object({ hidden: v.number(), continuing: v.boolean() }),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const result = await hidePassedDraftsPage(ctx, null);
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.parser.autoHidePastDrafts, {
        cursor: result.continueCursor,
      });
    }
    return { hidden: result.hidden, continuing: !result.isDone };
  },
});

/**
 * Cron entry point: the same sweep as {@link hidePastDrafts}, with no admin
 * token. Schedules itself with the next cursor until the whole draft index has
 * been walked.
 */
export const autoHidePastDrafts = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await hidePassedDraftsPage(ctx, args.cursor ?? null);
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.parser.autoHidePastDrafts, {
        cursor: result.continueCursor,
      });
    }
    return null;
  },
});

/**
 * Drafts the sweep hid, most recently hidden first, so an admin can check
 * nothing relevant was lost. Restoring clears `autoHiddenAt`, which drops the
 * row out of this index.
 */
export const listAutoHiddenDrafts = query({
  args: { token: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(eventDocValidator),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    return await ctx.db
      .query("events")
      .withIndex("by_auto_hidden", (q) => q.gt("autoHiddenAt", 0))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * Puts an auto-hidden draft back in the review queue. `keptActiveAt` stops the
 * next sweep from hiding it again.
 */
export const restoreAutoHiddenDraft = mutation({
  args: { token: v.string(), eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const event = await ctx.db.get(args.eventId);
    if (
      !event ||
      event.visibility !== "hidden" ||
      event.autoHiddenAt === undefined
    ) {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch(args.eventId, {
      visibility: "draft",
      autoHiddenAt: undefined,
      keptActiveAt: now,
      updatedAt: now,
    });
    return null;
  },
});

/**
 * Messages read per stale-message sweep page. Kept small because each row
 * carries the full email body.
 */
const STALE_MESSAGE_BATCH = 100;

/**
 * Takes emails older than {@link STALE_EMAIL_DAYS} out of the ready-to-parse
 * queue by marking them `stale`, so the parser stops spending model calls on
 * them. They stay visible under "stale" and can be requeued; a requeued one
 * (`staleKeptAt`) is skipped.
 *
 * Walks the `new` queue a page at a time and hands back the cursor, so a page
 * of skipped or fresh emails still advances the sweep.
 */
async function moveStaleMessagesPage(
  ctx: MutationCtx,
  cursor: string | null,
): Promise<{ moved: number; continueCursor: string; isDone: boolean }> {
  const cutoff = Date.now() - STALE_EMAIL_DAYS * 86_400_000;
  const page = await ctx.db
    .query("listservMessages")
    .withIndex("by_processing_status", (q) => q.eq("processingStatus", "new"))
    .paginate({ numItems: STALE_MESSAGE_BATCH, cursor });
  const stale = page.page.filter(
    (message) =>
      message.receivedAt < cutoff && message.staleKeptAt === undefined,
  );

  for (const message of stale) {
    await ctx.db.patch(message._id, {
      processingStatus: "stale",
      parseError: `Email is older than ${STALE_EMAIL_DAYS} days. Requeue to parse it anyway.`,
    });
  }

  return {
    moved: stale.length,
    continueCursor: page.continueCursor,
    isDone: page.isDone,
  };
}

/** Cron entry point; schedules itself with the next cursor until done. */
export const sweepStaleReadyMessages = internalMutation({
  args: { cursor: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await moveStaleMessagesPage(ctx, args.cursor ?? null);
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.parser.sweepStaleReadyMessages, {
        cursor: result.continueCursor,
      });
    }
    return null;
  },
});

/**
 * Manual button for the same sweep. Moves the first page now and finishes the
 * rest in the background; `continuing` says whether it is.
 */
export const moveStaleMessagesNow = mutation({
  args: { token: v.string() },
  returns: v.object({ moved: v.number(), continuing: v.boolean() }),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const result = await moveStaleMessagesPage(ctx, null);
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.parser.sweepStaleReadyMessages, {
        cursor: result.continueCursor,
      });
    }
    return { moved: result.moved, continuing: !result.isDone };
  },
});

/** True if `value` is a well-formed http(s) URL. */
function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const updateDraftEvent = mutation({
  args: {
    token: v.string(),
    eventId: v.id("events"),
    title: v.string(),
    description: v.string(),
    aiDescription: v.string(),
    eventType: v.union(
      v.literal("event"),
      v.literal("opportunity"),
      v.literal("hackathon"),
      v.literal("courses"),
      v.literal("fundraiser"),
      v.literal("info"),
    ),
    dates: v.array(
      v.object({
        timestamp: v.number(),
        type: v.union(
          v.literal("start"),
          v.literal("end"),
          v.literal("deadline"),
          v.literal("single"),
        ),
      }),
    ),
    location: v.optional(
      v.object({
        displayText: v.string(),
        address: v.optional(v.string()),
        isVirtual: v.boolean(),
        buildingCode: v.optional(v.string()),
      }),
    ),
    links: v.array(
      v.object({
        url: v.string(),
        type: v.union(
          v.literal("registration"),
          v.literal("application"),
          v.literal("rsvp"),
          v.literal("info"),
          v.literal("social"),
        ),
        label: v.optional(v.string()),
      }),
    ),
    tags: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found.");
    if (event.visibility !== "draft") {
      throw new Error("Only draft events can be edited.");
    }

    // Drop blank rows (e.g. an "Add link" row left empty) and reject anything
    // left over that isn't a well-formed http(s) URL — never trust the client
    // for this even though the admin UI validates the same thing.
    const links = args.links
      .map((link) => ({
        url: link.url.trim(),
        type: link.type,
        label: link.label?.trim() || undefined,
      }))
      .filter((link) => link.url.length > 0);
    const invalidLink = links.find((link) => !isValidHttpUrl(link.url));
    if (invalidLink) {
      throw new Error(
        `"${invalidLink.url}" is not a valid http(s) URL. Fix or remove it before saving.`,
      );
    }

    await ctx.db.patch(args.eventId, {
      title: args.title.trim(),
      description: args.description.trim(),
      aiDescription: args.aiDescription.trim(),
      eventType: args.eventType,
      dates: args.dates,
      location: args.location,
      links,
      tags: normalizeTags(args.tags),
      updatedAt: Date.now(),
    });
    return null;
  },
});

const PARSE_MESSAGE_PROJECTION_VALIDATOR = v.object({
  _id: v.id("listservMessages"),
  _creationTime: v.number(),
  subject: v.string(),
  senderEmail: v.string(),
  processingStatus: v.union(
    v.literal("new"),
    v.literal("parsed"),
    v.literal("ignored"),
    v.literal("stale"),
    v.literal("failed"),
  ),
  parseError: v.optional(v.string()),
  organizationId: v.optional(v.id("orgs")),
  listservId: v.optional(v.id("listservs")),
  receivedAt: v.number(),
});

export const overview = query({
  args: { token: v.string() },
  returns: v.object({
    runs: v.array(parseRunDocValidator),
    failedMessages: v.array(PARSE_MESSAGE_PROJECTION_VALIDATOR),
    ignoredMessages: v.array(PARSE_MESSAGE_PROJECTION_VALIDATOR),
    staleMessages: v.array(PARSE_MESSAGE_PROJECTION_VALIDATOR),
    needsAssignmentCount: v.number(),
    readyCount: v.number(),
    readyScanTruncated: v.boolean(),
    draftCount: v.number(),
    pastDraftCount: v.number(),
    uncertainDraftCount: v.number(),
    draftScanTruncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const [
      runs,
      drafts,
      failedMessages,
      ignoredMessages,
      staleMessages,
      newMessages,
    ] = await Promise.all([
      ctx.db
        .query("parseRuns")
        .withIndex("by_started_at")
        .order("desc")
        .take(20),
      // Counted only — the list an admin reviews is `listDrafts`, which
      // paginates, so the header can say how big the backlog is while the
      // page loads it a screenful at a time.
      ctx.db
        .query("events")
        .withIndex("by_visibility", (q) => q.eq("visibility", "draft"))
        .take(DRAFT_COUNT_SCAN_LIMIT),
      ctx.db
        .query("listservMessages")
        .withIndex("by_processing_status", (q) =>
          q.eq("processingStatus", "failed"),
        )
        .order("desc")
        .take(25),
      // No mutation used to move a message off `ignored` until `requeueMessage`
      // — surfaced here so there's somewhere in the UI to click it.
      ctx.db
        .query("listservMessages")
        .withIndex("by_processing_status", (q) =>
          q.eq("processingStatus", "ignored"),
        )
        .order("desc")
        .take(25),
      // Emails swept out of the ready queue for being too old.
      ctx.db
        .query("listservMessages")
        .withIndex("by_processing_status", (q) =>
          q.eq("processingStatus", "stale"),
        )
        .order("desc")
        .take(25),
      // Bounded window behind both of the header's "new" message counts: how
      // many are blocked on sender assignment, and how many are ready to
      // parse. The ready *queue* is still paginated by `listReadyMessages`,
      // because listing it is a different job from counting it.
      ctx.db
        .query("listservMessages")
        .withIndex("by_processing_status", (q) =>
          q.eq("processingStatus", "new"),
        )
        .order("desc")
        .take(NEEDS_ASSIGNMENT_SCAN_LIMIT),
    ]);

    const needsAssignment = newMessages.filter(
      (m) => m.organizationId === undefined,
    );
    // Counted here rather than from the first page of `listReadyMessages`,
    // which filters unassigned rows out *after* paginating: when the newest 25
    // "new" messages are all unassigned — the normal state while the Sources
    // backlog is large — that page comes back empty and the admin page
    // concluded there was nothing to parse, disabling the only control that
    // runs the parser.
    const readyCount = newMessages.length - needsAssignment.length;

    // Project only what the admin UI needs — no email body content sent to client.
    const projectMessage = (m: (typeof failedMessages)[number]) => ({
      _id: m._id,
      _creationTime: m._creationTime,
      subject: m.subject,
      senderEmail: m.senderEmail,
      processingStatus: m.processingStatus,
      parseError: m.parseError,
      organizationId: m.organizationId,
      listservId: m.listservId,
      receivedAt: m.receivedAt,
    });

    // Convex does not re-run a query as the clock moves, so a draft that ages
    // past its last date is counted as past on the next change to `events`
    // or the next page load — soon enough for a backlog count.
    const now = Date.now();
    const staleness = drafts.map((draft) =>
      classifyDraftStaleness(draft, draft.sourceReceivedAt, now),
    );
    const pastDraftCount = staleness.filter((s) => s === "passed").length;
    const uncertainDraftCount = staleness.filter(
      (s) => s === "uncertain",
    ).length;

    return {
      runs,
      failedMessages: failedMessages.map(projectMessage),
      ignoredMessages: ignoredMessages.map(projectMessage),
      staleMessages: staleMessages.map(projectMessage),
      needsAssignmentCount: needsAssignment.length,
      readyCount,
      // Both counts above describe the newest `NEEDS_ASSIGNMENT_SCAN_LIMIT`
      // messages only, so the UI can show them as "at least this many".
      readyScanTruncated: newMessages.length === NEEDS_ASSIGNMENT_SCAN_LIMIT,
      draftCount: drafts.length,
      pastDraftCount,
      uncertainDraftCount,
      draftScanTruncated: drafts.length === DRAFT_COUNT_SCAN_LIMIT,
    };
  },
});

/**
 * The drafts awaiting review, newest first. Paginated so a backlog past one
 * screenful is reachable through "Load more" rather than silently cut off,
 * which is what the previous fixed `take(50)` did.
 */
export const listDrafts = query({
  args: { token: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(eventDocValidator),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    return await ctx.db
      .query("events")
      .withIndex("by_visibility", (q) => q.eq("visibility", "draft"))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/**
 * The actual ready-to-parse queue: `processingStatus: "new"` messages that
 * already have an organization assigned. Paginated rather than capped, so a
 * real backlog is both visible and inspectable rather than showing a number
 * that quietly stopped counting past 200.
 *
 * `by_processing_status` has no compound index on `organizationId`, so the
 * organization filter runs per page in TypeScript. Convex pagination
 * tolerates this — a filtered page can come back shorter than requested —
 * which is an acceptable trade at this table's size.
 */
export const listReadyMessages = query({
  args: { token: v.string(), paginationOpts: paginationOptsValidator },
  // `paginate()` returns `splitCursor`/`pageStatus` alongside `page`,
  // `isDone`, and `continueCursor` — a hand-rolled v.object() that omits
  // them fails ReturnsValidationError on every call. Convex ships this
  // factory precisely so the validator stays in sync with what
  // `.paginate()` actually returns.
  returns: paginationResultValidator(PARSE_MESSAGE_PROJECTION_VALIDATOR),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const result = await ctx.db
      .query("listservMessages")
      .withIndex("by_processing_status", (q) => q.eq("processingStatus", "new"))
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      isDone: result.isDone,
      continueCursor: result.continueCursor,
      page: result.page
        .filter((m) => m.organizationId !== undefined)
        .map((m) => ({
          _id: m._id,
          _creationTime: m._creationTime,
          subject: m.subject,
          senderEmail: m.senderEmail,
          processingStatus: m.processingStatus,
          parseError: m.parseError,
          organizationId: m.organizationId,
          listservId: m.listservId,
          receivedAt: m.receivedAt,
        })),
    };
  },
});

export const getMessagesForParsing = internalQuery({
  args: { messageId: v.optional(v.id("listservMessages")), limit: v.number() },
  handler: async (ctx, args) => {
    const singleMessage = args.messageId
      ? await ctx.db.get(args.messageId)
      : null;

    // For a single-message parse, try even without organizationId
    if (args.messageId) {
      if (!singleMessage || !singleMessage.organizationId) return [];
      const [listserv, organization] = await Promise.all([
        singleMessage.listservId ? ctx.db.get(singleMessage.listservId) : null,
        ctx.db.get(singleMessage.organizationId),
      ]);
      return [{ ...singleMessage, listserv, organization }];
    }

    // Scan a larger window so unassigned messages don't block assigned ones
    const candidates = await ctx.db
      .query("listservMessages")
      .withIndex("by_processing_status", (q) => q.eq("processingStatus", "new"))
      .order("desc")
      .take(args.limit * 10);

    const enriched: SourceMessage[] = [];
    for (const message of candidates) {
      if (!message.organizationId) continue;
      if (enriched.length >= args.limit) break;
      const [listserv, organization] = await Promise.all([
        message.listservId ? ctx.db.get(message.listservId) : null,
        ctx.db.get(message.organizationId),
      ]);
      enriched.push({ ...message, listserv, organization });
    }
    return enriched;
  },
});

export const startParseRun = internalMutation({
  args: {
    trigger: v.union(
      v.literal("manual"),
      v.literal("cron"),
      v.literal("single_message"),
    ),
    provider: v.optional(v.union(v.literal("openai"), v.literal("gemini"))),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("parseRuns", {
      trigger: args.trigger,
      status: "running",
      startedAt: Date.now(),
      provider: args.provider,
      model: args.model,
      messagesScanned: 0,
      messagesParsed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      messagesIgnored: 0,
    });
  },
});

export const finishParseRun = internalMutation({
  args: {
    runId: v.id("parseRuns"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    messagesScanned: v.number(),
    messagesParsed: v.number(),
    eventsCreated: v.number(),
    eventsSkippedDuplicate: v.number(),
    messagesIgnored: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: args.status,
      finishedAt: Date.now(),
      messagesScanned: args.messagesScanned,
      messagesParsed: args.messagesParsed,
      eventsCreated: args.eventsCreated,
      // Always 0 going forward — a dedupe hit is now reported as a skip
      // (eventsSkippedDuplicate), not an "update", since nothing is written.
      eventsUpdated: 0,
      eventsSkippedDuplicate: args.eventsSkippedDuplicate,
      messagesIgnored: args.messagesIgnored,
      error: args.error,
    });
  },
});

export const markMessageIgnored = internalMutation({
  args: { messageId: v.id("listservMessages"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      processingStatus: "ignored",
      parseError: args.reason,
    });
  },
});

export const markMessageFailed = internalMutation({
  args: { messageId: v.id("listservMessages"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      processingStatus: "failed",
      parseError: args.error,
    });
  },
});

export const storeParsedEvents = internalMutation({
  args: {
    messageId: v.id("listservMessages"),
    items: v.array(parsedItemValidator),
  },
  returns: v.object({ created: v.number(), skippedDuplicate: v.number() }),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found.");
    const listserv = message.listservId
      ? await ctx.db.get(message.listservId)
      : null;
    const organization = message.organizationId
      ? await ctx.db.get(message.organizationId)
      : null;
    if (!organization) throw new Error("Message has no organization.");

    // Reparsing an already-parsed message would otherwise insert a second
    // copy of every item and leave the first behind. Clear this message's
    // own prior drafts before storing the fresh parse — never `published` or
    // manually `hidden` ones, since those are decisions an admin already
    // made. Rows the passed-draft sweep hid are not a decision, so they are
    // cleared too; otherwise their dedupe key silently blocks the corrected
    // item.
    const priorDrafts = await ctx.db
      .query("events")
      .withIndex("by_source_message", (q) =>
        q.eq("sourceMessageId", args.messageId),
      )
      .collect();
    // A restore override belongs to the item, not the row: a reparse that
    // reproduces the same item (same dedupe key) keeps it.
    const keptActiveByKey = new Map<string, number>();
    for (const draft of priorDrafts) {
      const autoHidden =
        draft.visibility === "hidden" && draft.autoHiddenAt !== undefined;
      if (draft.visibility !== "draft" && !autoHidden) continue;
      if (draft.dedupeKey && draft.keptActiveAt !== undefined) {
        keptActiveByKey.set(draft.dedupeKey, draft.keptActiveAt);
      }
      await ctx.db.delete(draft._id);
    }

    const now = Date.now();
    let created = 0;
    let skippedDuplicate = 0;

    for (const item of args.items) {
      // Scoped to the organization: two orgs can legitimately announce the
      // same career fair, and without organizationId in the key the second
      // one collided with the first and was dropped.
      const dedupeKey = buildDedupeKey(item, message.organizationId);
      const existing = dedupeKey
        ? await ctx.db
            .query("events")
            .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
            .first()
        : null;
      if (existing) {
        skippedDuplicate += 1;
        continue;
      }

      await ctx.db.insert("events", {
        sourceMessageId: args.messageId,
        listservId: message.listservId,
        organizationId: message.organizationId,
        listserv: organization.name,
        listservSection: listserv?.sourceType ?? "unknown",
        title: item.title,
        description: item.description,
        aiDescription: item.aiDescription,
        eventType: item.eventType,
        hosts: item.hosts,
        dates: item.dates,
        statedYears: item.statedYears,
        isRecurring: item.isRecurring,
        recurrenceNote: item.recurrenceNote,
        location: item.location,
        links: item.links,
        contacts: item.contacts,
        tags: item.tags,
        targetAudience: item.targetAudience,
        perks: item.perks,
        visibility: "draft",
        sourceReceivedAt: message.receivedAt,
        keptActiveAt: dedupeKey ? keptActiveByKey.get(dedupeKey) : undefined,
        // Per item: `args.confidence` / `args.warnings` describe the message
        // as a whole and are already folded into each item's own values.
        parseConfidence: item.confidence,
        parseWarnings: item.warnings,
        dedupeKey,
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
    }

    await ctx.db.patch(args.messageId, {
      processingStatus: "parsed",
      parseError: undefined,
    });
    return { created, skippedDuplicate };
  },
});

/**
 * One-off backfill of `sourceReceivedAt` on drafts stored before the field
 * existed, copied from the source message (or the legacy email row). Without
 * it the stale-draft check has no email date and leaves the draft current.
 *
 * Run `npx convex run parser:backfillDraftSourceReceivedAt` once. Each call
 * handles one page and schedules the next itself, because every message read
 * carries its full email body and one pass over the backlog exceeds the
 * per-function read limit. Progress shows in the Convex logs.
 */
export const backfillDraftSourceReceivedAt = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    updated: v.optional(v.number()),
    skippedNoSource: v.optional(v.number()),
  },
  returns: v.object({
    updated: v.number(),
    skippedNoSource: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    let updated = args.updated ?? 0;
    let skippedNoSource = args.skippedNoSource ?? 0;

    const page = await ctx.db
      .query("events")
      .withIndex("by_visibility", (q) => q.eq("visibility", "draft"))
      .paginate({ numItems: BACKFILL_PAGE_SIZE, cursor: args.cursor ?? null });

    // Several drafts usually share one email; read each body once.
    const receivedAtByMessage = new Map<Id<"listservMessages">, number>();
    for (const draft of page.page) {
      if (draft.sourceReceivedAt !== undefined) continue;

      let receivedAt: number | undefined;
      if (draft.sourceMessageId) {
        receivedAt = receivedAtByMessage.get(draft.sourceMessageId);
        if (receivedAt === undefined) {
          receivedAt = (await ctx.db.get(draft.sourceMessageId))?.receivedAt;
          if (receivedAt !== undefined) {
            receivedAtByMessage.set(draft.sourceMessageId, receivedAt);
          }
        }
      }
      if (receivedAt === undefined && draft.listservEmailId) {
        receivedAt = (await ctx.db.get(draft.listservEmailId))?.sentAt;
      }
      if (receivedAt === undefined) {
        skippedNoSource += 1;
        continue;
      }

      await ctx.db.patch(draft._id, { sourceReceivedAt: receivedAt });
      updated += 1;
    }

    if (page.isDone) {
      console.log(
        `backfillDraftSourceReceivedAt done: ${updated} updated, ${skippedNoSource} without a source`,
      );
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.parser.backfillDraftSourceReceivedAt,
        { cursor: page.continueCursor, updated, skippedNoSource },
      );
    }
    return { updated, skippedNoSource, isDone: page.isDone };
  },
});

/**
 * Drafts per backfill page. Small because each one can cost a full email body
 * read (well under the 16 MB per-function limit even at ~500 KB per email).
 */
const BACKFILL_PAGE_SIZE = 25;

/**
 * One-off repair for drafts parsed before the year moved server-side: every
 * date whose year predates the year its source email arrived in is shifted
 * onto the year {@link resolveYear} would pick today, keeping the same
 * wall-clock month/day/time. Drafts only — `published` and `hidden` are
 * decisions an admin already made.
 *
 * Run `npx convex run parser:fixDraftEventYears '{"dryRun": true}'` first and
 * read `samples`; re-run without `dryRun` to write. Anything this can't fix
 * (a wrong day, not just a wrong year) is better handled by requeueing the
 * source message with `requeueMessage` and reparsing it.
 */
export const fixDraftEventYears = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    scanned: v.number(),
    changed: v.number(),
    skippedNoSource: v.number(),
    samples: v.array(
      v.object({
        title: v.string(),
        before: v.array(v.string()),
        after: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const samples: Array<{ title: string; before: string[]; after: string[] }> =
      [];
    let scanned = 0;
    let changed = 0;
    let skippedNoSource = 0;

    const drafts = ctx.db
      .query("events")
      .withIndex("by_visibility", (q) => q.eq("visibility", "draft"));

    for await (const draft of drafts) {
      scanned += 1;
      if (draft.dates.length === 0) continue;

      const message = draft.sourceMessageId
        ? await ctx.db.get(draft.sourceMessageId)
        : null;
      if (!message) {
        skippedNoSource += 1;
        continue;
      }

      const receivedYear = epochMsToLocalParts(message.receivedAt).year;
      const dates = draft.dates.map((date) => {
        const parts = epochMsToLocalParts(date.timestamp);
        if (parts.year >= receivedYear) return date;
        const year = resolveYear(
          { statedYear: null, month: parts.month, day: parts.day },
          message.receivedAt,
        );
        return {
          timestamp: localPartsToEpochMs({ ...parts, year }),
          type: date.type,
        };
      });

      if (dates.every((date, i) => date.timestamp === draft.dates[i].timestamp))
        continue;

      changed += 1;
      if (samples.length < 20) {
        samples.push({
          title: draft.title,
          before: draft.dates.map((date) => formatSampleDate(date.timestamp)),
          after: dates.map((date) => formatSampleDate(date.timestamp)),
        });
      }
      if (args.dryRun) continue;

      // Recomputed because the key embeds the first date, so leaving the old
      // one in place would let a reparse of the same email insert a second
      // copy rather than dedupe against this draft.
      await ctx.db.patch(draft._id, {
        dates,
        dedupeKey: buildDedupeKey(
          { title: draft.title, dates, links: draft.links },
          draft.organizationId,
        ),
        updatedAt: Date.now(),
      });
    }

    return { scanned, changed, skippedNoSource, samples };
  },
});

/**
 * One-off rescore for drafts stored before confidence became a measure of the
 * extraction rather than the model's self-report. Reads the same fields
 * `scoreParseQuality` reads at parse time, so a rescored draft and a freshly
 * parsed one are directly comparable. Drafts only.
 *
 * Run `npx convex run parser:rescoreDraftConfidence '{"dryRun": true}'` first
 * and read `samples`; re-run without `dryRun` to write.
 */
export const rescoreDraftConfidence = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    scanned: v.number(),
    changed: v.number(),
    samples: v.array(
      v.object({
        title: v.string(),
        before: v.number(),
        after: v.number(),
        reasons: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const samples: Array<{
      title: string;
      before: number;
      after: number;
      reasons: string[];
    }> = [];
    let scanned = 0;
    let changed = 0;

    const drafts = ctx.db
      .query("events")
      .withIndex("by_visibility", (q) => q.eq("visibility", "draft"));

    for await (const draft of drafts) {
      scanned += 1;
      const before = draft.parseConfidence ?? 0;
      // `droppedDate` is unknowable after the fact — whatever was dropped is
      // gone — so it is left false here. Those items already carry the
      // parser's own warning about it.
      const quality = scoreParseQuality(
        draft,
        normalizeModelConfidence(before),
      );
      if (quality.confidence === before) continue;

      changed += 1;
      if (samples.length < 20) {
        samples.push({
          title: draft.title,
          before,
          after: quality.confidence,
          reasons: quality.reasons,
        });
      }
      if (args.dryRun) continue;

      await ctx.db.patch(draft._id, {
        parseConfidence: quality.confidence,
        updatedAt: Date.now(),
      });
    }

    return { scanned, changed, samples };
  },
});

/**
 * One-off repair for drafts whose `hour`/`minute` (and, in principle,
 * `month`/`day`) came from the model computing its own epoch timestamp —
 * the pre-fix pipeline this file used to run. {@link fixDraftEventYears}
 * only ever corrects the year and keeps the rest of the stored timestamp,
 * so a draft whose time was wrong for some other reason than the year stays
 * wrong after it. The only trustworthy fix for that is re-deriving the whole
 * date from the source email under the current prompt and
 * {@link normalizeDates}, which means a full reparse rather than a patch.
 *
 * This only requeues the *message* (`processingStatus: "new"`, mirroring
 * `requeueMessage`) — it does not touch the draft. `storeParsedEvents`
 * already deletes a message's prior `draft`-visibility events before
 * inserting the fresh parse, so nothing here needs to delete anything, and a
 * draft an admin already published or hid is left alone because its message
 * is never requeued.
 *
 * Requeuing alone does not reparse anything: after this runs, trigger a
 * parse run (the admin page's "Run parser" button, or
 * `npx convex run parser:runParseInternal '{"trigger": "manual"}'`) to
 * actually regenerate the drafts.
 *
 * A draft already entirely in the past is excluded rather than requeued: its
 * event already happened, so a corrected hour is not worth an AI call. Only
 * every date on a draft being past excludes it — one still-future date among
 * several (a multi-date item, or another item from the same email) keeps the
 * whole message in, since reparsing it is one call that fixes every item it
 * contains anyway.
 *
 * Run `npx convex run parser:requeueDraftMessagesForReparse '{"dryRun": true}'`
 * first and read `samples`; re-run without `dryRun` to requeue for real.
 */
export const requeueDraftMessagesForReparse = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    draftsAffected: v.number(),
    skippedPast: v.number(),
    messagesRequeued: v.number(),
    skippedNoSource: v.number(),
    samples: v.array(
      v.object({
        messageId: v.id("listservMessages"),
        subject: v.string(),
        draftTitles: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const samples: Array<{
      messageId: Id<"listservMessages">;
      subject: string;
      draftTitles: string[];
    }> = [];
    let draftsAffected = 0;
    let skippedPast = 0;
    let skippedNoSource = 0;

    const now = Date.now();
    const drafts = ctx.db
      .query("events")
      .withIndex("by_visibility", (q) => q.eq("visibility", "draft"));

    const messageTitles = new Map<Id<"listservMessages">, string[]>();
    for await (const draft of drafts) {
      draftsAffected += 1;

      if (isPastEvent(draft.dates, now)) {
        skippedPast += 1;
        continue;
      }

      if (!draft.sourceMessageId) {
        skippedNoSource += 1;
        continue;
      }
      const titles = messageTitles.get(draft.sourceMessageId) ?? [];
      titles.push(draft.title);
      messageTitles.set(draft.sourceMessageId, titles);
    }

    let messagesRequeued = 0;
    for (const [messageId, draftTitles] of messageTitles) {
      const message = await ctx.db.get(messageId);
      if (!message) {
        skippedNoSource += draftTitles.length;
        continue;
      }

      if (samples.length < 20) {
        samples.push({ messageId, subject: message.subject, draftTitles });
      }
      if (args.dryRun) continue;

      messagesRequeued += 1;
      await ctx.db.patch(messageId, {
        processingStatus: "new",
        parseError: undefined,
      });
    }

    return {
      draftsAffected,
      skippedPast,
      messagesRequeued,
      skippedNoSource,
      samples,
    };
  },
});

/** Human-readable Cornell-local date for the backfill's dry-run output. */
function formatSampleDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: SOURCE_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

async function parseMessageWithAI(
  message: SourceMessage,
  config: AIConfig,
): Promise<unknown> {
  const prompt = buildParsePrompt(message);
  try {
    return await callAIProvider(prompt, config.provider, config.model);
  } catch (error) {
    if (!config.fallback) throw error;
    try {
      return await callAIProvider(
        prompt,
        config.fallback.provider,
        config.fallback.model,
      );
    } catch (fallbackError) {
      throw new Error(
        `Primary ${config.provider}/${config.model} failed: ${formatError(error)}. Fallback ${config.fallback.provider}/${config.fallback.model} failed: ${formatError(fallbackError)}`,
      );
    }
  }
}

async function callAIProvider(
  prompt: string,
  provider: AIProvider,
  model: string,
): Promise<unknown> {
  if (provider === "openai") return parseWithOpenAI(prompt, model);
  return parseWithGemini(prompt, model);
}

async function parseWithOpenAI(
  prompt: string,
  model: string,
): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You extract structured JSON from Cornell listserv emails. Return JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "OpenAI parse request failed.");

  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned no content.");
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

async function parseWithGemini(
  prompt: string,
  model: string,
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "Gemini parse request failed.");

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text.");
  const parsed: unknown = JSON.parse(text);
  return parsed;
}

function getAIConfig(): AIConfig {
  const openai = getOpenAIConfig();
  const gemini = getGeminiConfig();

  if (openai && gemini) return { ...openai, fallback: gemini };
  if (openai) return openai;
  if (gemini) return gemini;

  throw new Error(
    "No AI parser provider is configured. Set OPENAI_API_KEY for OpenAI or GEMINI_API_KEY for Gemini.",
  );
}

function getOpenAIConfig(): AIConfig | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return {
    provider: "openai",
    model: process.env.OPENAI_PARSE_MODEL ?? DEFAULT_OPENAI_PARSE_MODEL,
  };
}

function getGeminiConfig(): AIConfig | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return {
    provider: "gemini",
    model: process.env.GEMINI_PARSE_MODEL ?? DEFAULT_GEMINI_PARSE_MODEL,
  };
}

function buildParsePrompt(message: SourceMessage) {
  const receivedAtIso = new Date(message.receivedAt).toISOString();
  const input = {
    sourceOrganization: message.organization?.name,
    sourceOrganizationType: message.organization?.orgType,
    sourceEmail: message.senderEmail,
    sourceName: message.listserv?.name,
    subject: message.subject,
    receivedAt: receivedAtIso,
    bodyText: message.bodyText.slice(0, 12000),
    links: extractLinks(`${message.bodyText}\n${message.bodyHtml}`).slice(
      0,
      40,
    ),
  };

  // The model reports the date parts it read and nothing more: asking
  // gpt-4o-mini for epoch milliseconds produced numbers from its own training
  // era instead of the year this email arrived in. Verified against prod: ~35
  // of 36 sampled drafts had every date land in 2023 despite every source
  // message arriving in 2025/2026, and telling the model to anchor on the
  // received date did not fix it, because the arithmetic step is where the
  // stale year crept back in. `normalizeDates` resolves the year and the
  // timestamp server-side instead.
  return `Extract Cornell student-relevant feed items from this listserv email. Return strict JSON only. Do not invent details. The source organization advertised the item but may not be the host.

This email was received on ${receivedAtIso} (Cornell/Ithaca local time is ${SOURCE_TIMEZONE}). Report dates exactly as the email writes them — do not compute timestamps, offsets, or epoch values, and do not convert timezones. Set "year" only when the email itself states a year; otherwise set it to null. If the email gives only a year or year range for an item (e.g. "2027–2028 program"), add one date per stated year with "month" and "day" set to null. Set "hour"/"minute" only when the email states a time; otherwise null. Times are assumed to be ${SOURCE_TIMEZONE}.

Return this exact shape:
{
  "messageType": "events" | "opportunities" | "newsletter" | "admin" | "irrelevant",
  "shouldPublish": false,
  "summary": string,
  "confidence": number,  // whole number 0-100, not a fraction
  "warnings": string[],
  "items": [{
    "title": string,
    "description": string,
    "aiDescription": string,
    "eventType": "event" | "opportunity" | "hackathon" | "courses" | "fundraiser" | "info",
    "hosts": [{"name": string, "kind": "club" | "company" | "external_org", "role": "primary" | "cohost" | "sponsor"}],
    "dates": [{"year": number | null, "month": number | null, "day": number | null, "hour": number | null, "minute": number | null, "type": "start" | "end" | "deadline" | "single"}],
    "isRecurring": boolean,
    "recurrenceNote": string | null,
    "location": {"displayText": string, "address": string | null, "isVirtual": boolean, "buildingCode": string | null} | null,
    "links": [{"url": string, "type": "registration" | "application" | "rsvp" | "info" | "social", "label": string | null}],
    "contacts": [{"type": "email" | "instagram" | "website", "value": string}],
    "tags": string[],
    "targetAudience": "all" | "first_year" | "women_nonbinary" | "international" | "graduate" | null,
    "perks": ("food" | "swag" | "prizes" | "travel_covered" | "paid")[]
  }]
}

Tags: choose 0-3 tags for each item, copied exactly from this list and no others: ${CANONICAL_TAGS.join(", ")}.

Confidence: an integer from 0 to 100 (a whole-number percentage, so 85 means 85% — never 0.85), for how well this email supports the items you extracted.

Rules: ignore unsubscribe text, confirmations, and admin/list-manager mail. In "dates", "month" is 1-12, "day" is 1-31, "hour" is 0-23 on a 24-hour clock, and "minute" is 0-59. If no useful item exists, return items: [] and messageType "irrelevant" or "admin". Drafts are reviewed by admins, so shouldPublish must always be false.

Email input:
${JSON.stringify(input, null, 2)}`;
}

function normalizeParseResult(
  result: unknown,
  receivedAt: number,
): ParseResult {
  const raw = isRecord(result) ? result : {};
  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map(String).slice(0, 20)
    : [];
  // Rescaled rather than clamped: the prompt used to leave the scale unstated
  // and the model answered 0-1, which `clampNumber(…, 0, 100)` passed through
  // untouched and the admin badge then rendered as "0.9%".
  const modelConfidence = normalizeModelConfidence(Number(raw.confidence));
  const items = Array.isArray(raw.items)
    ? raw.items.flatMap((item) =>
        normalizeItem(item, warnings, receivedAt, modelConfidence),
      )
    : [];
  return {
    messageType: normalizeMessageType(raw.messageType),
    shouldPublish: false,
    summary: String(raw.summary ?? "").slice(0, 500),
    confidence: modelConfidence,
    warnings,
    items,
  };
}

function normalizeItem(
  item: unknown,
  messageWarnings: string[],
  receivedAt: number,
  modelConfidence: number,
): ParsedItem[] {
  if (!isRecord(item)) return [];
  const title = String(item.title ?? "").trim();
  const description = String(item.description ?? "").trim();
  if (!title || !description) return [];

  // Collected per item, then merged with the message-level ones, so a warning
  // about this item's dates lands on this item rather than on every draft the
  // email produced.
  const itemWarnings: string[] = [];
  const statedYears: number[] = [];
  const isRecurring = Boolean(item.isRecurring);
  const dates = withDefaultEnd(
    normalizeDates(item.dates, receivedAt, title, itemWarnings, statedYears),
    isRecurring,
  );
  const droppedDate = itemWarnings.some((warning) =>
    warning.startsWith("Dropped impossible date"),
  );

  const scored: Omit<ParsedItem, "confidence" | "warnings"> = {
    title,
    description,
    aiDescription: String(item.aiDescription ?? description).slice(0, 220),
    eventType: normalizeEventType(item.eventType),
    hosts: normalizeHosts(item.hosts),
    dates,
    statedYears: statedYears.length > 0 ? statedYears : undefined,
    isRecurring,
    recurrenceNote: optionalString(item.recurrenceNote),
    location: normalizeLocation(item.location),
    links: normalizeLinks(item.links),
    contacts: normalizeContacts(item.contacts),
    tags: Array.isArray(item.tags) ? normalizeTags(item.tags.map(String)) : [],
    targetAudience: normalizeAudience(item.targetAudience),
    perks: normalizePerks(item.perks),
  };

  const quality = scoreParseQuality(scored, modelConfidence, { droppedDate });
  if (quality.reasons.length > 0) {
    itemWarnings.push(`Missing: ${quality.reasons.join(", ")}`);
  }

  return [
    {
      ...scored,
      confidence: quality.confidence,
      warnings: [...itemWarnings, ...messageWarnings].slice(0, 20),
    },
  ];
}

/**
 * Turn the date parts the model read off the email into stored timestamps.
 *
 * A date with no usable month/day is dropped rather than guessed at (its year,
 * if stated, is kept in `statedYears`), and so is
 * one whose parts don't name a real calendar day — `Date.UTC` would silently
 * roll "February 30" into March, which reads as a confident wrong answer in
 * the admin editor. A date with no stated time becomes local noon, far enough
 * from either midnight that no timezone rendering can shift it onto the
 * neighbouring day.
 */
function normalizeDates(
  value: unknown,
  receivedAt: number,
  title: string,
  warnings: string[],
  statedYears: number[],
): ParsedItem["dates"] {
  if (!Array.isArray(value)) return [];

  const dates: ParsedItem["dates"] = [];
  let missingTime = false;

  for (const raw of value.slice(0, 8)) {
    if (!isRecord(raw)) continue;
    const month = integerIn(raw.month, 1, 12);
    const day = integerIn(raw.day, 1, 31);
    if (month === null || day === null) {
      // Not a timestamp, but still evidence of when the item runs.
      const year = integerIn(raw.year, 1970, 2100);
      if (year !== null && !statedYears.includes(year)) statedYears.push(year);
      continue;
    }

    const hour = integerIn(raw.hour, 0, 23);
    if (hour === null) missingTime = true;

    const parts = {
      year: resolveYear(
        { statedYear: integerIn(raw.year, 1970, 2100), month, day },
        receivedAt,
      ),
      month,
      day,
      hour: hour ?? 12,
      minute: hour === null ? 0 : (integerIn(raw.minute, 0, 59) ?? 0),
    };

    const timestamp = localPartsToEpochMs(parts);
    const roundTrip = epochMsToLocalParts(timestamp);
    if (roundTrip.month !== month || roundTrip.day !== day) {
      warnings.push(`Dropped impossible date ${month}/${day} for ${title}`);
      continue;
    }

    dates.push({ timestamp, type: normalizeDateType(raw.type) });
  }

  if (missingTime) warnings.push(`No time given for ${title}`);
  return dates;
}

/**
 * Gives a timed `start` with no stated `end` the default duration, so the
 * assumed length is stored once at parse time rather than re-derived by every
 * reader. Only a `start` qualifies — see `effectiveEndTimestamp` for why a
 * `single`, a `deadline`, or an untimed start is left as it came.
 *
 * Recurring items are left alone: `classifyDraftStaleness` reads a missing
 * `end` as "the email never said when the series stops" and sends such a
 * draft to review rather than filing it as passed. A stored end we invented
 * would answer that question with something the email never said. Their cards
 * still show a one-hour range, since `effectiveEndTimestamp` fills it in at
 * read time.
 */
function withDefaultEnd(
  dates: ParsedItem["dates"],
  isRecurring: boolean,
): ParsedItem["dates"] {
  if (isRecurring) return dates;
  if (dates.some((date) => date.type === "end" || date.type === "deadline")) {
    return dates;
  }
  const start = dates.find((date) => date.type === "start");
  if (!start || !hasStatedClockTime(start.timestamp)) return dates;
  return [
    ...dates,
    { timestamp: start.timestamp + DEFAULT_EVENT_DURATION_MS, type: "end" },
  ];
}

function normalizeDateType(
  value: unknown,
): ParsedItem["dates"][number]["type"] {
  return value === "start" ||
    value === "end" ||
    value === "deadline" ||
    value === "single"
    ? value
    : "single";
}

/** `value` as an integer within `[min, max]`, or null if it is neither. */
function integerIn(value: unknown, min: number, max: number): number | null {
  const number = Number(value);
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (!Number.isInteger(number)) return null;
  return number >= min && number <= max ? number : null;
}

function shouldIgnoreMessage(message: SourceMessage) {
  return isListAdminNoise(message);
}

function buildDedupeKey(
  item: Pick<ParsedItem, "title" | "dates" | "links">,
  organizationId?: Id<"orgs">,
) {
  const firstDate = item.dates[0]?.timestamp
    ? new Date(item.dates[0].timestamp).toISOString().slice(0, 10)
    : "no-date";
  const firstLink = item.links[0]?.url ?? "no-link";
  return `${organizationId ?? "no-org"}:${normalizeKey(item.title)}:${firstDate}:${normalizeKey(firstLink)}`.slice(
    0,
    240,
  );
}

function extractLinks(value: string) {
  return [...new Set(value.match(/https?:\/\/[^\s"'<>]+/g) ?? [])];
}

function normalizeMessageType(value: unknown): ParseResult["messageType"] {
  return value === "events" ||
    value === "opportunities" ||
    value === "newsletter" ||
    value === "admin" ||
    value === "irrelevant"
    ? value
    : "irrelevant";
}

function normalizeEventType(value: unknown): ParsedItem["eventType"] {
  return value === "event" ||
    value === "opportunity" ||
    value === "hackathon" ||
    value === "courses" ||
    value === "fundraiser" ||
    value === "info"
    ? value
    : "info";
}

function normalizeHosts(hosts: unknown): ParsedItem["hosts"] {
  if (!Array.isArray(hosts)) return [];
  return hosts
    .filter(isRecord)
    .filter((host) => host.name)
    .slice(0, 6)
    .map((host) => ({
      name: String(host.name),
      kind:
        host.kind === "club" ||
        host.kind === "company" ||
        host.kind === "external_org"
          ? host.kind
          : "external_org",
      role:
        host.role === "primary" ||
        host.role === "cohost" ||
        host.role === "sponsor"
          ? host.role
          : "primary",
    }));
}

function normalizeLocation(location: unknown): ParsedItem["location"] {
  if (!isRecord(location) || !location.displayText) return undefined;
  return {
    displayText: String(location.displayText),
    address: optionalString(location.address),
    isVirtual: Boolean(location.isVirtual),
    buildingCode: optionalString(location.buildingCode),
  };
}

function normalizeLinks(links: unknown): ParsedItem["links"] {
  if (!Array.isArray(links)) return [];
  return links
    .filter(isRecord)
    .filter((link) => link.url)
    .slice(0, 12)
    .map((link) => ({
      url: String(link.url),
      type:
        link.type === "registration" ||
        link.type === "application" ||
        link.type === "rsvp" ||
        link.type === "info" ||
        link.type === "social"
          ? link.type
          : "info",
      label: optionalString(link.label),
    }));
}

function normalizeContacts(contacts: unknown): ParsedItem["contacts"] {
  if (!Array.isArray(contacts)) return [];
  return contacts
    .filter(isRecord)
    .filter((contact) => contact.value)
    .slice(0, 8)
    .map((contact) => ({
      type:
        contact.type === "email" ||
        contact.type === "instagram" ||
        contact.type === "website"
          ? contact.type
          : "website",
      value: String(contact.value),
    }));
}

function normalizeAudience(value: unknown): ParsedItem["targetAudience"] {
  return value === "all" ||
    value === "first_year" ||
    value === "women_nonbinary" ||
    value === "international" ||
    value === "graduate"
    ? value
    : undefined;
}

function normalizePerks(perks: unknown): ParsedItem["perks"] {
  if (!Array.isArray(perks)) return [];
  return perks.filter(isPerk).slice(0, 6);
}

function isPerk(value: unknown): value is ParsedItem["perks"][number] {
  return (
    value === "food" ||
    value === "swag" ||
    value === "prizes" ||
    value === "travel_covered" ||
    value === "paid"
  );
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === "string") return error.slice(0, 500);
  return "Unknown parse error.";
}
