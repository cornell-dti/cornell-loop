import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";

declare const process: { env: Record<string, string | undefined> };

const GMAIL_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_MESSAGES_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GMAIL_HISTORY_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/history";
const GMAIL_PROFILE_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const GMAIL_BATCH_ENDPOINT = "https://www.googleapis.com/batch/gmail/v1";
const HISTORY_STATE_KEY = "gmail_history_id";
const MESSAGES_PER_PAGE = 100;
const MAX_BOOTSTRAP_MESSAGES = 250;
const BATCH_SIZE = 50;

type GmailHeader = { name?: string; value?: string };

type GmailMessagePart = {
  mimeType?: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
  headers?: GmailHeader[];
};

type GmailFullMessage = {
  id?: string;
  threadId?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

type GmailListResponse = {
  messages?: Array<{ id: string; threadId?: string }>;
  nextPageToken?: string;
};

type GmailHistoryResponse = {
  history?: Array<{
    messagesAdded?: Array<{ message?: { id?: string } }>;
  }>;
  nextPageToken?: string;
  historyId?: string;
};

type GmailProfileResponse = {
  historyId?: string;
};

type ParsedEmail = {
  gmailMessageId: string;
  threadId?: string;
  sender: string;
  senderEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  receivedAt: number;
  bodyText: string;
  bodyHtml: string;
  headers: Array<{ name: string; value: string }>;
};

type StoredParsedEmail = ParsedEmail & {
  listservId?: Id<"listservs">;
  organizationId?: Id<"organizations">;
};

type MatchableListserv = {
  _id: Id<"listservs">;
  organizationId?: Id<"organizations">;
  listEmail: string;
  senderEmails: string[];
};

type IngestionRunResult = {
  fetched: number;
  unseen: number;
  stored: number;
};

type FetchedMessageIds = {
  messageIds: string[];
  historyId?: string;
};

type IngestionStateSnapshot = {
  value?: string;
};

type GmailConnectionSnapshot = {
  email: string;
  refreshToken: string;
};

export const pollListservInbox = internalAction({
  args: {
    trigger: v.optional(v.union(v.literal("cron"), v.literal("manual"))),
  },
  handler: async (ctx, args): Promise<IngestionRunResult> => {
    const runId: Id<"ingestionRuns"> = await ctx.runMutation(
      internal.ingestion.startIngestionRun,
      { trigger: args.trigger ?? "cron" },
    );

    await ctx.runMutation(internal.ingestion.markIngestionRunning, {
      key: HISTORY_STATE_KEY,
    });

    try {
      const accessToken = await refreshAccessToken(ctx);
      const state = (await ctx.runQuery(internal.ingestion.getIngestionState, {
        key: HISTORY_STATE_KEY,
      })) as IngestionStateSnapshot | null;

      const fetched: FetchedMessageIds = state?.value
        ? await fetchMessagesSinceHistory(accessToken, state.value)
        : await fetchRecentMessages(accessToken);

      const unseenIds = (await ctx.runQuery(
        internal.ingestion.filterUnseenMessages,
        {
          gmailMessageIds: fetched.messageIds,
        },
      )) as string[];

      let stored = 0;
      if (unseenIds.length > 0) {
        const [messages, listservs] = (await Promise.all([
          batchFetchMessages(unseenIds, accessToken),
          ctx.runQuery(internal.ingestion.getMatchableListservs),
        ])) as [GmailFullMessage[], MatchableListserv[]];

        const parsed: StoredParsedEmail[] = messages.flatMap(
          (message: GmailFullMessage) => {
            const email = parseGmailMessage(message);
            if (!email) return [];

            const sourceMatch = matchListserv(email, listservs);
            return [{ ...email, ...sourceMatch }];
          },
        );

        if (parsed.length > 0) {
          const result = await ctx.runMutation(
            internal.ingestion.storeParsedMessages,
            {
              messages: parsed,
            },
          );
          stored = result.stored;
        }
      }

      if (fetched.historyId) {
        await ctx.runMutation(internal.ingestion.markIngestionSucceeded, {
          key: HISTORY_STATE_KEY,
          value: fetched.historyId,
        });
      } else {
        await ctx.runMutation(internal.ingestion.markIngestionSucceeded, {
          key: HISTORY_STATE_KEY,
        });
      }

      const result = {
        fetched: fetched.messageIds.length,
        unseen: unseenIds.length,
        stored,
      };

      await ctx.runMutation(internal.ingestion.finishIngestionRun, {
        runId,
        status: "completed",
        ...result,
      });

      return result;
    } catch (error) {
      await ctx.runMutation(internal.ingestion.finishIngestionRun, {
        runId,
        status: "failed",
        fetched: 0,
        unseen: 0,
        stored: 0,
        error: formatError(error),
      });
      await ctx.runMutation(internal.ingestion.markIngestionFailed, {
        key: HISTORY_STATE_KEY,
        error: formatError(error),
      });
      throw error;
    }
  },
});

export const getIngestionState = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("listservIngestionState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
  },
});

