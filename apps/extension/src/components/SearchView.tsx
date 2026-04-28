/**
 * SearchView — empty state (popular searches) + results state.
 *
 * Empty state (no query):
 *   • Clicking a popular search row calls onSearchSelect(term) → populates the
 *     search bar in App.tsx via handleSearchSelect.
 *   • POPULAR_SEARCHES is a manually curated static list for beta.
 *
 * Results state (query present):
 *   • Calls useSearchResults(query) → api.events.searchEvents (Convex full-text search).
 *   • "Sort by" tag strip filters results further (OR match).
 *   • Tag strip supports +, pencil edit mode, and × delete via SortByTags.
 *   • Each BookmarkCard wires RSVP / Add to Calendar / bookmark actions.
 */

import { useState } from "react";
import type { EventItem } from "../data/types";
import { useSearchResults } from "../data/useEvents";
import {
  getPrimaryLink,
  getLinkLabel,
  openExternalUrl,
} from "../utils/linkUtils";
import { buildGCalUrl } from "../utils/calendarUtils";
import { BookmarkCard } from "./BookmarkCard";
import { SortByTags } from "./SortByTags";

// ── Shared typography ──────────────────────────────────────────────────────

// Figma: Inter Regular 16px, #5f5f5f, tracking -0.176px, leading 1.5
const UI_BODY =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[1rem] leading-[1.5] tracking-[-0.176px] text-[#5f5f5f]";

const SORT_LABEL = UI_BODY + " whitespace-nowrap";

// ── Constants ──────────────────────────────────────────────────────────────

const POPULAR_SEARCHES = [
  { rank: "#1", term: "Recruitment" },
  { rank: "#2", term: "Sports" },
  { rank: "#3", term: "Concert" },
  { rank: "#4", term: "Housing" },
  { rank: "#5", term: "A&S" },
];

const INITIAL_SORT_TAGS = [
  "Internships",
  "Early career",
  "Tech",
  "Mentorship",
  "Just for fun",
];

// ── SearchEmptyState ───────────────────────────────────────────────────────

interface SearchEmptyStateProps {
  onSelect: (term: string) => void;
}

function SearchEmptyState({ onSelect }: SearchEmptyStateProps) {
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
  onBookmark: (id: string) => void;
  onEmailView: (event: EventItem) => void;
}

function SearchResultsState({
  query,
  bookmarkedIds,
  onBookmark,
  onEmailView,
}: SearchResultsStateProps) {
  const results = useSearchResults(query);

  const [availableTags, setAvailableTags] = useState(INITIAL_SORT_TAGS);
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const handleTagToggle = (tag: string) =>
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );

  const handleTagAdd = (tag: string) => {
    setAvailableTags((prev) => [...prev, tag]);
    setActiveTags((prev) => [...prev, tag]);
  };

  const handleTagRemove = (tag: string) => {
    setAvailableTags((prev) => prev.filter((t) => t !== tag));
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
                onClick: () => openExternalUrl(primaryLink.url),
              }
            : undefined;

          const onAddToCalendar = event.calendarEvent
            ? () => openExternalUrl(buildGCalUrl(event.calendarEvent!))
            : undefined;

          return (
            <BookmarkCard
              key={event.id}
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
                  ? () => onBookmark(event.id)
                  : undefined
              }
            />
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
  onBookmark?: (id: string) => void;
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
