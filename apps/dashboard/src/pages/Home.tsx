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

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ErrorInfo,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { SideBar } from "@app/ui";
import type { SideBarItemId } from "@app/ui";
import { Tag } from "@app/ui";
import { SearchBar } from "@app/ui";
import { DashboardPost } from "@app/ui";
import type { DashboardPostProps, Organization } from "@app/ui";
import { SearchPanel } from "@app/ui";
import { Button } from "@app/ui";
import type { RsvpGroup, Club } from "@app/ui";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  eventToPost,
  orgsToClubs,
  rsvpsToRsvpGroups,
  stampFollowState,
  type HydratedEvent,
} from "../lib/eventToPost";
import { useFollowToggle } from "../lib/useFollowToggle";
import { SearchOverlay } from "../components/SearchOverlay";
import {
  overlayLabelAt,
  overlayRowCount,
} from "../components/searchOverlayUtils";
import type { RecentSearch, SearchSuggestion } from "../data/sampleSearch";
import { loadRecentSearches, saveRecentSearches } from "../lib/recentSearches";

const MIN_QUERY_LENGTH = 2;
// Debounce typed-query search calls so every keystroke doesn't fire a
// round trip — matches the perceived responsiveness of a typical "live
// search" without hammering the backend.
const SUGGESTION_DEBOUNCE_MS = 250;

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
  /** Pre-fills the SearchBar with this query on mount. */
  initialQuery?: string;
  /**
   * Past queries shown in the empty-state dropdown. Defaults to the
   * user's real recent searches from `localStorage` (see
   * `../lib/recentSearches`) — pass this to override for tests/stories.
   */
  recentSearches?: RecentSearch[];
  /**
   * Suggestion pool shown while the user types. Defaults to live
   * `api.events.searchEvents` / `api.orgs.searchOrgs` results for the
   * (debounced) query — pass this to override for tests/stories.
   */
  searchSuggestions?: SearchSuggestion[];
  /**
   * Called when the user commits a query (Enter or selecting a
   * suggestion/recent). Home always defers to the full `/search` results
   * page rather than rendering its own results state inline.
   */
  onSearchSubmit?: (query: string) => void;

  // ── Right panel (SearchPanel) ──
  /**
   * Grouped RSVP events shown in the SearchPanel "Your RSVPs" section.
   * Each group carries a period label ("Today" / "This week") and its events.
   */
  rsvpGroups?: RsvpGroup[];
  /** Subscribed clubs rendered in the SearchPanel "Your Clubs" section. */
  clubs?: Club[];
  /** Called when a club tile in the right rail is clicked. */
  onClubClick?: (club: Club) => void;
  /** Called when an org name in a post header is clicked. */
  onOrgClick?: (org: Organization) => void;
}

// ─── Default data ─────────────────────────────────────────────────────────────

// Stable empty-array reference so `posts` doesn't change identity on every
// render when neither `postsOverride` nor `queriedPosts` is set — otherwise
// the `filteredPosts` useMemo below would recompute unnecessarily.
const EMPTY_POSTS: DashboardPostProps[] = [];

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

export function Home(props: HomeProps) {
  return (
    <FeedErrorBoundary>
      <HomeInner {...props} />
    </FeedErrorBoundary>
  );
}

