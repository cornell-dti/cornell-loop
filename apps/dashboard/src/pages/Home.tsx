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
import { useConvex, useMutation, useQuery } from "convex/react";
import { SideBar } from "@app/ui";
import type { SideBarItemId } from "@app/ui";
import { Tag } from "@app/ui";
import { SearchBar } from "@app/ui";
import { DashboardPost } from "@app/ui";
import type { DashboardPostProps, Organization } from "@app/ui";
import { SearchPanel } from "@app/ui";
import { Toggle } from "@app/ui";
import { Button } from "@app/ui";
import type { RsvpGroup, Club } from "@app/ui";
import { fallbackColorsForName } from "@app/ui";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  eventToPost,
  orgsToClubs,
  rsvpsToRsvpGroups,
  type HydratedEvent,
} from "../lib/eventToPost";
import { SearchOverlay } from "../components/SearchOverlay";
import {
  overlayLabelAt,
  overlayRowCount,
} from "../components/searchOverlayUtils";
import type { RecentSearch, SearchSuggestion } from "../data/sampleSearch";
import {
  SAMPLE_RECENT_SEARCHES,
  SAMPLE_SUGGESTIONS,
  SAMPLE_ORG_RESULTS,
  SAMPLE_RESULT_POSTS,
} from "../data/sampleSearch";
import type { SearchOrgResult } from "../data/sampleSearch";

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
  /**
   * When set, Home boots into the "results" state with this query already
   * pre-filled in the SearchBar — used by the /search?q=… route so a
   * deep-link can land directly on results.
   */
  initialQuery?: string;
  /** Past queries shown in the empty-state dropdown. */
  recentSearches?: RecentSearch[];
  /** Suggestion pool filtered while the user types. */
  searchSuggestions?: SearchSuggestion[];
  /** Org results shown above the post feed in results state. */
  orgResults?: SearchOrgResult[];
  /** Posts shown in the feed when in results state. */
  resultPosts?: DashboardPostProps[];
  /** Called when the user commits a query (Enter or selecting a suggestion). */
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
type SearchScope = "top" | "events" | "orgs";

