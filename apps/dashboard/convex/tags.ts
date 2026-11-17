import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { normalizeTags, tagKey, toCanonicalTag } from "./lib/tags";

/**
 * Free-form tags that describe who an event is for or what it offers rather
 * than its topic. They have no canonical tag; the backfill moves them onto the
 * structured `targetAudience` / `perks` fields instead of dropping them.
 */
const FIRST_YEAR_TAG_KEYS: ReadonlySet<string> = new Set([
  "first-year friendly",
  "first year friendly",
  "first-year",
  "first year",
  "freshman",
  "freshmen",
]);
const FOOD_PERK_TAG_KEYS: ReadonlySet<string> = new Set([
  "food provided",
  "free food",
]);

/**
 * One-off backfill: rewrite every existing event's tags onto the canonical
 * set. Run with `npx convex run tags:migrateEventTags` (pass
 * `'{"dryRun": true}'` first to preview). Returns the free-form tags that had
 * no mapping so the alias table can be extended before the real run.
 */
export const migrateEventTags = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    scanned: v.number(),
    changed: v.number(),
    audienceSetToFirstYear: v.number(),
    foodPerkAdded: v.number(),
    dropped: v.array(v.object({ tag: v.string(), count: v.number() })),
  }),
  handler: async (ctx, args) => {
    const dropped = new Map<string, number>();
    let scanned = 0;
    let changed = 0;
    let audienceSetToFirstYear = 0;
    let foodPerkAdded = 0;
    for await (const event of ctx.db.query("events")) {
      scanned += 1;
      const patch: Partial<
        Pick<Doc<"events">, "tags" | "targetAudience" | "perks">
      > = {};

      let firstYear = false;
      let food = false;
      for (const tag of event.tags) {
        const key = tagKey(tag);
        if (FIRST_YEAR_TAG_KEYS.has(key)) firstYear = true;
        else if (FOOD_PERK_TAG_KEYS.has(key)) food = true;
        else if (toCanonicalTag(tag) === null) {
          dropped.set(tag, (dropped.get(tag) ?? 0) + 1);
        }
      }
      if (
        firstYear &&
        (event.targetAudience === undefined || event.targetAudience === "all")
      ) {
        patch.targetAudience = "first_year";
        audienceSetToFirstYear += 1;
      }
      if (food && !event.perks.includes("food")) {
        patch.perks = [...event.perks, "food"];
        foodPerkAdded += 1;
      }

      const next = normalizeTags(event.tags);
      const sameTags =
        next.length === event.tags.length &&
        next.every((tag, i) => tag === event.tags[i]);
      if (!sameTags) patch.tags = next;

      if (Object.keys(patch).length === 0) continue;
      changed += 1;
      if (!args.dryRun) await ctx.db.patch(event._id, patch);
    }
    return {
      scanned,
      changed,
      audienceSetToFirstYear,
      foodPerkAdded,
      dropped: [...dropped]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
});
