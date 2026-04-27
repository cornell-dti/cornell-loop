import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminToken } from "./_shared/adminToken";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const ORG_TYPES = v.union(
  v.literal("club"),
  v.literal("department"),
  v.literal("official"),
  v.literal("publication"),
  v.literal("company"),
  v.literal("other"),
);

export const overview = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const [organizations, listservs, messages] = await Promise.all([
      ctx.db.query("organizations").order("asc").collect(),
      ctx.db.query("listservs").order("asc").collect(),
      ctx.db
        .query("listservMessages")
        .withIndex("by_received_at")
        .order("desc")
        .take(500),
    ]);

    const sourceEmails = new Set(
      listservs
        .flatMap((source) => [source.listEmail, ...source.senderEmails])
        .map((email) => email.toLowerCase()),
    );
    const unassignedBySender = new Map<
      string,
      {
        senderEmail: string;
        count: number;
        latestReceivedAt: number;
        sampleSubjects: string[];
      }
    >();

    for (const message of messages) {
      const senderEmail = message.senderEmail.toLowerCase();
      if (!senderEmail || sourceEmails.has(senderEmail)) continue;

      const existing = unassignedBySender.get(senderEmail);
      if (existing) {
        existing.count += 1;
        existing.latestReceivedAt = Math.max(
          existing.latestReceivedAt,
          message.receivedAt,
        );
        if (message.subject && existing.sampleSubjects.length < 3) {
          existing.sampleSubjects.push(message.subject);
        }
      } else {
        unassignedBySender.set(senderEmail, {
          senderEmail,
          count: 1,
          latestReceivedAt: message.receivedAt,
          sampleSubjects: message.subject ? [message.subject] : [],
        });
      }
    }

    const unassignedSenders = [...unassignedBySender.values()]
      .map((sender) => ({
        ...sender,
        suggestion: suggestSource(sender.senderEmail),
      }))
      .sort(
        (a, b) => b.count - a.count || b.latestReceivedAt - a.latestReceivedAt,
      );

    return { organizations, listservs, unassignedSenders };
  },
});

export const createOrganization = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    type: ORG_TYPES,
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    return getOrCreateOrganization(ctx, {
      name: args.name,
      type: args.type,
      description: cleanOptional(args.description),
      website: cleanOptional(args.website),
      tags: args.tags ?? [],
    });
  },
});