const SEARCH_SCOPE_OPTIONS: { value: SearchScope; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "events", label: "Events" },
  { value: "orgs", label: "Orgs" },
];

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
  recentSearches = SAMPLE_RECENT_SEARCHES,
  searchSuggestions = SAMPLE_SUGGESTIONS,
  orgResults = SAMPLE_ORG_RESULTS,
  resultPosts = SAMPLE_RESULT_POSTS,
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
  const followedOrgIdSet = useMemo<ReadonlySet<Id<"orgs">>>(() => {
    if (!followedOrgIds) return new Set<Id<"orgs">>();
    return new Set<Id<"orgs">>(followedOrgIds);
  }, [followedOrgIds]);

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
      // Stamp `following` per-org from the user's follow set so the
      // Following badge renders correctly. Wire bookmark + RSVP click
      // handlers keyed by the underlying event id.
      const organizations = base.organizations.map((org, i) => {
        const matched = row.orgs[i];
        return {
          ...org,
          following:
            matched !== undefined ? followedOrgIdSet.has(matched._id) : false,
        };
      });
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
  ]);

  const queriedRsvpGroups = useMemo(
    () => rsvpsToRsvpGroups(myRsvps),
    [myRsvps],
  );
  const queriedClubs = useMemo(() => orgsToClubs(followedOrgs), [followedOrgs]);

  // Caller overrides take priority (used by /search and any tests).
  const posts: DashboardPostProps[] = postsOverride ?? queriedPosts ?? [];
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

  const [focused, setFocused] = useState<boolean>(false);
  // "results" mode is committed via Enter or selecting a suggestion. It
  // replaces the tag filter bar with a Top/Events/Orgs Toggle and shows
  // the org-result card + matching posts.
  const [showResults, setShowResults] = useState<boolean>(
    Boolean(initialQuery),
  );
  const [scope, setScope] = useState<SearchScope>("top");
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  // Local mutable copy of recents so the × buttons can prune. Seeded once
  // from props — for prototype data we don't need to re-sync if the parent
  // hands us a new array, and avoiding a sync effect dodges the
  // react-hooks/set-state-in-effect lint.
  const [recents, setRecents] = useState<RecentSearch[]>(recentSearches);

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
      // Typing always exits the committed-results state — typing a new
      // query restores the live-suggestions dropdown.
      if (showResults) setShowResults(false);
      // Reset the keyboard highlight whenever the query changes — this is
      // the only call site that actually changes the list contents, so the
      // reset belongs here (avoids a setState-in-effect lint error).
      setActiveIndex(-1);
      setFocused(true);
    },
    [isControlled, onSearchChange, showResults],
  );

  const handleClear = useCallback(() => {
    if (!isControlled) setInternalQuery("");
    onSearchChange?.("");
    onSearchClear?.();
    setShowResults(false);
  }, [isControlled, onSearchChange, onSearchClear]);

  const commitQuery = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      if (!isControlled) setInternalQuery(trimmed);
      onSearchChange?.(trimmed);
      onSearchSubmit?.(trimmed);
      setShowResults(true);
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

  // Which posts to render in the feed: results posts when committed, else
  // the everyday SAMPLE_POSTS supplied via the `posts` prop.
  const feedPosts = showResults ? resultPosts : posts;
  // Org result card visibility — only when scope shows orgs (Top/Orgs).
  const showOrgCards = showResults && scope !== "events";
  // Event filter — Events scope hides org card; Orgs scope hides post list.
  const showPosts = !showResults || scope !== "orgs";

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
        {/* ── Feed header: search bar + tag filter bar (or scope toggle) ── */}
        {/*
         * Figma node 506:8718: SearchBar sits above the tag filter bar within
         * the main feed, gap 16px. When the user submits a query (Figma
         * 515:2413), the tag bar is replaced by a Top/Events/Orgs Toggle.
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

          {/* Dropdown overlay — only visible when input is focused and the
              user has not yet committed a query. */}
          {focused && !showResults && (
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

          {/*
           * State machine: the row beneath the SearchBar is either the tag
           * filter bar (default) or the Top/Events/Orgs Toggle (results).
           */}
          {!showResults && (
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
          )}

          {showResults && (
            <Toggle
              options={SEARCH_SCOPE_OPTIONS}
              value={scope}
              onChange={(v) => {
                if (v === "top" || v === "events" || v === "orgs") setScope(v);
              }}
              size="default"
              className="self-stretch"
              aria-label="Filter search results"
            />
          )}
        </div>

        {/* Horizontal divider — Figma node 263:3557: 1px, --color-border */}
        <div
          className="h-px w-full shrink-0 bg-[var(--color-border)]"
          role="separator"
          aria-hidden="true"
        />

        {/* ── Org result cards (results state, Top + Orgs scope only) ── */}
        {showOrgCards && orgResults.length > 0 && (
          <div className="flex flex-col gap-[var(--space-3)] px-[var(--space-8)]">
            {orgResults.map((org) => (
              <OrgResultCard key={org.id} org={org} />
            ))}
          </div>
        )}

        {/* ── Post list ── */}
        {/*
         * Each post is rendered as a DashboardPost (org header + event card).
         * Figma (node 506:8718): pb 32px, px 32px, gap 20px between posts.
         */}
        {showPosts && (
          <div className="flex flex-col gap-[var(--space-5)] px-[var(--space-8)] pb-[var(--space-8)]">
            {!showResults && feedLoading && <FeedLoadingState />}
            {feedPosts.map((post, i) => (
              <DashboardPost
                key={i}
                {...post}
                onOrgClick={handleOrgClickInternal}
              />
            ))}
          </div>
        )}
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

// ─── OrgResultCard ────────────────────────────────────────────────────────────
//
// Mirrors the org result card from Figma node 515:2413 — avatar + name on the
// top row, "Follow" button on the right, description, then a tag row.
// Lives here (rather than in shared/ui) because it composes existing primitives
// (Tag, Button, Avatar fallback) and is only used by the search experience.

function OrgResultCard({ org }: { org: SearchOrgResult }) {
  const fallback = fallbackColorsForName(org.name);
  const [following, setFollowing] = useState<boolean>(org.following);
  const [pending, setPending] = useState<boolean>(false);
  const convex = useConvex();
  const followMutation = useMutation(api.follows.follow);
  const unfollowMutation = useMutation(api.follows.unfollow);

  const handleFollowToggle = useCallback(async () => {
    if (pending) return;
    const previous = following;
    const next = !previous;
    // Optimistic flip first.
    setFollowing(next);
    setPending(true);
    try {
      // SAMPLE_ORG_RESULTS use a slug-style id, not a real Convex Id<"orgs">.
      // Resolve the slug to a real org id, then call the mutation.
      const result = await convex.query(api.orgs.getBySlug, { slug: org.id });
      const resolved = result.org;
      if (resolved === null) {
        throw new Error(`Org not found for slug "${org.id}"`);
      }
      const orgId: Id<"orgs"> = resolved._id;
      if (next) {
        await followMutation({ orgId });
      } else {
        await unfollowMutation({ orgId });
      }
    } catch {
      // Rollback on any failure (network, not-found, mutation error).
      setFollowing(previous);
    } finally {
      setPending(false);
    }
  }, [convex, followMutation, following, org.id, pending, unfollowMutation]);

  return (
    <article
      className={[
        "flex flex-col gap-[var(--space-2)]",
        "rounded-[var(--radius-card)]",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "px-[var(--space-4)] py-[var(--space-3)]",
      ].join(" ")}
    >
      {/* Header — avatar + name + Follow button */}
      <div className="flex items-center gap-[var(--space-3)]">
        <div
          className="size-[var(--space-6)] shrink-0 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          {org.avatarUrl ? (
            <img
              src={org.avatarUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span
              className={[
                "flex size-full items-center justify-center",
                "font-[family-name:var(--font-body)] font-semibold",
                "text-[length:var(--font-size-body3)]",
              ].join(" ")}
              style={{ backgroundColor: fallback.bg, color: fallback.fg }}
            >
              {org.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <h3
          className={[
            "min-w-0 flex-1 truncate",
            "font-[family-name:var(--font-body)] font-bold",
            "text-[length:var(--font-size-sub2)] leading-[var(--line-height-sub2)]",
            "tracking-[var(--letter-spacing-body1)]",
            "text-[color:var(--color-neutral-900)]",
          ].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {org.name}
        </h3>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void handleFollowToggle();
          }}
          aria-pressed={following}
          disabled={pending}
        >
          {following ? "Following" : "Follow"}
        </Button>
      </div>

      {/* Description */}
      <p
        className={[
          "font-[family-name:var(--font-body)] font-normal",
          "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)]",
          "tracking-[var(--letter-spacing-body2)]",
          "text-[color:var(--color-neutral-700)]",
        ].join(" ")}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {org.description}
      </p>

      {/* Tags */}
      {org.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          {org.tags.map((t) => (
            <Tag
              key={t.label}
              color={t.color ?? "neutral"}
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {t.label}
            </Tag>
          ))}
        </div>
      )}
    </article>
  );
}
