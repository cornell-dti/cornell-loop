/**
 * useCurrentProfile — wraps `api.users.currentUser` and surfaces the bits the
 * dashboard cares about (auth user, profile row, onboarding flag, and a
 * defence-in-depth domain rejection signal).
 *
 * Side effect: when the backend reports `rejectedDomain: true` (i.e. somehow a
 * non-Cornell user row exists), we sign the user out and bounce them to
 * `/?error=non-cornell` so the Landing page can show a banner. The redirect is
 * gated by a ref so it only fires once per mount.
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
    void signOut().finally(() => {
      navigate("/?error=non-cornell", { replace: true });
    });
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
