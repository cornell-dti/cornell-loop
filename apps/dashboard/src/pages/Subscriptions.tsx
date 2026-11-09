/**
 * Subscriptions — Loop Dashboard Page
 *
 * Mirrors the Home page shell (SideBar + main feed + SearchPanel) so dashboard
 * surfaces feel consistent across routes. The right rail is the shared design-
 * system SearchPanel showing "Your RSVPs" + "Your Clubs". Each subscription row
 * uses design-system Button + Avatar primitives where possible.
 *
 * Source: Figma "Incubator-design-file" › node 260:2755 (Subscriptions view).
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  SideBar,
  Button,
  Dropdown,
  SearchBar,
  SearchPanel,
  Tag,
  fallbackColorsForName,
} from "@app/ui";
import VerifiedBadge from "@app/ui/assets/verified.svg?react";
import type { SideBarItemId, RsvpGroup, Club } from "@app/ui";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { PublicOrg } from "../../convex/orgs";
import type { SubscriptionInfo } from "../../convex/listservs";
import { orgsToClubs, rsvpsToRsvpGroups } from "../lib/eventToPost";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SubscriptionItem {
  orgName: string;
  orgAvatarUrl?: string;
  isVerified?: boolean;
  emailsReceived: number;
  emailAddress: string;
}

export interface SubscriptionsProps extends ComponentPropsWithoutRef<"div"> {
  // ── Sidebar ──
  activeNavItem?: SideBarItemId;
  onNavigate?: (id: SideBarItemId) => void;

  // ── Header ──
  subscriptionCount?: number;

  // ── Subscription list ──
  subscriptions?: SubscriptionItem[];

  // ── Right panel (shared SearchPanel) ──
  rsvpGroups?: RsvpGroup[];
  clubs?: Club[];
  onClubClick?: (club: Club) => void;
}

// ─── SubscriptionRow ──────────────────────────────────────────────────────────

function SubscriptionRow({
  item,
  onUnfollowClick,
  onClick,
}: {
  item: SubscriptionItem;
  onUnfollowClick: () => void;
  onClick?: () => void;
}) {
  const fallback = fallbackColorsForName(item.orgName);
  return (
    <div
      className={[
        "flex w-full items-center gap-[var(--space-3)]",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "rounded-[var(--radius-card)]",
        "px-[var(--space-3)] py-[var(--space-3)]",
        "transition-colors duration-150",
        onClick ? "hover:bg-[var(--color-surface-subtle)]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ── Left: avatar + org info — rendered as a real <button> when clickable
          so the row stays a single interactive element (avoids axe's
          nested-interactive rule firing because of the inner Unfollow button). */}
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={[
          "flex min-w-0 flex-1 items-center gap-[var(--space-3)] text-left",
          onClick ? "cursor-pointer" : "cursor-default",
          "bg-transparent",
          "rounded-[var(--radius-input)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-700)]",
        ].join(" ")}
        aria-label={onClick ? `Open ${item.orgName}` : undefined}
      >
        {/* 40 px avatar — same scale as the SearchPanel club row (size-[var(--space-10)]) */}
        <span
          className={[
            "inline-flex shrink-0 items-center justify-center",
            "overflow-hidden rounded-full",
            "size-[var(--space-10)]",
            "bg-[var(--color-surface-subtle)]",
          ].join(" ")}
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
                "flex size-full items-center justify-center " +
                "font-[family-name:var(--font-body)] font-semibold " +
                "text-[length:var(--font-size-body3)]"
              }
              style={{ backgroundColor: fallback.bg, color: fallback.fg }}
            >
              {item.orgName.charAt(0).toUpperCase()}
            </span>
          )}
        </span>

        {/* Org info stack — single row for name + Following pill, secondary
            row for email + count, mirrors DashboardPost / ClubItem density. */}
        <div className="flex min-w-0 flex-1 flex-col gap-0">
          <div className="flex min-w-0 items-center gap-[var(--space-2)]">
            <span
              className={
                "font-[family-name:var(--font-body)] font-semibold " +
                "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
                "tracking-[var(--letter-spacing-body2)] " +
                "min-w-0 truncate text-[color:var(--color-neutral-900)]"
              }
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {item.orgName}
            </span>

            {/* Verified badge — org.isVerified has no other visible
                treatment anywhere in the app; this is its only surface. */}
            {item.isVerified && (
              <VerifiedBadge
                aria-label="Verified organization"
                className="size-[var(--space-4)] shrink-0"
              />
            )}

            {/* "Following" pill — matches DashboardPost / SearchResultRow exactly */}
            <span
              className={[
                "inline-flex shrink-0 items-center",
                "rounded-full",
                "bg-[var(--color-neutral-200)]",
                "px-[var(--space-1-5)] py-0",
                "font-[family-name:var(--font-body)] font-medium",
                "text-[length:10px] leading-[18px]",
                "text-[color:var(--color-neutral-600)]",
                "whitespace-nowrap",
              ].join(" ")}
            >
              Following
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-[var(--space-2)]">
            <span
              className={
                "font-[family-name:var(--font-body)] font-normal " +
                "text-[length:var(--font-size-body3)] leading-[var(--line-height-body3)] " +
                "tracking-[var(--letter-spacing-body3)] " +
                "min-w-0 truncate text-[color:var(--color-text-secondary)]"
              }
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {item.emailAddress}
            </span>
            <span
              aria-hidden="true"
              className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]"
            >
              ·
            </span>
            <span
              className={
                "font-[family-name:var(--font-body)] font-normal " +
                "text-[length:var(--font-size-body3)] leading-[var(--line-height-body3)] " +
                "tracking-[var(--letter-spacing-body3)] " +
                "whitespace-nowrap text-[color:var(--color-text-secondary)]"
              }
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              <span className="font-semibold text-[color:var(--color-neutral-900)]">
                {item.emailsReceived}
              </span>
              {" emails"}
            </span>
          </div>
        </div>
      </button>

      {/* Unfollow — design-system secondary Button, sm size to balance row height. */}
      <Button
        variant="secondary"
        size="sm"
        onClick={onUnfollowClick}
        aria-label={`Unfollow ${item.orgName}`}
        className="shrink-0"
      >
        Unfollow
      </Button>
    </div>
  );
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Convert a followed org Doc to the SubscriptionItem display shape, using
 * the org's real listserv email + real message count from
 * `listservs.getSubscriptionInfoByOrgIds` (never `org.email`, and never
 * fabricated from `org.slug` — see that query's docstring for why).
 */
function orgToSubscriptionItem(
  org: PublicOrg,
  info: SubscriptionInfo | undefined,
): SubscriptionItem {
  return {
    orgName: org.name,
    orgAvatarUrl: org.avatarUrl,
    isVerified: org.isVerified,
    emailsReceived: info?.emailsReceived ?? 0,
    emailAddress: info?.email ?? "No email on file",
  };
}

type SortMode = "Alphabetical" | "Most emails" | "Recently added";

const SORT_MODES: SortMode[] = [
  "Alphabetical",
  "Most emails",
  "Recently added",
];

/** Narrows a Dropdown value to {@link SortMode} without an `as` cast. */
function parseSortMode(value: string): SortMode {
  return SORT_MODES.find((mode) => mode === value) ?? "Alphabetical";
}

/** One rendered row. Carries its org so actions never depend on list index. */
interface SubscriptionRowData {
  key: string;
  item: SubscriptionItem;
  /** Present for Convex-backed rows; absent in the legacy override flow. */
  org?: PublicOrg;
}

export function Subscriptions({
  activeNavItem = "subscriptions",
  onNavigate,
  subscriptionCount,
  subscriptions: subscriptionsOverride,
  rsvpGroups: rsvpGroupsOverride,
  clubs: clubsOverride,
  onClubClick,
  className,
  ...rest
}: SubscriptionsProps) {
  const navigate = useNavigate();
  const followedOrgs = useQuery(api.orgs.listFollowed);
  const myRsvps = useQuery(api.rsvps.myRsvps);
  const unfollowMutation = useMutation(api.follows.unfollow);
  const orgsList = useMemo<readonly PublicOrg[]>(
    () => followedOrgs ?? [],
    [followedOrgs],
  );

  const orgIds = useMemo(() => orgsList.map((org) => org._id), [orgsList]);
  const subscriptionInfoResult = useQuery(
    api.listservs.getSubscriptionInfoByOrgIds,
    orgIds.length > 0 ? { orgIds } : "skip",
  );
  const subscriptionInfoByOrgId = useMemo<
    ReadonlyMap<Id<"orgs">, SubscriptionInfo>
  >(() => {
    const map = new Map<Id<"orgs">, SubscriptionInfo>();
    for (const info of subscriptionInfoResult ?? []) {
      map.set(info.orgId, info);
    }
    return map;
  }, [subscriptionInfoResult]);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("Alphabetical");

  // Local copy for the deprecated subscriptionsOverride flow so the unfollow
  // modal can still optimistically remove rows.
  const [overrideItems, setOverrideItems] = useState<SubscriptionItem[]>(
    subscriptionsOverride ?? [],
  );

  // Followed orgs in the chosen order. Sorting works on a copy; the server
  // returns follows newest-first, which is the "Recently added" order.
  const allRows = useMemo<SubscriptionRowData[]>(() => {
    if (subscriptionsOverride !== undefined) {
      return overrideItems.map((item, i) => ({
        key: `${item.emailAddress}-${i}`,
        item,
      }));
    }
    const rows = orgsList.map((org) => ({
      key: org._id,
      item: orgToSubscriptionItem(org, subscriptionInfoByOrgId.get(org._id)),
      org,
    }));
    if (sortMode === "Alphabetical") {
      return [...rows].sort((a, b) =>
        a.item.orgName.localeCompare(b.item.orgName),
      );
    }
    if (sortMode === "Most emails") {
      return [...rows].sort(
        (a, b) => b.item.emailsReceived - a.item.emailsReceived,
      );
    }
    return rows;
  }, [
    subscriptionsOverride,
    overrideItems,
    orgsList,
    subscriptionInfoByOrgId,
    sortMode,
  ]);

  // Search matches the org name or its listserv address.
  const visibleRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allRows;
    return allRows.filter(
      ({ item }) =>
        item.orgName.toLowerCase().includes(query) ||
        (item.emailAddress.includes("@") &&
          item.emailAddress.toLowerCase().includes(query)),
    );
  }, [allRows, searchQuery]);

  const queriedRsvpGroups = useMemo(
    () => rsvpsToRsvpGroups(myRsvps),
    [myRsvps],
  );
  const queriedClubs = useMemo(() => orgsToClubs(followedOrgs), [followedOrgs]);

  const rsvpGroups = rsvpGroupsOverride ?? queriedRsvpGroups;
  const clubs = clubsOverride ?? queriedClubs;

  const loading =
    subscriptionsOverride === undefined && followedOrgs === undefined;
  const isEmpty =
    subscriptionsOverride === undefined &&
    followedOrgs !== undefined &&
    followedOrgs.length === 0;
  const noSearchMatches =
    !loading && allRows.length > 0 && visibleRows.length === 0;

  const [pendingUnfollowKey, setPendingUnfollowKey] = useState<string | null>(
    null,
  );
  const [recentlyUnfollowed, setRecentlyUnfollowed] = useState<string | null>(
    null,
  );

  const pendingRow = useMemo(
    () => allRows.find((row) => row.key === pendingUnfollowKey) ?? null,
    [allRows, pendingUnfollowKey],
  );

  const handleCloseModal = useCallback(() => {
    setPendingUnfollowKey(null);
  }, []);

  const handleConfirmUnfollow = useCallback(() => {
    if (!pendingRow) return;
    if (pendingRow.org) {
      void unfollowMutation({ orgId: pendingRow.org._id });
    } else {
      setOverrideItems((prev) =>
        prev.filter((item) => item !== pendingRow.item),
      );
    }
    setRecentlyUnfollowed(pendingRow.item.orgName);
    setPendingUnfollowKey(null);
  }, [pendingRow, unfollowMutation]);

  useEffect(() => {
    if (recentlyUnfollowed === null) return;
    const id = window.setTimeout(() => setRecentlyUnfollowed(null), 3500);
    return () => window.clearTimeout(id);
  }, [recentlyUnfollowed]);

  useEffect(() => {
    if (pendingUnfollowKey === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingUnfollowKey, handleCloseModal]);

  const dialogTitleId = useId();
  const dialogDescId = useId();

  const displayedCount = subscriptionCount ?? allRows.length;

  return (
    <div
      className={[
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
          "flex min-w-0 flex-1 flex-col gap-[var(--space-3)]",
          "overflow-y-auto bg-[var(--color-surface-subtle)] py-[var(--space-6)]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        ].join(" ")}
        aria-label="Subscriptions"
      >
        {/* ── Page header ── */}
        <div className="flex w-full shrink-0 flex-col gap-[var(--space-4)] px-[var(--space-8)]">
          <div className="flex items-center gap-[var(--space-3)]">
            <h1
              className={
                "font-[family-name:var(--font-brand)] font-bold " +
                "leading-[normal] text-[var(--font-size-wordmark)] " +
                "whitespace-nowrap text-[var(--color-black)]"
              }
            >
              Email Subscriptions
            </h1>

            {/* Count badge — uses design-system Tag for consistent sizing with chips */}
            <Tag color="neutral" aria-label={`${displayedCount} subscriptions`}>
              {displayedCount}
            </Tag>
          </div>

          {/* Search + Sort row — Figma: SearchBar fills, Sort pill on the right. */}
          <div className="flex w-full items-center gap-[var(--space-3)]">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onClear={() => setSearchQuery("")}
              placeholder="Search"
              className="min-w-0 flex-1"
            />

            {/* Sort — design-system Dropdown (Figma node 506:4039). */}
            <Dropdown
              value={sortMode}
              onChange={(value) => setSortMode(parseSortMode(value))}
              options={SORT_MODES}
              valuePrefix="Sort: "
              className="w-[13rem] shrink-0"
            />
          </div>
        </div>

        <div
          className="h-px w-full shrink-0 bg-[var(--color-border)]"
          role="separator"
          aria-hidden="true"
        />

        <div className="flex flex-col gap-[var(--space-3)] px-[var(--space-8)] pb-[var(--space-8)]">
          {loading && <SubscriptionsLoadingState />}
          {!loading && isEmpty && (
            <SubscriptionsEmptyState onBrowse={() => navigate("/search")} />
          )}
          {noSearchMatches && (
            <SubscriptionsNoMatchesState query={searchQuery.trim()} />
          )}
          {visibleRows.map((row) => {
            const { org } = row;
            return (
              <SubscriptionRow
                key={row.key}
                item={row.item}
                onUnfollowClick={() => setPendingUnfollowKey(row.key)}
                // Clicking the row (outside Unfollow) opens the org page. The
                // override flow carries no slug, so its rows aren't clickable.
                onClick={org ? () => navigate(`/orgs/${org.slug}`) : undefined}
              />
            );
          })}
        </div>
      </main>

      {/*
       * ── Right panel ──
       * Product rule: the sidebar must never be empty. When the user follows
       * zero clubs (and there are no RSVPs to surface), render an empty-state
       * card inviting discovery instead of letting SearchPanel render an
       * empty <aside>.
       */}
      {clubs.length === 0 && rsvpGroups.length === 0 ? (
        <SubscriptionsSidebarEmptyState />
      ) : (
        <SearchPanel
          rsvpGroups={rsvpGroups}
          clubs={clubs}
          onClubClick={onClubClick}
          className="hidden h-full shrink-0 overflow-visible lg:flex"
        />
      )}

      {/* ── Unfollow confirmation modal ── */}
      {pendingRow && (
        <UnfollowModal
          item={pendingRow.item}
          titleId={dialogTitleId}
          descriptionId={dialogDescId}
          onCancel={handleCloseModal}
          onConfirm={handleConfirmUnfollow}
        />
      )}

      {/* ── Toast (post-unfollow) ── */}
      {recentlyUnfollowed && (
        <div
          role="status"
          aria-live="polite"
          className={[
            "fixed right-[var(--space-6)] bottom-[var(--space-6)]",
            "z-50",
            "flex items-center gap-[var(--space-3)]",
            "rounded-[var(--radius-card)]",
            "bg-[var(--color-neutral-900)]",
            "px-[var(--space-4)] py-[var(--space-3)]",
            "shadow-[var(--shadow-1)]",
            "font-[family-name:var(--font-body)] font-medium",
            "leading-[var(--line-height-body2)] text-[var(--font-size-body2)]",
            "tracking-[var(--letter-spacing-body2)]",
            "text-[var(--color-white)]",
          ].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          <span>Unfollowed {recentlyUnfollowed}</span>
        </div>
      )}
    </div>
  );
}

// ─── Loading / empty states ──────────────────────────────────────────────────

function SubscriptionsLoadingState() {
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
      Loading subscriptions…
    </div>
  );
}

function SubscriptionsSidebarEmptyState() {
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

function SubscriptionsNoMatchesState({ query }: { query: string }) {
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
      No subscriptions match &ldquo;{query}&rdquo;
    </div>
  );
}

function SubscriptionsEmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div
      className={[
        "flex w-full flex-col items-start gap-[var(--space-3)]",
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
        You aren't following any clubs yet
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
        Search and filter for clubs to start curating your feed.
      </p>
      <Button variant="primary" size="md" onClick={onBrowse}>
        Discover clubs
      </Button>
    </div>
  );
}

// ─── UnfollowModal ────────────────────────────────────────────────────────────

function UnfollowModal({
  item,
  titleId,
  descriptionId,
  onCancel,
  onConfirm,
}: {
  item: SubscriptionItem;
  titleId: string;
  descriptionId: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className={[
        "fixed inset-0 z-40",
        "flex items-center justify-center",
        "bg-black/20",
      ].join(" ")}
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={[
          "relative",
          "flex w-[30.5rem] max-w-[calc(100vw-var(--space-8))] flex-col items-center",
          "gap-[var(--space-3)]",
          "rounded-[var(--radius-card)]",
          "bg-[var(--color-surface)]",
          "px-[var(--space-6)] py-[var(--space-8)]",
          "shadow-[var(--shadow-1)]",
          "outline-none",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className={[
            "absolute top-[var(--space-4)] right-[var(--space-4)]",
            "inline-flex items-center justify-center",
            "size-[var(--space-6)]",
            "rounded-[var(--radius-input)]",
            "text-[var(--color-text-secondary)]",
            "hover:bg-[var(--color-surface-subtle)]",
            "hover:text-[var(--color-text-default)]",
            "cursor-pointer transition-colors duration-150",
          ].join(" ")}
        >
          <X aria-hidden="true" className="size-[var(--space-4)]" />
        </button>

        {/* 108 px modal avatar with initial-letter fallback */}
        <span
          className={[
            "inline-flex shrink-0 items-center justify-center",
            "overflow-hidden rounded-full",
            "size-[6.75rem]",
            "bg-[var(--color-secondary-400)]",
          ].join(" ")}
          aria-hidden="true"
        >
          {item.orgAvatarUrl ? (
            <img
              src={item.orgAvatarUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span
              className={[
                "font-[family-name:var(--font-body)] font-semibold",
                "text-[var(--color-secondary-900)]",
                "text-[var(--font-size-h3)]",
              ].join(" ")}
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {item.orgName.charAt(0).toUpperCase()}
            </span>
          )}
        </span>

        <div
          className={[
            "flex w-[17.75rem] flex-col items-center gap-[var(--space-1)]",
            "tracking-[var(--letter-spacing-body1)]",
          ].join(" ")}
        >
          <h2
            id={titleId}
            className={[
              "text-center",
              "font-[family-name:var(--font-body)] font-bold",
              "leading-[var(--line-height-sub2)] text-[var(--font-size-sub2)]",
              "text-[var(--color-neutral-900)]",
            ].join(" ")}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Unfollow {item.orgName}?
          </h2>
        </div>

        <p
          id={descriptionId}
          className={[
            "text-center",
            "font-[family-name:var(--font-body)] font-normal",
            "leading-[var(--line-height-body2)] text-[var(--font-size-body2)]",
            "tracking-[var(--letter-spacing-body2)]",
            "text-[var(--color-neutral-700)]",
          ].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          They&rsquo;ll be removed from your clubs, so their posts won&rsquo;t
          be prioritized in your feed. You can follow them again anytime from
          their org page.
        </p>

        <div className="mt-[var(--space-1)] flex items-center gap-[var(--space-3)]">
          <Button variant="primary" size="md" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button variant="secondary" size="md" onClick={onConfirm}>
            Unfollow
          </Button>
        </div>
      </div>
    </div>
  );
}
