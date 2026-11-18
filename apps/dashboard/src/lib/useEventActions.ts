/**
 * useEventActions — the bookmark + RSVP behaviour shared by every page that
 * renders a feed of `DashboardPost`s (Home, Bookmarks, Search).
 *
 * All three previously carried their own copy of this logic. Folding it into
 * one hook means the optimistic flip, the rollback, and the analytics event
 * can't drift apart between pages, and new surfaces get all three for free by
 * passing a different `surface`.
 *
 * Bookmarks renders removal rather than an unfilled icon, but it needs the
 * same state: an override of `false` is exactly "pending removal", so it
 * filters on `bookmarkOverrides` instead of keeping a second set.
 */

import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { consumeFirstAction, track, type AnalyticsSurface } from "./analytics";

export interface EventActions {
  /**
   * Per-event optimistic bookmark state, overriding the server value until
   * the mutation settles. A successful mutation leaves the entry in place —
   * the next query refresh agrees with it. A failure removes it, restoring
   * the server view.
   */
  bookmarkOverrides: ReadonlyMap<Id<"events">, boolean>;
  toggleBookmark: (
    eventId: Id<"events">,
    currentlyBookmarked: boolean,
    orgIds: readonly Id<"orgs">[],
  ) => void;
  rsvp: (eventId: Id<"events">, orgIds: readonly Id<"orgs">[]) => void;
}

export function useEventActions(
  surface: AnalyticsSurface,
  onError?: () => void,
): EventActions {
  const bookmarkMutation = useMutation(api.bookmarks.bookmark);
  const unbookmarkMutation = useMutation(api.bookmarks.unbookmark);
  const setRsvpMutation = useMutation(api.rsvps.setRsvp);

  const [bookmarkOverrides, setBookmarkOverrides] = useState<
    ReadonlyMap<Id<"events">, boolean>
  >(() => new Map());

  // RSVP has no visual state to flip yet, so a ref is enough to dedupe rapid
  // clicks without re-rendering the whole post list.
  const inFlightRsvps = useRef<Set<Id<"events">>>(new Set());

  const toggleBookmark = useCallback<EventActions["toggleBookmark"]>(
    (eventId, currentlyBookmarked, orgIds) => {
      const next = !currentlyBookmarked;
      setBookmarkOverrides((prev) => {
        const m = new Map(prev);
        m.set(eventId, next);
        return m;
      });

      track("event_bookmarked", {
        event_id: eventId,
        org_ids: [...orgIds],
        surface,
        action: next ? "add" : "remove",
        is_first_action: next ? consumeFirstAction() : false,
      });

      const promise = next
        ? bookmarkMutation({ eventId })
        : unbookmarkMutation({ eventId });
      void promise.catch(() => {
        setBookmarkOverrides((prev) => {
          const m = new Map(prev);
          m.delete(eventId);
          return m;
        });
        onError?.();
      });
    },
    [bookmarkMutation, unbookmarkMutation, onError, surface],
  );

  const rsvp = useCallback<EventActions["rsvp"]>(
    (eventId, orgIds) => {
      if (inFlightRsvps.current.has(eventId)) return;
      inFlightRsvps.current.add(eventId);

      track("event_rsvp", {
        event_id: eventId,
        org_ids: [...orgIds],
        surface,
        status: "going",
        is_first_action: consumeFirstAction(),
      });

      void setRsvpMutation({ eventId, status: "going" })
        .catch(() => {
          onError?.();
        })
        .finally(() => {
          inFlightRsvps.current.delete(eventId);
        });
    },
    [setRsvpMutation, onError, surface],
  );

  return { bookmarkOverrides, toggleBookmark, rsvp };
}
