/**
 * SearchView — empty state + results state.
 *
 * Empty state (no query):
 *   • SHOW_POPULAR_SEARCHES gates the ranked list (off for store; keep the
 *     data for a later live ranking). When off, show a type-to-search prompt.
 *   • Clicking a popular search row calls onSearchSelect(term) → populates the
 *     search bar in App.tsx via handleSearchSelect.
 *
 * Results state (query present):
 *   • Calls useSearchResults(query) → api.events.searchEvents (Convex full-text search).
 *   • "Sort by" tag strip filters results further (OR match).
 *   • Tag strip supports +, pencil edit mode, and × delete via SortByTags.
 *   • Each BookmarkCard wires RSVP / Add to Calendar / bookmark actions.
 */

import { useEffect, useState } from "react";
import type { EventId, EventItem } from "../data/types";
import { useSearchResults } from "../data/useEvents";
import {
  getPrimaryLink,
  getLinkLabel,
  openExternalUrl,
} from "../utils/linkUtils";
import { buildGCalUrl } from "../utils/calendarUtils";
import { BookmarkCard } from "./BookmarkCard";
import { SortByTags } from "./SortByTags";
import { useFilterTags } from "../data/useFilterTags";
import type { CanonicalTag } from "@app/convex/lib/tags";
import { track } from "../analytics";
import { EventImpression } from "../analytics/EventImpression";
import {
  trackBookmarkToggle,
  trackCalendarAdd,
  trackFilter,
  trackLinkClick,
} from "../analytics/eventTracking";

const SURFACE = "search";

/**
 * Students type a query a character at a time, so the raw input would send one
 * event per keystroke. Waiting for a pause means one event per actual search.
 */
const SEARCH_TRACK_DEBOUNCE_MS = 800;

// ── Shared typography ──────────────────────────────────────────────────────

