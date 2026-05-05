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

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  SideBar,
  SearchBar,
  SearchPanel,
  Tag,
  DashboardPost,
  Button,
} from "@app/ui";
import type {
  SideBarItemId,
  DashboardPostProps,
  RsvpGroup,
  Club,
  Organization,
} from "@app/ui";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  eventToPost,
  orgsToClubs,
  rsvpsToRsvpGroups,
} from "../lib/eventToPost";

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
  posts: postsOverride,
  rsvpGroups: rsvpGroupsOverride,
  clubs: clubsOverride,
  onClubClick,
  onOrgClick,
  className,
  ...rest
}: BookmarksProps) {
  const navigate = useNavigate();
  const bookmarksResult = useQuery(api.bookmarks.myBookmarks, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const followedOrgIds = useQuery(api.follows.myFollows);
  const myRsvps = useQuery(api.rsvps.myRsvps);
  const followedOrgs = useQuery(api.orgs.listFollowed);

  const unbookmarkMutation = useMutation(api.bookmarks.unbookmark);
  const setRsvpMutation = useMutation(api.rsvps.setRsvp);
  const followedOrgIdSet = useMemo<ReadonlySet<Id<"orgs">>>(() => {
    if (!followedOrgIds) return new Set<Id<"orgs">>();
    return new Set<Id<"orgs">>(followedOrgIds);
  }, [followedOrgIds]);

  // Optimistic-removal set: bookmarks that the user just unbookmarked but
  // whose mutation hasn't yet round-tripped. Visually filter these out so the
  // row disappears immediately; on mutation failure we re-add the id so the
  // row reappears.
  const [optimisticallyRemoved, setOptimisticallyRemoved] = useState<
    ReadonlySet<Id<"events">>
  >(() => new Set<Id<"events">>());

  // Surface a banner when the underlying queries fail to load for a
  // sustained period (still undefined after several seconds) or when a
  // mutation throws. Retry just reloads the page.
  const [hasError, setHasError] = useState(false);
  const queryStillLoading = bookmarksResult === undefined;
  useEffect(() => {
    if (!queryStillLoading) return;
    const id = window.setTimeout(() => setHasError(true), 8000);
    return () => window.clearTimeout(id);
  }, [queryStillLoading]);

  const handleRemoveBookmark = useCallback(
    (eventId: Id<"events">) => {
      setOptimisticallyRemoved((prev) => {
        const next = new Set(prev);
        next.add(eventId);
        return next;
      });
      void unbookmarkMutation({ eventId }).catch(() => {
        setOptimisticallyRemoved((prev) => {
          const next = new Set(prev);
          next.delete(eventId);
          return next;
        });
        setHasError(true);
      });
    },
    [unbookmarkMutation],
  );

  const handleRsvp = useCallback(
    (eventId: Id<"events">) => {
      void setRsvpMutation({ eventId, status: "going" }).catch(() => {
        setHasError(true);
      });
    },
    [setRsvpMutation],
  );

  const queriedPosts = useMemo<DashboardPostProps[] | undefined>(() => {
    if (!bookmarksResult) return undefined;
    return bookmarksResult.page
      .filter((row) => !optimisticallyRemoved.has(row.event._id))
      .map((row) => {
        // myBookmarks only ever returns bookmarked rows, so isBookmarked is true.
        const base = eventToPost({
          event: row.event,
          orgs: row.orgs,
          isBookmarked: true,
        });
        const organizations = base.organizations.map((org, i) => {
          const matched = row.orgs[i];
          return {
            ...org,
            following:
              matched !== undefined ? followedOrgIdSet.has(matched._id) : false,
          };
        });
        return {
          ...base,
          organizations,
          onBookmark: () => handleRemoveBookmark(row.event._id),
          onRsvp: () => handleRsvp(row.event._id),
        };
      });
  }, [
    bookmarksResult,
    followedOrgIdSet,
    handleRemoveBookmark,
    handleRsvp,
    optimisticallyRemoved,
  ]);

  const queriedRsvpGroups = useMemo(
    () => rsvpsToRsvpGroups(myRsvps),
    [myRsvps],
  );
  const queriedClubs = useMemo(() => orgsToClubs(followedOrgs), [followedOrgs]);

  const posts: DashboardPostProps[] = postsOverride ?? queriedPosts ?? [];
  const rsvpGroups = rsvpGroupsOverride ?? queriedRsvpGroups;
  const clubs = clubsOverride ?? queriedClubs;

  const feedLoading =
    postsOverride === undefined && bookmarksResult === undefined;
  const feedEmpty =
    postsOverride === undefined &&
    bookmarksResult !== undefined &&
    bookmarksResult.page.length === 0;

  const handleOrgClickInternal = useCallback(
    (org: Organization) => {
      if (onOrgClick) {
        onOrgClick(org);
        return;
      }
      if (org.id) {
        navigate(`/orgs/${org.id}`);
      }
    },
    [navigate, onOrgClick],
  );
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
          {hasError && (
            <BookmarksErrorBanner onRetry={() => window.location.reload()} />
          )}
          {feedLoading && <BookmarksLoadingState />}
          {!feedLoading && feedEmpty && <BookmarksEmptyState />}
          {posts.map((post, i) => (
            <DashboardPost
              key={i}
              {...post}
              onOrgClick={handleOrgClickInternal}
            />
          ))}
        </div>
      </main>

      {/* ── Right panel — design-system SearchPanel, or empty-state when the
       * user follows zero clubs and has no upcoming RSVPs. Mirrors the
       * Home/Subscriptions sidebar pattern so the right rail never goes blank.
       */}
      {clubs.length === 0 && rsvpGroups.length === 0 ? (
        <BookmarksSidebarEmptyState />
      ) : (
        <SearchPanel
          rsvpGroups={rsvpGroups}
          clubs={clubs}
          onClubClick={onClubClick}
          className="hidden h-full shrink-0 overflow-visible lg:flex"
        />
      )}
    </div>
  );
}

