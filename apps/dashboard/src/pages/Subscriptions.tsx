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
import { ChevronDown } from "lucide-react";
import { SideBar, Button, SearchBar, SearchPanel, Tag } from "@app/ui";
import type { SideBarItemId, RsvpGroup, Club } from "@app/ui";

// ─── Shared typography class strings ─────────────────────────────────────────

const BODY2_REGULAR =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

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

  // ── Center search ──
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchClear?: () => void;

  // ── Sort ──
  /** Display label for the sort chip (e.g. "Alphabetical"). */
  sortLabel?: string;
  /** Called when the sort chip is clicked so the caller can cycle/show a picker. */
  onSortChange?: () => void;

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
  onUnsubscribeClick,
}: {
  item: SubscriptionItem;
  onUnsubscribeClick: () => void;
}) {
  return (
    <div
      className={[
        "flex w-full items-center justify-between",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "rounded-[var(--radius-card)]",
        "px-[var(--space-4)] py-[var(--space-3)]",
      ].join(" ")}
    >
      {/* ── Left: avatar + org info ── */}
      <div className="flex items-center gap-[var(--space-4)]">
        {/* 60 px avatar with initial-letter fallback */}
        {/* 40 px avatar — matches design-system row scale (--space-10) */}
        <span
          className={[
            "inline-flex shrink-0 items-center justify-center",
            "overflow-hidden rounded-full",
            "size-[var(--space-10)]",
            "bg-[var(--color-surface-raised)]",
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
                "bg-[var(--color-secondary-400)] " +
                "font-[family-name:var(--font-body)] font-semibold " +
                "text-[var(--color-secondary-900)] text-[var(--font-size-body2)]"
              }
            >
              {item.orgName.charAt(0).toUpperCase()}
            </span>
          )}
        </span>

        {/* Org info stack */}
        <div className="flex flex-col items-start justify-center gap-[var(--space-0-5)]">
          {/* Org name row: name + optional verified badge */}
          <div className="flex items-center gap-[var(--space-2)]">
            <span
              className={
                "font-[family-name:var(--font-body)] font-semibold " +
                "leading-[var(--line-height-body2)] text-[var(--font-size-body2)] " +
                "tracking-[var(--letter-spacing-body2)] " +
                "whitespace-nowrap text-[var(--color-neutral-900)]"
              }
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {item.orgName}
            </span>

            {/*
             * "Following" pill — every subscription row is by definition a
             * followed mailing list, so we surface the design-system Following
             * indicator (matches DashboardPost). Replaces the prior star icon
             * which was visually conflated with "following" elsewhere.
             */}
            <span
              className={[
                "inline-flex items-center",
                "rounded-full",
                "bg-[var(--color-neutral-200)]",
                "px-[var(--space-1-5)] py-0",
                "font-[family-name:var(--font-body)] font-medium",
                "text-[length:10px] leading-[18px]",
                "text-[var(--color-neutral-600)]",
                "whitespace-nowrap",
              ].join(" ")}
            >
              Following
            </span>
          </div>

          <p
            className={
              BODY2_REGULAR +
              " whitespace-nowrap text-[var(--color-text-secondary)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            <span className="font-semibold">{item.emailsReceived}</span>
            {" emails received"}
          </p>

          <p
            className={
              "font-[family-name:var(--font-body)] font-normal italic " +
              "leading-[var(--line-height-body2)] text-[var(--font-size-body2)] " +
              "tracking-[var(--letter-spacing-body2)] " +
              "whitespace-nowrap text-[var(--color-text-muted)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {item.emailAddress}
          </p>
        </div>
      </div>

      {/* Unsubscribe — design-system secondary Button */}
      <Button
        variant="secondary"
        size="md"
        onClick={onUnsubscribeClick}
        aria-label={`Unsubscribe from ${item.orgName}`}
      >
        Unsubscribe
      </Button>
    </div>
  );
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function Subscriptions({
  activeNavItem = "subscriptions",
  onNavigate,
  subscriptionCount,
  searchValue,
  onSearchChange,
  onSearchClear,
  sortLabel = "Alphabetical",
  onSortChange,
  subscriptions = [],
  rsvpGroups,
  clubs,
  onClubClick,
  className,
  ...rest
}: SubscriptionsProps) {
  const [items, setItems] = useState<SubscriptionItem[]>(subscriptions);
  const [pendingUnsubscribeIndex, setPendingUnsubscribeIndex] = useState<
    number | null
  >(null);
  const [recentlyUnsubscribed, setRecentlyUnsubscribed] = useState<
    string | null
  >(null);

  const pendingItem = useMemo(
    () =>
      pendingUnsubscribeIndex !== null
        ? (items[pendingUnsubscribeIndex] ?? null)
        : null,
    [pendingUnsubscribeIndex, items],
  );

  const handleCloseModal = useCallback(() => {
    setPendingUnsubscribeIndex(null);
  }, []);

  const handleConfirmUnsubscribe = useCallback(() => {
    if (pendingUnsubscribeIndex === null) return;
    const removed = items[pendingUnsubscribeIndex];
    if (!removed) return;
    setItems((prev) => prev.filter((_, i) => i !== pendingUnsubscribeIndex));
    setRecentlyUnsubscribed(removed.orgName);
    setPendingUnsubscribeIndex(null);
  }, [pendingUnsubscribeIndex, items]);

  useEffect(() => {
    if (recentlyUnsubscribed === null) return;
    const id = window.setTimeout(() => setRecentlyUnsubscribed(null), 3500);
    return () => window.clearTimeout(id);
  }, [recentlyUnsubscribed]);

  useEffect(() => {
    if (pendingUnsubscribeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingUnsubscribeIndex, handleCloseModal]);

  const dialogTitleId = useId();
  const dialogDescId = useId();

  const displayedCount = subscriptionCount ?? items.length;

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
          "flex min-w-0 flex-1 flex-col gap-[var(--space-6)]",
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
              value={searchValue}
              onChange={onSearchChange}
              onClear={onSearchClear}
              placeholder="Search"
              className="min-w-0 flex-1"
            />

            {/*
             * Sort dropdown trigger. Cycles through three orderings on click so
             * the chip feels interactive even though sorting isn't yet wired to
             * data. Visual matches Figma node 506:4039 (Sort: Alphabetical pill).
             */}
            <button
              type="button"
              onClick={onSortChange}
              className={[
                "inline-flex shrink-0 items-center gap-[var(--space-2)]",
                "px-[var(--space-4)] py-[var(--space-2)]",
                "rounded-[var(--radius-card)]",
                "bg-[var(--color-surface)]",
                "border border-[var(--color-border)]",
                BODY2_REGULAR,
                "text-[var(--color-neutral-700)]",
                "cursor-pointer whitespace-nowrap",
                "hover:bg-[var(--color-surface-subtle)]",
                "transition-colors duration-150",
              ].join(" ")}
              style={{ fontVariationSettings: "'opsz' 14" }}
              aria-label="Change sort order"
            >
              {`Sort: ${sortLabel}`}
              <ChevronDown
                aria-hidden="true"
                className="size-[var(--space-4)] shrink-0"
              />
            </button>
          </div>
        </div>

        <div
          className="h-px w-full shrink-0 bg-[var(--color-border)]"
          role="separator"
          aria-hidden="true"
        />

        <div className="flex flex-col gap-[var(--space-3)] px-[var(--space-8)] pb-[var(--space-8)]">
          {items.map((item, i) => (
            <SubscriptionRow
              key={`${item.emailAddress}-${i}`}
              item={item}
              onUnsubscribeClick={() => setPendingUnsubscribeIndex(i)}
            />
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

      {/* ── Unsubscribe confirmation modal ── */}
      {pendingItem && (
        <UnsubscribeModal
          item={pendingItem}
          titleId={dialogTitleId}
          descriptionId={dialogDescId}
          onCancel={handleCloseModal}
          onConfirm={handleConfirmUnsubscribe}
        />
      )}

      {/* ── Toast (post-unsubscribe) ── */}
      {recentlyUnsubscribed && (
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
          <span>Unsubscribed from {recentlyUnsubscribed}</span>
        </div>
      )}
    </div>
  );
}

// ─── UnsubscribeModal ─────────────────────────────────────────────────────────

function UnsubscribeModal({
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
            Remove your email from the {item.orgName} mailing list?
          </h2>
          <p
            className={[
              "text-center whitespace-nowrap",
              "font-[family-name:var(--font-body)] font-normal",
              "leading-[var(--line-height-body2)] text-[var(--font-size-body2)]",
              "tracking-[var(--letter-spacing-body2)]",
              "text-[var(--color-neutral-700)]",
            ].join(" ")}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {item.emailAddress}
          </p>
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
          Don&rsquo;t worry, you&rsquo;ll still see their posts here on Loop!
        </p>

        <div className="mt-[var(--space-1)] flex items-center gap-[var(--space-3)]">
          <Button variant="primary" size="md" onClick={onCancel} autoFocus>
            Cancel
          </Button>
          <Button variant="secondary" size="md" onClick={onConfirm}>
            Unsubscribe
          </Button>
        </div>
      </div>
    </div>
  );
}
