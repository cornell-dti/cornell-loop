/**
 * Event-shaped helpers so the feed, bookmarks, and search views all report an
 * interaction the same way and only differ by `surface`.
 *
 * Each takes the `EventItem` the student acted on, which is where `org_ids`
 * comes from — engagement is attributed to a club without anything that names
 * the student.
 */

import type { AnalyticsSurface } from "@app/analytics";
import type { EventItem, LinkType } from "../data/types";
import { consumeFirstAction, track } from "./index";

/**
 * Outbound link types collapse to the four the schema knows about: `info` and
 * `social` are never primary CTAs, so they arrive as `other`.
 */
function linkTypeFor(
  type: LinkType,
): "rsvp" | "application" | "registration" | "other" {
  if (type === "rsvp") return "rsvp";
  if (type === "application") return "application";
  if (type === "registration") return "registration";
  return "other";
}

export function trackBookmarkToggle(
  event: EventItem,
  surface: AnalyticsSurface,
  action: "add" | "remove",
): void {
  track("event_bookmarked", {
    event_id: event.id,
    org_ids: [...event.orgIds],
    surface,
    action,
    // Only an added bookmark is activation; removing one never is.
    is_first_action: action === "add" ? consumeFirstAction() : false,
  });
}

/**
 * Leaving Loop for an org's own RSVP, application, or registration page. Kept
 * separate from `event_rsvp` because all we know is that the link opened.
 */
export function trackLinkClick(
  event: EventItem,
  surface: AnalyticsSurface,
  type: LinkType,
): void {
  track("event_link_clicked", {
    event_id: event.id,
    org_ids: [...event.orgIds],
    link_type: linkTypeFor(type),
    surface,
  });
}

export function trackCalendarAdd(
  event: EventItem,
  surface: AnalyticsSurface,
): void {
  track("event_added_to_calendar", {
    event_id: event.id,
    org_ids: [...event.orgIds],
    surface,
  });
}

/**
 * The `SortByTags` strip does two different things: toggling a tag filters the
 * list, while adding or removing one changes which tags are offered at all.
 * The second is the more interesting signal — it says which categories a
 * student cares about even when they aren't filtering.
 */
export function trackFilter(
  tag: string,
  action: "select" | "deselect" | "pin" | "unpin",
  surface: AnalyticsSurface,
): void {
  track("filter_used", { tag, action, surface });
}
