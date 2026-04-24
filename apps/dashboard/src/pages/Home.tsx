/**
 * Home — Loop Dashboard Page
 *
 * Source: Figma "Incubator-design-file" › node 263:3493 "Home"
 *
 * Full-page layout composed from existing design system components:
 *   • SideBar (left)     — navigation rail with logo + primary nav + profile
 *   • Main feed (center) — Toggle tab switcher, tag filter bar, post list
 *   • SearchPanel (right) — RSVPs + Clubs (design-system component)
 *
 * The feed uses the DashboardPost component for each post entry.
 * The right panel uses the shared SearchPanel component which owns its own
 * <aside> wrapper (width, border, padding).
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef } from "react";
import { SideBar } from "@app/ui";
import type { SideBarItemId } from "@app/ui";
import { Tag } from "@app/ui";
import { SearchBar } from "@app/ui";
import { DashboardPost } from "@app/ui";
import type { DashboardPostProps } from "@app/ui";
import { SearchPanel } from "@app/ui";
import type { RsvpGroup, Club } from "@app/ui";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FeedTagItem {
  /** Display label for the filter tag, e.g. "Recruitment". */
  label: string;
}

export interface HomeProps extends ComponentPropsWithoutRef<"div"> {
  // ── Sidebar ──
  /** Currently active navigation item. Defaults to 'home'. */
  activeNavItem?: SideBarItemId;
  /** Called with the nav item id when a sidebar tab is clicked. */
  onNavigate?: (id: SideBarItemId) => void;

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

  // ── Right panel (SearchPanel) ──
  /**
   * Grouped RSVP events shown in the SearchPanel "Your RSVPs" section.
   * Each group carries a period label ("Today" / "This week") and its events.
   */
  rsvpGroups?: RsvpGroup[];
  /** Subscribed clubs rendered in the SearchPanel "Your Clubs" section. */
  clubs?: Club[];
}

// ─── Default data ─────────────────────────────────────────────────────────────

const DEFAULT_FEED_TAGS: FeedTagItem[] = [
  { label: "Recruitment" },
  { label: "Early Career" },
  { label: "Tech" },
  { label: "Mentorship" },
  { label: "Just for Fun" },
];

// ─── Home ─────────────────────────────────────────────────────────────────────

/**
 * Home page layout — three-column shell:
 *
 *   ┌────────────┬──────────────────────────┬────────────────┐
 *   │  SideBar   │  Main feed               │  SearchPanel   │
 *   │ (215px)    │  (flex-1)                │ (334px)        │
 *   │            │  Toggle + tag filter     │  Your RSVPs    │
 *   │  Home      │  ─────────────────────   │  Your Clubs    │
 *   │  Bookmarks │  DashboardPost ×n        │                │
 *   │  Subs      │                          │                │
 *   │  ────────  │                          │                │
 *   │  Profile   │                          │                │
 *   └────────────┴──────────────────────────┴────────────────┘
 */
export function Home({
  activeNavItem = "home",
  onNavigate,
  feedTags = DEFAULT_FEED_TAGS,
  onTagClick,
  onAddTag,
  posts = [],
  searchValue,
  onSearchChange,
  onSearchClear,
  rsvpGroups,
  clubs,
  className,
  ...rest
}: HomeProps) {
  return (
    <div
      className={[
        /*
         * h-screen + per-column scroll so the SideBar (left) and SearchPanel
         * (right) stay visually fixed while only the feed scrolls. Using the
         * viewport as the scroll container would let the sidebars scroll away.
         */
        "flex h-screen w-full overflow-hidden",
        "bg-[var(--color-surface)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {/* ── Left sidebar — sticky via flex stretch + internal scroll ── */}
      <div className="h-full shrink-0 overflow-y-auto">
        <SideBar activeItem={activeNavItem} onNavigate={onNavigate} />
      </div>

      {/* ── Main feed ── */}
      <main
        className={[
          "flex min-w-0 flex-1 flex-col gap-[var(--space-6)]",
          "overflow-y-auto bg-[var(--color-surface-subtle)] py-[var(--space-6)]",
          /*
           * Hide the feed scrollbar while keeping the element scrollable.
           * Firefox uses the `scrollbar-width` property; Chromium/Safari
           * use the ::-webkit-scrollbar pseudo.
           */
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        ].join(" ")}
        aria-label="Feed"
      >
        {/* ── Feed header: search bar + tag filter bar ── */}
        {/*
         * Figma node 506:8718: SearchBar sits above the tag filter bar within
         * the main feed, gap 16px. Tags row is the category filter shown
         * beneath it; the "+" tag opens a picker.
         */}
        <div className="flex w-full shrink-0 flex-col gap-[var(--space-4)] px-[var(--space-8)]">
          <SearchBar
            value={searchValue}
            onChange={onSearchChange}
            onClear={onSearchClear}
            placeholder="Search"
            className="w-full shrink-0"
          />

          <div className="flex items-center gap-[var(--space-3)] overflow-x-auto">
            {feedTags.map((tag) => (
              <Tag
                key={tag.label}
                color="neutral"
                onClick={() => onTagClick?.(tag.label)}
                className="shrink-0 cursor-pointer"
                style={{ fontVariationSettings: "'opsz' 14" }}
              >
                {tag.label}
              </Tag>
            ))}

            {/* "+" tag — opens tag picker (Figma node 263:3552) */}
            <Tag
              color="neutral"
              onClick={onAddTag}
              className="shrink-0 cursor-pointer"
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              +
            </Tag>
          </div>
        </div>

        {/* Horizontal divider — Figma node 263:3557: 1px, --color-border */}
        <div
          className="h-px w-full shrink-0 bg-[var(--color-border)]"
          role="separator"
          aria-hidden="true"
        />

        {/* ── Post list ── */}
        {/*
         * Each post is rendered as a DashboardPost (org header + event card).
         * Figma (node 506:8718): pb 32px, px 32px, gap 20px between posts.
         */}
        <div className="flex flex-col gap-[var(--space-5)] px-[var(--space-8)] pb-[var(--space-8)]">
          {posts.map((post, i) => (
            <DashboardPost key={i} {...post} />
          ))}
        </div>
      </main>

      {/*
       * ── Right panel ──
       * Sticky via flex stretch. `overflow-visible` is intentional: the
       * OrgHoverCard inside ClubItem needs to float outside the aside
       * bounds (into the feed column). If we scroll-trap this aside the
       * hover card gets clipped. Content is short (RSVPs + clubs) so no
       * internal scroll is needed in practice.
       */}
      <SearchPanel
        rsvpGroups={rsvpGroups}
        clubs={clubs}
        className="h-full shrink-0 overflow-visible"
      />
    </div>
  );
}
