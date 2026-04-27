import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const CONNECTION_KEY = "primary";

export const getConnection = internalQuery({
  args: {},
  handler: async (ctx) => {
    const connection = await ctx.db
      .query("gmailConnections")
      .withIndex("by_key", (q) => q.eq("key", CONNECTION_KEY))
      .unique();

    if (!connection || connection.status !== "connected") return null;
    return {
      email: connection.email,
      refreshToken: connection.refreshToken,
    };
  },
});

export const markInvalid = internalMutation({
  args: { error: v.string() },
  handler: async (ctx, args) => {
    const connection = await ctx.db
      .query("gmailConnections")
      .withIndex("by_key", (q) => q.eq("key", CONNECTION_KEY))
      .unique();

    if (!connection) return;

    await ctx.db.patch(connection._id, {
      status: "invalid",
      lastError: args.error,
      updatedAt: Date.now(),
    });
  },
});
