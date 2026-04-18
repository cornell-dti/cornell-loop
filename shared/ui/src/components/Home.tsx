/**
 * Home — Loop Dashboard Page
 *
 * Source: Figma "Incubator-design-file" › node 263:3493 "Home"
 *
 * Full-page layout composed from existing design system components:
 *   • SideBar (left)     — navigation rail with logo + primary nav + profile
 *   • Main feed (center) — Toggle tab switcher, tag filter bar, post list
 *   • Right panel        — SearchBar, contextual event sections ("This week", "Trending")
 *
 * The feed uses the DashboardPost component for each post entry.
 * The right-panel event rows mirror the SearchResultRow pattern from SearchPanel,
 * extended to support circle avatars and the orange "For you" availability badge.
 *
 * "For you" badge: Figma uses bg #ffe4d5 / text #b54400 — approximated here with
 * --color-primary-500 / --color-primary-800, the closest available palette tokens.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef } from 'react';
import { SideBar } from './SideBar';
import type { SideBarItemId } from './SideBar';
import { Toggle } from './Toggle';
import { Tag } from './Tags';
import { SearchBar } from './SearchBar';
import { DashboardPost } from './Cards/DashboardPost';
import type { DashboardPostProps } from './Cards/DashboardPost';
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

export type FeedTab = 'for-you' | 'following';

export interface FeedTagItem {
  /** Display label for the filter tag, e.g. "Recruitment". */
  label: string;
}

/**
 * A single event row rendered inside a right-panel section ("This week" / "Trending").
 * Mirrors the structure of Figma node 263:3698 and siblings.
 */
export interface HomeEventItem {
  title: string;
  orgName: string;
  /** Optional avatar image URL. Falls back to an initial-letter badge. */
  orgAvatarUrl?: string;
  /**
   * When true a small neutral indicator badge (star icon) is shown beside the org name.
   * Matches the Figma "Icon button" element (bg #949494 ≈ --color-neutral-600).
   */
  hasIndicator?: boolean;
  /**
   * When true an orange "For you" badge is rendered to the right of the org row.
   * Figma: bg #ffe4d5 / text #b54400 — approximated with --color-primary-500 / --color-primary-800.
   */
  isForYou?: boolean;
}

/** Props for a single right-panel section card ("This week" or "Trending"). */
export interface HomeSidePanelProps {
  /** Card heading text, e.g. "This week" or "Trending". */
  title: string;
  items: HomeEventItem[];
  /** When provided a "Show more" link is rendered at the bottom of the card. */
  onShowMore?: () => void;
}

export interface HomeProps extends ComponentPropsWithoutRef<'div'> {
  // ── Sidebar ──
  /** Currently active navigation item. Defaults to 'home'. */
  activeNavItem?: SideBarItemId;
  /** Called with the nav item id when a sidebar tab is clicked. */
  onNavigate?: (id: SideBarItemId) => void;

  // ── Feed toggle ──
  /** Active feed tab. Defaults to 'for-you'. */
  activeTab?: FeedTab;
  /** Called with the new tab value when the toggle changes. */
  onTabChange?: (tab: FeedTab) => void;

  // ── Tag filter bar ──
  /**
   * List of tags shown in the horizontal filter bar.
   * Defaults to the tags from the Figma spec.
   */
  feedTags?: FeedTagItem[];
  /** Called with the tag label when a filter tag is clicked. */
  onTagClick?: (label: string) => void;
  /** Called when the "+" add-tag button is clicked. */
  onAddTag?: () => void;

  // ── Posts ──
  /** Feed posts rendered using the DashboardPost component. */
  posts?: DashboardPostProps[];

  // ── Search ──
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchClear?: () => void;

  // ── Right panel sections ──
  /**
   * Ordered list of contextual event sections shown in the right panel.
   * Figma shows "This week" first, then "Trending".
   */
  sidePanels?: HomeSidePanelProps[];
}

// ─── Default data ─────────────────────────────────────────────────────────────

const DEFAULT_FEED_TAGS: FeedTagItem[] = [
  { label: 'Recruitment' },
  { label: 'Early Career' },
  { label: 'Tech' },
  { label: 'Mentorship' },
  { label: 'Just for Fun' },
];

// ─── HomeEventRow ─────────────────────────────────────────────────────────────

/**
 * A single event row inside a HomeSidePanel section.
 * Renders: event title + org avatar + org name + optional indicator badge + optional "For you" tag.
 * Matches Figma nodes 263:3698–263:3724.
 */
