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
import type { Doc, Id } from "./_generated/dataModel";

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_OPENAI_PARSE_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_PARSE_MODEL = "gemini-2.5-flash";
const MAX_MESSAGES_PER_RUN = 10;

type AIProvider = "openai" | "gemini";
type AIConfig = {
  provider: AIProvider;
  model: string;
  fallback?: { provider: AIProvider; model: string };
};

type ParseResult = {
  messageType:
    | "events"
    | "opportunities"
    | "newsletter"
    | "admin"
    | "irrelevant";
  shouldPublish: boolean;
  summary: string;
  confidence: number;
  warnings: string[];
  items: ParsedItem[];
};

type ParsedItem = {
  title: string;
  description: string;
  aiDescription: string;
  eventType:
    | "event"
    | "opportunity"
    | "hackathon"
    | "courses"
    | "fundraiser"
    | "info";
  hosts: Array<{
    name: string;
    kind: "club" | "company" | "external_org";
    role: "primary" | "cohost" | "sponsor";
  }>;
  dates: Array<{
    timestamp: number;
    type: "start" | "end" | "deadline" | "single";
  }>;
  isRecurring: boolean;
  recurrenceNote?: string;
  location?: {
    displayText: string;
    address?: string;
    isVirtual: boolean;
    buildingCode?: string;
  };
  links: Array<{
    url: string;
    type: "registration" | "application" | "rsvp" | "info" | "social";
    label?: string;
  }>;
  contacts: Array<{ type: "email" | "instagram" | "website"; value: string }>;
  tags: string[];
  targetAudience?:
    | "all"
    | "first_year"
    | "women_nonbinary"
    | "international"
    | "graduate";
  perks: Array<"food" | "swag" | "prizes" | "travel_covered" | "paid">;
};

type SourceMessage = Doc<"listservMessages"> & {
  listserv?: Doc<"listservs"> | null;
  organization?: Doc<"orgs"> | null;
};

export const runParseNow = action({
  args: { token: v.string(), messageId: v.optional(v.id("listservMessages")) },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const aiConfig = getAIConfig();
    const runId: Id<"parseRuns"> = await ctx.runMutation(
      internal.parser.startParseRun,
      {
        trigger: args.messageId ? "single_message" : "manual",
        provider: aiConfig.provider,
        model: aiConfig.model,
      },
    );

    let messagesScanned = 0;
    let messagesParsed = 0;
    let eventsCreated = 0;
    let eventsUpdated = 0;
    let messagesIgnored = 0;

    try {
      const messages = (await ctx.runQuery(
        internal.parser.getMessagesForParsing,
        {
          messageId: args.messageId,
          limit: MAX_MESSAGES_PER_RUN,
        },
      )) as SourceMessage[];
      messagesScanned = messages.length;

      for (const message of messages) {
        if (shouldIgnoreMessage(message)) {
          await ctx.runMutation(internal.parser.markMessageIgnored, {
            messageId: message._id,
            reason: "Administrative or confirmation message.",
          });
          messagesIgnored += 1;
          continue;
        }

        try {
          const result = await parseMessageWithAI(message, aiConfig);
          const normalized = normalizeParseResult(result);
          if (
            normalized.items.length === 0 ||
            normalized.messageType === "irrelevant" ||
            normalized.messageType === "admin"
          ) {
            await ctx.runMutation(internal.parser.markMessageIgnored, {
              messageId: message._id,
              reason:
                normalized.warnings.join("; ") ||
                "No useful feed items extracted.",
            });
            messagesIgnored += 1;
            continue;
          }

          const stored = (await ctx.runMutation(
            internal.parser.storeParsedEvents,
            {
              messageId: message._id,
              items: normalized.items,
              confidence: normalized.confidence,
              warnings: normalized.warnings,
            },
          )) as { created: number; updated: number };
          messagesParsed += 1;
          eventsCreated += stored.created;
          eventsUpdated += stored.updated;
        } catch (error) {
          await ctx.runMutation(internal.parser.markMessageFailed, {
            messageId: message._id,
            error: formatError(error),
          });
        }
      }

      await ctx.runMutation(internal.parser.finishParseRun, {
        runId,
        status: "completed",
        messagesScanned,
        messagesParsed,
        eventsCreated,
        eventsUpdated,
        messagesIgnored,
      });
      return {
        messagesScanned,
        messagesParsed,
        eventsCreated,
        eventsUpdated,
        messagesIgnored,
      };
    } catch (error) {
      await ctx.runMutation(internal.parser.finishParseRun, {
        runId,
        status: "failed",
        messagesScanned,
        messagesParsed,
        eventsCreated,
        eventsUpdated,
        messagesIgnored,
        error: formatError(error),
      });
      throw error;
    }
  },
});

