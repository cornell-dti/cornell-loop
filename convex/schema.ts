// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // raw email data
  listservEmails: defineTable({
    listserv: v.string(), // listserv name
    sentAt: v.number(), // timestamp
    fromAddress: v.optional(v.string()), // listserv email address
    rawHtml: v.optional(v.string()),
    rawText: v.optional(v.string()),
    section: v.optional(v.string()), // "On-Campus", "Off-Campus", "Opportunities"
  }).index("by_listserv", ["listserv"]),

  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    type: v.union(
      v.literal("club"),
      v.literal("department"),
      v.literal("official"),
      v.literal("publication"),
      v.literal("company"),
      v.literal("other"),
    ),
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    tags: v.array(v.string()),
    status: v.union(v.literal("active"), v.literal("hidden")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  listservCandidates: defineTable({
    email: v.string(),
    displayName: v.optional(v.string()),
    source: v.union(
      v.literal("d1_discovery"),
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
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  listservs: defineTable({
    name: v.string(),
    displayName: v.optional(v.string()),
    listEmail: v.string(),
    senderEmails: v.array(v.string()),
    organizationId: v.optional(v.id("organizations")),
    sourceType: v.optional(
      v.union(
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
    joinInstructions: v.optional(v.string()),
    joinConfidence: v.optional(v.number()),
    joinDetectionReasons: v.optional(v.array(v.string())),
    joinDetectedAt: v.optional(v.number()),
    source: v.union(
      v.literal("d1_discovery"),
      v.literal("manual"),
      v.literal("import"),
    ),
    candidateId: v.optional(v.id("listservCandidates")),
    notes: v.optional(v.string()),
    lastReceivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_list_email", ["listEmail"])
    .index("by_organization", ["organizationId"])
    .index("by_status", ["status"]),

  listservMessages: defineTable({
    gmailMessageId: v.string(),
    threadId: v.optional(v.string()),
    listservId: v.optional(v.id("listservs")),
    organizationId: v.optional(v.id("organizations")),
    sender: v.string(),
    senderEmail: v.string(),
    to: v.array(v.string()),
    cc: v.array(v.string()),
    subject: v.string(),
    receivedAt: v.number(),
    bodyText: v.string(),
    bodyHtml: v.string(),
    headers: v.array(
      v.object({
        name: v.string(),
        value: v.string(),
      }),
    ),
    processingStatus: v.union(
      v.literal("new"),
      v.literal("parsed"),
      v.literal("ignored"),
      v.literal("failed"),
    ),
    parseError: v.optional(v.string()),
    confirmationClearedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_gmail_message_id", ["gmailMessageId"])
    .index("by_listserv", ["listservId"])
    .index("by_organization", ["organizationId"])
    .index("by_received_at", ["receivedAt"])
    .index("by_confirmation_cleared_at", ["confirmationClearedAt"])
    .index("by_processing_status", ["processingStatus"]),

  listservIngestionState: defineTable({
    key: v.string(),
    value: v.optional(v.string()),
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("failed"),
    ),
    lastStartedAt: v.optional(v.number()),
    lastSucceededAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  discoveryRuns: defineTable({
    source: v.literal("initial_sender_dataset"),
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
  }).index("by_started_at", ["startedAt"]),

  joinAttempts: defineTable({
    listservId: v.id("listservs"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    recipient: v.string(),
    subject: v.string(),
    body: v.string(),
    gmailMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_listserv", ["listservId"])
    .index("by_created_at", ["createdAt"]),

  ingestionRuns: defineTable({
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
  }).index("by_started_at", ["startedAt"]),

  parseRuns: defineTable({
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
    messagesIgnored: v.number(),
    error: v.optional(v.string()),
  }).index("by_started_at", ["startedAt"]),

  gmailConnections: defineTable({
    key: v.string(),
    email: v.string(),
    refreshToken: v.string(),
    scopes: v.array(v.string()),
    status: v.union(v.literal("connected"), v.literal("invalid")),
    connectedAt: v.number(),
    updatedAt: v.number(),
    lastError: v.optional(v.string()),
  }).index("by_key", ["key"]),

  gmailOAuthStates: defineTable({
    state: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    // When true this row was created as a short-lived admin-initiation nonce
    // (used so the admin token never appears in a navigable URL).
    adminNonce: v.optional(v.boolean()),
  }).index("by_state", ["state"]),

  // One row per listserv item
  events: defineTable({
    listservEmailId: v.optional(v.id("listservEmails")), // legacy link to the listserv email data
    sourceMessageId: v.optional(v.id("listservMessages")),
    listservId: v.optional(v.id("listservs")),
    organizationId: v.optional(v.id("organizations")),
    listserv: v.string(),
    listservSection: v.string(),

    title: v.string(),
    description: v.string(),
    aiDescription: v.string(), // condensed 1 sentence ai-generated description
    eventType: v.union(
      v.literal("event"), // one-time event
      v.literal("opportunity"), // internship, job, program, application
      v.literal("hackathon"),
      v.literal("courses"), // workshop series / class series
      v.literal("fundraiser"),
      v.literal("info"), // announcements with no clear CTA, catch-all
    ),

    // ex. WICC x Jane Street, AppDev x Ramp, WICC x AppDev
    hosts: v.array(
      v.object({
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
      }),
    ),

    dates: v.array(
      v.object({
        timestamp: v.number(),
        type: v.union(
          v.literal("start"), // start & end for recurring events
          v.literal("end"),
          v.literal("deadline"),
          v.literal("single"), // one-off event with no end
        ),
      }),
    ),
    isRecurring: v.boolean(),
    recurrenceNote: v.optional(v.string()), // "Every Wednesday 5-6:30pm"

    location: v.optional(
      v.object({
        displayText: v.string(),
        address: v.optional(v.string()),
        isVirtual: v.boolean(),
        buildingCode: v.optional(v.string()), // "Gates 114", "CIS 250"
      }),
    ),

    links: v.array(
      v.object({
        url: v.string(),
        type: v.union(
          v.literal("registration"), // more for courses, hackathons, etc.
          v.literal("application"), // internships, jobs, programs
          v.literal("rsvp"), // events with physical link (decide if combines with registration)
          v.literal("info"), // general info, websites, etc.
          v.literal("social"), // instagram, etc.
        ),
        label: v.optional(v.string()), // "Apply here", "RSVP Link"
      }),
    ),

    contacts: v.array(
      v.object({
        type: v.union(
          v.literal("email"),
          v.literal("instagram"),
          v.literal("website"),
        ),
        value: v.string(),
      }),
    ),

    tags: v.array(v.string()),
    targetAudience: v.optional(
      v.union(
        // decide if we need all or define more
        v.literal("all"),
        v.literal("first_year"),
        v.literal("women_nonbinary"),
        v.literal("international"),
        v.literal("graduate"),
      ),
    ),
    perks: v.array(
      v.union(
        v.literal("food"),
        v.literal("swag"),
        v.literal("prizes"),
        v.literal("travel_covered"),
        v.literal("paid"),
      ),
    ),
    visibility: v.optional(
      v.union(v.literal("draft"), v.literal("published"), v.literal("hidden")),
    ),
    parseConfidence: v.optional(v.number()),
    parseWarnings: v.optional(v.array(v.string())),
    dedupeKey: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_listserv", ["listserv"])
    .index("by_source_message", ["sourceMessageId"])
    .index("by_listserv_id", ["listservId"])
    .index("by_organization", ["organizationId"])
    .index("by_visibility", ["visibility"])
    .index("by_dedupe_key", ["dedupeKey"])
    .index("by_section", ["listservSection"])
    .index("by_event_type", ["eventType"]),
});
