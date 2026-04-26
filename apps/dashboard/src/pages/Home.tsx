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
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
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
  initialQuery,
  recentSearches = SAMPLE_RECENT_SEARCHES,
  searchSuggestions = SAMPLE_SUGGESTIONS,
  orgResults = SAMPLE_ORG_RESULTS,
  resultPosts = SAMPLE_RESULT_POSTS,
  onSearchSubmit,
  rsvpGroups,
  clubs,
  onClubClick,
  onOrgClick,
  className,
  ...rest
}: HomeProps) {
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
            aria-expanded={focused}
            aria-controls="search-overlay"
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
            {feedPosts.map((post, i) => (
              <DashboardPost key={i} {...post} onOrgClick={onOrgClick} />
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
       */}
      <SearchPanel
        rsvpGroups={rsvpGroups}
        clubs={clubs}
        onClubClick={onClubClick}
        className="h-full shrink-0 overflow-visible"
      />
    </div>
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
          onClick={() => setFollowing((f) => !f)}
          aria-pressed={following}
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