export const updateOrganization = mutation({
  args: {
    token: v.string(),
    organizationId: v.id("organizations"),
    name: v.string(),
    type: ORG_TYPES,
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.union(v.literal("active"), v.literal("hidden")),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.organizationId, {
      name: args.name.trim(),
      slug: slugify(args.name),
      type: args.type,
      description: cleanOptional(args.description),
      website: cleanOptional(args.website),
      tags: args.tags ?? [],
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const assignSender = mutation({
  args: {
    token: v.string(),
    senderEmail: v.string(),
    organizationId: v.optional(v.id("organizations")),
    organizationName: v.optional(v.string()),
    organizationType: v.optional(ORG_TYPES),
    sourceName: v.optional(v.string()),
    sourceType: v.optional(
      v.union(
        v.literal("lyris"),
        v.literal("campus_groups"),
        v.literal("newsletter"),
        v.literal("direct_email"),
        v.literal("unknown"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const senderEmail = normalizeEmail(args.senderEmail);
    const suggestion = suggestSource(senderEmail);
    const organizationId =
      args.organizationId ??
      (await getOrCreateOrganization(ctx, {
        name:
          cleanOptional(args.organizationName) ?? suggestion.organizationName,
        type: args.organizationType ?? suggestion.organizationType,
        tags: [],
      }));

    const existing = await ctx.db
      .query("listservs")
      .withIndex("by_list_email", (q) => q.eq("listEmail", senderEmail))
      .unique();
    const now = Date.now();
    const sourceFields = {
      name: cleanOptional(args.sourceName) ?? suggestion.sourceName,
      displayName: cleanOptional(args.sourceName) ?? suggestion.sourceName,
      listEmail: senderEmail,
      senderEmails: [senderEmail],
      organizationId,
      sourceType: args.sourceType ?? suggestion.sourceType,
      status: "active" as const,
      joinMethod: "unknown" as const,
      joinStatus: "joined" as const,
      source: "manual" as const,
      updatedAt: now,
    };

    const listservId = existing
      ? existing._id
      : await ctx.db.insert("listservs", { ...sourceFields, createdAt: now });
    if (existing) await ctx.db.patch(existing._id, sourceFields);

    const messages = await ctx.db.query("listservMessages").collect();
    for (const message of messages) {
      if (message.senderEmail.toLowerCase() === senderEmail) {
        await ctx.db.patch(message._id, { listservId, organizationId });
      }
    }

    return { organizationId, listservId };
  },
});

export const ignoreSender = mutation({
  args: {
    token: v.string(),
    senderEmail: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const senderEmail = normalizeEmail(args.senderEmail);

    // If a listservs row already exists, just mark it paused so it stops
    // surfacing in the unassigned list without losing history.
    const existing = await ctx.db
      .query("listservs")
      .withIndex("by_list_email", (q) => q.eq("listEmail", senderEmail))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "paused",
        updatedAt: Date.now(),
      });
      return;
    }

    // For inbox-only senders, create a minimal tombstone row so the sender
    // email is now "known" and won't appear as unrecognized again.
    const suggestion = suggestSource(senderEmail);
    const now = Date.now();
    await ctx.db.insert("listservs", {
      name: suggestion.sourceName,
      displayName: suggestion.sourceName,
      listEmail: senderEmail,
      senderEmails: [senderEmail],
      sourceType: suggestion.sourceType,
      status: "paused",
      joinMethod: "unknown",
      joinStatus: "not_started",
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const unignoreSource = mutation({
  args: {
    token: v.string(),
    listservId: v.id("listservs"),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.listservId, {
      status: "joining",
      updatedAt: Date.now(),
    });
  },
});

export const assignSourceOrganization = mutation({
  args: {
    token: v.string(),
    listservId: v.id("listservs"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.listservId, {
      organizationId: args.organizationId,
      updatedAt: Date.now(),
    });

    const messages = await ctx.db
      .query("listservMessages")
      .withIndex("by_listserv", (q) => q.eq("listservId", args.listservId))
      .collect();
    for (const message of messages) {
      await ctx.db.patch(message._id, { organizationId: args.organizationId });
    }
  },
});

async function getOrCreateOrganization(
  ctx: MutationCtx,
  params: {
    name: string;
    type:
      | "club"
      | "department"
      | "official"
      | "publication"
      | "company"
      | "other";
    description?: string;
    website?: string;
    tags: string[];
  },
): Promise<Id<"organizations">> {
  const name = params.name.trim();
  if (!name) throw new Error("Organization name is required.");

  const slug = slugify(name);
  const existing = await ctx.db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (existing) return existing._id;

  const now = Date.now();
  return ctx.db.insert("organizations", {
    name,
    slug,
    type: params.type,
    description: params.description,
    website: params.website,
    tags: params.tags,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
}

function suggestSource(senderEmail: string) {
  const [local = "", domain = ""] = senderEmail.toLowerCase().split("@");
  const cleanedLocal = local
    .replace(/^owner-/, "")
    .replace(/-request$/, "")
    .replace(/-l$/, "");
  const organizationName = inferName(cleanedLocal || domain);

  if (
    ["list.cornell.edu", "mm.list.cornell.edu", "list.cs.cornell.edu"].includes(
      domain,
    )
  ) {
    return {
      organizationName,
      organizationType: "club" as const,
      sourceName: `${organizationName} Listserv`,
      sourceType: "lyris" as const,
    };
  }

  if (domain === "campusgroups.com") {
    return {
      organizationName,
      organizationType: "club" as const,
      sourceName: `${organizationName} CampusGroups`,
      sourceType: "campus_groups" as const,
    };
  }

  if (
    /substack|beehiiv|mailchimp|mailerlite|ccsend|newsletter/.test(
      domain + local,
    )
  ) {
    return {
      organizationName,
      organizationType: "publication" as const,
      sourceName: `${organizationName} Newsletter`,
      sourceType: "newsletter" as const,
    };
  }

  return {
    organizationName,
    organizationType: domain.endsWith("cornell.edu")
      ? ("official" as const)
      : ("other" as const),
    sourceName: `${organizationName} Email`,
    sourceType: "direct_email" as const,
  };
}

function inferName(value: string) {
  return (
    value
      .split(/[-_.]+/)
      .filter(Boolean)
      .map((part) =>
        part.length <= 4
          ? part.toUpperCase()
          : part.charAt(0).toUpperCase() + part.slice(1),
      )
      .join(" ") || "Unknown Source"
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function cleanOptional(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}