export const publishEvent = mutation({
  args: { token: v.string(), eventId: v.id("events") },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const now = Date.now();

    await ctx.db.patch(args.eventId, { visibility: "published", updatedAt: now });

    // Insert the eventOrgs join so the org name appears in the feed post header.
    // organizationId now points directly to `orgs`, so no cross-table sync needed.
    const event = await ctx.db.get(args.eventId);
    if (!event?.organizationId) return;

    const existing = await ctx.db
      .query("eventOrgs")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .filter((q) => q.eq(q.field("orgId"), event.organizationId!))
      .unique();

    if (existing === null) {
      await ctx.db.insert("eventOrgs", {
        eventId: args.eventId,
        orgId: event.organizationId,
        eventCreationTime: event._creationTime,
      });
    }
  },
});

export const hideEvent = mutation({
  args: { token: v.string(), eventId: v.id("events") },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.eventId, {
      visibility: "hidden",
      updatedAt: Date.now(),
    });
  },
});

export const overview = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const [runs, drafts, failedMessages, newMessages] = await Promise.all([
      ctx.db
        .query("parseRuns")
        .withIndex("by_started_at")
        .order("desc")
        .take(20),
      ctx.db
        .query("events")
        .withIndex("by_visibility", (q) => q.eq("visibility", "draft"))
        .order("desc")
        .take(50),
      ctx.db
        .query("listservMessages")
        .withIndex("by_processing_status", (q) =>
          q.eq("processingStatus", "failed"),
        )
        .order("desc")
        .take(25),
      ctx.db
        .query("listservMessages")
        .withIndex("by_processing_status", (q) =>
          q.eq("processingStatus", "new"),
        )
        .order("desc")
        .take(200),
    ]);

    const readyMessages = newMessages.filter(
      (m) => m.organizationId !== undefined,
    );
    const needsAssignment = newMessages.filter(
      (m) => m.organizationId === undefined,
    );

    // Project only what the admin UI needs — no email body content sent to client.
    const projectMessage = (m: (typeof failedMessages)[number]) => ({
      _id: m._id,
      _creationTime: m._creationTime,
      subject: m.subject,
      senderEmail: m.senderEmail,
      processingStatus: m.processingStatus,
      parseError: m.parseError,
      organizationId: m.organizationId,
      listservId: m.listservId,
      receivedAt: m.receivedAt,
    });

    return {
      runs,
      drafts,
      failedMessages: failedMessages.map(projectMessage),
      readyMessages: readyMessages.map(projectMessage),
      needsAssignmentCount: needsAssignment.length,
    };
  },
});

export const getMessagesForParsing = internalQuery({
  args: { messageId: v.optional(v.id("listservMessages")), limit: v.number() },
  handler: async (ctx, args) => {
    const singleMessage = args.messageId
      ? await ctx.db.get(args.messageId)
      : null;

    // For a single-message parse, try even without organizationId
    if (args.messageId) {
      if (!singleMessage || !singleMessage.organizationId) return [];
      const [listserv, organization] = await Promise.all([
        singleMessage.listservId ? ctx.db.get(singleMessage.listservId) : null,
        ctx.db.get(singleMessage.organizationId),
      ]);
      return [{ ...singleMessage, listserv, organization }];
    }

    // Scan a larger window so unassigned messages don't block assigned ones
    const candidates = await ctx.db
      .query("listservMessages")
      .withIndex("by_processing_status", (q) => q.eq("processingStatus", "new"))
      .order("desc")
      .take(args.limit * 10);

    const enriched: SourceMessage[] = [];
    for (const message of candidates) {
      if (!message.organizationId) continue;
      if (enriched.length >= args.limit) break;
      const [listserv, organization] = await Promise.all([
        message.listservId ? ctx.db.get(message.listservId) : null,
        ctx.db.get(message.organizationId),
      ]);
      enriched.push({ ...message, listserv, organization });
    }
    return enriched;
  },
});