// ─── BookmarksSidebarEmptyState ──────────────────────────────────────────────
//
// Rendered in place of <SearchPanel> when the user follows zero clubs (and has
// no RSVPs). Mirrors the Home and Subscriptions empty-state sidebars verbatim
// so visual parity holds across pages.

function BookmarksSidebarEmptyState() {
  return (
    <aside
      aria-label="Search panel"
      className={[
        "hidden h-full shrink-0 flex-col gap-[var(--space-3)] lg:flex",
        "w-[var(--search-panel-width)]",
        "bg-[var(--color-surface)]",
        "border-l border-[var(--color-border)]",
        "px-[var(--space-6)] py-[var(--space-8)]",
        "overflow-visible",
      ].join(" ")}
    >
      <div
        className={[
          "flex w-full flex-col items-start gap-[var(--space-2)]",
          "rounded-[var(--radius-card)]",
          "bg-[var(--color-surface)]",
          "border border-[var(--color-border)]",
          "px-[var(--space-4)] py-[var(--space-4)]",
        ].join(" ")}
      >
        <h3
          className={[
            "font-[family-name:var(--font-body)] font-semibold",
            "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)]",
            "tracking-[var(--letter-spacing-body2)]",
            "text-[color:var(--color-text)]",
          ].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          No clubs followed yet
        </h3>
        <p
          className={[
            "font-[family-name:var(--font-body)] font-normal",
            "text-[length:var(--font-size-body3)] leading-[var(--line-height-body2)]",
            "tracking-[var(--letter-spacing-body3)]",
            "text-[color:var(--color-text-secondary)]",
          ].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Discover clubs to fill your feed.
        </p>
        <Link to="/search" className="mt-[var(--space-1)]">
          <Button variant="primary" size="sm">
            Discover clubs
          </Button>
        </Link>
      </div>
    </aside>
  );
}

// ─── Loading / empty states ──────────────────────────────────────────────────

function BookmarksLoadingState() {
  return (
    <div
      className={[
        "flex w-full items-center justify-center",
        "rounded-[var(--radius-card)]",
        "border border-dashed border-[var(--color-border)]",
        "bg-[var(--color-surface)]",
        "px-[var(--space-6)] py-[var(--space-8)]",
        "font-[family-name:var(--font-body)] font-normal",
        "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)]",
        "tracking-[var(--letter-spacing-body2)]",
        "text-[color:var(--color-text-secondary)]",
      ].join(" ")}
      role="status"
      aria-live="polite"
      style={{ fontVariationSettings: "'opsz' 14" }}
    >
      Loading bookmarks…
    </div>
  );
}

function BookmarksErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={[
        "flex w-full items-center justify-between gap-[var(--space-3)]",
        "rounded-[var(--radius-card)]",
        "border border-[var(--color-border)]",
        "bg-[var(--color-surface)]",
        "px-[var(--space-4)] py-[var(--space-3)]",
      ].join(" ")}
    >
      <p
        className={[
          "font-[family-name:var(--font-body)] font-medium",
          "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)]",
          "tracking-[var(--letter-spacing-body2)]",
          "text-[color:var(--color-neutral-900)]",
        ].join(" ")}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Couldn&rsquo;t load bookmarks.
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function BookmarksEmptyState() {
  return (
    <div
      className={[
        "flex w-full flex-col items-start gap-[var(--space-2)]",
        "rounded-[var(--radius-card)]",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "px-[var(--space-5)] py-[var(--space-4)]",
      ].join(" ")}
    >
      <h2
        className={[
          "font-[family-name:var(--font-body)] font-bold",
          "text-[length:var(--font-size-sub2)] leading-[var(--line-height-sub2)]",
          "tracking-[var(--letter-spacing-body1)]",
          "text-[color:var(--color-neutral-900)]",
        ].join(" ")}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Nothing bookmarked yet
      </h2>
      <p
        className={[
          "font-[family-name:var(--font-body)] font-normal",
          "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)]",
          "tracking-[var(--letter-spacing-body2)]",
          "text-[color:var(--color-text-secondary)]",
        ].join(" ")}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Tap the bookmark icon on any post to save it for later.
      </p>
    </div>
  );
}
