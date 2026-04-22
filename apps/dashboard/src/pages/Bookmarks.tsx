/**
 * Bookmarks — Loop Dashboard Page
 *
 * Source: Figma "Incubator-design-file" › node 260:2325 "Home" (Bookmarks view)
 *
 * Three-column page layout:
 *   • SideBar (left)        — navigation rail, "Bookmarks" active
 *   • Main content (center) — heading, SearchBar, tag filter bar, bookmarked post list
 *   • Right panel           — SearchBar, "This week" + "Trending" event sections
 *
 * The main content renders one DashboardPost per bookmarked item, each with
 * `bookmarked={true}` to show the filled bookmark icon state.
 *
 * The tag filter bar mirrors the Home page filter bar (Recruitment, Early Career, etc.)
 * and sits directly below the SearchBar in a shared px-32px column.
 *
 * Right-panel sections (SideEventRow, SidePanelSection) mirror the pattern
 * from Subscriptions.tsx.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef } from 'react';
import { SideBar } from '@app/ui';
import type { SideBarItemId } from '@app/ui';
import { SearchBar } from '@app/ui';
import { Tag } from '@app/ui';
import { DashboardPost } from '@app/ui';
import type { DashboardPostProps } from '@app/ui';
import StarIcon from '../assets/star.svg?react';

// ─── Shared typography class strings ─────────────────────────────────────────

const BODY2_SEMIBOLD =
  'font-[family-name:var(--font-body)] font-semibold ' +
  'text-[var(--font-size-body2)] leading-[var(--line-height-body2)] ' +
  'tracking-[var(--letter-spacing-body2)]';

const BODY2_REGULAR =
  'font-[family-name:var(--font-body)] font-normal ' +
  'text-[var(--font-size-body2)] leading-[var(--line-height-body2)] ' +
  'tracking-[var(--letter-spacing-body2)]';

const SECTION_TITLE =
  'font-[family-name:var(--font-body)] font-bold ' +
  'text-[var(--font-size-sub2)] leading-[var(--line-height-sub2)] ' +
  'tracking-[var(--letter-spacing-body1)] ' +
  'text-[var(--color-neutral-900)] whitespace-nowrap';

// ─── Public types ─────────────────────────────────────────────────────────────

/** A single tag in the filter bar, e.g. "Recruitment". */
export interface FeedTagItem {
  label: string;
}

/**
 * A single event row inside a right-panel section ("This week" / "Trending").
 * Mirrors the SideEventItem pattern from Subscriptions.tsx.
 */
export interface SideEventItem {
  title: string;
  orgName: string;
  orgAvatarUrl?: string;
  /**
   * When true a small indicator badge (star icon) is shown beside the org name.
   * Figma bg: #949494 ≈ --color-neutral-600.
   */
  hasIndicator?: boolean;
  /**
   * When true an orange "For you" badge is rendered to the right of the org row.
   * Figma: bg #ffe4d5 / text #b54400 — approximated with
   * --color-primary-500 / --color-primary-800.
   */
  isForYou?: boolean;
}

/** Props for a right-panel contextual section card ("This week" / "Trending"). */
export interface SidePanelSectionProps {
  title: string;
  items: SideEventItem[];
  onShowMore?: () => void;
}

export interface BookmarksProps extends ComponentPropsWithoutRef<'div'> {
  // ── Sidebar ──
  activeNavItem?: SideBarItemId;
  onNavigate?: (id: SideBarItemId) => void;

  // ── Center search ──
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchClear?: () => void;

  // ── Tag filter bar ──
  feedTags?: FeedTagItem[];
  onTagClick?: (label: string) => void;
  onAddTag?: () => void;

  // ── Bookmarked posts ──
  posts?: DashboardPostProps[];

  // ── Right panel search ──
  sidePanelSearchValue?: string;
  onSidePanelSearchChange?: (value: string) => void;
  onSidePanelSearchClear?: () => void;

  // ── Right panel sections ──
  sidePanels?: SidePanelSectionProps[];
}

// ─── Default data ─────────────────────────────────────────────────────────────

const DEFAULT_FEED_TAGS: FeedTagItem[] = [
  { label: 'Recruitment' },
  { label: 'Early Career' },
  { label: 'Tech' },
  { label: 'Mentorship' },
  { label: 'Just for Fun' },
];

// ─── SideEventRow ─────────────────────────────────────────────────────────────

/**
 * A single event row inside a right-panel section.
 * Matches Figma nodes 260:2513–260:2539 and 260:2544–260:2568.
 */
