/**
 * One place that decides who is allowed in.
 *
 * `authedQuery` / `authedMutation` wrap the stock `query` / `mutation`
 * builders and enforce, on every use (not just at account-creation time):
 *   1. The caller has a valid Convex Auth session (`getAuthUserId`).
 *   2. The signed-in user's email is a `@cornell.edu` address, or an
 *      exact extra address in `EXTRA_ALLOWED_EMAILS` (Chrome Web Store
 *      review). Remove that set to close the exception.
 *
 * Both checks throw a `ConvexError` with a stable `code` the frontend can
 * branch on. Handlers built on these wrappers receive `ctx.user` (the full
 * `users` doc) instead of re-deriving it from a raw `userId`.
 *
 * `users.currentUser` intentionally does NOT use `authedQuery` — it needs to
 * report the "signed in but non-Cornell" state (`rejectedDomain: true`)
 * rather than throw, so the frontend can sign the user out gracefully. Reuse
 * `isCornellEmail` there instead.
 */

import { ConvexError } from "convex/values";
import {
  customAction,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  action,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";

const ALLOWED_EMAIL_DOMAIN = "@cornell.edu";

/** Exact extras that skip the Cornell domain check. Empty this to revoke. */
const EXTRA_ALLOWED_EMAILS = new Set(["looptest.webstore@gmail.com"]);

export function isCornellEmail(email: string | undefined): boolean {
  if (typeof email !== "string") {
    return false;
  }
  const normalized = email.toLowerCase();
  return (
    normalized.endsWith(ALLOWED_EMAIL_DOMAIN) ||
    EXTRA_ALLOWED_EMAILS.has(normalized)
  );
}

async function requireCornellUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "You must be signed in to do that.",
    });
  }

  const user = await ctx.db.get(userId);
  if (user === null || !isCornellEmail(user.email)) {
    throw new ConvexError({
      code: "NON_CORNELL_EMAIL",
      message: "Loop is open to Cornell students only.",
    });
  }

  return user;
}

/**
 * Drop-in replacement for `query` that requires a signed-in Cornell user.
 * Handlers get `ctx.user: Doc<"users">` in addition to the normal ctx.
 */
export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const user = await requireCornellUser(ctx);
    return { ctx: { ...ctx, user }, args: {} };
  },
});

/**
 * Drop-in replacement for `mutation` that requires a signed-in Cornell user.
 * Handlers get `ctx.user: Doc<"users">` in addition to the normal ctx.
 */
export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const user = await requireCornellUser(ctx);
    return { ctx: { ...ctx, user }, args: {} };
  },
});

/**
 * Drop-in replacement for `action` that requires a signed-in Cornell user.
 * Handlers get `ctx.user: Doc<"users">` in addition to the normal ctx.
 *
 * Actions have no `ctx.db` of their own, so the Cornell-domain check runs via
 * `ctx.runQuery(internal.users.getCornellUser, ...)` — that query lives in
 * `users.ts`, not here, because referencing `internal.lib.auth.*` from
 * inside this file would make this module's own type depend on itself.
 */
export const authedAction = customAction(action, {
  args: {},
  // Explicit annotations below are required, not stylistic: this function
  // calls `internal.users.getCornellUser`, and `internal`'s type is built
  // from every module under convex/ including this one, which would
  // otherwise make `authedAction`'s type depend on itself.
  input: async (
    ctx: ActionCtx,
  ): Promise<{ ctx: ActionCtx & { user: Doc<"users"> }; args: object }> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "You must be signed in to do that.",
      });
    }

    const user: Doc<"users"> | null = await ctx.runQuery(
      internal.users.getCornellUser,
      { userId },
    );
    if (user === null) {
      throw new ConvexError({
        code: "NON_CORNELL_EMAIL",
        message: "Loop is open to Cornell students only.",
      });
    }

    return { ctx: { ...ctx, user }, args: {} };
  },
});
