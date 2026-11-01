// convex/lib/docValidators.ts
//
// Shared `returns` validators for full table documents, reused across
// sourceAdmin.ts and listservAdmin.ts so every query/mutation/action that
// hands back a raw `Doc<"...">` (or an array of them) has a real validator
// instead of going without one. Each validator mirrors schema.ts exactly —
// system fields (`_id`, `_creationTime`) plus every table field, with the
// same optionality. Kept here rather than duplicated per-file since several
// of these tables (`listservs`, `orgs`) are returned by queries in both
// admin files.
import { v } from "convex/values";

export const orgDocValidator = v.object({
  _id: v.id("orgs"),
  _creationTime: v.number(),
  slug: v.string(),
  name: v.string(),
  avatarUrl: v.optional(v.string()),
  coverImageUrl: v.optional(v.string()),
  description: v.string(),
  tags: v.array(v.string()),
  websiteUrl: v.optional(v.string()),
  email: v.optional(v.string()),
  isVerified: v.boolean(),
  loopSummary: v.optional(v.string()),
  isSeed: v.optional(v.boolean()),
  orgType: v.optional(
    v.union(
      v.literal("club"),
      v.literal("department"),
      v.literal("official"),
      v.literal("publication"),
      v.literal("company"),
      v.literal("other"),
    ),
  ),
  orgStatus: v.optional(v.union(v.literal("active"), v.literal("hidden"))),
  updatedAt: v.optional(v.number()),
});

