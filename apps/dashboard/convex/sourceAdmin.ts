import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAdminToken } from "./_shared/adminToken";
import {
  isLegacyLyrisAddress,
  isSimplelistsAddress,
  simplelistsAddressForList,
  subscriptionListNameFrom,
} from "./lib/cornellLists";
import { orgDocValidator, listservDocValidator } from "./lib/docValidators";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

const ORG_TYPES = v.union(
  v.literal("club"),
  v.literal("department"),
  v.literal("official"),
  v.literal("publication"),
  v.literal("company"),
  v.literal("other"),
);

type OrgType =
  | "club"
  | "department"
  | "official"
  | "publication"
  | "company"
  | "other";

/**
 * Upper bound on the never-matched-message scan below.
 *
 * Deliberately low, because `listservMessages` rows carry the full `bodyText`
 * and `bodyHtml` of every email while this query only reads four scalar fields
 * off them. At 2000 the read volume was megabytes per evaluation, and because
 * `overview` is a reactive subscription that re-runs on every relevant write,
 * exceeding Convex's per-query read limit would take the Sources tab down
 * continuously rather than once.
 *
 * Truncation is reported rather than hidden — see `unassignedTruncated`.
 */
const UNASSIGNED_MESSAGE_SCAN_LIMIT = 400;

const SOURCE_TYPES = v.union(
  v.literal("simplelists"),
  v.literal("lyris"),
  v.literal("campus_groups"),
  v.literal("newsletter"),
  v.literal("direct_email"),
  v.literal("unknown"),
);

const SUGGESTION_VALIDATOR = v.object({
  organizationName: v.string(),
  organizationType: ORG_TYPES,
  sourceName: v.string(),
  sourceType: SOURCE_TYPES,
});

