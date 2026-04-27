import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireAdminToken } from "./_shared/adminToken";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";

declare const process: { env: Record<string, string | undefined> };

const GMAIL_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

type CandidateInput = {
  email: string;
  displayName?: string;
  confidence: number;
  popularity?: number;
  matchedReasons: string[];
};

type D1QueryResponse = {
  success: boolean;
  errors?: Array<{ message?: string }>;
  result?: Array<{
    results?: Array<{ email?: string; popularity?: number | string }>;
  }>;
};

type DiscoveryStats = {
  inserted: number;
  updated: number;
};

type GmailSendResponse = {
  id?: string;
};

type IngestionRunResult = {
  fetched: number;
  unseen: number;
  stored: number;
};

type GmailConnectionSnapshot = {
  email: string;
  refreshToken: string;
};

const SEED_CANDIDATES: CandidateInput[] = [
  candidate("wicc-l@list.cornell.edu", "WICC", 95, 6, [
    "list domain",
    "list-style address",
    "high overlap",
  ]),
  candidate("acsu-l@list.cornell.edu", "ACSU", 92, 5, [
    "list domain",
    "list-style address",
    "high overlap",
  ]),
  candidate("entrepreneurship-l@mm.list.cornell.edu", "Entrepreneurship", 90, 6, [
    "list domain",
    "list-style address",
    "high overlap",
  ]),
  candidate("swemail-l@list.cornell.edu", "SWE Mail", 82, 2, [
    "list domain",
    "list-style address",
  ]),
  candidate("lindseth_climbing_wall-l@list.cornell.edu", "Lindseth Climbing Wall", 78, 3, [
    "list domain",
    "list-style address",
  ]),
  candidate("meng-students@list.cs.cornell.edu", "MEng Students", 72, 1, [
    "list domain",
  ]),
  candidate("emotionkpop-l@list.cornell.edu", "E.Motion K-Pop", 70, 1, [
    "list domain",
    "list-style address",
  ]),
  candidate("flute-l@list.cornell.edu", "Flute List", 68, 1, [
    "list domain",
    "list-style address",
  ]),
  candidate("psc-lep-l@list.cornell.edu", "PSC LEP", 68, 1, [
    "list domain",
    "list-style address",
  ]),
  candidate("fgssgradminors-l@list.cornell.edu", "FGSS Grad Minors", 66, 1, [
    "list domain",
    "list-style address",
  ]),
  candidate("achresidents-l@list.cornell.edu", "ACH Residents", 54, 1, [
    "list domain",
    "list-style address",
    "possibly private",
  ]),
];

export const dashboard = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const [
      candidates,
      listservs,
      ingestionState,
      discoveryRuns,
      joinAttempts,
      ingestionRuns,
      recentMessages,
    ] = await Promise.all([
      ctx.db.query("listservCandidates").order("desc").take(150),
      ctx.db.query("listservs").order("desc").take(150),
      ctx.db.query("listservIngestionState").collect(),
      ctx.db.query("discoveryRuns").withIndex("by_started_at").order("desc").take(12),
      ctx.db.query("joinAttempts").withIndex("by_created_at").order("desc").take(20),
      ctx.db.query("ingestionRuns").withIndex("by_started_at").order("desc").take(20),
      ctx.db.query("listservMessages").withIndex("by_received_at").order("desc").take(20),
    ]);

    return {
      candidates,
      listservs,
      ingestionState,
      discoveryRuns,
      joinAttempts,
      ingestionRuns,
      recentMessages,
    };
  },
});

export const runDiscovery = action({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const runId: Id<"discoveryRuns"> = await ctx.runMutation(
      internal.listservAdmin.startDiscoveryRun,
      {},
    );

    try {
      const discovered = await discoverCandidatesFromInitialDataset();
      const stats = (await ctx.runMutation(internal.listservAdmin.upsertDiscoveredCandidates, {
        candidates: discovered,
      })) as DiscoveryStats;

      await ctx.runMutation(internal.listservAdmin.finishDiscoveryRun, {
        runId,
        status: "completed",
        candidatesFound: discovered.length,
        candidatesInserted: stats.inserted,
        candidatesUpdated: stats.updated,
      });

      return { candidatesFound: discovered.length, ...stats };
    } catch (error) {
      await ctx.runMutation(internal.listservAdmin.finishDiscoveryRun, {
        runId,
        status: "failed",
        candidatesFound: 0,
        candidatesInserted: 0,
        candidatesUpdated: 0,
        error: formatError(error),
      });
      throw error;
    }
  },
});