export const listservDocValidator = v.object({
  _id: v.id("listservs"),
  _creationTime: v.number(),
  name: v.string(),
  displayName: v.optional(v.string()),
  listEmail: v.string(),
  senderEmails: v.array(v.string()),
  organizationId: v.optional(v.id("orgs")),
  sourceType: v.optional(
    v.union(
      v.literal("simplelists"),
      v.literal("lyris"),
      v.literal("campus_groups"),
      v.literal("newsletter"),
      v.literal("direct_email"),
      v.literal("unknown"),
    ),
  ),
  status: v.union(
    v.literal("joining"),
    v.literal("active"),
    v.literal("paused"),
    v.literal("failed"),
  ),
  joinMethod: v.union(
    v.literal("email_command"),
    v.literal("web_form"),
    v.literal("manual"),
    v.literal("unknown"),
  ),
  joinStatus: v.union(
    v.literal("not_started"),
    v.literal("join_email_sent"),
    v.literal("awaiting_confirmation"),
    v.literal("joined"),
    v.literal("failed"),
    v.literal("manual_required"),
  ),
  joinStrategy: v.optional(
    v.union(
      v.literal("cornell_simplelists"),
      v.literal("cornell_simplelists_owner_contact"),
      v.literal("cornell_lyris"),
      v.literal("cornell_lyris_owner_contact"),
      v.literal("campus_groups"),
      v.literal("newsletter"),
      v.literal("direct_org_email"),
      v.literal("manual"),
      v.literal("unknown"),
    ),
  ),
  joinRecipient: v.optional(v.string()),
  ownerRecipient: v.optional(v.string()),
  joinSubject: v.optional(v.string()),
  joinBody: v.optional(v.string()),
  subscribeUrl: v.optional(v.string()),
  joinInstructions: v.optional(v.string()),
  joinConfidence: v.optional(v.number()),
  joinDetectionReasons: v.optional(v.array(v.string())),
  joinDetectedAt: v.optional(v.number()),
  source: v.union(
    v.literal("d1_discovery"),
    v.literal("simplelists_directory"),
    v.literal("manual"),
    v.literal("import"),
  ),
  candidateId: v.optional(v.id("listservCandidates")),
  notes: v.optional(v.string()),
  lastReceivedAt: v.optional(v.number()),
  isPrimary: v.optional(v.boolean()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const listservCandidateDocValidator = v.object({
  _id: v.id("listservCandidates"),
  _creationTime: v.number(),
  email: v.string(),
  displayName: v.optional(v.string()),
  source: v.union(
    v.literal("d1_discovery"),
    v.literal("simplelists_directory"),
    v.literal("manual"),
    v.literal("import"),
  ),
  status: v.union(
    v.literal("candidate"),
    v.literal("approved"),
    v.literal("rejected"),
  ),
  confidence: v.number(),
  popularity: v.optional(v.number()),
  matchedReasons: v.array(v.string()),
  directoryDescription: v.optional(v.string()),
  subscribeUrl: v.optional(v.string()),
  notes: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const listservIngestionStateDocValidator = v.object({
  _id: v.id("listservIngestionState"),
  _creationTime: v.number(),
  key: v.string(),
  value: v.optional(v.string()),
  status: v.union(v.literal("idle"), v.literal("running"), v.literal("failed")),
  lastStartedAt: v.optional(v.number()),
  lastSucceededAt: v.optional(v.number()),
  lastError: v.optional(v.string()),
  updatedAt: v.number(),
});

export const discoveryRunDocValidator = v.object({
  _id: v.id("discoveryRuns"),
  _creationTime: v.number(),
  source: v.union(
    v.literal("initial_sender_dataset"),
    v.literal("simplelists_directory"),
  ),
  status: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
  ),
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  candidatesFound: v.number(),
  candidatesInserted: v.number(),
  candidatesUpdated: v.number(),
  error: v.optional(v.string()),
});

export const joinAttemptDocValidator = v.object({
  _id: v.id("joinAttempts"),
  _creationTime: v.number(),
  listservId: v.id("listservs"),
  status: v.union(v.literal("sent"), v.literal("failed")),
  recipient: v.optional(v.string()),
  subject: v.optional(v.string()),
  body: v.optional(v.string()),
  gmailMessageId: v.optional(v.string()),
  method: v.optional(v.union(v.literal("email"), v.literal("web_form"))),
  httpStatus: v.optional(v.number()),
  subscribeUrl: v.optional(v.string()),
  error: v.optional(v.string()),
  createdAt: v.number(),
});

export const ingestionRunDocValidator = v.object({
  _id: v.id("ingestionRuns"),
  _creationTime: v.number(),
  trigger: v.union(v.literal("cron"), v.literal("manual")),
  status: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
  ),
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  fetched: v.number(),
  unseen: v.number(),
  stored: v.number(),
  error: v.optional(v.string()),
});

export const parseRunDocValidator = v.object({
  _id: v.id("parseRuns"),
  _creationTime: v.number(),
  trigger: v.union(
    v.literal("manual"),
    v.literal("cron"),
    v.literal("single_message"),
  ),
  status: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
  ),
  startedAt: v.number(),
  finishedAt: v.optional(v.number()),
  provider: v.optional(v.union(v.literal("openai"), v.literal("gemini"))),
  model: v.optional(v.string()),
  messagesScanned: v.number(),
  messagesParsed: v.number(),
  eventsCreated: v.number(),
  eventsUpdated: v.number(),
  eventsSkippedDuplicate: v.optional(v.number()),
  messagesIgnored: v.number(),
  error: v.optional(v.string()),
});

export const eventHostValidator = v.object({
  name: v.string(),
  kind: v.union(
    v.literal("club"),
    v.literal("company"),
    v.literal("external_org"),
  ),
  role: v.union(
    v.literal("primary"),
    v.literal("cohost"),
    v.literal("sponsor"),
  ),
});

export const eventDateValidator = v.object({
  timestamp: v.number(),
  type: v.union(
    v.literal("start"),
    v.literal("end"),
    v.literal("deadline"),
    v.literal("single"),
  ),
});

export const eventLocationValidator = v.object({
  displayText: v.string(),
  address: v.optional(v.string()),
  isVirtual: v.boolean(),
  buildingCode: v.optional(v.string()),
});

export const eventLinkValidator = v.object({
  url: v.string(),
  type: v.union(
    v.literal("registration"),
    v.literal("application"),
    v.literal("rsvp"),
    v.literal("info"),
    v.literal("social"),
  ),
  label: v.optional(v.string()),
});

export const eventContactValidator = v.object({
  type: v.union(
    v.literal("email"),
    v.literal("instagram"),
    v.literal("website"),
  ),
  value: v.string(),
});

export const eventTypeValidator = v.union(
  v.literal("event"),
  v.literal("opportunity"),
  v.literal("hackathon"),
  v.literal("courses"),
  v.literal("fundraiser"),
  v.literal("info"),
);

export const targetAudienceValidator = v.union(
  v.literal("all"),
  v.literal("first_year"),
  v.literal("women_nonbinary"),
  v.literal("international"),
  v.literal("graduate"),
);

export const perkValidator = v.union(
  v.literal("food"),
  v.literal("swag"),
  v.literal("prizes"),
  v.literal("travel_covered"),
  v.literal("paid"),
);

/**
 * Shape of one AI-parsed feed item, shared between the `parseRuns` writer
 * (`storeParsedEvents`, which validates the model's raw output against this
 * before ever touching `events`) and {@link eventDocValidator} below (which
 * layers on the stored-document fields).
 */
export const parsedItemValidator = v.object({
  title: v.string(),
  description: v.string(),
  aiDescription: v.string(),
  eventType: eventTypeValidator,
  hosts: v.array(eventHostValidator),
  dates: v.array(eventDateValidator),
  isRecurring: v.boolean(),
  recurrenceNote: v.optional(v.string()),
  location: v.optional(eventLocationValidator),
  links: v.array(eventLinkValidator),
  contacts: v.array(eventContactValidator),
  tags: v.array(v.string()),
  targetAudience: v.optional(targetAudienceValidator),
  perks: v.array(perkValidator),
});

export const eventDocValidator = v.object({
  _id: v.id("events"),
  _creationTime: v.number(),
  listservEmailId: v.optional(v.id("listservEmails")),
  sourceMessageId: v.optional(v.id("listservMessages")),
  listservId: v.optional(v.id("listservs")),
  organizationId: v.optional(v.id("orgs")),
  listserv: v.string(),
  listservSection: v.string(),
  title: v.string(),
  description: v.string(),
  aiDescription: v.string(),
  eventType: eventTypeValidator,
  hosts: v.array(eventHostValidator),
  dates: v.array(eventDateValidator),
  isRecurring: v.boolean(),
  recurrenceNote: v.optional(v.string()),
  location: v.optional(eventLocationValidator),
  links: v.array(eventLinkValidator),
  contacts: v.array(eventContactValidator),
  tags: v.array(v.string()),
  targetAudience: v.optional(targetAudienceValidator),
  perks: v.array(perkValidator),
  isSeed: v.optional(v.boolean()),
  visibility: v.optional(
    v.union(v.literal("draft"), v.literal("published"), v.literal("hidden")),
  ),
  parseConfidence: v.optional(v.number()),
  parseWarnings: v.optional(v.array(v.string())),
  dedupeKey: v.optional(v.string()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
});
