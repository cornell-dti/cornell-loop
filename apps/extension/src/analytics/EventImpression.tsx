/**
 * EventImpression — wraps one or more event cards and fires `event_viewed`
 * once they have actually been on screen. The extension twin of the dashboard
 * component of the same name, with the same thresholds so the two platforms'
 * numbers are comparable.
 *
 * Cards have no whole-card click affordance, so there is no "opened the
 * event" moment to hang a view event on. An impression answers "how many
 * events did this student actually see", which is the denominator the
 * engagement metrics need.
 *
 * Takes a list rather than a single event because the feed groups several
 * events into one org card: when that card is seen, every row in it was seen.
 *
 * Deliberately conservative — half the card visible for a sustained moment,
 * once per mount — so a fast scroll past doesn't register and scrolling back
 * up doesn't double-count.
 */

import { useEffect, useRef, type ReactNode } from "react";
import type { AnalyticsSurface } from "@app/analytics";
import type { EventItem } from "../data/types";
import { track } from "./index";

/** Fraction of the card that must be visible to count as seen. */
const VISIBILITY_THRESHOLD = 0.5;
/** How long it must stay that visible, in ms. */
const DWELL_MS = 1000;

export interface EventImpressionProps {
  events: readonly EventItem[];
  surface: AnalyticsSurface;
  children: ReactNode;
}

export function EventImpression({
  events,
  surface,
  children,
}: EventImpressionProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  // The effect keys off the ids, not the array identity, so a parent
  // re-render with the same events doesn't restart the dwell timer.
  const idsKey = events.map((event) => event.id).join(",");
  const latestEvents = useRef(events);
  useEffect(() => {
    latestEvents.current = events;
  }, [events]);

  useEffect(() => {
    const node = hostRef.current;
    if (node === null) return;
    if (typeof IntersectionObserver === "undefined") return;

    let dwellTimer: number | null = null;
    const clearDwell = () => {
      if (dwellTimer !== null) {
        window.clearTimeout(dwellTimer);
        dwellTimer = null;
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (fired.current) return;
          if (entry.isIntersecting) {
            if (dwellTimer !== null) continue;
            dwellTimer = window.setTimeout(() => {
              fired.current = true;
              for (const event of latestEvents.current) {
                track("event_viewed", {
                  event_id: event.id,
                  org_ids: [...event.orgIds],
                  surface,
                });
              }
              observer.disconnect();
            }, DWELL_MS);
          } else {
            clearDwell();
          }
        }
      },
      { threshold: VISIBILITY_THRESHOLD },
    );

    observer.observe(node);
    return () => {
      clearDwell();
      observer.disconnect();
    };
  }, [idsKey, surface]);

  return <div ref={hostRef}>{children}</div>;
}
