import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAdminToken } from "./_shared/adminToken";
import { completeJson, formatError, getAIConfig, isRecord } from "./lib/ai";
import { isListAdminNoise } from "./lib/cornellLists";
import {
  orgDocValidator,
  orgProfileDraftDocValidator,
} from "./lib/docValidators";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";

// The org parser is a manual, admin-triggered pass over an org's listserv mail
// that proposes the profile fields an org page needs (description, Loop
// summary, tags, website, contact email, avatar/cover images). Output lands in
// `orgProfileDrafts`; an admin reviews it in the Orgs tab and publishes the
// fields they want onto the `orgs` row.

/**
 * Messages read from the index per run, before admin-noise filtering. Kept
 * low because each row carries the full, uncapped `bodyHtml` of the email,
 * and newsletter HTML can run to hundreds of KB.
 */
const MESSAGE_SCAN_LIMIT = 20;
/** Messages actually sent to the model. */
const MAX_MESSAGES_PER_ORG = 15;
/** Per-message body budget, keeping the whole prompt well inside context. */
const BODY_CHAR_LIMIT = 3000;
const LINKS_PER_MESSAGE = 20;
const RECENT_EVENT_LIMIT = 20;
const MAX_IMAGE_CANDIDATES = 12;
/** Below this many usable emails, the draft is flagged as thin. */
const LOW_DATA_THRESHOLD = 3;
const MAX_TAGS = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ORG_SCAN_LIMIT = 500;
const LISTSERV_SCAN_LIMIT = 2000;

const SYSTEM_PROMPT =
  "You write public profile copy for Cornell student organizations based on the emails they send. Return JSON only.";

const imageCandidateValidator = v.object({
  url: v.string(),
  alt: v.optional(v.string()),
  occurrences: v.number(),
});

type ImageCandidate = {
  url: string;
  alt?: string;
  occurrences: number;
};

const enrichmentMessageValidator = v.object({
  _id: v.id("listservMessages"),
  subject: v.string(),
  senderEmail: v.string(),
  receivedAt: v.number(),
  bodyText: v.string(),
  links: v.array(v.string()),
});

type EnrichmentMessage = {
  _id: Id<"listservMessages">;
  subject: string;
  senderEmail: string;
  receivedAt: number;
  bodyText: string;
  links: string[];
};

const enrichmentInputValidator = v.object({
  org: orgDocValidator,
  messages: v.array(enrichmentMessageValidator),
  imageCandidates: v.array(imageCandidateValidator),
  recentEvents: v.array(
    v.object({ title: v.string(), aiDescription: v.string() }),
  ),
});

type EnrichmentInput = {
  org: Doc<"orgs">;
  messages: EnrichmentMessage[];
  imageCandidates: ImageCandidate[];
  recentEvents: Array<{ title: string; aiDescription: string }>;
};

type NormalizedProfile = {
  description?: string;
  loopSummary?: string;
  tags: string[];
  websiteUrl?: string;
  email?: string;
  suggestedAvatarUrl?: string;
  suggestedCoverUrl?: string;
  confidence: number;
  warnings: string[];
};

const overviewRowValidator = v.object({
  org: orgDocValidator,
  sourceCount: v.number(),
  lastReceivedAt: v.optional(v.number()),
  missingFields: v.array(v.string()),
  draft: v.union(orgProfileDraftDocValidator, v.null()),
});

// ─── Public (admin-token) API ────────────────────────────────────────────────

/**
 * Every org with what its public page is missing, its source count, and its
 * open draft (if any). Never reads `listservMessages` — those rows carry full
 * email bodies and this is a reactive subscription.
 */
export const overview = query({
  args: { token: v.string() },
  returns: v.array(overviewRowValidator),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const [orgs, listservs, drafts] = await Promise.all([
      ctx.db.query("orgs").order("asc").take(ORG_SCAN_LIMIT),
      ctx.db.query("listservs").take(LISTSERV_SCAN_LIMIT),
      ctx.db
        .query("orgProfileDrafts")
        .withIndex("by_status", (q) => q.eq("status", "draft"))
        .take(ORG_SCAN_LIMIT),
    ]);

    const sourcesByOrg = new Map<
      Id<"orgs">,
      { count: number; lastReceivedAt?: number }
    >();
    for (const listserv of listservs) {
      if (!listserv.organizationId || listserv.status === "paused") continue;
      const entry = sourcesByOrg.get(listserv.organizationId) ?? { count: 0 };
      entry.count += 1;
      if (
        listserv.lastReceivedAt !== undefined &&
        (entry.lastReceivedAt === undefined ||
          listserv.lastReceivedAt > entry.lastReceivedAt)
      ) {
        entry.lastReceivedAt = listserv.lastReceivedAt;
      }
      sourcesByOrg.set(listserv.organizationId, entry);
    }

    const draftByOrg = new Map(drafts.map((draft) => [draft.orgId, draft]));

    return orgs
      .filter((org) => !org.isSeed)
      .map((org) => {
        const sources = sourcesByOrg.get(org._id);
        return {
          org,
          sourceCount: sources?.count ?? 0,
          lastReceivedAt: sources?.lastReceivedAt,
          missingFields: missingProfileFields(org),
          draft: draftByOrg.get(org._id) ?? null,
        };
      });
  },
});