export const getMatchableListservs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const listservs = await ctx.db.query("listservs").collect();
    return listservs
      .filter(
        (listserv) =>
          listserv.status === "active" || listserv.status === "joining",
      )
      .map((listserv) => ({
        _id: listserv._id,
        organizationId: listserv.organizationId,
        listEmail: listserv.listEmail,
        senderEmails: listserv.senderEmails,
      }));
  },
});

export const filterUnseenMessages = internalQuery({
  args: { gmailMessageIds: v.array(v.string()) },
  handler: async (ctx, args) => {
    const unseen: string[] = [];

    for (const id of args.gmailMessageIds) {
      const existing = await ctx.db
        .query("listservMessages")
        .withIndex("by_gmail_message_id", (q) => q.eq("gmailMessageId", id))
        .unique();
      if (!existing) unseen.push(id);
    }

    return unseen;
  },
});

export const startIngestionRun = internalMutation({
  args: { trigger: v.union(v.literal("cron"), v.literal("manual")) },
  handler: async (ctx, args) => {
    return ctx.db.insert("ingestionRuns", {
      trigger: args.trigger,
      status: "running",
      startedAt: Date.now(),
      fetched: 0,
      unseen: 0,
      stored: 0,
    });
  },
});

export const finishIngestionRun = internalMutation({
  args: {
    runId: v.id("ingestionRuns"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    fetched: v.number(),
    unseen: v.number(),
    stored: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: args.status,
      finishedAt: Date.now(),
      fetched: args.fetched,
      unseen: args.unseen,
      stored: args.stored,
      error: args.error,
    });
  },
});

export const markIngestionRunning = internalMutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("listservIngestionState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "running",
        lastStartedAt: now,
        lastError: undefined,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("listservIngestionState", {
      key: args.key,
      status: "running",
      lastStartedAt: now,
      updatedAt: now,
    });
  },
});

export const markIngestionSucceeded = internalMutation({
  args: { key: v.string(), value: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("listservIngestionState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    const patch = {
      value: args.value ?? existing?.value,
      status: "idle" as const,
      lastSucceededAt: now,
      lastError: undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return;
    }

    await ctx.db.insert("listservIngestionState", {
      key: args.key,
      ...patch,
    });
  },
});

export const markIngestionFailed = internalMutation({
  args: { key: v.string(), error: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("listservIngestionState")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "failed",
        lastError: args.error,
        updatedAt: now,
      });
      return;
    }

    await ctx.db.insert("listservIngestionState", {
      key: args.key,
      status: "failed",
      lastError: args.error,
      updatedAt: now,
    });
  },
});

