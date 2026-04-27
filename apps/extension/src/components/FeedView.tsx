/**
 * FeedView — "Your Subscriptions" + "Trending This Week"
 *
 * Feed rules (all enforced in useFeedSections / useTrendingEvents):
 *   • Only events whose parent email was sent in the last 14 days
 *   • Sorted newest-first within each org group
 *   • Subscriptions grouped by org; max 3 rows visible with "Show more" expand
 *   • Trending: up to 4 individual event cards (single-event per card)
 */

import { useState } from "react";
import { ExtensionEventCard } from "@app/ui";
import type { EventItem } from "../data/types";
import { useFeedSections, useTrendingEvents } from "../data/useEvents";

// ── Typography ─────────────────────────────────────────────────────────────

// Figma: Inter SemiBold 20px, #5f5f5f, tracking -0.22px, leading 1.5
const SECTION_HEADING =
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[1.25rem] leading-[1.5] tracking-[-0.22px] " +
  "text-[#5f5f5f] whitespace-nowrap";

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_VISIBLE = 3;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Collapses string[] subtitle to a single-line description for ExtensionEventRow. */
function toRowDescription(event: EventItem): string {
  if (Array.isArray(event.subtitle)) return event.subtitle.join(" · ");
  return event.subtitle ?? "";
}

// ── Props ───────────────────────────────────────────────────────────────────

interface FeedViewProps {
  bookmarkedIds: Set<string>;
  onBookmark: (id: string) => void;
  onEmailView: (event: EventItem) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FeedView({
  bookmarkedIds,
  onBookmark,
  onEmailView,
}: FeedViewProps) {
  const feedSections = useFeedSections();
  const trendingEvents = useTrendingEvents();

  // Track which org sections have been expanded beyond the 3-event cap.
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const toggleExpand = (orgName: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgName)) {
        next.delete(orgName);
      } else {
        next.add(orgName);
      }
      return next;
    });
  };

  return (
    <div className="flex w-full flex-col gap-[var(--space-4)]">
      {/* ── Your Subscriptions ── */}
      <section className="flex flex-col gap-[var(--space-4)]">
        <p className={SECTION_HEADING}>Your Subscriptions</p>

        {feedSections.length === 0 && (
          <p className="text-[length:var(--font-size-body3)] text-[var(--color-neutral-500)]">
            No recent emails from your subscriptions.
          </p>
        )}

        {feedSections.map(({ orgName, events }) => {
          const isExpanded = expandedOrgs.has(orgName);
          const visibleEvents = isExpanded
            ? events
            : events.slice(0, MAX_VISIBLE);
          const hiddenCount = events.length - MAX_VISIBLE;

          return (
            <ExtensionEventCard
              key={orgName}
              orgName={orgName}
              events={visibleEvents.map((event) => ({
                thumbnailVariant: event.thumbnailVariant,
                day: event.day,
                month: event.month,
                title: event.title,
                description: toRowDescription(event),
                bookmarked: bookmarkedIds.has(event.id),
                onBookmark: () => onBookmark(event.id),
                onRowClick: event.isEdgeCase
                  ? () => onEmailView(event)
                  : undefined,
              }))}
              onViewMore={
                !isExpanded && events.length > MAX_VISIBLE
                  ? () => toggleExpand(orgName)
                  : undefined
              }
              onViewLess={isExpanded ? () => toggleExpand(orgName) : undefined}
            />
          );
        })}
      </section>

      {/* ── Trending This Week ── */}
      {trendingEvents.length > 0 && (
        <section className="flex flex-col gap-[var(--space-4)]">
          <p className={SECTION_HEADING}>Trending This Week</p>

          {trendingEvents.map((event) => (
            <ExtensionEventCard
              key={event.id}
              orgName={event.orgName}
              events={[
                {
                  thumbnailVariant: event.thumbnailVariant,
                  day: event.day,
                  month: event.month,
                  title: event.title,
                  description: toRowDescription(event),
                  bookmarked: bookmarkedIds.has(event.id),
                  onBookmark: () => onBookmark(event.id),
                  onRowClick: event.isEdgeCase
                    ? () => onEmailView(event)
                    : undefined,
                },
              ]}
            />
          ))}
        </section>
      )}
    </div>
  );
}
