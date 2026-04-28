/**
 * BookmarkView — "Your Bookmarks"
 *
 * Shows events the user has saved. Receives pre-fetched bookmarked events
 * from the parent (App.tsx), which derives them from api.bookmarks.myBookmarks.
 *
 * Tag-strip supports:
 *   • Click to toggle filter (OR match across active tags)
 *   • + to add a custom tag
 *   • Pencil → edit mode → × to delete a tag
 *
 * On Google Calendar (pageContext === "gcal"):
 *   • Subheader "Hover on the events to preview time on your calendar" is shown
 *   • Hovering a card calls onPreviewSlot to inject the orange-border highlight
 *     into the actual GCal grid via the content-script bridge.
 */

import { useState } from "react";
import type { EventItem } from "../data/types";
import type { PageContext } from "../App";
import {
  getPrimaryLink,
  getLinkLabel,
  openExternalUrl,
} from "../utils/linkUtils";
import { buildGCalUrl } from "../utils/calendarUtils";
import { removeSlotPreview } from "../gcalHighlight";
import { BookmarkCard } from "./BookmarkCard";
import { SortByTags } from "./SortByTags";

// ── Typography ─────────────────────────────────────────────────────────────

// Figma: Inter Regular 16px, #5f5f5f, tracking -0.176px, leading 1.5
const SORT_LABEL =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[1rem] leading-[1.5] tracking-[-0.176px] " +
  "text-[#5f5f5f] whitespace-nowrap";

// Figma: Inter SemiBold 20px, #5f5f5f, tracking -0.22px, leading 1.5
const SECTION_HEADING =
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[1.25rem] leading-[1.5] tracking-[-0.22px] " +
  "text-[#5f5f5f] whitespace-nowrap";

// GCal subheader — Inter Regular 14px, #5f5f5f (Figma annotation)
const GCAL_SUBHEADER =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[1.5] " +
  "text-[#5f5f5f]";

const INITIAL_SORT_TAGS = [
  "Internships",
  "Early career",
  "Tech",
  "Mentorship",
  "Just for fun",
];

// ── Props ───────────────────────────────────────────────────────────────────

interface BookmarkViewProps {
  /** Pre-fetched bookmarked events from Convex (api.bookmarks.myBookmarks). */
  events: EventItem[];
  /** Called when the user removes a bookmark from any card in this view. */
  onUnbookmark: (id: string) => void;
  onEmailView: (event: EventItem) => void;
  pageContext: PageContext;
  onPreviewSlot?: (event: EventItem | null) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BookmarkView({
  events,
  onUnbookmark,
  onEmailView,
  pageContext,
  onPreviewSlot,
}: BookmarkViewProps) {
  // ── Tag filter state ──────────────────────────────────────────────────
  const [availableTags, setAvailableTags] = useState(INITIAL_SORT_TAGS);
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const handleTagToggle = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleTagAdd = (tag: string) => {
    setAvailableTags((prev) => [...prev, tag]);
    setActiveTags((prev) => [...prev, tag]);
  };

  const handleTagRemove = (tag: string) => {
    setAvailableTags((prev) => prev.filter((t) => t !== tag));
    setActiveTags((prev) => prev.filter((t) => t !== tag));
  };

  // Filter: show all when no active tags; OR match otherwise
  const filteredEvents =
    activeTags.length === 0
      ? events
      : events.filter((e) => activeTags.some((tag) => e.tags.includes(tag)));

  return (
    <div className="flex w-full flex-col gap-[var(--space-4)]">
      {/* ── Sort by ── */}
      <section className="flex flex-col gap-[var(--space-2)]">
        <p className={SORT_LABEL}>Sort by</p>
        <SortByTags
          tags={availableTags}
          activeTags={activeTags}
          onTagToggle={handleTagToggle}
          onTagAdd={handleTagAdd}
          onTagRemove={handleTagRemove}
        />
      </section>

      {/* ── Your Bookmarks ── */}
      <section className="flex flex-col gap-[var(--space-3)]">
        <div className="flex flex-col gap-[var(--space-1)]">
          <p className={SECTION_HEADING}>Your Bookmarks</p>

          {/* GCal-only subheader */}
          {pageContext === "gcal" && (
            <p className={GCAL_SUBHEADER}>
              Hover on the events to preview time on your calendar
            </p>
          )}
        </div>

        {filteredEvents.length === 0 && (
          <p className="text-[length:var(--font-size-body3)] text-[var(--color-neutral-500)]">
            {events.length === 0
              ? "Bookmark events from the Feed to save them here."
              : "No bookmarks match the selected filters."}
          </p>
        )}

        <div className="flex flex-col gap-[var(--space-4)]">
          {filteredEvents.map((event) => {
            const primaryLink = getPrimaryLink(event);
            const primaryAction = primaryLink
              ? {
                  label: getLinkLabel(primaryLink),
                  onClick: () => openExternalUrl(primaryLink.url),
                }
              : undefined;

            const onAddToCalendar = event.calendarEvent
              ? () => {
                  removeSlotPreview();
                  openExternalUrl(buildGCalUrl(event.calendarEvent!));
                }
              : undefined;

            return (
              <BookmarkCard
                key={event.id}
                orgName={event.orgName}
                orgAvatarUrl={event.orgAvatarUrl}
                thumbnailVariant={event.thumbnailVariant}
                day={event.day}
                month={event.month}
                title={event.title}
                subtitle={event.subtitle}
                onSubtitleClick={
                  event.isEdgeCase ? () => onEmailView(event) : undefined
                }
                tags={event.tags}
                primaryAction={primaryAction}
                onAddToCalendar={onAddToCalendar}
                onUnbookmark={() => onUnbookmark(event.id)}
                onPreviewEnter={
                  pageContext === "gcal" && event.calendarEvent
                    ? () => onPreviewSlot?.(event)
                    : undefined
                }
                onPreviewLeave={
                  pageContext === "gcal" && event.calendarEvent
                    ? () => onPreviewSlot?.(null)
                    : undefined
                }
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