export const overview = query({
  args: { token: v.string() },
  returns: v.object({
    organizations: v.array(orgDocValidator),
    listservs: v.array(listservDocValidator),
    unassignedSenders: v.array(
      v.object({
        senderEmail: v.string(),
        // The Cornell list this group's mail was addressed to, when every
        // message in it names one. Absent for direct mail, which stays
        // grouped by its From address exactly as before.
        listAddress: v.optional(v.string()),
        // Every distinct From address folded into this group. One entry for a
        // direct-mail group; one per person for a list group.
        senderEmails: v.array(v.string()),
        count: v.number(),
        latestReceivedAt: v.number(),
        sampleSubjects: v.array(v.string()),
        suggestion: SUGGESTION_VALIDATOR,
      }),
    ),
    // True when the unassigned scan hit its cap, so the groups below describe a
    // slice rather than the whole backlog. Mirrors `reconciliationReport`'s
    // `possiblyTruncated` — an admin must be able to tell "nothing left to
    // assign" apart from "you are looking at the first 400 messages".
    unassignedTruncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const [organizations, listservs, messages] = await Promise.all([
      ctx.db.query("orgs").order("asc").take(ORG_SCAN_LIMIT),
      ctx.db.query("listservs").order("asc").take(LISTSERV_SCAN_LIMIT),
      // Indexed on `listservId === undefined` rather than "the most recent
      // 500 messages" — a sender that only ever sent old mail, buried under
      // 500+ more recent messages from known sources, used to be permanently
      // invisible in the Sources tab. A message only lacks a `listservId` at
      // all when ingestion could not match it to any known source, which is
      // exactly "unassigned" — recency doesn't change that.
      ctx.db
        .query("listservMessages")
        .withIndex("by_listserv", (q) => q.eq("listservId", undefined))
        .order("desc")
        .take(UNASSIGNED_MESSAGE_SCAN_LIMIT),
    ]);

    const sourceEmails = new Set(
      listservs
        .flatMap((source) => [source.listEmail, ...source.senderEmails])
        .map((email) => email.toLowerCase()),
    );
    // Grouped by the list a message was addressed *to*, falling back to the
    // From address only for direct mail that names no list.
    //
    // Grouping by From address is what produced Entrepreneurship's 62
    // `listservs` rows: ~62 students each mailed `eship-l@lists.cornell.edu`,
    // each appeared here as its own unassigned sender, and each `assignSender`
    // click inserted a row keyed on that student's personal address. All of
    // that mail belongs to one list, so it is now one assignable unit.
    const groups = new Map<
      string,
      {
        senderEmail: string;
        listAddress?: string;
        senderEmails: string[];
        count: number;
        latestReceivedAt: number;
        sampleSubjects: string[];
      }
    >();

    for (const message of messages) {
      const senderEmail = message.senderEmail.toLowerCase();
      if (!senderEmail || sourceEmails.has(senderEmail)) continue;

      const listAddress = listAddressForMessage(message);
      const key = listAddress ?? senderEmail;

      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        existing.latestReceivedAt = Math.max(
          existing.latestReceivedAt,
          message.receivedAt,
        );
        if (!existing.senderEmails.includes(senderEmail)) {
          existing.senderEmails.push(senderEmail);
        }
        if (message.subject && existing.sampleSubjects.length < 3) {
          existing.sampleSubjects.push(message.subject);
        }
      } else {
        groups.set(key, {
          // For a list group this is the list address, so the row still has a
          // single stable identity for the existing assign/ignore mutations.
          senderEmail: key,
          listAddress,
          senderEmails: [senderEmail],
          count: 1,
          latestReceivedAt: message.receivedAt,
          sampleSubjects: message.subject ? [message.subject] : [],
        });
      }
    }

    const unassignedSenders = [...groups.values()]
      .map((group) => ({
        ...group,
        // Keyed on the group identity, so a list group suggests the list's own
        // name ("Eship Listserv") rather than whichever student happened to
        // send the first message.
        suggestion: suggestSource(group.senderEmail),
      }))
      .sort(
        (a, b) => b.count - a.count || b.latestReceivedAt - a.latestReceivedAt,
      );

    return {
      organizations,
      listservs,
      unassignedSenders,
      unassignedTruncated: messages.length === UNASSIGNED_MESSAGE_SCAN_LIMIT,
    };
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
    // Only used to widen the duplicate check to email/source addresses —
    // never stored on the org.
    sourceEmail: v.optional(v.string()),
    // Required once findSimilarOrganizations has already returned a fuzzy
    // match for this name/email and the admin chose "create new anyway".
    // Without it, getOrCreateOrg throws instead of silently producing a
    // second org for the same real-world club.
    confirmedNew: v.optional(v.boolean()),
  },
  returns: v.id("orgs"),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    return getOrCreateOrg(ctx, {
      name: args.name,
      type: args.type,
      description: cleanOptional(args.description),
      website: cleanOptional(args.website),
      tags: args.tags ?? [],
      sourceEmail: cleanOptional(args.sourceEmail),
      confirmedNew: args.confirmedNew,
    });
  },
});

const SIMILAR_ORG_MATCH_VALIDATOR = v.object({
  organizationId: v.id("orgs"),
  name: v.string(),
  slug: v.string(),
  matchedOn: v.array(v.string()),
});

export type SimilarOrgMatch = {
  organizationId: Id<"orgs">;
  name: string;
  slug: string;
  matchedOn: string[];
};

/**
 * Read-only preflight for {@link createOrganization}. The Sources tab calls
 * this before ever showing a "create org" button so the admin sees the
 * choice up front; the mutation re-runs the same check server-side so it
 * cannot be bypassed by a caller that skips the query. An exact slug match is
 * never included — {@link getOrCreateOrg} already resolves it by attaching to
 * that org, so it is not a duplicate risk worth interrupting the admin for.
 */
export const findSimilarOrganizations = query({
  args: {
    token: v.string(),
    name: v.string(),
    sourceEmail: v.optional(v.string()),
  },
  returns: v.array(SIMILAR_ORG_MATCH_VALIDATOR),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    return similarOrganizations(ctx, args.name, args.sourceEmail);
  },
});

