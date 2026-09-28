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
import {
  hasAuthenticatedCornellSender,
  isCornellListAddress,
  isJoinConfirmationMail,
  isLegacyLyrisAddress,
  isSimplelistsAddress,
  listNameFromConfirmationSender,
  managerAddressForList,
  simplelistsAddressForList,
  subscribeUrlForList,
  subscriptionListNameFrom,
  SIMPLELISTS_ORIGIN,
} from "./lib/cornellLists";
import {
  buildLyrisJoinDefaults,
  lyrisDetectionReasons,
} from "./lib/legacyLyris";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx } from "./_generated/server";

declare const process: { env: Record<string, string | undefined> };

const GMAIL_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

/** Name submitted on the Simplelists subscribe form alongside the inbox address. */
const SUBSCRIBER_DISPLAY_NAME = "Cornell Loop";

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

type RematchResult = {
  scanned: number;
  matched: number;
  candidatesRaised: number;
};

type GmailConnectionSnapshot = {
  email: string;
  refreshToken: string;
};

type SubscribeResult = {
  ok: boolean;
  httpStatus?: number;
  subscribeUrl: string;
  error?: string;
};

type JoinStrategy =
  | "cornell_simplelists"
  | "cornell_simplelists_owner_contact"
  | "cornell_lyris"
  | "cornell_lyris_owner_contact"
  | "campus_groups"
  | "newsletter"
  | "direct_org_email"
  | "manual"
  | "unknown";

type JoinDetection = {
  joinStrategy: JoinStrategy;
  joinRecipient?: string;
  ownerRecipient?: string;
  joinSubject?: string;
  joinBody?: string;
  joinInstructions?: string;
  subscribeUrl?: string;
  joinConfidence: number;
  joinDetectionReasons: string[];
  joinDetectedAt: number;
};

/**
 * {@link JoinDetection} with every optional key required-but-nullable, so
 * spreading it into a `ctx.db.patch` clears fields the new strategy does not
 * set instead of leaving the previous strategy's values behind.
 */
