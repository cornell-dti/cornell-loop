/**
 * AnalyticsIdentity — renders nothing; owns the PostHog person lifecycle for
 * the extension, mirroring the dashboard component of the same name.
 *
 * Mounted once inside `ConvexAuthProvider` in `content.tsx` so identify,
 * reset, and `app_opened` happen in exactly one place no matter which view
 * the student lands on.
 *
 * `app_opened` fires only once a day per browser. The panel remounts whenever
 * the auth token flips or Gmail navigates, and counting each of those as an
 * app open would turn one student's morning into a dozen sessions.
 */

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { ANALYTICS_LAUNCH_AT } from "@app/analytics";
import { api } from "@app/convex/_generated/api";
import {
  consumeFirstSession,
  hydrateAnalyticsFlags,
  identifyUser,
  resetAnalytics,
  track,
} from "./index";

const APP_OPENED_DAY_KEY = "loop.analytics.app_opened_day";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function firstOpenToday(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get(APP_OPENED_DAY_KEY);
    if (stored[APP_OPENED_DAY_KEY] === today()) return false;
    await chrome.storage.local.set({ [APP_OPENED_DAY_KEY]: today() });
    return true;
  } catch {
    // Storage unavailable — skip rather than risk one event per remount.
    return false;
  }
}

export function AnalyticsIdentity() {
  const current = useQuery(api.users.currentUser);
  const identifiedId = useRef<string | null>(null);

  useEffect(() => {
    if (current === undefined) return;

    const user = current.user;

    if (user === null || current.rejectedDomain) {
      // Covers every sign-out path without each one having to remember to
      // reset. Also clears the anonymous id, so the next student to sign in
      // on a shared machine doesn't inherit this one's history.
      if (identifiedId.current !== null) {
        resetAnalytics();
        identifiedId.current = null;
      }
      return;
    }

    if (identifiedId.current === user._id) return;
    identifiedId.current = user._id;

    const userId = user._id;
    const isOnboarded = current.isOnboarded;
    const creationTime = user._creationTime;

    void (async () => {
      await hydrateAnalyticsFlags();

      identifyUser(userId, {
        cohort:
          creationTime < ANALYTICS_LAUNCH_AT
            ? "pre_analytics"
            : "post_analytics",
        first_seen_at: new Date(creationTime).toISOString(),
      });

      const isFirstSession = consumeFirstSession();
      if (await firstOpenToday()) {
        track("app_opened", {
          is_first_session: isFirstSession,
          onboarded: isOnboarded,
        });
      }
    })();
  }, [current]);

  return null;
}