export const updateOrganization = mutation({
  args: {
    token: v.string(),
    organizationId: v.id("orgs"),
    name: v.string(),
    type: ORG_TYPES,
    description: v.optional(v.string()),
    website: v.optional(v.string()),
    email: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.union(v.literal("active"), v.literal("hidden")),
    // Convex storage IDs for images — when provided the permanent URL is
    // resolved and stored; pass null to explicitly clear a field.
    avatarStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    coverStorageId: v.optional(v.union(v.id("_storage"), v.null())),
    isVerified: v.optional(v.boolean()),
    loopSummary: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    // Resolve storage IDs to permanent URLs if supplied.
    let avatarUrl: string | null | undefined = undefined; // undefined = don't touch
    if (args.avatarStorageId !== undefined) {
      avatarUrl =
        args.avatarStorageId !== null
          ? await ctx.storage.getUrl(args.avatarStorageId)
          : null;
    }
    let coverImageUrl: string | null | undefined = undefined;
    if (args.coverStorageId !== undefined) {
      coverImageUrl =
        args.coverStorageId !== null
          ? await ctx.storage.getUrl(args.coverStorageId)
          : null;
    }

    const patch: Record<string, unknown> = {
      name: args.name.trim(),
      slug: slugify(args.name),
      orgType: args.type,
      description: cleanOptional(args.description) ?? "",
      websiteUrl: cleanOptional(args.website) ?? undefined,
      email: cleanOptional(args.email) ?? undefined,
      tags: (args.tags ?? []).map((t) => t.trim()).filter(Boolean),
      orgStatus: args.status,
      isVerified: args.isVerified ?? false,
      updatedAt: Date.now(),
    };
    if (loopSummaryClean(args.loopSummary) !== undefined) {
      patch.loopSummary = loopSummaryClean(args.loopSummary);
    }
    if (avatarUrl !== undefined) {
      patch.avatarUrl = avatarUrl ?? undefined;
    }
    if (coverImageUrl !== undefined) {
      patch.coverImageUrl = coverImageUrl ?? undefined;
    }

    await ctx.db.patch(args.organizationId, patch);
    return null;
  },
});

/** Generate a short-lived upload URL for org images (avatar or cover). */
export const generateOrgImageUploadUrl = mutation({
  args: { token: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    return await ctx.storage.generateUploadUrl();
  },
});

export const assignSender = mutation({
  args: {
    token: v.string(),
    // The group's identity: a Cornell list address for list mail, or the From
    // address for direct mail. Becomes the row's `listEmail`.
    senderEmail: v.string(),
    // Every From address observed in the group. For a list group this is the
    // ~62 students who post to it; they become aliases on the single row
    // instead of 62 rows of their own.
    senderEmails: v.optional(v.array(v.string())),
    // Set when this group came from list mail. Scopes the message backfill to
    // mail actually addressed to this list, so a student who posts to two
    // lists does not drag their other list's mail along.
    listAddress: v.optional(v.string()),
    organizationId: v.optional(v.id("orgs")),
    organizationName: v.optional(v.string()),
    organizationType: v.optional(ORG_TYPES),
    sourceName: v.optional(v.string()),
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
    // Same purpose as on createOrganization: only reached when the caller
    // omits organizationId and asks this mutation to create one itself.
    confirmedNewOrg: v.optional(v.boolean()),
  },
  returns: v.object({
    organizationId: v.id("orgs"),
    listservId: v.id("listservs"),
  }),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const senderEmail = normalizeEmail(args.senderEmail);
    const suggestion = suggestSource(senderEmail);
    const organizationId =
      args.organizationId ??
      (await getOrCreateOrg(ctx, {
        name:
          cleanOptional(args.organizationName) ?? suggestion.organizationName,
        type: args.organizationType ?? suggestion.organizationType,
        tags: [],
        sourceEmail: senderEmail,
        confirmedNew: args.confirmedNewOrg,
      }));

    const existing = await findListservByAnyAddress(ctx, senderEmail);
    const now = Date.now();
    const groupSenders = (args.senderEmails ?? []).map(normalizeEmail);
    const sourceName = cleanOptional(args.sourceName) ?? suggestion.sourceName;

    const sourceFields = {
      // Provenance is preserved rather than overwritten. Attaching an alias to
      // a row that directory discovery found used to rewrite it to
      // `source: "manual"`, force `joinStatus: "joined"` whether or not a join
      // ever happened, and replace the directory's real name with a guess
      // derived from an email local part.
      name: existing?.name ?? sourceName,
      displayName: existing?.displayName ?? sourceName,
      listEmail: existing?.listEmail ?? senderEmail,
      // Union rather than replace: senderEmails accumulates aliases observed
      // for this source, and overwriting it loses every one of them.
      senderEmails: [
        ...new Set([
          ...(existing?.senderEmails ?? []).map(normalizeEmail),
          senderEmail,
          ...groupSenders,
        ]),
      ],
      organizationId,
      sourceType:
        existing?.sourceType ?? args.sourceType ?? suggestion.sourceType,
      status: "active" as const,
      joinMethod: existing?.joinMethod ?? ("unknown" as const),
      // Mail is arriving, so we are demonstrably subscribed — but only claim
      // that for a row we are creating here. An existing row's join history is
      // more trustworthy than this inference.
      joinStatus: existing?.joinStatus ?? ("joined" as const),
      source: existing?.source ?? ("manual" as const),
      updatedAt: now,
    };

    const listservId = existing
      ? existing._id
      : await ctx.db.insert("listservs", { ...sourceFields, createdAt: now });
    if (existing) await ctx.db.patch(existing._id, sourceFields);

    // Every From address in the group, plus the identity itself for direct
    // mail where they are the same thing.
    const backfillAddresses = [...new Set([senderEmail, ...groupSenders])];
    for (const address of backfillAddresses) {
      await backfillMessagesForSender(ctx, address, {
        listservId,
        organizationId,
        listAddress: args.listAddress ? normalizeEmail(args.listAddress) : null,
      });
    }

    return { organizationId, listservId };
  },
});

