import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { normalizeTags, toCanonicalTag } from "./lib/tags";

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
    dropped: v.array(v.object({ tag: v.string(), count: v.number() })),
  }),
  handler: async (ctx, args) => {
    const dropped = new Map<string, number>();
    let scanned = 0;
    let changed = 0;
    for await (const event of ctx.db.query("events")) {
      scanned += 1;
      for (const tag of event.tags) {
        if (toCanonicalTag(tag) === null) {
          dropped.set(tag, (dropped.get(tag) ?? 0) + 1);
        }
      }
      const next = normalizeTags(event.tags);
      const same =
        next.length === event.tags.length &&
        next.every((tag, i) => tag === event.tags[i]);
      if (same) continue;
      changed += 1;
      if (!args.dryRun) await ctx.db.patch(event._id, { tags: next });
    }
    return {
      scanned,
      changed,
      dropped: [...dropped]
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
});
