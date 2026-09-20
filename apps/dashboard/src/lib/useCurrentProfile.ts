/**
 * useCurrentProfile — wraps `api.users.currentUser` and surfaces the bits the
 * dashboard cares about (auth user, profile row, onboarding flag, and a
 * defence-in-depth domain rejection signal).
 *
 * Side effect: when the backend reports `rejectedDomain: true` (i.e. somehow a
 * non-Cornell user row exists), we bounce the user to `/?error=non-cornell`
 * (so the Landing page can show a banner) and sign them out. The redirect is
 * gated by a ref so it only fires once per mount.
 *
 * IMPORTANT: `navigate()` is called *before* `signOut()`, not after. Every
 * protected route (`ProtectedRoute`/`AuthOnlyRoute` in App.tsx) renders
 * `<Unauthenticated><Navigate to="/" replace /></Unauthenticated>` as a
 * sibling of the `<Authenticated>` branch this hook lives inside. `signOut()`
 * flips `isAuthenticated` to `false` partway through its own promise chain
 * (via its internal `setToken` call) — *before* that promise resolves — so a
 * `signOut().finally(() => navigate(...))` ordering loses a race: the
 * protected route's own `<Navigate to="/" replace />` fires as soon as
 * `isAuthenticated` goes false, landing on a bare "/" with no error param,
 * and it wins because it fires strictly before our `.finally()` callback
 * (which only runs once `signOut()`'s entire chain — including the network
 * round trip — has settled). Navigating first unmounts the protected route
 * (and this hook's own instance) before `isAuthenticated` ever changes, so
 * that competing `<Navigate>` never gets a chance to render.
 */

import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

export interface CurrentProfileResult {
  user: Doc<"users"> | null;
  profile: Doc<"userProfiles"> | null;
  loading: boolean;
  isOnboarded: boolean;
  rejectedDomain: boolean;
}

export function useCurrentProfile(): CurrentProfileResult {
  const result = useQuery(api.users.currentUser);
  const { signOut } = useAuthActions();
  const navigate = useNavigate();
  const handledRejection = useRef(false);

  const rejectedDomain = result?.rejectedDomain ?? false;

  useEffect(() => {
    if (!rejectedDomain) return;
    if (handledRejection.current) return;
    handledRejection.current = true;
    navigate("/?error=non-cornell", { replace: true });
    void signOut();
  }, [rejectedDomain, signOut, navigate]);

  if (result === undefined) {
    return {
      user: null,
      profile: null,
      loading: true,
      isOnboarded: false,
      rejectedDomain: false,
    };
  }

  return {
    user: result.user,
    profile: result.profile,
    loading: false,
    isOnboarded: result.isOnboarded,
    rejectedDomain: result.rejectedDomain,
  };
}
