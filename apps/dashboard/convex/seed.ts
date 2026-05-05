import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import {
  SEED_EVENTS,
  SEED_EVENT_HOST_SLUGS,
  SEED_LISTSERV_NAME,
  SEED_LISTSERV_SECTION,
  SEED_ORGS,
  type SeedDate,
  type SeedEvent,
} from "./seedData";

type SeedSummary = {
  listservEmails: number;
  orgs: number;
  events: number;
  eventOrgs: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function dateToTimestamp(now: number, date: SeedDate): number {
  return (
    now +
    date.dayOffset * MS_PER_DAY +
    date.hour * 60 * 60 * 1000 +
    date.minute * 60 * 1000
  );
}

async function findSeedListservId(
  ctx: MutationCtx,
): Promise<Id<"listservEmails"> | null> {
  const existing = await ctx.db
    .query("listservEmails")
    .withIndex("by_listserv", (q) => q.eq("listserv", SEED_LISTSERV_NAME))
    .take(50);
  for (const row of existing) {
    if (row.isSeed === true) {
      return row._id;
    }
  }
  return null;
}

async function findSeedEventByTitle(
  ctx: MutationCtx,
  title: string,
): Promise<Id<"events"> | null> {
  const rows = await ctx.db
    .query("events")
    .withIndex("by_listserv", (q) => q.eq("listserv", SEED_LISTSERV_NAME))
    .take(200);
  for (const row of rows) {
    if (row.isSeed === true && row.title === title) {
      return row._id;
    }
  }
  return null;
}

export const seedAll = internalMutation({
  args: {},
  handler: async (ctx): Promise<SeedSummary> => {
    const summary: SeedSummary = {
      listservEmails: 0,
      orgs: 0,
      events: 0,
      eventOrgs: 0,
    };
    const now = Date.now();

    // 1. Listserv parent row.
    let listservId = await findSeedListservId(ctx);
    if (listservId === null) {
      listservId = await ctx.db.insert("listservEmails", {
        listserv: SEED_LISTSERV_NAME,
        sentAt: now,
        section: SEED_LISTSERV_SECTION,
        fromAddress: "seed@example.com",
        rawText: "Seed listserv parent row.",
        isSeed: true,
      });
      summary.listservEmails += 1;
    }

    // 2. Orgs (skip if a row with this slug already exists).
    const orgIdsBySlug = new Map<string, Id<"orgs">>();
    for (const org of SEED_ORGS) {
      const existing = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", org.slug))
        .unique();
      if (existing !== null) {
        orgIdsBySlug.set(org.slug, existing._id);
        continue;
      }
      const inserted = await ctx.db.insert("orgs", {
        slug: org.slug,
        name: org.name,
        description: org.description,
        tags: org.tags,
        isVerified: org.isVerified,
        websiteUrl: org.websiteUrl,
        email: org.email,
        loopSummary: org.loopSummary,
        isSeed: true,
      });
      orgIdsBySlug.set(org.slug, inserted);
      summary.orgs += 1;
    }

    // 3. Events (skip if same title under seed listserv already exists).
    const eventIdsByKey = new Map<string, Id<"events">>();
    for (const event of SEED_EVENTS) {
      const existingId = await findSeedEventByTitle(ctx, event.title);
      if (existingId !== null) {
        eventIdsByKey.set(event.key, existingId);
        continue;
      }
      const inserted = await insertSeedEvent(ctx, listservId, event, now);
      eventIdsByKey.set(event.key, inserted);
      summary.events += 1;
    }

    // 4. eventOrgs join rows for each host slug.
    for (const event of SEED_EVENTS) {
      const eventId = eventIdsByKey.get(event.key);
      if (eventId === undefined) continue;

      const hostSlugs = SEED_EVENT_HOST_SLUGS[event.key] ?? [];
      for (const slug of hostSlugs) {
        const orgId = orgIdsBySlug.get(slug);
        if (orgId === undefined) continue;

        // Skip if join already exists.
        const existingJoins = await ctx.db
          .query("eventOrgs")
          .withIndex("by_event", (q) => q.eq("eventId", eventId))
          .take(20);
        const alreadyJoined = existingJoins.some(
          (join) => join.orgId === orgId,
        );
        if (alreadyJoined) continue;

        await ctx.db.insert("eventOrgs", {
          eventId,
          orgId,
          eventCreationTime: now,
          isSeed: true,
        });
        summary.eventOrgs += 1;
      }
    }

    return summary;
  },
});

async function insertSeedEvent(
  ctx: MutationCtx,
  listservId: Id<"listservEmails">,
  event: SeedEvent,
  now: number,
): Promise<Id<"events">> {
  return await ctx.db.insert("events", {
    listservEmailId: listservId,
    listserv: SEED_LISTSERV_NAME,
    listservSection: SEED_LISTSERV_SECTION,
    title: event.title,
    description: event.description,
    aiDescription: event.aiDescription,
    eventType: event.eventType,
    hosts: event.hosts,
    dates: event.dates.map((d) => ({
      timestamp: dateToTimestamp(now, d),
      type: d.type,
    })),
    isRecurring: event.isRecurring,
    recurrenceNote: event.recurrenceNote,
    location: event.location,
    links: event.links,
    contacts: event.contacts,
    tags: event.tags,
    targetAudience: event.targetAudience,
    perks: event.perks,
    isSeed: true,
  });
}

const CLEAR_BATCH = 100;

/**
 * Paginated delete of all rows tagged isSeed:true. Reschedules itself if a
 * full batch was processed for any table. Tables without `isSeed` (follows,
 * bookmarks, rsvps) are intentionally skipped — they have no seed rows.
 */
export const clearSeed = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ done: boolean; deleted: number }> => {
    let deleted = 0;
    let needsReschedule = false;

    // eventOrgs first (depends on events + orgs).
    const eventOrgRows = await ctx.db
      .query("eventOrgs")
      .withIndex("by_seed", (q) => q.eq("isSeed", true))
      .take(CLEAR_BATCH);
    for (const row of eventOrgRows) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    if (eventOrgRows.length === CLEAR_BATCH) needsReschedule = true;

    // events
    if (!needsReschedule) {
      const eventRows = await ctx.db
        .query("events")
        .withIndex("by_seed", (q) => q.eq("isSeed", true))
        .take(CLEAR_BATCH);
      for (const row of eventRows) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
      if (eventRows.length === CLEAR_BATCH) needsReschedule = true;
    }

    // orgs
    if (!needsReschedule) {
      const orgRows = await ctx.db
        .query("orgs")
        .withIndex("by_seed", (q) => q.eq("isSeed", true))
        .take(CLEAR_BATCH);
      for (const row of orgRows) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
      if (orgRows.length === CLEAR_BATCH) needsReschedule = true;
    }

    // listservEmails
    if (!needsReschedule) {
      const listservRows = await ctx.db
        .query("listservEmails")
        .withIndex("by_seed", (q) => q.eq("isSeed", true))
        .take(CLEAR_BATCH);
      for (const row of listservRows) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
      if (listservRows.length === CLEAR_BATCH) needsReschedule = true;
    }

    // userProfiles (any isSeed-tagged seed profiles)
    if (!needsReschedule) {
      // userProfiles has no by_seed index; iterate up to CLEAR_BATCH and
      // filter in-memory. Seed profiles are not currently created, but this
      // keeps clearSeed honest if they ever are.
      const profileRows = await ctx.db.query("userProfiles").take(CLEAR_BATCH);
      const seedProfiles = profileRows.filter((row) => row.isSeed === true);
      for (const row of seedProfiles) {
        await ctx.db.delete(row._id);
        deleted += 1;
      }
      // If we hit batch size and any were seeds, re-run.
      if (
        profileRows.length === CLEAR_BATCH &&
        seedProfiles.length === profileRows.length
      ) {
        needsReschedule = true;
      }
    }

    if (needsReschedule) {
      await ctx.scheduler.runAfter(0, internal.seed.clearSeed, {});
      return { done: false, deleted };
    }
    return { done: true, deleted };
  },
});

export const seedFollowsForCurrentUser = internalMutation({
  args: { slugs: v.array(v.string()) },
  handler: async (ctx, args): Promise<{ followed: number }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "You must be signed in to seed follows.",
      });
    }

    let followed = 0;
    for (const slug of args.slugs) {
      const org = await ctx.db
        .query("orgs")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (org === null) continue;

      const existing = await ctx.db
        .query("follows")
        .withIndex("by_user_and_org", (q) =>
          q.eq("userId", userId).eq("orgId", org._id),
        )
        .unique();
      if (existing !== null) continue;

      await ctx.db.insert("follows", {
        userId,
        orgId: org._id,
        createdAt: Date.now(),
      });
      followed += 1;
    }
    return { followed };
  },
});
