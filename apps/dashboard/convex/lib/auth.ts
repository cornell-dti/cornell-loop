/**
 * One place that decides who is allowed in.
 *
 * `authedQuery` / `authedMutation` wrap the stock `query` / `mutation`
 * builders and enforce, on every use (not just at account-creation time):
 *   1. The caller has a valid Convex Auth session (`getAuthUserId`).
 *   2. The signed-in user's email is a `@cornell.edu` address.
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
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc } from "../_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";

const ALLOWED_EMAIL_DOMAIN = "@cornell.edu";

export function isCornellEmail(email: string | undefined): boolean {
  return (
    typeof email === "string" &&
    email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)
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