export const ignoreSender = mutation({
  args: {
    token: v.string(),
    senderEmail: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const senderEmail = normalizeEmail(args.senderEmail);

    // If a listservs row already exists, just mark it paused so it stops
    // surfacing in the unassigned list without losing history.
    const existing = await findListservByAnyAddress(ctx, senderEmail);

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "paused",
        updatedAt: Date.now(),
      });
      return null;
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
    return null;
  },
});

export const unignoreSource = mutation({
  args: {
    token: v.string(),
    listservId: v.id("listservs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.listservId, {
      status: "joining",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const assignSourceOrganization = mutation({
  args: {
    token: v.string(),
    listservId: v.id("listservs"),
    organizationId: v.id("orgs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.listservId, {
      organizationId: args.organizationId,
      updatedAt: Date.now(),
    });

    await runListservOrgBackfillBatch(ctx, {
      listservId: args.listservId,
      organizationId: args.organizationId,
      cursor: null,
    });
    return null;
  },
});

/**
 * Upper bound on unindexed `listservs` scans in this file (the `overview`
 * dashboard read, the `senderEmails` scan below, and the fuzzy-match scan in
 * {@link similarOrganizations}). The table holds fewer than a hundred rows
 * today; this exists so those queries stay bounded if that changes.
 */
/**
 * Raised from 500 because directory discovery seeds roughly 600 candidates, and
 * approving them creates `listservs` rows. Past the cap this file fails
 * silently and in three separate ways: `overview` truncates `sourceEmails` so
 * already-assigned senders reappear as unassigned, `findListservByAnyAddress`
 * misses an alias and inserts a duplicate row instead of patching, and the
 * duplicate-org guard stops matching the orgs it exists to catch. Listserv rows
 * carry no message bodies, so a larger bound is cheap.
 */
const LISTSERV_SCAN_LIMIT = 2000;

/**
 * Find the source that owns an address, checking `senderEmails` as well as
 * `listEmail`. Looking only at `listEmail` means an address we have already
 * seen as an alias produces a duplicate row on assign, and silently fails to
 * pause anything on ignore.
 *
 * `by_list_email` carries no uniqueness constraint, so the indexed lookup
 * takes the first match rather than throwing on duplicates. `senderEmails` is
 * an unindexed array field, so that half is a bounded scan — a conscious
 * trade at this table size.
 */
async function findListservByAnyAddress(ctx: MutationCtx, email: string) {
  const byListEmail = await ctx.db
    .query("listservs")
    .withIndex("by_list_email", (q) => q.eq("listEmail", email))
    .first();
  if (byListEmail) return byListEmail;

  const rows = await ctx.db.query("listservs").take(LISTSERV_SCAN_LIMIT);
  return (
    rows.find((row) =>
      row.senderEmails.some((value) => normalizeEmail(value) === email),
    ) ?? null
  );
}

/**
 * Upper bound on unindexed `orgs` scans in this file (the `overview`
 * dashboard read and the fuzzy-match scan in {@link similarOrganizations}),
 * mirroring {@link LISTSERV_SCAN_LIMIT}: the table holds well under this
 * today.
 */
const ORG_SCAN_LIMIT = 500;

/**
 * Fuzzy-matches a candidate org name (and, optionally, the local part of a
 * source address) against every existing org — by exact slug, by acronym in
 * either direction (`"ACSU"` vs `"Association of Computer Science
 * Undergraduates"`), by close spelling, and by a shared source-address local
 * part on one of the org's existing `listservs` rows.
 */
async function similarOrganizations(
  ctx: MutationCtx | QueryCtx,
  name: string,
  sourceEmail: string | undefined,
): Promise<SimilarOrgMatch[]> {
  const candidateName = name.trim();
  if (!candidateName) return [];

  const candidateSlug = slugify(candidateName);
  const candidateNormalized = normalizeForMatch(candidateName);
  const candidateAcronym = acronymOf(candidateName);
  const candidateLocal = sourceEmail
    ? stripAddressSuffixes(normalizeEmail(sourceEmail).split("@")[0] ?? "")
    : "";

  const [orgs, listservs] = await Promise.all([
    ctx.db.query("orgs").take(ORG_SCAN_LIMIT),
    ctx.db.query("listservs").take(LISTSERV_SCAN_LIMIT),
  ]);

  const listservsByOrg = new Map<Id<"orgs">, string[]>();
  for (const row of listservs) {
    if (!row.organizationId) continue;
    const locals = [row.listEmail, ...row.senderEmails].map((address) =>
      stripAddressSuffixes(normalizeEmail(address).split("@")[0] ?? ""),
    );
    const existingLocals = listservsByOrg.get(row.organizationId) ?? [];
    listservsByOrg.set(row.organizationId, [...existingLocals, ...locals]);
  }

  const matches: SimilarOrgMatch[] = [];
  for (const org of orgs) {
    const reasons: string[] = [];
    const orgSlug = org.slug;
    const orgNormalized = normalizeForMatch(org.name);
    const orgAcronym = acronymOf(org.name);

    if (orgSlug === candidateSlug) {
      // getOrCreateOrg already resolves this by attaching to the existing
      // org before this function is ever called from there, and it is not a
      // duplicate risk worth surfacing to the admin from
      // findSimilarOrganizations either — it is the same org, not a
      // different one that merely looks similar.
      continue;
    } else if (orgNormalized === candidateNormalized) {
      reasons.push("name matches exactly under a different slug");
    } else {
      if (
        candidateNormalized.length >= 2 &&
        orgAcronym === candidateNormalized
      ) {
        reasons.push(
          `"${candidateName}" looks like an acronym of "${org.name}"`,
        );
      }
      if (orgNormalized.length >= 2 && candidateAcronym === orgNormalized) {
        reasons.push(
          `"${org.name}" looks like an acronym of "${candidateName}"`,
        );
      }
      const spellingDistance = levenshteinDistance(
        candidateNormalized,
        orgNormalized,
      );
      const spellingThreshold = Math.max(
        1,
        Math.floor(
          Math.min(candidateNormalized.length, orgNormalized.length) / 4,
        ),
      );
      if (
        candidateNormalized.length >= 4 &&
        orgNormalized.length >= 4 &&
        spellingDistance > 0 &&
        spellingDistance <= spellingThreshold
      ) {
        reasons.push("name is a close spelling match");
      }
    }

    if (candidateLocal) {
      const orgLocals = listservsByOrg.get(org._id) ?? [];
      if (orgLocals.includes(candidateLocal)) {
        reasons.push(
          `shares the "${candidateLocal}" source address with an existing listserv`,
        );
      }
    }

    if (reasons.length > 0) {
      matches.push({
        organizationId: org._id,
        name: org.name,
        slug: org.slug,
        matchedOn: reasons,
      });
    }
  }

  return matches;
}

/** Lowercased, alphanumeric-only — for comparing names irrespective of punctuation/casing. */
function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** First letter of each word, e.g. "Association of CS Undergrads" -> "aocu". */
function acronymOf(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .toLowerCase();
}

/** Strips the address-role suffixes that decorate a list's local part without changing which list it is. */
function stripAddressSuffixes(local: string) {
  return local
    .replace(/^owner-/, "")
    .replace(/-(account-manager|manager|request|l|list)$/, "");
}

/** Classic edit-distance, computed with a rolling single row (no 2D array indexing to trip strict mode). */
function levenshteinDistance(a: string, b: string): number {
  let previousRow: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    const currentRow: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      const insertion = (currentRow[j - 1] ?? Infinity) + 1;
      const deletion = (previousRow[j] ?? Infinity) + 1;
      const substitution = (previousRow[j - 1] ?? Infinity) + substitutionCost;
      currentRow.push(Math.min(insertion, deletion, substitution));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length] ?? Math.max(a.length, b.length);
}

async function getOrCreateOrg(
  ctx: MutationCtx,
  params: {
    name: string;
    type: OrgType;
    description?: string;
    website?: string;
    tags: string[];
    sourceEmail?: string;
    confirmedNew?: boolean;
  },
): Promise<Id<"orgs">> {
  const name = params.name.trim();
  if (!name) throw new Error("Organization name is required.");

  const slug = slugify(name);
  const existing = await ctx.db
    .query("orgs")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
  if (existing) return existing._id;

  if (!params.confirmedNew) {
    const matches = await similarOrganizations(ctx, name, params.sourceEmail);
    // An exact slug match never reaches here — it was already returned
    // above. Everything left is a *fuzzy* match (acronym, near-spelling, or
    // a shared source address under a different name), which is exactly the
    // case that would otherwise create a silent duplicate org, so it forces
    // an explicit choice.
    if (matches.length > 0) {
      throw new Error(
        `"${name}" looks similar to existing organization(s): ${matches
          .map((match) => match.name)
          .join(
            ", ",
          )}. Attach to one of those instead, or pass confirmedNew: true to create anyway.`,
      );
    }
  }

  const now = Date.now();
  return ctx.db.insert("orgs", {
    name,
    slug,
    orgType: params.type,
    description: params.description ?? "",
    websiteUrl: params.website,
    tags: params.tags,
    isVerified: false,
    orgStatus: "active",
    updatedAt: now,
  });
}

/**
 * Messages patched per transaction by the two backfills below.
 *
 * `listservMessages` documents carry full email bodies, so a batch's cost is
 * driven by body length. Both backfills used to `.collect()` the whole set and
 * patch it in one transaction, which is unbounded in the size of a list's
 * archive — fine for a new source, and a hard failure for a busy one.
 */
const BACKFILL_BATCH_SIZE = 200;

/**
 * Attributes a sender's not-yet-attributed mail to a listserv and org.
 *
 * Only touches messages with no `listservId`: a message that already resolved
 * to some other source is correctly attributed there, and re-pointing it would
 * silently move another list's history. When `listAddress` is set the backfill
 * is further narrowed to mail addressed to that list, so assigning a student
 * who posts to two lists does not drag the other list's mail along.
 *
 * The first page runs inline so a small source is fully assigned by the time
 * the mutation returns; anything larger continues in scheduled batches.
 */
async function backfillMessagesForSender(
  ctx: MutationCtx,
  senderEmail: string,
  target: {
    listservId: Id<"listservs">;
    organizationId: Id<"orgs">;
    listAddress: string | null;
  },
) {
  await runSenderBackfillBatch(ctx, {
    senderEmail,
    ...target,
    cursor: null,
  });
}

type SenderBackfillArgs = {
  senderEmail: string;
  listservId: Id<"listservs">;
  organizationId: Id<"orgs">;
  listAddress: string | null;
  cursor: string | null;
};

async function runSenderBackfillBatch(
  ctx: MutationCtx,
  args: SenderBackfillArgs,
) {
  // Paginated rather than repeatedly `.take()`-ing the head of the index:
  // patching a message does not remove it from `by_sender_email`, so a
  // take-based drain would re-read the same rows forever.
  const page = await ctx.db
    .query("listservMessages")
    .withIndex("by_sender_email", (q) => q.eq("senderEmail", args.senderEmail))
    .paginate({ numItems: BACKFILL_BATCH_SIZE, cursor: args.cursor });

  for (const message of page.page) {
    if (message.listservId) continue;
    if (
      args.listAddress &&
      listAddressForMessage(message) !== args.listAddress
    ) {
      continue;
    }
    await ctx.db.patch(message._id, {
      listservId: args.listservId,
      organizationId: args.organizationId,
    });
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.sourceAdmin.backfillSenderMessages,
      { ...args, cursor: page.continueCursor },
    );
  }
}

export const backfillSenderMessages = internalMutation({
  args: {
    senderEmail: v.string(),
    listservId: v.id("listservs"),
    organizationId: v.id("orgs"),
    listAddress: v.union(v.string(), v.null()),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runSenderBackfillBatch(ctx, args);
    return null;
  },
});

async function runListservOrgBackfillBatch(
  ctx: MutationCtx,
  args: {
    listservId: Id<"listservs">;
    organizationId: Id<"orgs">;
    cursor: string | null;
  },
) {
  const page = await ctx.db
    .query("listservMessages")
    .withIndex("by_listserv", (q) => q.eq("listservId", args.listservId))
    .paginate({ numItems: BACKFILL_BATCH_SIZE, cursor: args.cursor });

  for (const message of page.page) {
    if (message.organizationId === args.organizationId) continue;
    await ctx.db.patch(message._id, { organizationId: args.organizationId });
  }

  if (!page.isDone) {
    await ctx.scheduler.runAfter(
      0,
      internal.sourceAdmin.backfillListservOrganization,
      { ...args, cursor: page.continueCursor },
    );
  }
}

export const backfillListservOrganization = internalMutation({
  args: {
    listservId: v.id("listservs"),
    organizationId: v.id("orgs"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await runListservOrgBackfillBatch(ctx, args);
    return null;
  },
});

/**
 * The Cornell list address a message was sent to, or undefined when it names
 * none.
 *
 * Looks at the same recipient signals `matchListserv` uses, in the same order,
 * so the Sources tab groups mail exactly the way ingestion will attribute it
 * once a row exists. `subscriptionListNameFrom` unwraps Simplelists' `-manager`
 * and `-account-manager` aliases, so administrative mail about a list groups
 * with the list itself rather than forming a second row.
 */
function listAddressForMessage(message: Doc<"listservMessages">) {
  const recipients = [
    ...message.to,
    ...message.cc,
    ...extractHeaderEmails(message.headers, "list-id"),
    ...extractHeaderEmails(message.headers, "delivered-to"),
  ];

  for (const recipient of recipients) {
    const listName = subscriptionListNameFrom(recipient);
    if (!listName) continue;
    const address = isLegacyLyrisAddress(recipient)
      ? normalizeEmail(recipient)
      : simplelistsAddressForList(listName);
    if (address) return address;
  }
  return undefined;
}

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/**
 * `List-Id` carries a dotted pseudo-address (`<eship-l.lists.cornell.edu>`) as
 * often as a real one, so addresses are pulled out by pattern rather than
 * assuming the whole header value is one.
 */
function extractHeaderEmails(
  headers: ReadonlyArray<{ name: string; value: string }>,
  name: string,
) {
  return headers
    .filter((header) => header.name.toLowerCase() === name)
    .flatMap((header) => header.value.match(EMAIL_PATTERN) ?? [])
    .map(normalizeEmail);
}

function suggestSource(senderEmail: string) {
  const [local = "", domain = ""] = senderEmail.toLowerCase().split("@");
  const cleanedLocal = local
    .replace(/^owner-/, "")
    .replace(/-request$/, "")
    .replace(/-l$/, "");
  const organizationName = inferName(cleanedLocal || domain);

  if (isLegacyLyrisAddress(senderEmail)) {
    return {
      organizationName,
      organizationType: "club" as const,
      sourceName: `${organizationName} Listserv`,
      sourceType: "lyris" as const,
    };
  }

  if (isSimplelistsAddress(senderEmail)) {
    return {
      organizationName,
      organizationType: "club" as const,
      sourceName: `${organizationName} Listserv`,
      sourceType: "simplelists" as const,
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

/** Returns the trimmed loop summary, or undefined if blank (to omit from patch). */
function loopSummaryClean(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}