export const startParseRun = internalMutation({
  args: {
    trigger: v.union(
      v.literal("manual"),
      v.literal("cron"),
      v.literal("single_message"),
    ),
    provider: v.optional(v.union(v.literal("openai"), v.literal("gemini"))),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("parseRuns", {
      trigger: args.trigger,
      status: "running",
      startedAt: Date.now(),
      provider: args.provider,
      model: args.model,
      messagesScanned: 0,
      messagesParsed: 0,
      eventsCreated: 0,
      eventsUpdated: 0,
      messagesIgnored: 0,
    });
  },
});

export const finishParseRun = internalMutation({
  args: {
    runId: v.id("parseRuns"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    messagesScanned: v.number(),
    messagesParsed: v.number(),
    eventsCreated: v.number(),
    eventsUpdated: v.number(),
    messagesIgnored: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: args.status,
      finishedAt: Date.now(),
      messagesScanned: args.messagesScanned,
      messagesParsed: args.messagesParsed,
      eventsCreated: args.eventsCreated,
      eventsUpdated: args.eventsUpdated,
      messagesIgnored: args.messagesIgnored,
      error: args.error,
    });
  },
});

export const markMessageIgnored = internalMutation({
  args: { messageId: v.id("listservMessages"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      processingStatus: "ignored",
      parseError: args.reason,
    });
  },
});

export const markMessageFailed = internalMutation({
  args: { messageId: v.id("listservMessages"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      processingStatus: "failed",
      parseError: args.error,
    });
  },
});

export const storeParsedEvents = internalMutation({
  args: {
    messageId: v.id("listservMessages"),
    confidence: v.number(),
    warnings: v.array(v.string()),
    items: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found.");
    const listserv = message.listservId
      ? await ctx.db.get(message.listservId)
      : null;
    const organization = message.organizationId
      ? await ctx.db.get(message.organizationId)
      : null;
    if (!organization) throw new Error("Message has no organization.");

    const now = Date.now();
    let created = 0;
    let updated = 0;

    for (const rawItem of args.items) {
      const item = rawItem as ParsedItem;
      const dedupeKey = buildDedupeKey(item);
      const existing = dedupeKey
        ? await ctx.db
            .query("events")
            .withIndex("by_dedupe_key", (q) => q.eq("dedupeKey", dedupeKey))
            .first()
        : null;
      if (existing) {
        updated += 1;
        continue;
      }

      await ctx.db.insert("events", {
        sourceMessageId: args.messageId,
        listservId: message.listservId,
        organizationId: message.organizationId,
        listserv: organization.name,
        listservSection: listserv?.sourceType ?? "unknown",
        title: item.title,
        description: item.description,
        aiDescription: item.aiDescription,
        eventType: item.eventType,
        hosts: item.hosts,
        dates: item.dates,
        isRecurring: item.isRecurring,
        recurrenceNote: item.recurrenceNote,
        location: item.location,
        links: item.links,
        contacts: item.contacts,
        tags: item.tags,
        targetAudience: item.targetAudience,
        perks: item.perks,
        visibility: "draft",
        parseConfidence: args.confidence,
        parseWarnings: args.warnings,
        dedupeKey,
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
    }

    await ctx.db.patch(args.messageId, {
      processingStatus: "parsed",
      parseError: undefined,
    });
    return { created, updated };
  },
});

async function parseMessageWithAI(
  message: SourceMessage,
  config: AIConfig,
): Promise<ParseResult> {
  const prompt = buildParsePrompt(message);
  try {
    return await callAIProvider(prompt, config.provider, config.model);
  } catch (error) {
    if (!config.fallback) throw error;
    try {
      return await callAIProvider(
        prompt,
        config.fallback.provider,
        config.fallback.model,
      );
    } catch (fallbackError) {
      throw new Error(
        `Primary ${config.provider}/${config.model} failed: ${formatError(error)}. Fallback ${config.fallback.provider}/${config.fallback.model} failed: ${formatError(fallbackError)}`,
      );
    }
  }
}

async function callAIProvider(
  prompt: string,
  provider: AIProvider,
  model: string,
): Promise<ParseResult> {
  if (provider === "openai") return parseWithOpenAI(prompt, model);
  return parseWithGemini(prompt, model);
}

async function parseWithOpenAI(
  prompt: string,
  model: string,
): Promise<ParseResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You extract structured JSON from Cornell listserv emails. Return JSON only.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "OpenAI parse request failed.");

  const text = payload.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned no content.");
  return JSON.parse(text) as ParseResult;
}

