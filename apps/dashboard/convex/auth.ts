import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

const ALLOWED_EMAIL_DOMAIN = "@cornell.edu";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      const email = args.profile.email;
      if (
        typeof email !== "string" ||
        !email.toLowerCase().endsWith(ALLOWED_EMAIL_DOMAIN)
      ) {
        throw new ConvexError({
          code: "NON_CORNELL_EMAIL",
          message: "Loop is open to Cornell students only.",
        });
      }
      if (args.existingUserId) {
        return args.existingUserId;
      }
      const name =
        typeof args.profile.name === "string" ? args.profile.name : undefined;
      const image =
        typeof args.profile.image === "string" ? args.profile.image : undefined;
      return await ctx.db.insert("users", {
        email: email.toLowerCase(),
        name,
        image,
      });
    },
  },
});