function SideEventRow({ item }: { item: SideEventItem }) {
  return (
    <div
      className={[
        'flex flex-col gap-[var(--space-1)] w-full',
        'rounded-[var(--radius-input)] px-[var(--space-1-5)] py-[var(--space-1)]',
        'cursor-pointer',
        'hover:bg-[var(--color-surface-subtle)]',
        'transition-colors duration-150',
      ].join(' ')}
    >
      {/* Event title */}
      <p
        className={BODY2_SEMIBOLD + ' text-[var(--color-neutral-700)] truncate w-full'}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {item.title}
      </p>

      {/* Org row: avatar + name + optional indicator + optional "For you" tag */}
      <div className="flex items-center gap-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          {/* Circle avatar — 24 × 24 px */}
          <span
            className={[
              'inline-flex items-center justify-center shrink-0',
              'rounded-full overflow-hidden',
              'size-[var(--space-6)]',
              'bg-[var(--color-surface-raised)]',
            ].join(' ')}
          >
            {item.orgAvatarUrl ? (
              <img
                src={item.orgAvatarUrl}
                alt={item.orgName}
                className="size-full object-cover"
              />
            ) : (
              <span
                className={
                  'size-full flex items-center justify-center ' +
                  'bg-[var(--color-secondary-400)] ' +
                  'font-[family-name:var(--font-body)] font-semibold ' +
                  'text-[var(--font-size-body3)] text-[var(--color-secondary-900)]'
                }
              >
                {item.orgName.charAt(0).toUpperCase()}
              </span>
            )}
          </span>

          {/* Org name */}
          <span
            className={BODY2_REGULAR + ' text-[var(--color-text-secondary)] whitespace-nowrap'}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {item.orgName}
          </span>

          {/*
           * Indicator badge — small circular pill with a star icon.
           * Figma bg: #949494 ≈ --color-neutral-600.
           */}
          {item.hasIndicator && (
            <span
              className={[
                'inline-flex items-center justify-center',
                'rounded-full p-[var(--space-1)]',
                'size-[var(--space-3)]',
                'bg-[var(--color-neutral-600)]',
              ].join(' ')}
              aria-hidden="true"
            >
              <StarIcon className="size-full" />
            </span>
          )}
        </div>

        {/*
         * "For you" badge.
         * Figma: bg #ffe4d5 / text #b54400 — approximated with
         * --color-primary-500 (#ffcaaa) / --color-primary-800 (#a74409).
         */}
        {item.isForYou && (
          <span
            className={[
              'inline-flex items-center',
              'px-[var(--space-3)] py-[var(--space-0-5)]',
              'rounded-[var(--radius-input)]',
              'bg-[var(--color-primary-500)]',
              'font-[family-name:var(--font-body)] font-medium',
              'text-[var(--font-size-body2)] leading-[var(--space-6)]',
              'tracking-[var(--letter-spacing-body2)]',
              'text-[var(--color-primary-800)]',
              'whitespace-nowrap select-none',
            ].join(' ')}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            For you
          </span>
        )}
      </div>
    </div>
  );
}

// ─── SidePanelSection ─────────────────────────────────────────────────────────

/**
 * A contextual event section card in the right panel ("This week" / "Trending").
 * Matches Figma nodes 260:2510 and 260:2541.
 */
