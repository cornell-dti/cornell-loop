/**
 * AnalyticsIdentity — renders nothing; owns the PostHog person lifecycle.
 *
 * Mounted once above the router so identify, reset, and `app_opened` happen in
 * exactly one place regardless of which route the user lands on.
 *
 * It reads `api.users.currentUser` directly rather than going through
 * `useCurrentProfile`, on purpose. That hook signs non-Cornell sessions out and
 * redirects, and it guards the redirect with a per-instance ref — so a second
 * always-mounted instance would race the page's own instance and could fire the
 * navigation twice. Here we only need to read identity, never act on it.
 *
 * `app_opened` fires only for signed-in users. Firing it for anonymous landing
 * visitors would fold bot and bounce traffic into DAU/WAU and wreck the
 * retention cohorts, which are all about people with accounts. Anonymous
 * acquisition is already covered by the automatic `$pageview`.
 */

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { ANALYTICS_LAUNCH_AT } from "@app/analytics";
import { api } from "../../convex/_generated/api";
import {
  consumeFirstSession,
  identifyUser,
  registerSessionProperties,
  resetAnalytics,
  track,
} from "./analytics";

const APP_OPENED_SESSION_KEY = "loop.analytics.app_opened";

function alreadyOpenedThisSession(): boolean {
  try {
    if (window.sessionStorage.getItem(APP_OPENED_SESSION_KEY) !== null) {
      return true;
    }
    window.sessionStorage.setItem(APP_OPENED_SESSION_KEY, "1");
    return false;
  } catch {
    // Storage unavailable — skip rather than risk one event per render.
    return true;
  }
}

export function AnalyticsIdentity() {
  const current = useQuery(api.users.currentUser);
  const identifiedId = useRef<string | null>(null);

  useEffect(() => {
    if (current === undefined) return;

    const user = current.user;

    if (user === null || current.rejectedDomain) {
      // Covers every sign-out path, including the non-Cornell rejection in
      // `useCurrentProfile`, without each of them needing to remember to call
      // `resetAnalytics` itself.
      if (identifiedId.current !== null) {
        resetAnalytics();
        identifiedId.current = null;
      }
      return;
    }

    if (identifiedId.current === user._id) return;
    identifiedId.current = user._id;

    const isFirstSession = consumeFirstSession();
    identifyUser(user._id, {
      cohort:
        user._creationTime < ANALYTICS_LAUNCH_AT
          ? "pre_analytics"
          : "post_analytics",
      first_seen_at: new Date(user._creationTime).toISOString(),
    });
    registerSessionProperties({
      is_first_session: isFirstSession,
      onboarded: current.isOnboarded,
    });

    if (!alreadyOpenedThisSession()) {
      track("app_opened", {
        is_first_session: isFirstSession,
        onboarded: current.isOnboarded,
      });
    }
  }, [current]);

  return null;
}