async function parseWithGemini(
  prompt: string,
  model: string,
): Promise<ParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(payload.error?.message ?? "Gemini parse request failed.");

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text.");
  return JSON.parse(text) as ParseResult;
}

function getAIConfig(): AIConfig {
  const openai = getOpenAIConfig();
  const gemini = getGeminiConfig();

  if (openai && gemini) return { ...openai, fallback: gemini };
  if (openai) return openai;
  if (gemini) return gemini;

  throw new Error(
    "No AI parser provider is configured. Set OPENAI_API_KEY for OpenAI or GEMINI_API_KEY for Gemini.",
  );
}

function getOpenAIConfig(): AIConfig | null {
  if (!process.env.OPENAI_API_KEY) return null;
  return {
    provider: "openai",
    model: process.env.OPENAI_PARSE_MODEL ?? DEFAULT_OPENAI_PARSE_MODEL,
  };
}

function getGeminiConfig(): AIConfig | null {
  if (!process.env.GEMINI_API_KEY) return null;
  return {
    provider: "gemini",
    model: process.env.GEMINI_PARSE_MODEL ?? DEFAULT_GEMINI_PARSE_MODEL,
  };
}

function buildParsePrompt(message: SourceMessage) {
  const input = {
    sourceOrganization: message.organization?.name,
    sourceOrganizationType: message.organization?.orgType,
    sourceEmail: message.senderEmail,
    sourceName: message.listserv?.name,
    subject: message.subject,
    receivedAt: new Date(message.receivedAt).toISOString(),
    bodyText: message.bodyText.slice(0, 12000),
    links: extractLinks(`${message.bodyText}\n${message.bodyHtml}`).slice(
      0,
      40,
    ),
  };

  return `Extract Cornell student-relevant feed items from this listserv email. Return strict JSON only. Do not invent details. The source organization advertised the item but may not be the host.

Return this exact shape:
{
  "messageType": "events" | "opportunities" | "newsletter" | "admin" | "irrelevant",
  "shouldPublish": false,
  "summary": string,
  "confidence": number,
  "warnings": string[],
  "items": [{
    "title": string,
    "description": string,
    "aiDescription": string,
    "eventType": "event" | "opportunity" | "hackathon" | "courses" | "fundraiser" | "info",
    "hosts": [{"name": string, "kind": "club" | "company" | "external_org", "role": "primary" | "cohost" | "sponsor"}],
    "dates": [{"timestamp": number, "type": "start" | "end" | "deadline" | "single"}],
    "isRecurring": boolean,
    "recurrenceNote": string | null,
    "location": {"displayText": string, "address": string | null, "isVirtual": boolean, "buildingCode": string | null} | null,
    "links": [{"url": string, "type": "registration" | "application" | "rsvp" | "info" | "social", "label": string | null}],
    "contacts": [{"type": "email" | "instagram" | "website", "value": string}],
    "tags": string[],
    "targetAudience": "all" | "first_year" | "women_nonbinary" | "international" | "graduate" | null,
    "perks": ("food" | "swag" | "prizes" | "travel_covered" | "paid")[]
  }]
}

Rules: ignore unsubscribe text, confirmations, and admin/list-manager mail. Use timestamps in milliseconds since epoch. If no useful item exists, return items: [] and messageType "irrelevant" or "admin". Drafts are reviewed by admins, so shouldPublish must always be false.

Email input:
${JSON.stringify(input, null, 2)}`;
}

function normalizeParseResult(result: ParseResult): ParseResult {
  const warnings = Array.isArray(result.warnings)
    ? result.warnings.map(String).slice(0, 20)
    : [];
  const items = Array.isArray(result.items)
    ? result.items.flatMap((item) => normalizeItem(item, warnings))
    : [];
  return {
    messageType: normalizeMessageType(result.messageType),
    shouldPublish: false,
    summary: String(result.summary ?? "").slice(0, 500),
    confidence: clampNumber(result.confidence, 0, 100),
    warnings,
    items,
  };
}

