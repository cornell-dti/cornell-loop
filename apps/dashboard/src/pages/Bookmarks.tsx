/**
 * Bookmarks — Loop Dashboard Page
 *
 * Mirrors the Home page shell (SideBar + main feed + SearchPanel) so the
 * dashboard surfaces feel consistent across routes. The main column shows
 * bookmarked posts with `bookmarked={true}`. The right rail is the shared
 * design-system SearchPanel showing "Your RSVPs" + "Your Clubs".
 *
 * The design system is the source of truth for the right rail layout — no
 * custom asides or per-page section components.
 */

import type { ComponentPropsWithoutRef } from "react";
import { SideBar, SearchBar, SearchPanel, Tag, DashboardPost } from "@app/ui";
import type {
  SideBarItemId,
  DashboardPostProps,
  RsvpGroup,
  Club,
  Organization,
} from "@app/ui";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FeedTagItem {
  label: string;
}

export interface BookmarksProps extends ComponentPropsWithoutRef<"div"> {
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

  // ── Right panel (shared SearchPanel) ──
  rsvpGroups?: RsvpGroup[];
  clubs?: Club[];
  onClubClick?: (club: Club) => void;
  /** Called when an org name in a post header is clicked. */
  onOrgClick?: (org: Organization) => void;
}

const DEFAULT_FEED_TAGS: FeedTagItem[] = [
  { label: "Recruitment" },
  { label: "Early Career" },
  { label: "Tech" },
  { label: "Mentorship" },
  { label: "Just for Fun" },
];

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export function Bookmarks({
  activeNavItem = "bookmarks",
  onNavigate,
  searchValue,
  onSearchChange,
  onSearchClear,
  feedTags = DEFAULT_FEED_TAGS,
  onTagClick,
  onAddTag,
  posts = [],
  rsvpGroups,
  clubs,
  onClubClick,
  onOrgClick,
  className,
  ...rest
}: BookmarksProps) {
  return (
    <div
      className={[
        // Match Home shell: full viewport with per-column scroll so SideBar
        // and SearchPanel stay visually fixed while only the feed scrolls.
        "flex h-screen w-full overflow-hidden",
        "bg-[var(--color-surface)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {/* ── Left sidebar — design system ── */}
      <div className="h-full shrink-0 overflow-y-auto">
        <SideBar activeItem={activeNavItem} onNavigate={onNavigate} />
      </div>

      {/* ── Main feed ── */}
      <main
        className={[
          "flex min-w-0 flex-1 flex-col gap-[var(--space-6)]",
          "overflow-y-auto bg-[var(--color-surface-subtle)] py-[var(--space-6)]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        ].join(" ")}
        aria-label="Bookmarks"
      >
        {/* ── Page header ── */}
        <div className="flex w-full shrink-0 flex-col gap-[var(--space-4)] px-[var(--space-8)]">
          <h1
            className={
              "font-[family-name:var(--font-brand)] font-bold " +
              "leading-[normal] text-[var(--font-size-wordmark)] " +
              "whitespace-nowrap text-[var(--color-black)]"
            }
          >
            Bookmarks
          </h1>

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

        {/* Divider */}
        <div
          className="h-px w-full shrink-0 bg-[var(--color-border)]"
          role="separator"
          aria-hidden="true"
        />

        {/* ── Bookmarked post list ── */}
        <div className="flex flex-col gap-[var(--space-5)] px-[var(--space-8)] pb-[var(--space-8)]">
          {posts.map((post, i) => (
            <DashboardPost key={i} {...post} onOrgClick={onOrgClick} />
          ))}
        </div>
      </main>

      {/* ── Right panel — design-system SearchPanel ── */}
      <SearchPanel
        rsvpGroups={rsvpGroups}
        clubs={clubs}
        onClubClick={onClubClick}
        className="h-full shrink-0 overflow-visible"
      />
    </div>
  );
}
