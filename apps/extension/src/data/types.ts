/**
 * Schema-agnostic frontend types for the extension.
 *
 * These mirror the Convex schema (apps/dashboard/convex/schema.ts) but are
 * deliberately decoupled — only useEvents.ts maps raw DB rows to EventItem.
 * UI components never import Convex schema types directly.
 */

export type LinkType =
  | "registration"
  | "application"
  | "rsvp"
  | "info"
  | "social";

export interface EventLink {
  url: string;
  type: LinkType;
  /** Display label. Falls back to default label derived from type when absent. */
  label?: string;
}

export interface CalendarEvent {
  title: string;
  /** ISO-8601 local or UTC datetime, e.g. "2026-04-24T16:00:00". */
  startISO: string;
  endISO?: string;
  location?: string;
}

export interface EventItem {
  id: string;
  /** Primary host name, e.g. "Cornell DTI". From schema: hosts[0].name. */
  orgName: string;
  /** Controls the DateBadge style in feed/card rows. */
  thumbnailVariant: "date" | "news";
  /** Day-of-month for the "date" thumbnail (e.g. 24). */
  day?: number | string;
  /** Abbreviated month (e.g. "Apr"). */
  month?: string;
  title: string;
  /**
   * Derived subtitle per Figma annotations:
   *   string[]  → event with time + location (e.g. ["4:00–5:30 pm", "Hollister 312"])
   *   string    → informative summary / aiDescription
   *   undefined → no subtitle shown
   * When isEdgeCase=true the string is always "Click to see original email".
   */
  subtitle?: string | string[];
  tags: string[];
  /**
   * All links from the Convex schema. The view layer picks the primary CTA via
   * getPrimaryLink() in utils/linkUtils.ts — priority: rsvp → application → registration.
   */
  links: EventLink[];
  /**
   * Present only when the event has a specific date + time (schema: eventType "event"
   * with parseable start/end). Drives the "Add to Calendar" button.
   */
  calendarEvent?: CalendarEvent;
  /**
   * When true the subtitle reads "Click to see original email".
   * Clicking the subtitle in BookmarkCard calls onSubtitleClick → shows OriginalEmailView.
   */
  isEdgeCase?: boolean;
  /** Links back to listservEmails._id for OriginalEmailView. */
  emailId?: string;
  /** Subject line shown in OriginalEmailView. */
  rawEmailTitle?: string;
  /** Paragraphs shown in OriginalEmailView. Empty strings render as spacers. */
  rawEmailParagraphs?: string[];
  /**
   * Epoch ms of the parent listserv email (listservEmails.sentAt).
   * Used by useFeedSections to enforce the 14-day window and newest-first order.
   */
  sentAt?: number;
}
