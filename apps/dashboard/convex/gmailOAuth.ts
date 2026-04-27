import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  httpAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireAdminToken } from "./_shared/adminToken";

declare const process: { env: Record<string, string | undefined> };

const CONNECTION_KEY = "primary";
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_PROFILE_URL =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GmailProfileResponse = {
  emailAddress?: string;
};

export const connectionStatus = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);

    const connection = await ctx.db
      .query("gmailConnections")
      .withIndex("by_key", (q) => q.eq("key", CONNECTION_KEY))
      .unique();

    if (!connection) return null;

    return {
      email: connection.email,
      scopes: connection.scopes,
      status: connection.status,
      connectedAt: connection.connectedAt,
      updatedAt: connection.updatedAt,
      lastError: connection.lastError,
    };
  },
});

// Called from the frontend (with the admin token over the Convex API, not in a URL).
// Returns a short-lived one-time nonce the browser can use in the OAuth start URL
// so the admin token itself never appears in a navigable URL or server access log.
export const createOAuthNonce = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    requireAdminToken(args.token);
    const nonce = crypto.randomUUID();
    const now = Date.now();
    await ctx.db.insert("gmailOAuthStates", {
      state: nonce,
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes
      adminNonce: true,
    });
    return nonce;
  },
});

export const consumeAdminNonce = internalMutation({
  args: { nonce: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("gmailOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", args.nonce))
      .unique();
    if (!row || !row.adminNonce || row.usedAt || row.expiresAt < Date.now())
      return false;
    await ctx.db.patch(row._id, { usedAt: Date.now() });
    return true;
  },
});

export const start = httpAction(async (ctx, request) => {
  try {
    const url = new URL(request.url);

    // Prefer the safe nonce-based flow. Fall back to legacy ?token= for backwards
    // compatibility, but the frontend should always use the nonce path.
    const nonce = url.searchParams.get("nonce");
    if (nonce) {
      const valid = await ctx.runMutation(
        internal.gmailOAuth.consumeAdminNonce,
        { nonce },
      );
      if (!valid)
        return textResponse("Nonce is invalid, already used, or expired.", 403);
    } else {
      const token = url.searchParams.get("token") ?? "";
      requireAdminToken(token);
    }

    const state = crypto.randomUUID();
    await ctx.runMutation(internal.gmailOAuth.createOAuthState, { state });

    const redirectUri = getRedirectUri(request);
    const params = new URLSearchParams({
      client_id: getRequiredEnv("ADMIN_GOOGLE_OAUTH_CLIENT_ID"),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return Response.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`, 302);
  } catch (error) {
    return textResponse(formatError(error), 400);
  }
});

export const callback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  const oauthError = url.searchParams.get("error");

  if (oauthError)
    return htmlResponse(
      renderResultPage("Gmail connection failed", oauthError),
      400,
    );
  if (!state || !code)
    return htmlResponse(
      renderResultPage(
        "Gmail connection failed",
        "Missing OAuth state or code.",
      ),
      400,
    );

  try {
    const stateRow = await ctx.runQuery(
      internal.gmailOAuth.getValidOAuthState,
      { state },
    );
    if (!stateRow) throw new Error("OAuth state is invalid or expired.");

    const redirectUri = getRedirectUri(request);
    const tokenResponse = await exchangeCodeForTokens(code, redirectUri);
    if (!tokenResponse.refresh_token) {
      throw new Error(
        "Google did not return a refresh token. Try reconnecting and approving consent again.",
      );
    }
    if (!tokenResponse.access_token)
      throw new Error("Google did not return an access token.");

    const profile = await getGmailProfile(tokenResponse.access_token);
    const email = profile.emailAddress?.toLowerCase();
    if (!email) throw new Error("Could not read Gmail profile email.");

    await ctx.runMutation(internal.gmailOAuth.storeConnection, {
      state,
      email,
      refreshToken: tokenResponse.refresh_token,
      scopes: tokenResponse.scope?.split(" ") ?? GMAIL_SCOPES,
    });

    return htmlResponse(
      renderResultPage(
        "Gmail connected",
        `Connected ${email}. You can close this tab.`,
      ),
    );
  } catch (error) {
    return htmlResponse(
      renderResultPage("Gmail connection failed", formatError(error)),
      400,
    );
  }
});

export const createOAuthState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("gmailOAuthStates", {
      state: args.state,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
    });
  },
});

export const getValidOAuthState = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("gmailOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();

    if (!state || state.usedAt || state.expiresAt < Date.now()) return null;
    return { _id: state._id };
  },
});

export const storeConnection = internalMutation({
  args: {
    state: v.string(),
    email: v.string(),
    refreshToken: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const state = await ctx.db
      .query("gmailOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .unique();
    if (state) await ctx.db.patch(state._id, { usedAt: now });

    const existing = await ctx.db
      .query("gmailConnections")
      .withIndex("by_key", (q) => q.eq("key", CONNECTION_KEY))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        refreshToken: args.refreshToken,
        scopes: args.scopes,
        status: "connected",
        updatedAt: now,
        lastError: undefined,
      });
      return;
    }

    await ctx.db.insert("gmailConnections", {
      key: CONNECTION_KEY,
      email: args.email,
      refreshToken: args.refreshToken,
      scopes: args.scopes,
      status: "connected",
      connectedAt: now,
      updatedAt: now,
    });
  },
});

function getRedirectUri(request: Request) {
  const configured = process.env.ADMIN_GOOGLE_OAUTH_REDIRECT_URI;
  if (configured) return configured;

  const url = new URL(request.url);
  return `${url.origin}/gmail/oauth/callback`;
}

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const params = new URLSearchParams({
    code,
    client_id: getRequiredEnv("ADMIN_GOOGLE_OAUTH_CLIENT_ID"),
    client_secret: getRequiredEnv("ADMIN_GOOGLE_OAUTH_CLIENT_SECRET"),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const body = (await response.json()) as GoogleTokenResponse;

  if (!response.ok) {
    throw new Error(
      body.error_description ?? body.error ?? "Google token exchange failed.",
    );
  }

  return body;
}

async function getGmailProfile(accessToken: string) {
  const response = await fetch(GMAIL_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok)
    throw new Error(`Gmail profile request failed: ${await response.text()}`);
  return (await response.json()) as GmailProfileResponse;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function textResponse(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function htmlResponse(html: string, status = 200) {
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderResultPage(title: string, message: string) {
  return `<!doctype html><html><head><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:680px;margin:64px auto;padding:0 24px;line-height:1.5;color:#212529}div{border:1px solid #dee2e6;border-radius:16px;padding:24px}</style></head><body><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error.";
}
