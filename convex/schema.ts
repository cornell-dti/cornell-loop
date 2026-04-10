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
      v.union( // decide if we need all or define more
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

  })
    .index("by_listserv", ["listserv"])
    .index("by_section", ["listservSection"])
    .index("by_event_type", ["eventType"]),
});