function normalizeItem(item: ParsedItem, warnings: string[]): ParsedItem[] {
  const title = String(item.title ?? "").trim();
  const description = String(item.description ?? "").trim();
  if (!title || !description) return [];
  const dates = Array.isArray(item.dates)
    ? item.dates
        .filter((date) => Number.isFinite(date.timestamp) && date.timestamp > 0)
        .slice(0, 8)
    : [];
  if (
    dates.length === 0 &&
    (!Array.isArray(item.links) || item.links.length === 0)
  ) {
    warnings.push(`Low detail item: ${title}`);
  }

  return [
    {
      title,
      description,
      aiDescription: String(item.aiDescription ?? description).slice(0, 220),
      eventType: normalizeEventType(item.eventType),
      hosts: normalizeHosts(item.hosts),
      dates,
      isRecurring: Boolean(item.isRecurring),
      recurrenceNote: optionalString(item.recurrenceNote),
      location: normalizeLocation(item.location),
      links: normalizeLinks(item.links),
      contacts: normalizeContacts(item.contacts),
      tags: Array.isArray(item.tags)
        ? item.tags
            .map(String)
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 12)
        : [],
      targetAudience: normalizeAudience(item.targetAudience),
      perks: normalizePerks(item.perks),
    },
  ];
}

function shouldIgnoreMessage(message: SourceMessage) {
  const text =
    `${message.senderEmail}\n${message.subject}\n${message.bodyText}`.toLowerCase();
  return /lyris-confirm-|confirm your subscription|unsubscribe request|delivery status notification/.test(
    text,
  );
}

function buildDedupeKey(item: ParsedItem) {
  const firstDate = item.dates[0]?.timestamp
    ? new Date(item.dates[0].timestamp).toISOString().slice(0, 10)
    : "no-date";
  const firstLink = item.links[0]?.url ?? "no-link";
  return `${normalizeKey(item.title)}:${firstDate}:${normalizeKey(firstLink)}`.slice(
    0,
    240,
  );
}

function extractLinks(value: string) {
  return [...new Set(value.match(/https?:\/\/[^\s"'<>]+/g) ?? [])];
}

function normalizeMessageType(value: string): ParseResult["messageType"] {
  return [
    "events",
    "opportunities",
    "newsletter",
    "admin",
    "irrelevant",
  ].includes(value)
    ? (value as ParseResult["messageType"])
    : "irrelevant";
}

function normalizeEventType(value: string): ParsedItem["eventType"] {
  return [
    "event",
    "opportunity",
    "hackathon",
    "courses",
    "fundraiser",
    "info",
  ].includes(value)
    ? (value as ParsedItem["eventType"])
    : "info";
}

function normalizeHosts(hosts: ParsedItem["hosts"]) {
  return Array.isArray(hosts)
    ? hosts
        .filter((host) => host?.name)
        .slice(0, 6)
        .map((host) => ({
          name: String(host.name),
          kind: ["club", "company", "external_org"].includes(host.kind)
            ? host.kind
            : "external_org",
          role: ["primary", "cohost", "sponsor"].includes(host.role)
            ? host.role
            : "primary",
        }))
    : [];
}

function normalizeLocation(location: ParsedItem["location"]) {
  if (!location?.displayText) return undefined;
  return {
    displayText: String(location.displayText),
    address: optionalString(location.address),
    isVirtual: Boolean(location.isVirtual),
    buildingCode: optionalString(location.buildingCode),
  };
}

function normalizeLinks(links: ParsedItem["links"]) {
  return Array.isArray(links)
    ? links
        .filter((link) => link?.url)
        .slice(0, 12)
        .map((link) => ({
          url: String(link.url),
          type: [
            "registration",
            "application",
            "rsvp",
            "info",
            "social",
          ].includes(link.type)
            ? link.type
            : "info",
          label: optionalString(link.label),
        }))
    : [];
}

function normalizeContacts(contacts: ParsedItem["contacts"]) {
  return Array.isArray(contacts)
    ? contacts
        .filter((contact) => contact?.value)
        .slice(0, 8)
        .map((contact) => ({
          type: ["email", "instagram", "website"].includes(contact.type)
            ? contact.type
            : "website",
          value: String(contact.value),
        }))
    : [];
}

function normalizeAudience(
  value: unknown,
): ParsedItem["targetAudience"] | undefined {
  return typeof value === "string" &&
    [
      "all",
      "first_year",
      "women_nonbinary",
      "international",
      "graduate",
    ].includes(value)
    ? (value as ParsedItem["targetAudience"])
    : undefined;
}

function normalizePerks(perks: ParsedItem["perks"]) {
  const allowed = new Set(["food", "swag", "prizes", "travel_covered", "paid"]);
  return Array.isArray(perks)
    ? perks.filter((perk) => allowed.has(perk)).slice(0, 6)
    : [];
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clampNumber(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === "string") return error.slice(0, 500);
  return "Unknown parse error.";
}