type JoinDetectionPatch = JoinDetection & {
  joinRecipient: string | undefined;
  ownerRecipient: string | undefined;
  joinSubject: string | undefined;
  joinBody: string | undefined;
  joinInstructions: string | undefined;
  subscribeUrl: string | undefined;
};

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
      clearedConfirmations,
    ] = await Promise.all([
      ctx.db.query("listservCandidates").order("desc").take(150),
      ctx.db.query("listservs").order("desc").take(150),
      ctx.db.query("listservIngestionState").collect(),
      ctx.db
        .query("discoveryRuns")
        .withIndex("by_started_at")
        .order("desc")
        .take(12),
      ctx.db
        .query("joinAttempts")
        .withIndex("by_created_at")
        .order("desc")
        .take(20),
      ctx.db
        .query("ingestionRuns")
        .withIndex("by_started_at")
        .order("desc")
        .take(20),
      ctx.db
        .query("listservMessages")
        .withIndex("by_received_at")
        .order("desc")
        .take(100),
      ctx.db
        .query("listservMessages")
        .withIndex("by_confirmation_cleared_at")
        .order("desc")
        .take(50),
    ]);

    // Fields needed for the confirmation queue (link extraction + sender matching).
    const confirmationFields = (m: (typeof recentMessages)[number]) => ({
      _id: m._id,
      _creationTime: m._creationTime,
      receivedAt: m.receivedAt,
      listservId: m.listservId,
      subject: m.subject,
      senderEmail: m.senderEmail,
      sender: m.sender,
      to: m.to,
      cc: m.cc,
      processingStatus: m.processingStatus,
      confirmationClearedAt: m.confirmationClearedAt,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml,
      // Whether the receiving server recorded a DMARC/DKIM pass for a Cornell
      // domain. The admin UI only renders the confirmation link as clickable
      // when this holds, so the (large) raw headers never leave the backend.
      senderAuthenticated: hasAuthenticatedCornellSender(m.headers),
    });

    // Pending confirmations: uncleared messages that look like confirmation requests.
    // These need body content so we keep those fields — but only for this targeted set.
    const pendingConfirmations = recentMessages
      .filter(
        (m) =>
          m.confirmationClearedAt === undefined && isJoinConfirmationMail(m),
      )
      .map(confirmationFields);

    // Project only the fields the admin UI actually needs for the general message
    // list — never send email body content (bodyHtml / bodyText) there.
    const recentMessagesProjected = recentMessages.map((m) => ({
      _id: m._id,
      _creationTime: m._creationTime,
      receivedAt: m.receivedAt,
      listservId: m.listservId,
      subject: m.subject,
      senderEmail: m.senderEmail,
      processingStatus: m.processingStatus,
    }));

    // Cleared confirmations also need body fields for the same reasons.
    const clearedConfirmationsFiltered = clearedConfirmations
      .filter((message) => message.confirmationClearedAt !== undefined)
      .map(confirmationFields);

    return {
      candidates,
      listservs,
      ingestionState,
      discoveryRuns,
      joinAttempts,
      ingestionRuns,
      recentMessages: recentMessagesProjected,
      pendingConfirmations,
      clearedConfirmations: clearedConfirmationsFiltered,
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
      const stats = (await ctx.runMutation(
        internal.listservAdmin.upsertDiscoveredCandidates,
        {
          candidates: discovered,
        },
      )) as DiscoveryStats;

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
    const joinDetection = detectJoinStrategy(listEmail, [
      candidateRow.email,
      listEmail,
    ]);
    const listservFields = {
      name:
        cleanOptional(args.name) ??
        candidateRow.displayName ??
        inferDisplayName(listEmail),
      listEmail,
      senderEmails: [...new Set([candidateRow.email, listEmail])],
      status: "joining" as const,
      joinMethod: args.joinMethod ?? ("unknown" as const),
      joinStatus: "not_started" as const,
      ...joinDetection,
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

    const listserv = await ctx.runQuery(
      internal.listservAdmin.getListservForAdmin,
      {
        listservId: args.listservId,
      },
    );
    if (!listserv) throw new Error("Listserv not found.");

    const recipient = cleanRequired(args.recipient, "Recipient");
    const subject = cleanRequired(args.subject, "Subject");
    const body = args.body;

    try {
      const connection = await getGmailConnection(ctx);
      const accessToken = await refreshGmailAccessToken(
        ctx,
        connection.refreshToken,
      );
      const sent = await sendGmailMessage(
        accessToken,
        connection.email,
        recipient,
        subject,
        body,
      );

      await ctx.runMutation(internal.listservAdmin.recordJoinAttempt, {
        listservId: args.listservId,
        status: "sent",
        method: "email",
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
        method: "email",
        recipient,
        subject,
        body,
        error: formatError(error),
      });
      throw error;
    }
  },
});

/**
 * Subscribes the ingestion inbox to a Simplelists list through the list's
 * public web form, which is the only join path Simplelists supports.
 *
 * This is a convenience, never the only path: on any failure the Join tab
 * still renders the raw subscribe URL so an admin can click through by hand.
 * Lists configured to require approval degrade gracefully — Simplelists
 * notifies their managers instead of subscribing us immediately, which still
 * shows up here as a successful POST.
 */