export const seedCandidates = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    return upsertCandidates(ctx, SEED_CANDIDATES);
  },
});

export const addCandidate = mutation({
  args: {
    token: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const email = normalizeEmail(args.email);
    const existing = await ctx.db
      .query("listservCandidates")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) return existing._id;

    const now = Date.now();
    return ctx.db.insert("listservCandidates", {
      email,
      displayName: cleanOptional(args.displayName) ?? inferDisplayName(email),
      source: "manual",
      status: "candidate",
      confidence: 50,
      matchedReasons: ["manual"],
      notes: cleanOptional(args.notes),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const rejectCandidate = mutation({
  args: {
    token: v.string(),
    candidateId: v.id("listservCandidates"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.candidateId, {
      status: "rejected",
      notes: cleanOptional(args.notes),
      updatedAt: Date.now(),
    });
  },
});

export const approveCandidate = mutation({
  args: {
    token: v.string(),
    candidateId: v.id("listservCandidates"),
    name: v.optional(v.string()),
    joinMethod: v.optional(
      v.union(
        v.literal("email_command"),
        v.literal("web_form"),
        v.literal("manual"),
        v.literal("unknown"),
      ),
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const candidateRow = await ctx.db.get(args.candidateId);
    if (!candidateRow) throw new Error("Candidate not found.");

    const listEmail = stripOwnerPrefix(candidateRow.email);
    const existing = await ctx.db
      .query("listservs")
      .withIndex("by_list_email", (q) => q.eq("listEmail", listEmail))
      .unique();

    const now = Date.now();
    const listservFields = {
      name: cleanOptional(args.name) ?? candidateRow.displayName ?? inferDisplayName(listEmail),
      listEmail,
      senderEmails: [...new Set([candidateRow.email, listEmail])],
      status: "joining" as const,
      joinMethod: args.joinMethod ?? ("unknown" as const),
      joinStatus: "not_started" as const,
      source: candidateRow.source,
      candidateId: args.candidateId,
      notes: cleanOptional(args.notes) ?? candidateRow.notes,
      updatedAt: now,
    };

    let listservId = existing?._id;
    if (existing) {
      await ctx.db.patch(existing._id, listservFields);
    } else {
      listservId = await ctx.db.insert("listservs", {
        ...listservFields,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.candidateId, {
      status: "approved",
      updatedAt: now,
    });

    return listservId;
  },
});

export const sendJoinEmail = action({
  args: {
    token: v.string(),
    listservId: v.id("listservs"),
    recipient: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const listserv = await ctx.runQuery(internal.listservAdmin.getListservForAdmin, {
      listservId: args.listservId,
    });
    if (!listserv) throw new Error("Listserv not found.");

    const recipient = cleanRequired(args.recipient, "Recipient");
    const subject = cleanRequired(args.subject, "Subject");
    const body = cleanRequired(args.body, "Body");

    try {
      const connection = await getGmailConnection(ctx);
      const accessToken = await refreshGmailAccessToken(ctx, connection.refreshToken);
      const sent = await sendGmailMessage(accessToken, connection.email, recipient, subject, body);

      await ctx.runMutation(internal.listservAdmin.recordJoinAttempt, {
        listservId: args.listservId,
        status: "sent",
        recipient,
        subject,
        body,
        gmailMessageId: sent.id,
      });

      return { gmailMessageId: sent.id };
    } catch (error) {
      await ctx.runMutation(internal.listservAdmin.recordJoinAttempt, {
        listservId: args.listservId,
        status: "failed",
        recipient,
        subject,
        body,
        error: formatError(error),
      });
      throw error;
    }
  },
});

export const runIngestionNow = action({
  args: { token: v.string() },
  handler: async (ctx, args): Promise<IngestionRunResult> => {
    requireAdminToken(args.token);
    return (await ctx.runAction(internal.ingestion.pollListservInbox, {
      trigger: "manual",
    })) as IngestionRunResult;
  },
});

export const updateListservStatus = mutation({
  args: {
    token: v.string(),
    listservId: v.id("listservs"),
    status: v.union(
      v.literal("joining"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.listservId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const updateJoinStatus = mutation({
  args: {
    token: v.string(),
    listservId: v.id("listservs"),
    joinStatus: v.union(
      v.literal("not_started"),
      v.literal("join_email_sent"),
      v.literal("awaiting_confirmation"),
      v.literal("joined"),
      v.literal("failed"),
      v.literal("manual_required"),
    ),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.listservId, {
      joinStatus: args.joinStatus,
      updatedAt: Date.now(),
    });
  },
});

export const updateListservNotes = mutation({
  args: {
    token: v.string(),
    listservId: v.id("listservs"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    await ctx.db.patch(args.listservId, {
      notes: cleanOptional(args.notes),
      updatedAt: Date.now(),
    });
  },
});

export const startDiscoveryRun = internalMutation({
  args: {},
  handler: async (ctx) => {
    return ctx.db.insert("discoveryRuns", {
      source: "initial_sender_dataset",
      status: "running",
      startedAt: Date.now(),
      candidatesFound: 0,
      candidatesInserted: 0,
      candidatesUpdated: 0,
    });
  },
});

export const finishDiscoveryRun = internalMutation({
  args: {
    runId: v.id("discoveryRuns"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    candidatesFound: v.number(),
    candidatesInserted: v.number(),
    candidatesUpdated: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      status: args.status,
      finishedAt: Date.now(),
      candidatesFound: args.candidatesFound,
      candidatesInserted: args.candidatesInserted,
      candidatesUpdated: args.candidatesUpdated,
      error: args.error,
    });
  },
});

export const upsertDiscoveredCandidates = internalMutation({
  args: {
    candidates: v.array(
      v.object({
        email: v.string(),
        displayName: v.optional(v.string()),
        confidence: v.number(),
        popularity: v.optional(v.number()),
        matchedReasons: v.array(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    return upsertCandidates(ctx, args.candidates);
  },
});

export const getListservForAdmin = internalQuery({
  args: { listservId: v.id("listservs") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.listservId);
  },
});

export const recordJoinAttempt = internalMutation({
  args: {
    listservId: v.id("listservs"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    recipient: v.string(),
    subject: v.string(),
    body: v.string(),
    gmailMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("joinAttempts", {
      listservId: args.listservId,
      status: args.status,
      recipient: args.recipient,
      subject: args.subject,
      body: args.body,
      gmailMessageId: args.gmailMessageId,
      error: args.error,
      createdAt: now,
    });

    await ctx.db.patch(args.listservId, {
      joinStatus: args.status === "sent" ? "join_email_sent" : "failed",
      updatedAt: now,
    });
  },
});

async function upsertCandidates(ctx: MutationCtx, candidates: CandidateInput[]) {
  const now = Date.now();
  let inserted = 0;
  let updated = 0;

  for (const input of candidates) {
    const email = normalizeEmail(input.email);
    const existing = await ctx.db
      .query("listservCandidates")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      if (existing.status !== "candidate") continue;
      await ctx.db.patch(existing._id, {
        displayName: input.displayName ?? existing.displayName ?? inferDisplayName(email),
        confidence: Math.max(existing.confidence, input.confidence),
        popularity: input.popularity ?? existing.popularity,
        matchedReasons: [...new Set([...existing.matchedReasons, ...input.matchedReasons])],
        updatedAt: now,
      });
      updated += 1;
      continue;
    }

    await ctx.db.insert("listservCandidates", {
      email,
      displayName: input.displayName ?? inferDisplayName(email),
      source: "d1_discovery",
      status: "candidate",
      confidence: input.confidence,
      popularity: input.popularity,
      matchedReasons: input.matchedReasons,
      createdAt: now,
      updatedAt: now,
    });
    inserted += 1;
  }

  return { inserted, updated };
}

async function discoverCandidatesFromInitialDataset() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !databaseId || !token) {
    throw new Error(
      "Cloudflare env vars are not configured. Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN.",
    );
  }

  const sql = `
    SELECT e.email, COUNT(es.user_hash) AS popularity
    FROM emails e
    LEFT JOIN email_submissions es ON es.email_id = e.id
    WHERE
      lower(e.email) LIKE '%@list.cornell.edu'
      OR lower(e.email) LIKE '%@mm.list.cornell.edu'
      OR lower(e.email) LIKE '%@list.cs.cornell.edu'
      OR lower(substr(e.email, 1, instr(e.email, '@') - 1)) LIKE '%-l'
      OR lower(substr(e.email, 1, instr(e.email, '@') - 1)) LIKE '%announce%'
      OR lower(e.email) LIKE '%newsletter%'
      OR lower(e.email) LIKE '%digest%'
    GROUP BY e.id
    ORDER BY popularity DESC, e.email
    LIMIT 250
  `;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    },
  );

  if (!response.ok) {
    throw new Error(`Cloudflare D1 query failed (${response.status}): ${await response.text()}`);
  }

  const payload = (await response.json()) as D1QueryResponse;
  if (!payload.success) {
    throw new Error(payload.errors?.map((error) => error.message).join(", ") || "D1 query failed.");
  }

  return (payload.result?.[0]?.results ?? [])
    .flatMap((row) => scoreCandidate(row.email ?? "", Number(row.popularity ?? 0)))
    .filter((candidateRow) => candidateRow.confidence >= 45)
    .slice(0, 100);
}

function scoreCandidate(emailValue: string, popularity: number): CandidateInput[] {
  const email = normalizeEmail(emailValue);
  if (!email || !email.includes("@")) return [];
  if (/noreply|no-reply|daemon|notification|receipt|verify/.test(email)) return [];

  const [local = "", domain = ""] = email.split("@");
  const reasons: string[] = [];
  let score = 0;

  if (["list.cornell.edu", "mm.list.cornell.edu", "list.cs.cornell.edu"].includes(domain)) {
    score += 55;
    reasons.push("list domain");
  }

  if (local.endsWith("-l")) {
    score += 20;
    reasons.push("list-style address");
  }

  if (/announce|newsletter|digest/.test(local)) {
    score += 12;
    reasons.push("announcement-style address");
  }

  if (popularity >= 5) {
    score += 15;
    reasons.push("high overlap");
  } else if (popularity >= 2) {
    score += 8;
    reasons.push("some overlap");
  }

  if (local.startsWith("owner-")) {
    score -= 30;
    reasons.push("owner/admin address");
  }

  if (!domain.endsWith("cornell.edu") && !domain.endsWith("cornellsun.com")) score -= 35;

  return [
    {
      email,
      displayName: inferDisplayName(email),
      confidence: Math.max(0, Math.min(100, score)),
      popularity,
      matchedReasons: reasons.length > 0 ? reasons : ["pattern match"],
    },
  ];
}

async function getGmailConnection(ctx: ActionCtx) {
  const connection = (await ctx.runQuery(
    internal.gmailConnection.getConnection,
    {},
  )) as GmailConnectionSnapshot | null;

  if (!connection) {
    throw new Error("Gmail is not connected. Use the admin page to connect Gmail first.");
  }

  return connection;
}

async function refreshGmailAccessToken(ctx: ActionCtx, refreshToken: string) {
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
  if (!data.access_token) throw new Error("Token refresh returned no access_token.");
  return data.access_token;
}

async function sendGmailMessage(
  accessToken: string,
  from: string,
  to: string,
  subject: string,
  body: string,
) {
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ].join("\r\n");

  const response = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64UrlEncode(mime) }),
  });

  if (!response.ok) {
    throw new Error(`Gmail send failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as GmailSendResponse;
}

function candidate(
  email: string,
  displayName: string,
  confidence: number,
  popularity: number,
  matchedReasons: string[],
): CandidateInput {
  return { email, displayName, confidence, popularity, matchedReasons };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function stripOwnerPrefix(email: string) {
  const [local, domain] = normalizeEmail(email).split("@");
  if (!local || !domain) return normalizeEmail(email);
  return `${local.replace(/^owner-/, "")}@${domain}`;
}

function inferDisplayName(email: string) {
  const local = email.split("@")[0] ?? email;
  const trimmed = local.replace(/^owner-/, "").replace(/-l$/, "");
  return trimmed
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => (part.length <= 4 ? part.toUpperCase() : capitalize(part)))
    .join(" ");
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function cleanOptional(value: string | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

function cleanRequired(value: string, label: string) {
  const cleaned = cleanOptional(value);
  if (!cleaned) throw new Error(`${label} is required.`);
  return cleaned;
}

function base64UrlEncode(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === "string") return error.slice(0, 500);
  return "Unknown error.";
}