function SidePanelSection({ title, items, onShowMore }: SidePanelSectionProps) {
  return (
    <div
      className={[
        'flex flex-col gap-[var(--space-3)]',
        'bg-[var(--color-surface)]',
        'border border-[var(--color-border)]',
        'rounded-[var(--radius-card)]',
        'px-[var(--space-4)] py-[var(--space-3)]',
        'w-full',
      ].join(' ')}
    >
      <h2 className={SECTION_TITLE} style={{ fontVariationSettings: "'opsz' 14" }}>
        {title}
      </h2>

      <div className="flex flex-col gap-[var(--space-4)] w-full">
        {items.map((item, i) => (
          <SideEventRow key={i} item={item} />
        ))}
      </div>

      {/*
       * "Show more" link — Figma: #0074bc.
       * --color-link maps to --color-secondary-600 (#427fb4), the closest token.
       */}
      {onShowMore && (
        <button
          type="button"
          onClick={onShowMore}
          className={[
            'self-start',
            BODY2_REGULAR,
            'text-[var(--color-link)]',
            'hover:underline',
            'cursor-pointer transition-[text-decoration] duration-150',
          ].join(' ')}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Show more
        </button>
      )}
    </div>
  );
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

/**
 * Bookmarks page layout — three-column shell:
 *
 *   ┌────────────┬────────────────────────────────┬────────────────┐
 *   │  SideBar   │  Main content                  │  Right panel   │
 *   │ (215px)    │  (flex-1)                      │ (334px)        │
 *   │            │  "Bookmarks" heading            │  SearchBar     │
 *   │  Home      │  SearchBar + tag filter bar     │  This week     │
 *   │  Bookmarks ●  ──────────────────────────    │  Trending      │
 *   │  Subs      │  DashboardPost (bookmarked) × n │                │
 *   │  ────────  │                                 │                │
 *   │  Profile   │                                 │                │
 *   └────────────┴────────────────────────────────┴────────────────┘
 */
export function Bookmarks({
  activeNavItem = 'bookmarks',
  onNavigate,
  searchValue,
  onSearchChange,
  onSearchClear,
  feedTags = DEFAULT_FEED_TAGS,
  onTagClick,
  onAddTag,
  posts = [],
  sidePanelSearchValue,
  onSidePanelSearchChange,
  onSidePanelSearchClear,
  sidePanels = [],
  className,
  ...rest
}: BookmarksProps) {
  return (
    <div
      className={[
        'flex h-full w-full',
        'bg-[var(--color-surface)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {/* ── Left sidebar ── */}
      <SideBar
        activeItem={activeNavItem}
        onNavigate={onNavigate}
      />

      {/* ── Main content ── */}
      <main
        className="flex-1 min-w-0 flex flex-col gap-[var(--space-6)] py-[var(--space-6)] overflow-y-auto"
        aria-label="Bookmarks"
      >
        {/* ── Page header ── */}
        <div className="flex flex-col gap-[var(--space-6)] w-full shrink-0">
          {/*
           * Heading — Figma (node 260:2577): px 24px.
           * Typography: Manrope Bold ~31px = --font-brand + --font-size-wordmark.
           */}
          <div className="px-[var(--space-6)]">
            <h1
              className={
                'font-[family-name:var(--font-brand)] font-bold ' +
                'text-[var(--font-size-wordmark)] leading-[normal] ' +
                'text-[var(--color-black)] whitespace-nowrap'
              }
            >
              Bookmarks
            </h1>
          </div>

          {/*
           * SearchBar + tag filter — Figma (node 260:2372): px 32px, stacked vertically.
           */}
          <div className="flex flex-col gap-[var(--space-3)] px-[var(--space-8)]">
            <SearchBar
              value={searchValue}
              onChange={onSearchChange}
              onClear={onSearchClear}
              placeholder="Search"
              className="w-full"
            />

            {/*
             * Tag filter bar — Figma (node 260:2593): horizontal row of neutral Tag chips.
             * The final "+" tag triggers onAddTag to open a tag picker.
             */}
            <div className="flex items-center gap-[var(--space-3)] overflow-x-auto">
              {feedTags.map((tag) => (
                <Tag
                  key={tag.label}
                  color="neutral"
                  onClick={() => onTagClick?.(tag.label)}
                  className="cursor-pointer shrink-0"
                  style={{ fontVariationSettings: "'opsz' 14" }}
                >
                  {tag.label}
                </Tag>
              ))}

              {/* "+" tag — opens tag picker */}
              <Tag
                color="neutral"
                onClick={onAddTag}
                className="cursor-pointer shrink-0"
                style={{ fontVariationSettings: "'opsz' 14" }}
              >
                +
              </Tag>
            </div>
          </div>
        </div>

        {/* Horizontal divider — Figma node 260:2389 */}
        <div
          className="h-px w-full bg-[var(--color-border)] shrink-0"
          role="separator"
          aria-hidden="true"
        />

        {/* ── Bookmarked post list — Figma node 260:2390 ── */}
        {/*
         * Figma: px 24px, pb 24px, gap 32px between posts.
         * Each post is rendered with bookmarked=true (filled bookmark icon).
         */}
        <div className="flex flex-col gap-[var(--space-8)] px-[var(--space-6)] pb-[var(--space-6)]">
          {posts.map((post, i) => (
            <DashboardPost key={i} {...post} />
          ))}
        </div>
      </main>

      {/* ── Right panel ── */}
      {/*
       * Mirrors the right-panel layout from Home and Subscriptions pages.
       * Figma (node 260:2506): w-326px, px 24px, py 32px, gap 24px, left border.
       * Uses --search-panel-width (334px) as the closest layout token.
       */}
      <aside
        className={[
          'flex flex-col gap-[var(--space-6)]',
          'w-[var(--search-panel-width)]',
          'h-full overflow-y-auto',
          'bg-[var(--color-surface)]',
          'border-l border-[var(--color-border)]',
          'px-[var(--space-6)] py-[var(--space-8)]',
          'shrink-0',
        ].join(' ')}
        aria-label="Contextual panel"
      >
        {/* Right-panel SearchBar — Figma node 260:2507 */}
        <SearchBar
          value={sidePanelSearchValue}
          onChange={onSidePanelSearchChange}
          onClear={onSidePanelSearchClear}
          placeholder="Search"
          className="w-full shrink-0"
        />

        {/* Contextual event sections — "This week", "Trending", etc. */}
        {sidePanels.map((panel, i) => (
          <SidePanelSection key={i} {...panel} />
        ))}
      </aside>
    </div>
  );
}
