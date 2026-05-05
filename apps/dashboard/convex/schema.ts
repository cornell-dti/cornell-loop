// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Per-user profile (extends auth `users` row)
  userProfiles: defineTable({
    userId: v.id("users"),
    major: v.optional(v.string()),
    gradYear: v.optional(v.string()),
    minor: v.optional(v.string()),
    interests: v.array(v.string()),
    onboardingCompletedAt: v.optional(v.number()),
    isSeed: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  // Organizations (clubs) — first-class entity for follows + org page
  orgs: defineTable({
    slug: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    description: v.string(),
    tags: v.array(v.string()),
    websiteUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    isVerified: v.boolean(),
    loopSummary: v.optional(v.string()), // populated by seed/AI branch later
    isSeed: v.optional(v.boolean()),
  })
    .index("by_slug", ["slug"])
    .index("by_seed", ["isSeed"])
    .searchIndex("search_orgs_name", { searchField: "name" })
    .searchIndex("search_orgs_desc", { searchField: "description" }),

  // Denormalized event<->org join so feed can be assembled per followed org
  eventOrgs: defineTable({
    eventId: v.id("events"),
    orgId: v.id("orgs"),
    eventCreationTime: v.number(),
    isSeed: v.optional(v.boolean()),
  })
    .index("by_org", ["orgId", "eventCreationTime"])
    .index("by_event", ["eventId"])
    .index("by_seed", ["isSeed"]),

  follows: defineTable({
    userId: v.id("users"),
    orgId: v.id("orgs"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_org", ["userId", "orgId"])
    .index("by_org", ["orgId"]),

  bookmarks: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_event", ["userId", "eventId"]),

  rsvps: defineTable({
    userId: v.id("users"),
    eventId: v.id("events"),
    status: v.union(
      v.literal("going"),
      v.literal("interested"),
      v.literal("maybe"),
    ),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_event", ["userId", "eventId"])
    .index("by_event", ["eventId"]),

  // raw email data
  listservEmails: defineTable({
    listserv: v.string(), // listserv name
    sentAt: v.number(), // timestamp
    fromAddress: v.optional(v.string()), // listserv email address
    rawHtml: v.optional(v.string()),
    rawText: v.optional(v.string()),
    section: v.optional(v.string()), // "On-Campus", "Off-Campus", "Opportunities"
    isSeed: v.optional(v.boolean()),
  })
    .index("by_listserv", ["listserv"])
    .index("by_seed", ["isSeed"]),

  // One row per listserv item
  events: defineTable({
    listservEmailId: v.id("listservEmails"), // link to the listserv email data
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
    isSeed: v.optional(v.boolean()),
  })
    .index("by_listserv", ["listserv"])
    .index("by_section", ["listservSection"])
    .index("by_event_type", ["eventType"])
    .index("by_seed", ["isSeed"])
    .searchIndex("search_events_title", { searchField: "title" })
    .searchIndex("search_events_desc", { searchField: "description" }),
});