export const submitSimplelistsSubscribe = action({
  args: { token: v.string(), listservId: v.id("listservs") },
  returns: v.object({
    ok: v.boolean(),
    httpStatus: v.optional(v.number()),
    subscribeUrl: v.string(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<SubscribeResult> => {
    requireAdminToken(args.token);

    const listserv = await ctx.runQuery(
      internal.listservAdmin.getListservForAdmin,
      { listservId: args.listservId },
    );
    if (!listserv) throw new Error("Listserv not found.");

    const listName = subscriptionListNameFrom(listserv.listEmail);
    const subscribeUrl =
      listserv.subscribeUrl ??
      (listName ? subscribeUrlForList(listName) : null);
    const listAddress = listName ? simplelistsAddressForList(listName) : null;

    if (!listName || !subscribeUrl || !listAddress) {
      throw new Error(
        `${listserv.listEmail} is not a Simplelists list address, so it has no subscribe form.`,
      );
    }

    const connection = await getGmailConnection(ctx);

    try {
      const { sessionCookie, csrfToken, listField } =
        await fetchSubscribeForm(subscribeUrl);

      const form = new URLSearchParams({
        csrf_token: csrfToken,
        name: SUBSCRIBER_DISPLAY_NAME,
        email: connection.email,
        list: listField ?? listAddress,
        action: "subscribe",
      });

      const response = await fetch(`${SIMPLELISTS_ORIGIN}/subscribe/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Convex's fetch does not manage cookies, so the session captured
          // from the GET is echoed back by hand. The csrf_token is bound to
          // it, so dropping this makes the POST fail CSRF validation.
          Cookie: sessionCookie,
          Referer: subscribeUrl,
        },
        body: form.toString(),
      });

      if (!response.ok) {
        throw new Error(
          `Subscribe POST failed (${response.status}): ${(await response.text()).slice(0, 300)}`,
        );
      }

      await ctx.runMutation(internal.listservAdmin.recordJoinAttempt, {
        listservId: args.listservId,
        status: "sent",
        method: "web_form",
        httpStatus: response.status,
        subscribeUrl,
        recipient: listAddress,
      });

      return { ok: true, httpStatus: response.status, subscribeUrl };
    } catch (error) {
      const message = formatError(error);
      await ctx.runMutation(internal.listservAdmin.recordJoinAttempt, {
        listservId: args.listservId,
        status: "failed",
        method: "web_form",
        httpStatus: httpStatusFrom(error),
        subscribeUrl,
        recipient: listAddress,
        error: message,
      });

      // Deliberately not rethrown: the UI needs to render the fallback link
      // alongside the reason, and a thrown action would surface only a toast.
      return {
        ok: false,
        httpStatus: httpStatusFrom(error),
        subscribeUrl,
        error: message,
      };
    }
  },
});

export const recomputeJoinStrategy = mutation({
  args: { token: v.string(), listservId: v.id("listservs") },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const listserv = await ctx.db.get(args.listservId);
    if (!listserv) throw new Error("Listserv not found.");

    await ctx.db.patch(args.listservId, {
      ...detectJoinStrategy(listserv.listEmail, listserv.senderEmails),
      updatedAt: Date.now(),
    });
  },
});

export const updateJoinStrategy = mutation({
  args: {
    token: v.string(),
    listservId: v.id("listservs"),
    joinStrategy: v.union(
      v.literal("cornell_simplelists"),
      v.literal("cornell_simplelists_owner_contact"),
      // Lyris values stay accepted so an admin can still correct a legacy row,
      // but they are no longer offered for new selections in the UI.
      v.literal("cornell_lyris"),
      v.literal("cornell_lyris_owner_contact"),
      v.literal("campus_groups"),
      v.literal("newsletter"),
      v.literal("direct_org_email"),
      v.literal("manual"),
      v.literal("unknown"),
    ),
  },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const listserv = await ctx.db.get(args.listservId);
    if (!listserv) throw new Error("Listserv not found.");

    await ctx.db.patch(args.listservId, {
      ...buildJoinDefaults(
        args.joinStrategy,
        listserv.listEmail,
        listserv.name,
      ),
      updatedAt: Date.now(),
    });
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

export const rematchUnassignedMessagesNow = action({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<RematchResult> => {
    requireAdminToken(args.token);
    return await ctx.runMutation(internal.ingestion.rematchUnassignedMessages, {
      limit: args.limit,
    });
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
    const patch =
      args.joinStatus === "joined"
        ? {
            joinStatus: args.joinStatus,
            status: "active" as const,
            updatedAt: Date.now(),
          }
        : { joinStatus: args.joinStatus, updatedAt: Date.now() };

    await ctx.db.patch(args.listservId, {
      ...patch,
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

export const clearConfirmation = mutation({
  args: { token: v.string(), messageId: v.id("listservMessages") },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const now = Date.now();
    const message = await ctx.db.get(args.messageId);
    const listservId =
      message?.listservId ??
      (message ? await resolveListservFromMessage(ctx, message) : undefined);

    await ctx.db.patch(args.messageId, {
      confirmationClearedAt: now,
      listservId,
    });

    if (listservId) {
      await ctx.db.patch(listservId, {
        joinStatus: "joined",
        status: "active",
        updatedAt: now,
      });
    }
  },
});

async function resolveListservFromMessage(
  ctx: MutationCtx,
  message: {
    subject: string;
    bodyText: string;
    senderEmail: string;
    to: string[];
    cc: string[];
  },
) {
  // A Simplelists confirmation names its list in the sender address, so it can
  // be resolved exactly. Try that before the substring heuristic below, which
  // matches on local parts and can easily land on the wrong row.
  const listName = listNameFromConfirmationSender(message.senderEmail);
  const listAddress = listName ? simplelistsAddressForList(listName) : null;
  if (listAddress) {
    // `by_list_email` is not unique — duplicate rows are exactly the state the
    // reconciliation work exists to clean up — so take the first match.
    const exact = await ctx.db
      .query("listservs")
      .withIndex("by_list_email", (q) => q.eq("listEmail", listAddress))
      .first();
    if (exact) return exact._id;
  }

  const listservs = await ctx.db.query("listservs").collect();
  const searchable =
    `${message.subject}\n${message.bodyText}\n${message.senderEmail}\n${message.to.join(" ")}\n${message.cc.join(" ")}`.toLowerCase();

  for (const listserv of listservs) {
    const addresses = [listserv.listEmail, ...listserv.senderEmails].map(
      (value) => value.toLowerCase(),
    );
    const localParts = addresses
      .map((value) => value.split("@")[0])
      .filter(Boolean);

    if (
      addresses.some((address) => searchable.includes(address)) ||
      localParts.some((local) => searchable.includes(local))
    ) {
      return listserv._id;
    }
  }

  return undefined;
}

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
    method: v.optional(v.union(v.literal("email"), v.literal("web_form"))),
    recipient: v.optional(v.string()),
    subject: v.optional(v.string()),
    body: v.optional(v.string()),
    gmailMessageId: v.optional(v.string()),
    httpStatus: v.optional(v.number()),
    subscribeUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const method = args.method ?? "email";
    await ctx.db.insert("joinAttempts", {
      listservId: args.listservId,
      status: args.status,
      method,
      recipient: args.recipient,
      subject: args.subject,
      body: args.body,
      gmailMessageId: args.gmailMessageId,
      httpStatus: args.httpStatus,
      subscribeUrl: args.subscribeUrl,
      error: args.error,
      createdAt: now,
    });

    // A successful web subscribe does not join us — Simplelists replies with a
    // confirmation mail that ingestion has to see, so the row waits on that
    // rather than reporting an e-mail we never sent.
    await ctx.db.patch(args.listservId, {
      joinStatus:
        args.status === "failed"
          ? "failed"
          : method === "web_form"
            ? "awaiting_confirmation"
            : "join_email_sent",
      updatedAt: now,
    });
    return null;
  },
});

async function upsertCandidates(
  ctx: MutationCtx,
  candidates: CandidateInput[],
) {
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
        displayName:
          input.displayName ?? existing.displayName ?? inferDisplayName(email),
        confidence: Math.max(existing.confidence, input.confidence),
        popularity: input.popularity ?? existing.popularity,
        matchedReasons: [
          ...new Set([...existing.matchedReasons, ...input.matchedReasons]),
        ],
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
    throw new Error(
      `Cloudflare D1 query failed (${response.status}): ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as D1QueryResponse;
  if (!payload.success) {
    throw new Error(
      payload.errors?.map((error) => error.message).join(", ") ||
        "D1 query failed.",
    );
  }

  return (payload.result?.[0]?.results ?? [])
    .flatMap((row) =>
      scoreCandidate(row.email ?? "", Number(row.popularity ?? 0)),
    )
    .filter((candidateRow) => candidateRow.confidence >= 45)
    .slice(0, 100);
}

function scoreCandidate(
  emailValue: string,
  popularity: number,
): CandidateInput[] {
  const email = normalizeEmail(emailValue);
  if (!email || !email.includes("@")) return [];
  if (/noreply|no-reply|daemon|notification|receipt|verify/.test(email))
    return [];

  const [local = "", domain = ""] = email.split("@");
  const reasons: string[] = [];
  let score = 0;

  // Discovery scores current Simplelists addresses as well as legacy Lyris
  // ones — new lists only ever land on lists.cornell.edu.
  if (isCornellListAddress(email)) {
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

  if (!domain.endsWith("cornell.edu") && !domain.endsWith("cornellsun.com"))
    score -= 35;

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

function detectJoinStrategy(
  listEmail: string,
  senderEmails: string[],
): JoinDetectionPatch {
  const allEmails = [listEmail, ...senderEmails].map(normalizeEmail);
  const primary = normalizeEmail(listEmail);
  const [local = "", domain = ""] = primary.split("@");

  // Simplelists is checked first so a real lists.cornell.edu address can never
  // fall through to the generic `endsWith("cornell.edu")` branch below, which
  // would classify it `direct_org_email` and offer to *email* the list asking
  // to be added. None of the existing non-Cornell-list rows reach this branch,
  // so ordering it first leaves their classification untouched.
  const simplelistsAddress = allEmails.find(isSimplelistsAddress);
  if (simplelistsAddress) {
    const viaSender = simplelistsAddress !== primary;
    return buildJoinDefaults(
      "cornell_simplelists",
      simplelistsAddress,
      inferDisplayName(simplelistsAddress),
      [
        viaSender
          ? "Sender uses the Cornell Simplelists domain"
          : "Cornell Simplelists list address",
        "Official flow: subscribe through the list's web form",
      ],
    );
  }

  // Only the retired Lyris domains get the e-mail-command join flow, and only
  // for rows that already live on those domains. See lib/legacyLyris.ts.
  if (isLegacyLyrisAddress(primary)) {
    return buildJoinDefaults(
      "cornell_lyris",
      primary,
      inferDisplayName(primary),
      lyrisDetectionReasons(primary, false),
    );
  }

  const lyrisSender = allEmails.find(isLegacyLyrisAddress);
  if (lyrisSender) {
    return buildJoinDefaults(
      "cornell_lyris",
      lyrisSender,
      inferDisplayName(lyrisSender),
      lyrisDetectionReasons(lyrisSender, true),
    );
  }

  if (
    domain === "campusgroups.com" ||
    allEmails.some((email) => email.endsWith("@campusgroups.com"))
  ) {
    return buildJoinDefaults(
      "campus_groups",
      primary,
      inferDisplayName(primary),
      ["CampusGroups sender", "Usually requires web signup or org membership"],
    );
  }

  if (isNewsletterDomain(domain) || /newsletter|digest/.test(local)) {
    return buildJoinDefaults("newsletter", primary, inferDisplayName(primary), [
      "Newsletter-style sender",
      "Usually requires a web signup flow",
    ]);
  }

  if (
    domain.endsWith("cornell.edu") &&
    !/noreply|no-reply|notification|daemon|receipt/.test(local)
  ) {
    return buildJoinDefaults(
      "direct_org_email",
      primary,
      inferDisplayName(primary),
      ["Cornell sender address", "Can draft a polite subscribe request"],
    );
  }

  return buildJoinDefaults("unknown", primary, inferDisplayName(primary), [
    "No reliable join pattern detected",
  ]);
}

/**
 * Every optional field is spelled out so a `ctx.db.patch` of this object
 * *clears* whatever the previous strategy stored rather than leaving it
 * behind. That matters most for `cornell_simplelists`: a stale `joinRecipient`
 * inherited from a `direct_org_email` classification would make the Join tab
 * offer an email composer for a list that cannot be joined by email at all.
 */
function buildJoinDefaults(
  joinStrategy: JoinStrategy,
  listEmail: string,
  name: string,
  reasons?: string[],
): JoinDetectionPatch {
  return {
    joinRecipient: undefined,
    ownerRecipient: undefined,
    joinSubject: undefined,
    joinBody: undefined,
    joinInstructions: undefined,
    subscribeUrl: undefined,
    ...resolveJoinDefaults(joinStrategy, listEmail, name, reasons),
  };
}

function resolveJoinDefaults(
  joinStrategy: JoinStrategy,
  listEmail: string,
  name: string,
  reasons?: string[],
): JoinDetection {
  const email = normalizeEmail(listEmail);
  const [local = ""] = email.split("@");
  const now = Date.now();

  if (joinStrategy === "cornell_simplelists") {
    const listName = subscriptionListNameFrom(email);
    const subscribeUrl = listName ? subscribeUrlForList(listName) : null;
    const managerAddress = listName ? managerAddressForList(listName) : null;
    return {
      joinStrategy,
      // No joinRecipient/joinSubject/joinBody: Simplelists cannot be joined by
      // email, so leaving them unset is what stops the UI offering a composer.
      ownerRecipient: managerAddress ?? undefined,
      subscribeUrl: subscribeUrl ?? undefined,
      joinInstructions: subscribeUrl
        ? "Cornell Simplelists lists are joined through the web form — email commands are not supported. Submit the subscribe form, then confirm from the email Simplelists sends back."
        : "This looks like a Simplelists address but its list name could not be derived, so no subscribe URL is available. Find the list on lists.cornell.edu and subscribe by hand.",
      joinConfidence: subscribeUrl ? 95 : 40,
      joinDetectionReasons: reasons ?? ["Cornell Simplelists list address"],
      joinDetectedAt: now,
    };
  }

  if (joinStrategy === "cornell_simplelists_owner_contact") {
    const listName = subscriptionListNameFrom(email);
    const managerAddress = listName ? managerAddressForList(listName) : null;
    return {
      joinStrategy,
      joinRecipient: managerAddress ?? undefined,
      ownerRecipient: managerAddress ?? undefined,
      joinSubject: listName
        ? `Request to join ${listName}`
        : "Request to join mailing list",
      joinBody: managerContactBody(listName ?? name),
      subscribeUrl: listName
        ? (subscribeUrlForList(listName) ?? undefined)
        : undefined,
      joinInstructions:
        "Use this when the list is closed or requires approval, so the web subscribe form will not add us directly. This emails the list's human manager.",
      joinConfidence: managerAddress ? 75 : 30,
      joinDetectionReasons: reasons ?? ["Simplelists manager contact fallback"],
      joinDetectedAt: now,
    };
  }

  const lyrisDefaults = buildLyrisJoinDefaults(
    joinStrategy,
    local,
    reasons,
    now,
  );
  if (lyrisDefaults) return { joinStrategy, ...lyrisDefaults };

  if (joinStrategy === "campus_groups") {
    return {
      joinStrategy,
      joinInstructions:
        "CampusGroups lists usually require manual web signup or org membership. Mark manual required unless you find a public signup link.",
      joinConfidence: 70,
      joinDetectionReasons: reasons ?? ["CampusGroups sender"],
      joinDetectedAt: now,
    };
  }

  if (joinStrategy === "newsletter") {
    return {
      joinStrategy,
      joinInstructions:
        "Newsletter senders usually need manual web signup. Use the sender/site link rather than emailing this address unless you know it accepts requests.",
      joinConfidence: 60,
      joinDetectionReasons: reasons ?? ["Newsletter-style sender"],
      joinDetectedAt: now,
    };
  }

  if (joinStrategy === "direct_org_email") {
    return {
      joinStrategy,
      joinRecipient: email,
      joinSubject: "Request to join mailing list",
      joinBody: directRequestBody(name),
      joinInstructions:
        "This is a direct request to a likely org/admin address. Review before sending.",
      joinConfidence: 55,
      joinDetectionReasons: reasons ?? ["Direct Cornell sender"],
      joinDetectedAt: now,
    };
  }

  return {
    joinStrategy,
    joinRecipient: joinStrategy === "manual" ? undefined : email,
    joinSubject:
      joinStrategy === "manual" ? undefined : "Request to join mailing list",
    joinBody: joinStrategy === "manual" ? undefined : directRequestBody(name),
    joinInstructions:
      "No reliable automated join flow detected. Review manually before sending anything.",
    joinConfidence: joinStrategy === "manual" ? 100 : 20,
    joinDetectionReasons: reasons ?? ["Manual review required"],
    joinDetectedAt: now,
  };
}

function isNewsletterDomain(domain: string) {
  return /substack|beehiiv|mailchimp|mailerlite|ccsend|constantcontact|newsletter/.test(
    domain,
  );
}

function managerContactBody(listName: string) {
  return `Hello,\n\nCould you please add dtiincubator@gmail.com to ${listName}?\n\nThis inbox is used by Cornell Loop to aggregate public Cornell student organization announcements for Cornell students.\n\nThank you.`;
}

function directRequestBody(name: string) {
  return `Hello,\n\nCould you please add dtiincubator@gmail.com to ${name}'s mailing list?\n\nThis inbox is used by Cornell Loop to aggregate public Cornell student organization announcements for Cornell students.\n\nThank you.`;
}

async function getGmailConnection(ctx: ActionCtx) {
  const connection = (await ctx.runQuery(
    internal.gmailConnection.getConnection,
    {},
  )) as GmailConnectionSnapshot | null;

  if (!connection) {
    throw new Error(
      "Gmail is not connected. Use the admin page to connect Gmail first.",
    );
  }

  return connection;
}

async function refreshGmailAccessToken(ctx: ActionCtx, refreshToken: string) {
  const clientId = process.env.ADMIN_GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.ADMIN_GOOGLE_OAUTH_CLIENT_SECRET;

  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error(
      "Admin ingestion Google OAuth client env vars are not configured.",
    );
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
    throw new Error(
      `Gmail send failed (${response.status}): ${await response.text()}`,
    );
  }

  return (await response.json()) as GmailSendResponse;
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
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 500);
  if (typeof error === "string") return error.slice(0, 500);
  return "Unknown error.";
}

/**
 * An HTTP failure from the Simplelists subscribe flow, carrying the status so
 * the recorded attempt can distinguish "list does not exist" (404) from a
 * transient upstream error.
 */
class SubscribeHttpError extends Error {
  readonly httpStatus: number;

  constructor(httpStatus: number, message: string) {
    super(message);
    this.name = "SubscribeHttpError";
    this.httpStatus = httpStatus;
  }
}

function httpStatusFrom(error: unknown) {
  return error instanceof SubscribeHttpError ? error.httpStatus : undefined;
}

/**
 * GETs a list's subscribe page to pick up the session cookie and the
 * session-bound CSRF token the POST requires.
 *
 * A 404 here is meaningful rather than incidental: Simplelists serves the page
 * only for lists that exist and accept self-subscribe, so the URL doubles as a
 * validity probe.
 */
async function fetchSubscribeForm(subscribeUrl: string) {
  const response = await fetch(subscribeUrl, { redirect: "follow" });

  if (response.status === 404) {
    throw new SubscribeHttpError(
      404,
      "Simplelists returned 404 for this subscribe page — the list does not exist or does not allow self-subscribe. Contact the list manager instead.",
    );
  }
  if (!response.ok) {
    throw new SubscribeHttpError(
      response.status,
      `Could not load the subscribe form (${response.status}).`,
    );
  }

  const html = await response.text();
  const form = subscribeFormFrom(html);
  const csrfToken = inputValueFrom(form, "csrf_token");
  if (!csrfToken) {
    throw new Error(
      "Loaded the subscribe form but found no csrf_token field; the Simplelists form markup has probably changed.",
    );
  }

  const sessionCookie = sessionCookieFrom(response);
  if (!sessionCookie) {
    throw new Error(
      "Simplelists did not set a session cookie on the subscribe page, so the CSRF token cannot be used.",
    );
  }

  // The form carries the list address in its own casing (`WICC-L@…`, not
  // `wicc-l@…`). It is submitted verbatim rather than rebuilt from the
  // lowercased list name, so this cannot break if Simplelists ever compares it
  // case-sensitively.
  return {
    sessionCookie,
    csrfToken,
    listField: inputValueFrom(form, "list"),
  };
}

/**
 * The subscribe form's markup. The page also contains an unrelated `/subs/`
 * form, so the fields are read from this block rather than the whole document.
 */
function subscribeFormFrom(html: string) {
  const match = html.match(
    /<form[^>]+action=["'][^"']*\/subscribe\/["'][^>]*>([\s\S]*?)<\/form>/i,
  );
  return match?.[1] ?? html;
}

function inputValueFrom(html: string, field: string) {
  const name = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match =
    html.match(
      new RegExp(
        `<input[^>]+name=["']${name}["'][^>]+value=["']([^"']*)["']`,
        "i",
      ),
    ) ??
    html.match(
      new RegExp(
        `<input[^>]+value=["']([^"']*)["'][^>]+name=["']${name}["']`,
        "i",
      ),
    );
  return match?.[1] ?? null;
}

/**
 * Rebuilds a `name=value` Cookie header from the response's `Set-Cookie`,
 * dropping attributes (`Path`, `HttpOnly`, …) that must not be echoed back.
 */
function sessionCookieFrom(response: Response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) return null;

  const pairs = raw
    .split(/,(?=[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter((pair): pair is string => Boolean(pair) && pair.includes("="));

  return pairs.length > 0 ? pairs.join("; ") : null;
}