// Figma: Inter Regular 16px, #5f5f5f, tracking -0.176px, leading 1.5
const UI_BODY =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[1rem] leading-[1.5] tracking-[-0.176px] text-[#5f5f5f]";

const SORT_LABEL = UI_BODY + " whitespace-nowrap";

// ── Constants ──────────────────────────────────────────────────────────────

const SHOW_POPULAR_SEARCHES = false;

const POPULAR_SEARCHES = [
  { rank: "#1", term: "Recruitment" },
  { rank: "#2", term: "Sports" },
  { rank: "#3", term: "Concert" },
  { rank: "#4", term: "Housing" },
  { rank: "#5", term: "A&S" },
];

// ── SearchEmptyState ───────────────────────────────────────────────────────

interface SearchEmptyStateProps {
  onSelect: (term: string) => void;
}

function SearchEmptyState({ onSelect }: SearchEmptyStateProps) {
  if (!SHOW_POPULAR_SEARCHES) {
    return (
      <p
        data-testid="search-empty-prompt"
        className={
          "font-[family-name:var(--font-body)] font-medium " +
          "text-[length:var(--font-size-body1)] leading-[var(--line-height-body1)] " +
          "tracking-[var(--letter-spacing-body1)] text-[var(--color-neutral-500)]"
        }
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Type to search events
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-[var(--space-3)]">
      {/* Heading — Figma: DM Sans Medium 18px, #5f5f5f, lh 28px, tracking -0.5px */}
      <p
        className={
          "font-[family-name:var(--font-body)] font-medium " +
          "text-[length:var(--font-size-body1)] leading-[var(--line-height-body1)] " +
          "tracking-[var(--letter-spacing-body1)] whitespace-nowrap text-[#5f5f5f]"
        }
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Popular searches this week
      </p>

      {/* Ranked rows */}
      <div className="flex w-full flex-col gap-[var(--space-2)]">
        {POPULAR_SEARCHES.map(({ rank, term }) => (
          <button
            key={rank}
            type="button"
            data-testid="popular-search-row"
            onClick={() => onSelect(term)}
            className={
              "flex w-full items-center gap-[var(--space-3)] " +
              "rounded-[var(--radius-button)] bg-[#f9f9f9] " +
              "px-[var(--space-4)] py-[var(--space-2)] " +
              "transition-colors duration-150 hover:bg-[var(--color-neutral-200)] " +
              "text-left"
            }
          >
            <span className={UI_BODY + " shrink-0"}>{rank}</span>
            <span className={UI_BODY}>{term}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SearchResultsState ─────────────────────────────────────────────────────

interface SearchResultsStateProps {
  query: string;
  bookmarkedIds: Set<string>;
  onBookmark: (id: EventId) => void;
  onEmailView: (event: EventItem) => void;
}

function SearchResultsState({
  query,
  bookmarkedIds,
  onBookmark,
  onEmailView,
}: SearchResultsStateProps) {
  const results = useSearchResults(query);

  const { tags: availableTags, addTag, removeTag } = useFilterTags();
  const [activeTags, setActiveTags] = useState<string[]>([]);

  // Length only — the query itself is deliberately never sent.
  const queryLength = query.trim().length;
  const resultCount = results.length;
  useEffect(() => {
    if (queryLength === 0) return;
    const timer = window.setTimeout(() => {
      track("search_performed", {
        query_length: queryLength,
        result_count: resultCount,
        surface: SURFACE,
      });
    }, SEARCH_TRACK_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [queryLength, resultCount]);

  const handleTagToggle = (tag: string) => {
    trackFilter(tag, activeTags.includes(tag) ? "deselect" : "select", SURFACE);
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleTagAdd = (tag: CanonicalTag) => {
    addTag(tag);
    trackFilter(tag, "pin", SURFACE);
  };

  const handleTagRemove = (tag: CanonicalTag) => {
    removeTag(tag);
    trackFilter(tag, "unpin", SURFACE);
    setActiveTags((prev) => prev.filter((t) => t !== tag));
  };

  const filtered =
    activeTags.length === 0
      ? results
      : results.filter((e) => activeTags.some((tag) => e.tags.includes(tag)));

  return (
    <div className="flex w-full flex-col gap-[var(--space-4)]">
      {/* Sort by */}
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

      {/* Result cards */}
      <div
        data-testid="search-results"
        className="flex flex-col gap-[var(--space-4)]"
      >
        {filtered.length === 0 && (
          <p className="text-[length:var(--font-size-body3)] text-[var(--color-neutral-500)]">
            No results found.
          </p>
        )}

        {filtered.map((event) => {
          const primaryLink = getPrimaryLink(event);
          const primaryAction = primaryLink
            ? {
                label: getLinkLabel(primaryLink),
                onClick: () => {
                  trackLinkClick(event, SURFACE, primaryLink.type);
                  openExternalUrl(primaryLink.url);
                },
              }
            : undefined;

          const onAddToCalendar = event.calendarEvent
            ? () => {
                trackCalendarAdd(event, SURFACE);
                openExternalUrl(buildGCalUrl(event.calendarEvent!));
              }
            : undefined;

          return (
            <EventImpression key={event.id} events={[event]} surface={SURFACE}>
              <BookmarkCard
                orgName={event.orgName}
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
                onUnbookmark={
                  bookmarkedIds.has(event.id)
                    ? () => {
                        trackBookmarkToggle(event, SURFACE, "remove");
                        onBookmark(event.id);
                      }
                    : undefined
                }
              />
            </EventImpression>
          );
        })}
      </div>
    </div>
  );
}

// ── SearchView ─────────────────────────────────────────────────────────────

export interface SearchViewProps {
  query?: string;
  onSearchSelect?: (term: string) => void;
  bookmarkedIds?: Set<string>;
  onBookmark?: (id: EventId) => void;
  onEmailView?: (event: EventItem) => void;
}

export default function SearchView({
  query = "",
  onSearchSelect,
  bookmarkedIds = new Set(),
  onBookmark = () => {},
  onEmailView = () => {},
}: SearchViewProps) {
  return query.trim() === "" ? (
    <SearchEmptyState onSelect={onSearchSelect ?? (() => {})} />
  ) : (
    <SearchResultsState
      query={query}
      bookmarkedIds={bookmarkedIds}
      onBookmark={onBookmark}
      onEmailView={onEmailView}
    />
  );
}
