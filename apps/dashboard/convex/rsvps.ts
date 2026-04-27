import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";

type RsvpStatus = "going" | "interested" | "maybe";

type HydratedRsvp = {
  rsvp: Doc<"rsvps">;
  event: Doc<"events">;
  orgs: Doc<"orgs">[];
};

type MyRsvpsResult = {
  today: HydratedRsvp[];
  thisWeek: HydratedRsvp[];
};

async function loadOrgsForEvent(
  ctx: QueryCtx,
  eventId: Id<"events">,
): Promise<Doc<"orgs">[]> {
  const joins = await ctx.db
    .query("eventOrgs")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .take(8);

  const orgs: Doc<"orgs">[] = [];
  for (const join of joins) {
    const org = await ctx.db.get(join.orgId);
    if (org !== null) {
      orgs.push(org);
    }
  }
  return orgs;
}

async function findRsvp(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  eventId: Id<"events">,
): Promise<Doc<"rsvps"> | null> {
  return await ctx.db
    .query("rsvps")
    .withIndex("by_user_and_event", (q) =>
      q.eq("userId", userId).eq("eventId", eventId),
    )
    .unique();
}

function getStartTimestamp(event: Doc<"events">): number | null {
  // Prefer "start" or "single" date types as the canonical event start.
  for (const date of event.dates) {
    if (date.type === "start" || date.type === "single") {
      return date.timestamp;
    }
  }
  return null;
}

// Returns the UTC date prefix (YYYY-MM-DD) for a given timestamp.
// NOTE: timezone handling is approximate — we use UTC day boundaries here.
// Precise America/New_York handling is out of scope for this placeholder.
function utcDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export const setRsvp = mutation({
  args: {
    eventId: v.id("events"),
    status: v.union(
      v.literal("going"),
      v.literal("interested"),
      v.literal("maybe"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "You must be signed in to RSVP.",
      });
    }

    const existing = await findRsvp(ctx, userId, args.eventId);
    const status: RsvpStatus = args.status;

    if (existing === null) {
      await ctx.db.insert("rsvps", {
        userId,
        eventId: args.eventId,
        status,
        createdAt: Date.now(),
      });
      return null;
    }

    await ctx.db.patch(existing._id, { status });
    return null;
  },
});

export const clearRsvp = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "You must be signed in to clear an RSVP.",
      });
    }

    const existing = await findRsvp(ctx, userId, args.eventId);
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
});

export const myRsvps = query({
  args: {},
  handler: async (ctx): Promise<MyRsvpsResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { today: [], thisWeek: [] };
    }

    const rows = await ctx.db
      .query("rsvps")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);

    const now = Date.now();
    const todayKey = utcDayKey(now);
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;

    const today: HydratedRsvp[] = [];
    const thisWeek: HydratedRsvp[] = [];

    for (const row of rows) {
      const event = await ctx.db.get(row.eventId);
      if (event === null) continue;

      const start = getStartTimestamp(event);
      if (start === null) continue;

      const orgs = await loadOrgsForEvent(ctx, event._id);
      const hydrated: HydratedRsvp = { rsvp: row, event, orgs };

      if (utcDayKey(start) === todayKey) {
        today.push(hydrated);
      } else if (start >= now && start <= sevenDaysFromNow) {
        thisWeek.push(hydrated);
      }
    }

    today.sort(
      (a, b) =>
        (getStartTimestamp(a.event) ?? 0) - (getStartTimestamp(b.event) ?? 0),
    );
    thisWeek.sort(
      (a, b) =>
        (getStartTimestamp(a.event) ?? 0) - (getStartTimestamp(b.event) ?? 0),
    );

    return { today, thisWeek };
  },
});