function HomeInner({
  activeNavItem = "home",
  onNavigate,
  feedTags = DEFAULT_FEED_TAGS,
  onTagClick,
  onAddTag,
  posts: postsOverride,
  searchValue,
  onSearchChange,
  onSearchClear,
  initialQuery,
  recentSearches: recentSearchesOverride,
  searchSuggestions: searchSuggestionsOverride,
  onSearchSubmit,
  rsvpGroups: rsvpGroupsOverride,
  clubs: clubsOverride,
  onClubClick,
  onOrgClick,
  className,
  ...rest
}: HomeProps) {
  // ── Convex-backed feed data ────────────────────────────────────────────
  // Default to "followed" scope; the server transparently falls back to "all"
  // when the current user follows nothing. Callers can still inject `posts`
  // (used by /search to replay sample search results until the search route
  // gets its own backend wiring).
  const navigate = useNavigate();
  const feedResult = useQuery(api.events.feed, {
    paginationOpts: { numItems: 20, cursor: null },
    scope: "followed",
  });
  const followedOrgIds = useQuery(api.follows.myFollows);
  const myRsvps = useQuery(api.rsvps.myRsvps);
  const followedOrgs = useQuery(api.orgs.listFollowed);

  const bookmarkMutation = useMutation(api.bookmarks.bookmark);
  const unbookmarkMutation = useMutation(api.bookmarks.unbookmark);
  const setRsvpMutation = useMutation(api.rsvps.setRsvp);
  const { followedOrgIdSet, toggleFollow } = useFollowToggle(followedOrgIds);

  // Optimistic bookmark state. Each entry overrides the server `isBookmarked`
  // value for that event id until the mutation resolves. Successful resolves
  // leave the entry in place — the next feed refresh will reflect the new
  // truth. Failed resolves remove the entry, restoring the server view.
  const [optimisticBookmarks, setOptimisticBookmarks] = useState<
    ReadonlyMap<Id<"events">, boolean>
  >(() => new Map());
  // In-flight RSVP set — event ids whose `setRsvp` mutation is still pending.
  // Mirrors the bookmark optimistic pattern: flip immediately (here, dedupe
  // rapid clicks), roll back on `.catch`. A ref is used instead of state
  // because DashboardPost has no RSVP'd visual to re-render off of yet —
  // rendering would just churn the post list. When the design system gains
  // a "going" pill, lift this into useState and thread it through queriedPosts.
  const inFlightRsvps = useRef<Set<Id<"events">>>(new Set());

  const handleBookmarkToggle = useCallback(
    (eventId: Id<"events">, currentlyBookmarked: boolean) => {
      const next = !currentlyBookmarked;
      setOptimisticBookmarks((prev) => {
        const m = new Map(prev);
        m.set(eventId, next);
        return m;
      });
      const promise = next
        ? bookmarkMutation({ eventId })
        : unbookmarkMutation({ eventId });
      void promise.catch(() => {
        setOptimisticBookmarks((prev) => {
          const m = new Map(prev);
          m.delete(eventId);
          return m;
        });
      });
    },
    [bookmarkMutation, unbookmarkMutation],
  );

  const handleRsvp = useCallback(
    (eventId: Id<"events">) => {
      // Dedupe rapid clicks while the mutation is in flight — equivalent to
      // the bookmark optimistic flip from the user's perspective.
      if (inFlightRsvps.current.has(eventId)) return;
      inFlightRsvps.current.add(eventId);
      void setRsvpMutation({ eventId, status: "going" })
        .catch(() => {
          // No visible state to roll back beyond freeing the dedupe slot.
        })
        .finally(() => {
          inFlightRsvps.current.delete(eventId);
        });
    },
    [setRsvpMutation],
  );

  const queriedPosts = useMemo<DashboardPostProps[] | undefined>(() => {
    if (!feedResult) return undefined;
    return feedResult.page.map((row: HydratedEvent) => {
      const base = eventToPost(row);
      // Stamp `following` + `onToggleFollow` per-org from the user's follow
      // set so both the Following badge and the hover-card Follow/Unfollow
      // button work. Wire bookmark + RSVP click handlers keyed by the
      // underlying event id.
      const organizations = stampFollowState(
        base.organizations,
        row.orgs,
        followedOrgIdSet,
        toggleFollow,
      );
      const optimisticBookmark = optimisticBookmarks.get(row.event._id);
      const bookmarked =
        optimisticBookmark !== undefined
          ? optimisticBookmark
          : row.isBookmarked;
      return {
        ...base,
        organizations,
        bookmarked,
        onBookmark: () => handleBookmarkToggle(row.event._id, bookmarked),
        onRsvp: () => handleRsvp(row.event._id),
      };
    });
  }, [
    feedResult,
    followedOrgIdSet,
    handleBookmarkToggle,
    handleRsvp,
    optimisticBookmarks,
    toggleFollow,
  ]);

  const queriedRsvpGroups = useMemo(
    () => rsvpsToRsvpGroups(myRsvps),
    [myRsvps],
  );
  const queriedClubs = useMemo(() => orgsToClubs(followedOrgs), [followedOrgs]);

  // "Your Clubs" rows are always currently-followed orgs, so unfollowing is
  // the only direction — resolve the club's slug (`Club.id`) back to its
  // real `Id<"orgs">` via the already-loaded `followedOrgs` list.
  const handleClubToggleFollow = useCallback(
    (club: Club) => {
      const matched = followedOrgs?.find((org) => org.slug === club.id);
      if (matched) toggleFollow(matched._id, true);
    },
    [followedOrgs, toggleFollow],
  );

  // Caller overrides take priority (used by /search and any tests).
  const posts: DashboardPostProps[] =
    postsOverride ?? queriedPosts ?? EMPTY_POSTS;
  const rsvpGroups = rsvpGroupsOverride ?? queriedRsvpGroups;
  const clubs = clubsOverride ?? queriedClubs;

  const feedLoading = postsOverride === undefined && feedResult === undefined;

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
  // ── Search-experience state ────────────────────────────────────────────
  // We always own the input value internally so the overlay/results state
  // machine works without callers wiring controlled props. Callers can
  // still observe via `onSearchChange` / `onSearchSubmit`.
  const [internalQuery, setInternalQuery] = useState<string>(
    searchValue ?? initialQuery ?? "",
  );
  const isControlled = searchValue !== undefined;
  const query = isControlled ? searchValue : internalQuery;

  // Selected filter tag — clicking a tag filters the feed to posts carrying
  // that tag; clicking the active tag again clears the filter.
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const handleTagClick = useCallback(
    (label: string) => {
      setSelectedTag((prev) => (prev === label ? null : label));
      onTagClick?.(label);
    },
    [onTagClick],
  );

  const [focused, setFocused] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  // Local mutable copy of recents so the × buttons can prune, seeded once
  // from real localStorage history (or the caller's override, for
  // tests/stories) — avoiding a sync effect dodges the
  // react-hooks/set-state-in-effect lint.
  const [recents, setRecents] = useState<RecentSearch[]>(
    () => recentSearchesOverride ?? loadRecentSearches(),
  );
  // Persist every recents change (adds via commitQuery, removals via the
  // overlay's × / "Clear all") — no-ops if the caller passed an override.
  useEffect(() => {
    if (recentSearchesOverride === undefined) saveRecentSearches(recents);
  }, [recents, recentSearchesOverride]);

  // Close the dropdown on outside click. We can't rely on input blur alone
  // because clicking a row needs to fire its onMouseDown first.
  const wrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focused) return;
    const handle = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        e.target instanceof Node &&
        !wrapperRef.current.contains(e.target)
      ) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [focused]);

  const handleQueryChange = useCallback(
    (next: string) => {
      if (!isControlled) setInternalQuery(next);
      onSearchChange?.(next);
      // Reset the keyboard highlight whenever the query changes — this is
      // the only call site that actually changes the list contents, so the
      // reset belongs here (avoids a setState-in-effect lint error).
      setActiveIndex(-1);
      setFocused(true);
    },
    [isControlled, onSearchChange],
  );

  const handleClear = useCallback(() => {
    if (!isControlled) setInternalQuery("");
    onSearchChange?.("");
    onSearchClear?.();
  }, [isControlled, onSearchChange, onSearchClear]);

  const commitQuery = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      if (!isControlled) setInternalQuery(trimmed);
      onSearchChange?.(trimmed);
      onSearchSubmit?.(trimmed);
      setFocused(false);
      // Promote committed query into recents (front of list, dedup).
      setRecents((prev) => {
        const filtered = prev.filter(
          (r) => r.label.toLowerCase() !== trimmed.toLowerCase(),
        );
        const next: RecentSearch = {
          id: `recent-${Date.now()}`,
          kind: "query",
          label: trimmed,
        };
        return [next, ...filtered].slice(0, 6);
      });
    },
    [isControlled, onSearchChange, onSearchSubmit],
  );

  // Debounce the typed query before firing live search — a keystroke every
  // few ms shouldn't each fire a round trip. Mirrors Search.tsx's
  // MIN_QUERY_LENGTH gate.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const id = window.setTimeout(
      () => setDebouncedQuery(query.trim()),
      SUGGESTION_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(id);
  }, [query]);
  const suggestionsQueryActive =
    searchSuggestionsOverride === undefined &&
    debouncedQuery.length >= MIN_QUERY_LENGTH;

  const suggestedEvents = useQuery(
    api.events.searchEvents,
    suggestionsQueryActive ? { q: debouncedQuery } : "skip",
  );
  const suggestedOrgs = useQuery(
    api.orgs.searchOrgs,
    suggestionsQueryActive ? { q: debouncedQuery } : "skip",
  );

  const queriedSuggestions = useMemo<SearchSuggestion[]>(() => {
    if (!suggestionsQueryActive) return [];
    const eventSuggestions: SearchSuggestion[] = (suggestedEvents ?? []).map(
      (hydrated) => ({
        id: hydrated.event._id,
        label: hydrated.event.title,
        kind: "event",
        meta: hydrated.orgs.map((org) => org.name).join(", ") || undefined,
      }),
    );
    const orgSuggestions: SearchSuggestion[] = (suggestedOrgs ?? []).map(
      (org) => ({
        id: org._id,
        label: org.name,
        kind: "org",
      }),
    );
    return [...eventSuggestions, ...orgSuggestions].slice(0, 8);
  }, [suggestionsQueryActive, suggestedEvents, suggestedOrgs]);

  const searchSuggestions = searchSuggestionsOverride ?? queriedSuggestions;

  // Keyboard navigation on the input — ↑/↓/Enter/Esc.
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        setFocused(false);
        return;
      }
      if (!focused) return;
      const count = overlayRowCount(query, recents, searchSuggestions);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (count === 0) return;
        setActiveIndex((i) => (i + 1) % count);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (count === 0) return;
        setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const picked = overlayLabelAt(
          activeIndex,
          query,
          recents,
          searchSuggestions,
        );
        commitQuery(picked ?? query);
      }
    },
    [activeIndex, commitQuery, focused, query, recents, searchSuggestions],
  );

  // Feed posts — narrowed to the selected filter tag, when one is active.
  // Committing a query navigates to /search (via onSearchSubmit) rather
  // than replacing the feed inline, so this is the only post list Home ever
  // renders.
  const feedPosts = useMemo(() => {
    if (!selectedTag) return posts;
    return posts.filter((post) =>
      post.tags?.some((tag) => tag.label === selectedTag),
    );
  }, [posts, selectedTag]);

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
         * the main feed, gap 16px. Committing a query (Figma 515:2413)
         * navigates to the full /search results page via `onSearchSubmit`
         * rather than replacing this bar inline.
         */}
        <div
          ref={wrapperRef}
          className="relative flex w-full shrink-0 flex-col gap-[var(--space-4)] px-[var(--space-8)]"
        >
          <SearchBar
            value={query}
            onChange={handleQueryChange}
            onClear={handleClear}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search"
            // aria-expanded/aria-controls are only valid on combobox/menu
            // triggers; the searchbox role from SearchBar doesn't accept
            // them. Drop them — the overlay's open/closed state is fully
            // visible to AT through focus + DOM presence.
            className="w-full shrink-0"
          />

          {/* Dropdown overlay — only visible while the input is focused
              (committing a query navigates away to /search, so there's no
              in-page "results" state to guard against here). */}
          {focused && (
            <div
              id="search-overlay"
              className="absolute top-[calc(100%+var(--space-2))] right-[var(--space-8)] left-[var(--space-8)] z-30"
            >
              <SearchOverlay
                query={query}
                recents={recents}
                suggestions={searchSuggestions}
                activeIndex={activeIndex}
                onActiveIndexChange={setActiveIndex}
                onSelect={(label) => commitQuery(label)}
                onRemoveRecent={(id) =>
                  setRecents((prev) => prev.filter((r) => r.id !== id))
                }
                onClearRecents={() => setRecents([])}
              />
            </div>
          )}

          {/* Tag filter bar */}
          <div className="flex items-center gap-[var(--space-3)] overflow-x-auto">
            {feedTags.map((tag) => (
              <Tag
                key={tag.label}
                color={selectedTag === tag.label ? "blue" : "neutral"}
                onClick={() => handleTagClick(tag.label)}
                aria-pressed={selectedTag === tag.label}
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
          {feedLoading && <FeedLoadingState />}
          {feedPosts.map((post, i) => (
            <DashboardPost
              key={i}
              {...post}
              onOrgClick={handleOrgClickInternal}
            />
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
       *
       * Product rule: the sidebar must never be empty. When the user
       * follows zero clubs (and there are no RSVPs to show), render an
       * empty-state inviting them to discover clubs instead of letting
       * SearchPanel render an empty <aside>.
       */}
      {clubs.length === 0 && rsvpGroups.length === 0 ? (
        <SidebarEmptyState />
      ) : (
        <SearchPanel
          rsvpGroups={rsvpGroups}
          clubs={clubs}
          onClubClick={onClubClick}
          onToggleFollow={handleClubToggleFollow}
          className="h-full shrink-0 overflow-visible"
        />
      )}
    </div>
  );
}

// ─── FeedErrorBoundary ───────────────────────────────────────────────────────
//
// Convex's `useQuery` can throw when a backend function throws. If anything
// inside HomeInner throws during render (or its child queries fail in a way
// that bubbles up), surface a user-facing banner with a Retry instead of a
// blank page. Retry just reloads — backend retries on the next hydration.

interface FeedErrorBoundaryState {
  hasError: boolean;
}

class FeedErrorBoundary extends Component<
  { children: ReactNode },
  FeedErrorBoundaryState
> {
  state: FeedErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FeedErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the error in the console so the dev sees the stack while a
    // friendly banner renders to the user.
    console.error("Home feed crashed:", error, info);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    return (
      <div
        className={[
          "flex h-screen w-full items-center justify-center",
          "bg-[var(--color-surface)]",
          "px-[var(--space-8)]",
        ].join(" ")}
        role="alert"
      >
        <div
          className={[
            "flex w-full max-w-[28rem] flex-col items-start gap-[var(--space-3)]",
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
            Something went wrong loading your feed.
          </h2>
          <Button variant="primary" size="sm" onClick={this.handleRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }
}

// ─── FeedLoadingState ────────────────────────────────────────────────────────

function FeedLoadingState() {
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
      Loading feed…
    </div>
  );
}

// ─── SidebarEmptyState ───────────────────────────────────────────────────────
//
// Rendered in place of <SearchPanel> when the user follows zero clubs (and has
// no RSVPs to show). Mirrors SearchPanel's outer aside dimensions/border so
// the layout doesn't jump, and uses the same card styling as FeedLoadingState.

function SidebarEmptyState() {
  return (
    <aside
      aria-label="Search panel"
      className={[
        "flex h-full shrink-0 flex-col gap-[var(--space-3)]",
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
          No clubs followed yet
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