/**
 * Run the org parser for one org and store the result as its draft,
 * replacing any open draft (this doubles as "reparse").
 */
export const runEnrichment = action({
  args: { token: v.string(), orgId: v.id("orgs") },
  returns: v.object({
    draftId: v.id("orgProfileDrafts"),
    messagesUsed: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ draftId: Id<"orgProfileDrafts">; messagesUsed: number }> => {
    requireAdminToken(args.token);

    const input: EnrichmentInput | null = await ctx.runQuery(
      internal.orgEnrichment.getEnrichmentInput,
      { orgId: args.orgId },
    );
    if (!input) throw new Error("Organization not found.");
    if (input.messages.length === 0) {
      throw new Error(
        "No usable emails for this organization yet. Assign a source and ingest mail first.",
      );
    }

    const config = getAIConfig();
    const result = await completeJson(
      config,
      SYSTEM_PROMPT,
      buildPrompt(input),
    );
    const profile = normalizeProfile(result.data, input);
    if (input.messages.length < LOW_DATA_THRESHOLD) {
      profile.warnings.unshift(
        `Only ${input.messages.length} email${input.messages.length === 1 ? "" : "s"} available — fields may be thin. Reparse once more mail arrives.`,
      );
    }

    const draftId: Id<"orgProfileDrafts"> = await ctx.runMutation(
      internal.orgEnrichment.storeDraft,
      {
        orgId: args.orgId,
        description: profile.description,
        loopSummary: profile.loopSummary,
        tags: profile.tags,
        websiteUrl: profile.websiteUrl,
        email: profile.email,
        imageCandidates: input.imageCandidates,
        suggestedAvatarUrl: profile.suggestedAvatarUrl,
        suggestedCoverUrl: profile.suggestedCoverUrl,
        sourceMessageIds: input.messages.map((message) => message._id),
        confidence: profile.confidence,
        warnings: profile.warnings,
        provider: result.provider,
        model: result.model,
      },
    );
    return { draftId, messagesUsed: input.messages.length };
  },
});

/**
 * Apply the admin-reviewed fields of a draft to its org. Only fields present
 * in `fields` are written, so anything already curated by hand survives.
 * Chosen images must be one of the draft's candidates; they're downloaded
 * into Convex storage rather than hotlinked.
 */
export const publishDraft = action({
  args: {
    token: v.string(),
    draftId: v.id("orgProfileDrafts"),
    fields: v.object({
      description: v.optional(v.string()),
      loopSummary: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      websiteUrl: v.optional(v.string()),
      email: v.optional(v.string()),
      avatarImageUrl: v.optional(v.string()),
      coverImageUrl: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    requireAdminToken(args.token);

    const draft: Doc<"orgProfileDrafts"> | null = await ctx.runQuery(
      internal.orgEnrichment.getDraft,
      { draftId: args.draftId },
    );
    if (!draft || draft.status !== "draft") {
      throw new Error("This draft is no longer open.");
    }

    const { avatarImageUrl, coverImageUrl, ...textFields } = args.fields;
    const candidateUrls = new Set(draft.imageCandidates.map((c) => c.url));
    for (const url of [avatarImageUrl, coverImageUrl]) {
      if (url !== undefined && !candidateUrls.has(url)) {
        throw new Error("Images must be chosen from the draft's candidates.");
      }
    }

    const stored: Id<"_storage">[] = [];
    try {
      const avatarStorageId = avatarImageUrl
        ? await storeRemoteImage(ctx, avatarImageUrl)
        : undefined;
      if (avatarStorageId) stored.push(avatarStorageId);
      const coverStorageId = coverImageUrl
        ? await storeRemoteImage(ctx, coverImageUrl)
        : undefined;
      if (coverStorageId) stored.push(coverStorageId);

      await ctx.runMutation(internal.orgEnrichment.applyDraft, {
        draftId: args.draftId,
        ...textFields,
        avatarStorageId,
        coverStorageId,
      });
    } catch (error) {
      // Don't leave orphaned uploads behind when the publish didn't land.
      await Promise.all(stored.map((id) => ctx.storage.delete(id)));
      throw error;
    }
    return null;
  },
});

export const discardDraft = mutation({
  args: { token: v.string(), draftId: v.id("orgProfileDrafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.status !== "draft") return null;
    await ctx.db.patch(args.draftId, {
      status: "discarded",
      updatedAt: Date.now(),
    });
    return null;
  },
});

// ─── Internal ────────────────────────────────────────────────────────────────

export const getEnrichmentInput = internalQuery({
  args: { orgId: v.id("orgs") },
  returns: v.union(enrichmentInputValidator, v.null()),
  handler: async (ctx, args): Promise<EnrichmentInput | null> => {
    const org = await ctx.db.get(args.orgId);
    if (!org) return null;

    const [rawMessages, events] = await Promise.all([
      ctx.db
        .query("listservMessages")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .order("desc")
        .take(MESSAGE_SCAN_LIMIT),
      ctx.db
        .query("events")
        .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
        .order("desc")
        .take(RECENT_EVENT_LIMIT),
    ]);

    const usable = rawMessages
      .filter((message) => !isListAdminNoise(message))
      .slice(0, MAX_MESSAGES_PER_ORG);

    return {
      org,
      messages: usable.map((message) => ({
        _id: message._id,
        subject: message.subject,
        senderEmail: message.senderEmail,
        receivedAt: message.receivedAt,
        bodyText: (
          message.bodyText.trim() || htmlToText(message.bodyHtml)
        ).slice(0, BODY_CHAR_LIMIT),
        links: extractLinks(`${message.bodyText}\n${message.bodyHtml}`).slice(
          0,
          LINKS_PER_MESSAGE,
        ),
      })),
      imageCandidates: collectImageCandidates(
        usable.map((message) => message.bodyHtml),
      ),
      recentEvents: events
        .filter((event) => event.visibility !== "hidden")
        .map((event) => ({
          title: event.title,
          aiDescription: event.aiDescription,
        })),
    };
  },
});

export const getDraft = internalQuery({
  args: { draftId: v.id("orgProfileDrafts") },
  returns: v.union(orgProfileDraftDocValidator, v.null()),
  handler: async (ctx, args) => ctx.db.get(args.draftId),
});

export const storeDraft = internalMutation({
  args: {
    orgId: v.id("orgs"),
    description: v.optional(v.string()),
    loopSummary: v.optional(v.string()),
    tags: v.array(v.string()),
    websiteUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    imageCandidates: v.array(imageCandidateValidator),
    suggestedAvatarUrl: v.optional(v.string()),
    suggestedCoverUrl: v.optional(v.string()),
    sourceMessageIds: v.array(v.id("listservMessages")),
    confidence: v.number(),
    warnings: v.array(v.string()),
    provider: v.union(v.literal("openai"), v.literal("gemini")),
    model: v.string(),
  },
  returns: v.id("orgProfileDrafts"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const status: Doc<"orgProfileDrafts">["status"] = "draft";
    const fields = {
      ...args,
      status,
      messagesUsed: args.sourceMessageIds.length,
      updatedAt: now,
    };
    const existing = await ctx.db
      .query("orgProfileDrafts")
      .withIndex("by_org_and_status", (q) =>
        q.eq("orgId", args.orgId).eq("status", "draft"),
      )
      .first();
    if (existing) {
      await ctx.db.replace(existing._id, {
        ...fields,
        createdAt: existing.createdAt,
      });
      return existing._id;
    }
    return ctx.db.insert("orgProfileDrafts", { ...fields, createdAt: now });
  },
});

export const applyDraft = internalMutation({
  args: {
    draftId: v.id("orgProfileDrafts"),
    description: v.optional(v.string()),
    loopSummary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    websiteUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    coverStorageId: v.optional(v.id("_storage")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.status !== "draft") {
      throw new Error("This draft is no longer open.");
    }

    const patch: Partial<Doc<"orgs">> = { updatedAt: Date.now() };
    const description = cleanText(args.description);
    if (description) patch.description = description;
    const loopSummary = cleanText(args.loopSummary);
    if (loopSummary) patch.loopSummary = loopSummary;
    if (args.tags) patch.tags = normalizeTags(args.tags);
    if (args.websiteUrl !== undefined) {
      const websiteUrl = cleanUrl(args.websiteUrl);
      if (!websiteUrl) throw new Error("Website must be an http(s) URL.");
      patch.websiteUrl = websiteUrl;
    }
    if (args.email !== undefined) {
      const email = cleanEmail(args.email);
      if (!email) throw new Error("Contact email is not a valid address.");
      patch.email = email;
    }
    if (args.avatarStorageId) {
      patch.avatarUrl =
        (await ctx.storage.getUrl(args.avatarStorageId)) ?? undefined;
    }
    if (args.coverStorageId) {
      patch.coverImageUrl =
        (await ctx.storage.getUrl(args.coverStorageId)) ?? undefined;
    }

    await ctx.db.patch(draft.orgId, patch);
    await ctx.db.patch(draft._id, {
      status: "published",
      updatedAt: Date.now(),
    });
    return null;
  },
});

// ─── Prompt + normalization ──────────────────────────────────────────────────

function buildPrompt(input: EnrichmentInput) {
  const { org } = input;
  const payload = {
    organization: {
      name: org.name,
      type: org.orgType,
      currentDescription: org.description || null,
      currentLoopSummary: org.loopSummary ?? null,
      currentTags: org.tags,
      currentWebsite: org.websiteUrl ?? null,
      currentEmail: org.email ?? null,
    },
    recentEventTitles: input.recentEvents,
    imageCandidates: input.imageCandidates.map((candidate) => ({
      url: candidate.url,
      alt: candidate.alt ?? null,
      appearsInEmails: candidate.occurrences,
    })),
    emails: input.messages.map((message) => ({
      subject: message.subject,
      from: message.senderEmail,
      receivedAt: new Date(message.receivedAt).toISOString(),
      body: message.bodyText,
      links: message.links,
    })),
  };

  return `Using only the emails below, propose profile fields for this Cornell organization's page on Loop, a campus event-discovery app. Do not invent details: if the emails don't support a field, return null (or [] for tags). The "current*" values are what the page shows today; improve on them, but don't contradict them without evidence.

Return this exact shape:
{
  "description": string | null,
  "loopSummary": string | null,
  "tags": string[],
  "websiteUrl": string | null,
  "email": string | null,
  "avatarImageUrl": string | null,
  "coverImageUrl": string | null,
  "confidence": number,
  "warnings": string[]
}

Field rules:
- description: 1–2 sentences in the org's own voice describing who they are and what they do. No event specifics or dates.
- loopSummary: one sentence, third person, summarizing what members get from following the org (e.g. "WICC runs mentorship circles, tech talks, and social events for women and non-binary folks in CS.").
- tags: up to ${MAX_TAGS} short Title Case topic tags (e.g. "Tech", "Mentorship", "Career", "Arts").
- websiteUrl: the org's own homepage only, copied exactly from the emails. Not a form, event page, social link, or a Cornell-wide page.
- email: the org's public contact address, copied exactly from the emails. Not a listserv or list-manager address, and not a personal address unless it's clearly the org's official contact.
- avatarImageUrl: a logo from imageCandidates suitable for a circular avatar, or null. Must be copied exactly from imageCandidates.
- coverImageUrl: a wide header/banner from imageCandidates, or null. Must be copied exactly from imageCandidates.
- confidence: 0–1, how well the emails support the profile overall.
- warnings: short notes an admin should check (e.g. "Emails are mostly forwarded announcements from other groups").

Input:
${JSON.stringify(payload, null, 2)}`;
}

/**
 * Validates model output against the source material: URLs and emails must
 * literally appear in the org's mail, and image picks must be candidates.
 * Anything that fails is dropped with a warning rather than stored.
 */
function normalizeProfile(
  data: unknown,
  input: EnrichmentInput,
): NormalizedProfile {
  if (!isRecord(data)) throw new Error("Model returned a non-object response.");

  const warnings = stringArray(data.warnings).slice(0, 10);
  const corpus = input.messages
    .map((message) => `${message.bodyText}\n${message.links.join("\n")}`)
    .join("\n")
    .toLowerCase();
  const candidateUrls = new Set(input.imageCandidates.map((c) => c.url));

  let websiteUrl = cleanUrl(optionalString(data.websiteUrl));
  if (websiteUrl && !corpus.includes(stripTrailingSlash(websiteUrl))) {
    warnings.push(`Dropped website "${websiteUrl}": not found in the emails.`);
    websiteUrl = undefined;
  }

  let email = cleanEmail(optionalString(data.email));
  if (email && !corpus.includes(email)) {
    warnings.push(`Dropped email "${email}": not found in the emails.`);
    email = undefined;
  }

  const pickImage = (value: unknown) => {
    const url = optionalString(value);
    return url && candidateUrls.has(url) ? url : undefined;
  };

  return {
    description: cleanText(optionalString(data.description)),
    loopSummary: cleanText(optionalString(data.loopSummary)),
    tags: normalizeTags(stringArray(data.tags)),
    websiteUrl,
    email,
    suggestedAvatarUrl: pickImage(data.avatarImageUrl),
    suggestedCoverUrl: pickImage(data.coverImageUrl),
    confidence: clamp01(data.confidence),
    warnings,
  };
}

function missingProfileFields(org: Doc<"orgs">) {
  const missing: string[] = [];
  if (!org.description.trim()) missing.push("description");
  if (!org.loopSummary?.trim()) missing.push("loopSummary");
  if (org.tags.length === 0) missing.push("tags");
  if (!org.websiteUrl) missing.push("websiteUrl");
  if (!org.email) missing.push("email");
  if (!org.avatarUrl) missing.push("avatar");
  if (!org.coverImageUrl) missing.push("cover");
  return missing;
}

// ─── Email helpers ───────────────────────────────────────────────────────────

const URL_PATTERN = /https?:\/\/[^\s"'<>)\]]+/gi;
const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i;
/** Open-tracking pixels, spacers, and social-icon sprites — never a logo. */
const NON_CONTENT_IMAGE =
  /(pixel|track|beacon|spacer|blank|\/open\b|\/o\.gif|1x1|social[-_]?icons?|icons?\/(facebook|instagram|twitter|linkedin|x|youtube|tiktok))/i;

function extractLinks(value: string) {
  const links = new Set<string>();
  for (const match of decodeEntities(value).matchAll(URL_PATTERN)) {
    const url = match[0].replace(/[.,;:!?]+$/, "");
    if (!IMAGE_EXTENSION.test(url)) links.add(url);
  }
  return [...links];
}

/**
 * `<img>` sources across an org's emails, ranked by how many emails use them —
 * a logo or header banner tends to recur in every newsletter, while one-off
 * event flyers don't.
 */
function collectImageCandidates(htmlBodies: string[]): ImageCandidate[] {
  const byUrl = new Map<string, ImageCandidate>();
  for (const html of htmlBodies) {
    const seenInThisEmail = new Set<string>();
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
      const tag = match[0];
      const src = attribute(tag, "src");
      if (!src || !/^https?:\/\//i.test(src)) continue;
      if (NON_CONTENT_IMAGE.test(src)) continue;
      const width = Number(attribute(tag, "width"));
      const height = Number(attribute(tag, "height"));
      if ((width > 0 && width < 24) || (height > 0 && height < 24)) continue;
      if (seenInThisEmail.has(src)) continue;
      seenInThisEmail.add(src);

      const existing = byUrl.get(src);
      if (existing) {
        existing.occurrences += 1;
      } else {
        const alt = attribute(tag, "alt")?.trim();
        byUrl.set(src, {
          url: src,
          alt: alt ? alt.slice(0, 120) : undefined,
          occurrences: 1,
        });
      }
    }
  }
  return [...byUrl.values()]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, MAX_IMAGE_CANDIDATES);
}

function attribute(tag: string, name: string) {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`,
    "i",
  ).exec(tag);
  const raw = match?.[2] ?? match?.[3];
  return raw === undefined ? undefined : decodeEntities(raw);
}

function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

async function storeRemoteImage(
  ctx: ActionCtx,
  url: string,
): Promise<Id<"_storage">> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`Couldn't download image: ${formatError(error)}`);
  }
  if (!response.ok) {
    throw new Error(`Couldn't download image (HTTP ${response.status}).`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error("That link didn't return an image.");
  }
  const blob = await response.blob();
  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is larger than 5 MB.");
  }
  return ctx.storage.store(blob);
}

// ─── Value cleaning ──────────────────────────────────────────────────────────

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function cleanText(value: string | undefined) {
  const cleaned = value?.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned : undefined;
}

function normalizeTags(tags: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const cleaned = tag.replace(/\s+/g, " ").trim();
    const key = cleaned.toLowerCase();
    if (!cleaned || cleaned.length > 32 || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result.slice(0, MAX_TAGS);
}

function cleanUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? trimmed
      : undefined;
  } catch {
    return undefined;
  }
}

function stripTrailingSlash(url: string) {
  return url.toLowerCase().replace(/\/+$/, "");
}

function cleanEmail(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    ? trimmed
    : undefined;
}

function clamp01(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}
