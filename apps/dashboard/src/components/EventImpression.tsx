/**
 * EventImpression — wraps a feed post and fires `event_viewed` once the card
 * has actually been on screen.
 *
 * `DashboardPost` has no whole-card click affordance, so there is no "opened
 * the event" moment to hang a view event on. An impression is the honest
 * alternative: it answers "how many events did this student actually see",
 * which is what the feed-engagement metrics need as a denominator.
 *
 * Deliberately conservative about what counts as seen — half the card visible
 * for a sustained moment, once per mount — so a fast scroll past doesn't
 * register, and scrolling back up doesn't double-count.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { track, type AnalyticsSurface } from "../lib/analytics";

/** Fraction of the card that must be visible to count as seen. */
const VISIBILITY_THRESHOLD = 0.5;
/** How long it must stay that visible, in ms. */
const DWELL_MS = 1000;

export interface EventImpressionProps {
  /**
   * Omitted for sample/override posts that aren't backed by a real event
   * (Home accepts injected `posts` for tests and stories). Without an id
   * there's nothing meaningful to report, so tracking is skipped.
   */
  eventId?: string;
  orgIds?: readonly string[];
  surface: AnalyticsSurface;
  children: ReactNode;
}

export function EventImpression({
  eventId,
  orgIds,
  surface,
  children,
}: EventImpressionProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (eventId === undefined) return;
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
              track("event_viewed", {
                event_id: eventId,
                org_ids: orgIds ? [...orgIds] : [],
                surface,
              });
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
  }, [eventId, orgIds, surface]);

  return <div ref={hostRef}>{children}</div>;
}