export const storeParsedMessages = internalMutation({
  args: {
    messages: v.array(
      v.object({
        gmailMessageId: v.string(),
        threadId: v.optional(v.string()),
        listservId: v.optional(v.id("listservs")),
        organizationId: v.optional(v.id("organizations")),
        sender: v.string(),
        senderEmail: v.string(),
        to: v.array(v.string()),
        cc: v.array(v.string()),
        subject: v.string(),
        receivedAt: v.number(),
        bodyText: v.string(),
        bodyHtml: v.string(),
        headers: v.array(v.object({ name: v.string(), value: v.string() })),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let stored = 0;

    for (const message of args.messages) {
      const existing = await ctx.db
        .query("listservMessages")
        .withIndex("by_gmail_message_id", (q) =>
          q.eq("gmailMessageId", message.gmailMessageId),
        )
        .unique();

      if (existing) continue;

      await ctx.db.insert("listservMessages", {
        ...message,
        processingStatus: "new",
        createdAt: now,
      });

      if (message.listservId) {
        const listserv = await ctx.db.get(message.listservId);
        const patch = buildListservIngestionPatch(
          message,
          now,
          listserv?.joinStatus,
        );
        await ctx.db.patch(message.listservId, patch);
      }

      stored += 1;
    }

    return { stored };
  },
});

function buildListservIngestionPatch(
  message: {
    receivedAt: number;
    senderEmail: string;
    subject: string;
    bodyText: string;
  },
  now: number,
  currentJoinStatus?:
    | "not_started"
    | "join_email_sent"
    | "awaiting_confirmation"
    | "joined"
    | "failed"
    | "manual_required",
) {
  if (isJoinConfirmation(message)) {
    return {
      lastReceivedAt: message.receivedAt,
      joinStatus:
        currentJoinStatus === "joined"
          ? ("joined" as const)
          : ("awaiting_confirmation" as const),
      updatedAt: now,
    };
  }

  if (currentJoinStatus !== "joined") {
    return {
      lastReceivedAt: message.receivedAt,
      joinStatus: "joined" as const,
      status: "active" as const,
      updatedAt: now,
    };
  }

  return {
    lastReceivedAt: message.receivedAt,
    updatedAt: now,
  };
}

async function refreshAccessToken(ctx: ActionCtx) {
  const connection = (await ctx.runQuery(
    internal.gmailConnection.getConnection,
    {},
  )) as GmailConnectionSnapshot | null;

  if (!connection) {
    throw new Error(
      "Gmail is not connected. Use the admin page to connect Gmail first.",
    );
  }

  const refreshToken = connection.refreshToken;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error("Gmail OAuth client env vars are not configured.");
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(GMAIL_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = `Token refresh failed (${response.status}): ${await response.text()}`;
    await ctx.runMutation(internal.gmailConnection.markInvalid, { error });
    throw new Error(error);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token)
    throw new Error("Token refresh returned no access_token.");

  return data.access_token;
}

async function fetchMessagesSinceHistory(
  accessToken: string,
  historyId: string,
) {
  const ids: string[] = [];
  let pageToken: string | undefined;
  let latestHistoryId: string | undefined;

  do {
    const url = new URL(GMAIL_HISTORY_URL);
    url.searchParams.set("startHistoryId", historyId);
    url.searchParams.set("historyTypes", "messageAdded");
    url.searchParams.set("maxResults", String(MESSAGES_PER_PAGE));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await gmailFetch<GmailHistoryResponse>(
      url.toString(),
      accessToken,
    );
    if (response.historyId) latestHistoryId = response.historyId;

    for (const historyItem of response.history ?? []) {
      for (const added of historyItem.messagesAdded ?? []) {
        if (added.message?.id) ids.push(added.message.id);
      }
    }

    pageToken = response.nextPageToken;
  } while (pageToken);

  return { messageIds: [...new Set(ids)], historyId: latestHistoryId };
}

async function fetchRecentMessages(accessToken: string) {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(GMAIL_MESSAGES_URL);
    url.searchParams.set("maxResults", String(MESSAGES_PER_PAGE));
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await gmailFetch<GmailListResponse>(
      url.toString(),
      accessToken,
    );
    ids.push(...(response.messages?.map((message) => message.id) ?? []));
    pageToken =
      ids.length < MAX_BOOTSTRAP_MESSAGES ? response.nextPageToken : undefined;
  } while (pageToken);

  const profile = await gmailFetch<GmailProfileResponse>(
    GMAIL_PROFILE_URL,
    accessToken,
  );
  return { messageIds: [...new Set(ids)], historyId: profile.historyId };
}

async function batchFetchMessages(ids: string[], accessToken: string) {
  const messages: GmailFullMessage[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const boundary = `batch_${crypto.randomUUID()}`;
    const body =
      chunk
        .map(
          (id) =>
            `--${boundary}\r\nContent-Type: application/http\r\n\r\nGET /gmail/v1/users/me/messages/${id}?format=full HTTP/1.1\r\n\r\n`,
        )
        .join("") + `--${boundary}--`;

    const response = await fetch(GMAIL_BATCH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Gmail batch fetch failed (${response.status}): ${await response.text()}`,
      );
    }

    messages.push(...parseBatchResponse(await response.text()));
  }

  return messages;
}

async function gmailFetch<T>(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(
      `Gmail API error ${response.status}: ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

function parseBatchResponse(responseText: string) {
  const results: GmailFullMessage[] = [];
  const parts = responseText.split(/--batch_[^\r\n]+/);

  for (const part of parts) {
    const jsonStart = part.indexOf("{");
    const jsonEnd = part.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) continue;

    try {
      const message = JSON.parse(
        part.slice(jsonStart, jsonEnd + 1),
      ) as GmailFullMessage;
      if (message.id) results.push(message);
    } catch {
      continue;
    }
  }

  return results;
}

function parseGmailMessage(message: GmailFullMessage): ParsedEmail | null {
  if (!message.id) return null;

  const headers = collectHeaders(message.payload);
  const headerMap = new Map(
    headers.map((header) => [header.name.toLowerCase(), header.value]),
  );
  const sender = headerMap.get("from") ?? "";
  const senderEmail = extractEmailAddress(sender);
  const subject = headerMap.get("subject") ?? "";
  const receivedAt =
    parseDate(headerMap.get("date")) ?? parseInternalDate(message.internalDate);
  if (!receivedAt) return null;

  const { text, html } = extractBodies(message.payload);

  return {
    gmailMessageId: message.id,
    threadId: message.threadId,
    sender,
    senderEmail,
    to: extractEmails(headerMap.get("to") ?? ""),
    cc: extractEmails(headerMap.get("cc") ?? ""),
    subject,
    receivedAt,
    bodyText: text,
    bodyHtml: html,
    headers,
  };
}

function collectHeaders(part: GmailMessagePart | undefined) {
  return (part?.headers ?? [])
    .filter((header) => header.name && header.value !== undefined)
    .map((header) => ({ name: header.name ?? "", value: header.value ?? "" }));
}

function matchListserv(email: ParsedEmail, listservs: MatchableListserv[]) {
  const emailSignals = new Set([
    email.senderEmail,
    ...email.to,
    ...email.cc,
    ...extractEmails(headerValue(email.headers, "list-id")),
    ...extractEmails(headerValue(email.headers, "list-unsubscribe")),
    ...extractEmails(headerValue(email.headers, "delivered-to")),
  ]);

  for (const listserv of listservs) {
    const candidates = [listserv.listEmail, ...listserv.senderEmails].map(
      (value) => value.toLowerCase(),
    );
    if (candidates.some((candidate) => emailSignals.has(candidate))) {
      return {
        listservId: listserv._id,
        organizationId: listserv.organizationId,
      };
    }
  }

  const searchable = `${email.subject}\n${email.bodyText}`.toLowerCase();
  if (isJoinConfirmation(email)) {
    for (const listserv of listservs) {
      const localParts = [listserv.listEmail, ...listserv.senderEmails]
        .map((value) => value.toLowerCase().split("@")[0])
        .filter(Boolean);
      if (localParts.some((local) => searchable.includes(local))) {
        return {
          listservId: listserv._id,
          organizationId: listserv.organizationId,
        };
      }
    }
  }

  return {};
}

function isJoinConfirmation(
  email: Pick<ParsedEmail, "senderEmail" | "subject" | "bodyText">,
) {
  const sender = email.senderEmail.toLowerCase();
  const text = `${email.subject}\n${email.bodyText}`.toLowerCase();
  return (
    sender.startsWith("lyris-confirm-") ||
    /confirm your subscription|confirm.*subscribe|confirmation.*subscription|confirm.*join/.test(
      text,
    )
  );
}

function headerValue(
  headers: Array<{ name: string; value: string }>,
  name: string,
) {
  return (
    headers.find((header) => header.name.toLowerCase() === name)?.value ?? ""
  );
}

function extractEmailAddress(value: string) {
  const angleMatch = value.match(/<([^>]+)>/);
  if (angleMatch) return normalizeEmail(angleMatch[1]);

  const bareMatch = value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (bareMatch) return normalizeEmail(bareMatch[0]);

  return normalizeEmail(value);
}

function extractEmails(value: string) {
  const matches = value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi);
  return matches ? matches.map(normalizeEmail) : [];
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function parseInternalDate(value: string | undefined) {
  if (!value) return null;
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function extractBodies(part: GmailMessagePart | undefined) {
  const out = { text: "", html: "" };
  walkPart(part, out);
  if (!out.text && out.html) out.text = htmlToText(out.html);
  return out;
}

function walkPart(
  part: GmailMessagePart | undefined,
  out: { text: string; html: string },
) {
  if (!part) return;

  const mime = (part.mimeType ?? "").toLowerCase();
  if (part.body?.data && !part.parts?.length) {
    const decoded = decodeBase64Url(part.body.data);
    if (mime === "text/plain" && !out.text) out.text = decoded;
    if (mime === "text/html" && !out.html) out.html = decoded;
    return;
  }

  for (const child of part.parts ?? []) {
    walkPart(child, out);
  }
}

function htmlToText(html: string) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/?(p|div|section|article|header|footer|main|li|h[1-6]|blockquote|pre|table|tr|td|th)[^>]*>/gi,
      "\n",
    )
    .replace(/<a[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeBase64Url(encoded: string) {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );

  try {
    return new TextDecoder("utf-8").decode(
      Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)),
    );
  } catch {
    return "";
  }
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === "string") return error.slice(0, 500);
  return "Unknown ingestion error.";
}