function HomeEventRow({ item }: { item: HomeEventItem }) {
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
      {/* Event title — semibold, single line truncation */}
      <p
        className={BODY2_SEMIBOLD + ' text-[var(--color-neutral-700)] truncate w-full'}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {item.title}
      </p>

      {/* Org row: avatar + name + indicator badge + optional "For you" tag */}
      <div className="flex items-center gap-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          {/*
           * Circle avatar — 24 × 24 px (--space-6).
           * Falls back to an initial-letter badge using secondary palette,
           * consistent with the avatar pattern in DashboardPost.
           */}
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
           * Figma bg: #949494 ≈ --color-neutral-600 (consistent with DashboardPost indicator).
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
         * --color-primary-500 (#ffcaaa) / --color-primary-800 (#a74409),
         * the closest available palette tokens.
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

// ─── HomeSidePanel ────────────────────────────────────────────────────────────

/**
 * A contextual event section card in the right panel ("This week" / "Trending").
 * Matches Figma nodes 263:3695 and 263:3726.
 *
 * Container: bg white, Neutral/300 border, rounded-[16px], px 16px, py 12px.
 * This mirrors the SearchResultList container style from SearchPanel.tsx.
 */
function HomeSidePanel({ title, items, onShowMore }: HomeSidePanelProps) {
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
      {/* Section title — DM Sans Bold 18px, Neutral/900 */}
      <h2 className={SECTION_TITLE} style={{ fontVariationSettings: "'opsz' 14" }}>
        {title}
      </h2>

      {/* Event rows */}
      <div className="flex flex-col gap-[var(--space-4)] w-full">
        {items.map((item, i) => (
          <HomeEventRow key={i} item={item} />
        ))}
      </div>

      {/*
       * "Show more" link — Figma: Inter Regular 16px, #0074bc.
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

// ─── Home ─────────────────────────────────────────────────────────────────────

/**
 * Home page layout — three-column shell:
 *
 *   ┌────────────┬──────────────────────────┬────────────────┐
 *   │  SideBar   │  Main feed               │  Right panel   │
 *   │ (215px)    │  (flex-1)                │ (334px)        │
 *   │            │  Toggle + tag filter     │  SearchBar     │
 *   │  Home      │  ─────────────────────   │  This week     │
 *   │  Bookmarks │  DashboardPost ×n        │  Trending      │
 *   │  Subs      │                          │                │
 *   │  ────────  │                          │                │
 *   │  Profile   │                          │                │
 *   └────────────┴──────────────────────────┴────────────────┘
 */
export function Home({
  activeNavItem = 'home',
  onNavigate,
  activeTab = 'for-you',
  onTabChange,
  feedTags = DEFAULT_FEED_TAGS,
  onTagClick,
  onAddTag,
  posts = [],
  searchValue,
  onSearchChange,
  onSearchClear,
  sidePanels = [],
  className,
  ...rest
}: HomeProps) {
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

      {/* ── Main feed ── */}
      <main
        className="flex-1 min-w-0 flex flex-col gap-[var(--space-6)] py-[var(--space-6)] overflow-y-auto"
        aria-label="Feed"
      >
        {/* ── Feed header: tab toggle + tag filter bar ── */}
        <div className="flex flex-col gap-[var(--space-6)] w-full shrink-0">
          {/*
           * Feed tab toggle — "For you" / "Following".
           * w-full stretches the toggle to fill the padded container.
           * Figma (node 263:3535): full-width pill container, px 24px.
           */}
          <div className="px-[var(--space-6)]">
            <Toggle
              options={[
                { value: 'for-you', label: 'For you' },
                { value: 'following', label: 'Following' },
              ]}
              value={activeTab}
              onChange={(v) => onTabChange?.(v as FeedTab)}
              className="w-full"
            />
          </div>

          {/*
           * Tag filter bar — horizontal scrollable row of neutral Tag chips.
           * Figma (node 263:3540): px 32px, gap 12px.
           * The final "+" tag triggers onAddTag to open a tag picker.
           */}
          <div
            className="flex items-center gap-[var(--space-3)] px-[var(--space-8)] overflow-x-auto"
          >
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

            {/* "+" tag — opens tag picker (Figma node 263:3552) */}
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

        {/* Horizontal divider — Figma node 263:3557: 1px, --color-border */}
        <div
          className="h-px w-full bg-[var(--color-border)] shrink-0"
          role="separator"
          aria-hidden="true"
        />

        {/* ── Post list ── */}
        {/*
         * Each post is rendered as a DashboardPost (org header + event card).
         * Figma (node 263:3558): pb 24px, px 24px, gap 32px between posts.
         */}
        <div className="flex flex-col gap-[var(--space-8)] px-[var(--space-6)] pb-[var(--space-6)]">
          {posts.map((post, i) => (
            <DashboardPost key={i} {...post} />
          ))}
        </div>
      </main>

      {/* ── Right panel ── */}
      {/*
       * Fixed-width aside — mirrors the SearchPanel layout from SearchPanel.tsx.
       * Figma (node 263:3691): w-326px, px 24px, py 32px, gap 24px, left border.
       * Uses --search-panel-width (334px) as the closest available layout token.
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
        {/* Search bar — Figma node 263:3692 */}
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          onClear={onSearchClear}
          placeholder="Search"
          className="w-full shrink-0"
        />

        {/* Contextual event sections — "This week", "Trending", etc. */}
        {sidePanels.map((panel, i) => (
          <HomeSidePanel key={i} {...panel} />
        ))}
      </aside>
    </div>
  );
}
