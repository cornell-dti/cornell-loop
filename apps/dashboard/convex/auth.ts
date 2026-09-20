import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

/**
 * We intentionally do NOT reject non-Cornell emails here. This callback runs
 * inside the OAuth HTTP callback action — throwing here aborts the token
 * exchange entirely, so no session or user row is ever created. That leaves
 * the browser bounced back to `SITE_URL` with no session and no way for the
 * client to know *why* sign-in failed (the promise from the client's
 * `signIn("google")` call belongs to a different page load than the one that
 * eventually hits this callback, so a `.catch()` on it never runs).
 *
 * Instead we let the user row + session get created like normal, and gate on
 * domain everywhere else: `authedQuery`/`authedMutation`
 * (`convex/lib/auth.ts`) reject every data-access call for a non-Cornell
 * user, and `users.currentUser` reports `rejectedDomain: true` so
 * `useCurrentProfile` can sign the user back out and redirect to
 * `/?error=non-cornell` with an explanation. The session is real but inert —
 * every authed function is a dead end for it.
 *
 * We deliberately do NOT pass `hd: "cornell.edu"` in `authorization.params`.
 * For a real Google Workspace domain (which cornell.edu is), that parameter
 * doesn't just pre-filter the account chooser — it routes the browser
 * straight into that domain's own sign-in flow, skipping Google's account
 * picker entirely. A personal Gmail user gets dead-ended there instead of
 * reaching the friendly rejection banner above, which defeats the whole
 * point of this design. The server-side gate is the actual enforcement and
 * doesn't need Google's cooperation.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }
      const email = args.profile.email;
      if (typeof email !== "string") {
        throw new Error("Google profile did not include an email address.");
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
