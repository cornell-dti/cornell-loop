/**
 * Subscriptions — Loop Dashboard Page
 *
 * Source: Figma "Incubator-design-file" › node 260:2755 "Home" (Subscriptions view)
 *
 * Three-column page layout:
 *   • SideBar (left)       — navigation rail, "Subscriptions" active
 *   • Main content (center) — heading + count badge, SearchBar, subscription list
 *   • Right panel          — SearchBar, "This week" + "Trending" event sections
 *
 * The subscription list renders one SubscriptionRow per org.  Each row shows a
 * circle avatar, org name, a "verified RSO" badge (with native tooltip), email
 * stats, mailing-list address, and an "Unsubscribe" action button.
 *
 * "Unsubscribe" button bg: Figma uses #909090 — approximated with
 * --color-neutral-600 (#616972), the closest available dark-neutral token.
 *
 * Avatar size: Figma specifies 60 × 60 px.  --size-club-avatar (56 px) is the
 * closest layout token; 60 px is used directly (size-[3.75rem]) since no token
 * covers this exact value.
 *
 * "emails received" text: Figma 16 px — no exact token; uses --font-size-body2
 * (14 px) as the closest meta-text token, consistent with secondary-text usage
 * across the design system.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef } from "react";
import { SideBar } from "@app/ui";
import type { SideBarItemId } from "@app/ui";
import { SearchBar } from "@app/ui";
import StarIcon from "../assets/star.svg?react";

// ─── Shared typography class strings ─────────────────────────────────────────

const BODY2_SEMIBOLD =
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

const BODY2_REGULAR =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

const SECTION_TITLE =
  "font-[family-name:var(--font-body)] font-bold " +
  "text-[var(--font-size-sub2)] leading-[var(--line-height-sub2)] " +
  "tracking-[var(--letter-spacing-body1)] " +
  "text-[var(--color-neutral-900)] whitespace-nowrap";

// ─── Public types ─────────────────────────────────────────────────────────────

/** A single mailing-list subscription displayed in the main content list. */
export interface SubscriptionItem {
  orgName: string;
  /** Optional avatar image URL. Falls back to an initial-letter badge. */
  orgAvatarUrl?: string;
  /**
   * When true, a "verified RSO" indicator badge is shown beside the org name.
   * Figma annotation: "Hover to show : this is a registered student organization
   * at Cornell". Rendered with a native tooltip via the `title` attribute.
   */
  isVerified?: boolean;
  /** Total emails received from this list; shown as semibold count + regular label. */
  emailsReceived: number;
  /** Mailing-list address displayed in italic below the stats row. */
  emailAddress: string;
  /** Called when the "Unsubscribe" button is clicked. */
  onUnsubscribe?: () => void;
}

/**
 * A single event row inside a right-panel section ("This week" / "Trending").
 * Mirrors the HomeEventItem pattern from Home.tsx.
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

export interface SubscriptionsProps extends ComponentPropsWithoutRef<"div"> {
  // ── Sidebar ──
  activeNavItem?: SideBarItemId;
  onNavigate?: (id: SideBarItemId) => void;

  // ── Header ──
  /** Total subscription count shown in the badge beside the heading. */
  subscriptionCount?: number;

  // ── Center search ──
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchClear?: () => void;

  // ── Subscription list ──
  subscriptions?: SubscriptionItem[];

  // ── Right panel search ──
  sidePanelSearchValue?: string;
  onSidePanelSearchChange?: (value: string) => void;
  onSidePanelSearchClear?: () => void;

  // ── Right panel sections ──
  sidePanels?: SidePanelSectionProps[];
}

// ─── SubscriptionRow ──────────────────────────────────────────────────────────

/**
 * A single row in the subscriptions list.
 * Matches Figma node 260:2988 and siblings.
 *
 * Container: bg white, Neutral/300 border, rounded-[16px], px 16px, py 12px.
 */
function SubscriptionRow({ item }: { item: SubscriptionItem }) {
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
        {/*
         * Circle avatar — 60 × 60 px (size-[3.75rem]).
         * Falls back to an initial-letter badge using the secondary palette,
         * consistent with the avatar pattern in DashboardPost and SearchPanel.
         */}
        <span
          className={[
            "inline-flex shrink-0 items-center justify-center",
            "overflow-hidden rounded-full",
            "size-[3.75rem]",
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
                "text-[var(--color-secondary-900)] text-[var(--font-size-body1)]"
              }
            >
              {item.orgName.charAt(0).toUpperCase()}
            </span>
          )}
        </span>

        {/* Org info stack */}
        <div className="flex flex-col items-start justify-center gap-[var(--space-1)]">
          {/* Org name row: name + optional verified badge */}
          <div className="flex items-center gap-[var(--space-2)]">
            <span
              className={
                "font-[family-name:var(--font-body)] font-semibold " +
                "leading-[var(--line-height-body1)] text-[var(--font-size-body1)] " +
                "tracking-[var(--letter-spacing-body1)] " +
                "whitespace-nowrap text-[var(--color-neutral-700)]"
              }
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {item.orgName}
            </span>

            {/*
             * Verified RSO badge — small circular indicator with a star icon.
             * Figma annotation: "Hover to show : this is a registered student
             * organization at Cornell". Native `title` tooltip fulfils this.
             * Bg: #949494 ≈ --color-neutral-600 (consistent with DashboardPost indicator).
             */}
            {item.isVerified && (
              <span
                title="This is a registered student organization at Cornell"
                className={[
                  "inline-flex items-center justify-center",
                  "rounded-full p-[var(--space-1)]",
                  "size-[var(--space-5)]",
                  "bg-[var(--color-neutral-600)]",
                  "shrink-0 cursor-help",
                ].join(" ")}
                aria-label="Registered student organization"
              >
                <StarIcon aria-hidden="true" className="size-full" />
              </span>
            )}
          </div>

          {/*
           * Emails received — semibold count inline with regular label.
           * Figma: "43 emails received" — count is SemiBold, rest is Regular.
           * Text colour: #949494 ≈ --color-text-muted (Neutral/500 #adb5bd),
           * the closest available muted-text token.
           */}
          <p
            className={
              BODY2_REGULAR +
              " whitespace-nowrap text-[var(--color-text-muted)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            <span className="font-semibold">{item.emailsReceived}</span>
            {" emails received"}
          </p>

          {/* Mailing-list address — italic, muted */}
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

      {/*
       * Unsubscribe button.
       * Figma: bg #909090, px 16px, py 8px, rounded-[16px], white SemiBold text.
       * --color-neutral-600 (#616972) is the closest dark-neutral token;
       * exact Figma value #909090 lies between neutral-500 and neutral-600.
       */}
      <button
        type="button"
        onClick={item.onUnsubscribe}
        className={[
          "inline-flex shrink-0 items-center justify-center",
          "px-[var(--space-4)] py-[var(--space-2)]",
          "rounded-[var(--radius-card)]",
          "bg-[var(--color-neutral-600)]",
          "font-[family-name:var(--font-body)] font-semibold",
          "leading-[var(--line-height-body2)] text-[var(--font-size-body2)]",
          "tracking-[var(--letter-spacing-body2)]",
          "text-[var(--color-white)]",
          "cursor-pointer whitespace-nowrap",
          "hover:bg-[var(--color-neutral-700)]",
          "transition-colors duration-150",
        ].join(" ")}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Unsubscribe
      </button>
    </div>
  );
}

// ─── SideEventRow ─────────────────────────────────────────────────────────────

/**
 * A single event row inside a right-panel section.
 * Matches Figma nodes 260:2925–260:2951 and 260:2956–260:2980.
 */
function SideEventRow({ item }: { item: SideEventItem }) {
  return (
    <div
      className={[
        "flex w-full flex-col gap-[var(--space-1)]",
        "rounded-[var(--radius-input)] px-[var(--space-1-5)] py-[var(--space-1)]",
        "cursor-pointer",
        "hover:bg-[var(--color-surface-subtle)]",
        "transition-colors duration-150",
      ].join(" ")}
    >
      {/* Event title */}
      <p
        className={
          BODY2_SEMIBOLD + " w-full truncate text-[var(--color-neutral-700)]"
        }
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
              "inline-flex shrink-0 items-center justify-center",
              "overflow-hidden rounded-full",
              "size-[var(--space-6)]",
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
                  "text-[var(--color-secondary-900)] text-[var(--font-size-body3)]"
                }
              >
                {item.orgName.charAt(0).toUpperCase()}
              </span>
            )}
          </span>

          {/* Org name */}
          <span
            className={
              BODY2_REGULAR +
              " whitespace-nowrap text-[var(--color-text-secondary)]"
            }
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
                "inline-flex items-center justify-center",
                "rounded-full p-[var(--space-1)]",
                "size-[var(--space-3)]",
                "bg-[var(--color-neutral-600)]",
              ].join(" ")}
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
              "inline-flex items-center",
              "px-[var(--space-3)] py-[var(--space-0-5)]",
              "rounded-[var(--radius-input)]",
              "bg-[var(--color-primary-500)]",
              "font-[family-name:var(--font-body)] font-medium",
              "leading-[var(--space-6)] text-[var(--font-size-body2)]",
              "tracking-[var(--letter-spacing-body2)]",
              "text-[var(--color-primary-800)]",
              "whitespace-nowrap select-none",
            ].join(" ")}
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
 * Matches Figma nodes 260:2922 and 260:2953.
 */
function SidePanelSection({ title, items, onShowMore }: SidePanelSectionProps) {
  return (
    <div
      className={[
        "flex flex-col gap-[var(--space-3)]",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "rounded-[var(--radius-card)]",
        "px-[var(--space-4)] py-[var(--space-3)]",
        "w-full",
      ].join(" ")}
    >
      <h2
        className={SECTION_TITLE}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {title}
      </h2>

      <div className="flex w-full flex-col gap-[var(--space-4)]">
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
            "self-start",
            BODY2_REGULAR,
            "text-[var(--color-link)]",
            "hover:underline",
            "cursor-pointer transition-[text-decoration] duration-150",
          ].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Show more
        </button>
      )}
    </div>
  );
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Subscriptions page layout — three-column shell:
 *
 *   ┌────────────┬────────────────────────────────┬────────────────┐
 *   │  SideBar   │  Main content                  │  Right panel   │
 *   │ (215px)    │  (flex-1)                      │ (334px)        │
 *   │            │  "Subscriptions" heading        │  SearchBar     │
 *   │  Home      │  + count badge                  │  This week     │
 *   │  Bookmarks │  SearchBar                      │  Trending      │
 *   │  Subs ●    │  ─────────────────────────      │                │
 *   │  ────────  │  SubscriptionRow × n            │                │
 *   │  Profile   │                                 │                │
 *   └────────────┴────────────────────────────────┴────────────────┘
 */
export function Subscriptions({
  activeNavItem = "subscriptions",
  onNavigate,
  subscriptionCount,
  searchValue,
  onSearchChange,
  onSearchClear,
  subscriptions = [],
  sidePanelSearchValue,
  onSidePanelSearchChange,
  onSidePanelSearchClear,
  sidePanels = [],
  className,
  ...rest
}: SubscriptionsProps) {
  return (
    <div
      className={["flex h-full w-full", "bg-[var(--color-surface)]", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {/* ── Left sidebar ── */}
      <SideBar activeItem={activeNavItem} onNavigate={onNavigate} />

      {/* ── Main content ── */}
      <main
        className="flex min-w-0 flex-1 flex-col gap-[var(--space-6)] overflow-y-auto py-[var(--space-6)]"
        aria-label="Subscriptions"
      >
        {/* ── Page header ── */}
        <div className="flex w-full shrink-0 flex-col gap-[var(--space-6)]">
          {/*
           * Heading row: "Subscriptions" wordmark + count badge.
           * Figma (node 260:2796): px 24px, gap 12px.
           * Typography: Manrope Bold ~31px = --font-brand + --font-size-wordmark.
           */}
          <div className="flex items-center gap-[var(--space-3)] px-[var(--space-6)]">
            <h1
              className={
                "font-[family-name:var(--font-brand)] font-bold " +
                "leading-[normal] text-[var(--font-size-wordmark)] " +
                "whitespace-nowrap text-[var(--color-black)]"
              }
            >
              Subscriptions
            </h1>

            {/*
             * Count badge — Figma (node 260:3022): bg #ececec ≈ --color-neutral-200,
             * text #767676 ≈ --color-text-secondary, rounded-[12px].
             * --space-3 (12px) is used for the border-radius as it has no exact token.
             */}
            {subscriptionCount !== undefined && (
              <span
                className={[
                  "inline-flex items-center justify-center",
                  "px-[var(--space-2)] py-[var(--space-0-5)]",
                  "rounded-[var(--space-3)]",
                  "bg-[var(--color-neutral-200)]",
                  "font-[family-name:var(--font-body)] font-normal",
                  "leading-[1.5] text-[var(--font-size-body2)]",
                  "tracking-[var(--letter-spacing-body2)]",
                  "text-[var(--color-text-secondary)]",
                  "whitespace-nowrap select-none",
                ].join(" ")}
                aria-label={`${subscriptionCount} subscriptions`}
              >
                {subscriptionCount}
              </span>
            )}
          </div>

          {/*
           * Center SearchBar — Figma (node 260:2800): full-width, px 32px.
           */}
          <div className="px-[var(--space-8)]">
            <SearchBar
              value={searchValue}
              onChange={onSearchChange}
              onClear={onSearchClear}
              placeholder="Search"
              className="w-full"
            />
          </div>
        </div>

        {/* Horizontal divider — Figma node 260:2814 */}
        <div
          className="h-px w-full shrink-0 bg-[var(--color-border)]"
          role="separator"
          aria-hidden="true"
        />

        {/* ── Subscription list — Figma node 260:2815 ── */}
        {/*
         * Figma: px 24px, pb 24px, gap 24px between rows.
         */}
        <div className="flex flex-col gap-[var(--space-6)] px-[var(--space-6)] pb-[var(--space-6)]">
          {subscriptions.map((item, i) => (
            <SubscriptionRow key={i} item={item} />
          ))}
        </div>
      </main>

      {/* ── Right panel ── */}
      {/*
       * Mirrors the right-panel layout from the Home page.
       * Figma (node 260:2918): w-326px, px 24px, py 32px, gap 24px, left border.
       * Uses --search-panel-width (334px) as the closest layout token.
       */}
      <aside
        className={[
          "flex flex-col gap-[var(--space-6)]",
          "w-[var(--search-panel-width)]",
          "h-full overflow-y-auto",
          "bg-[var(--color-surface)]",
          "border-l border-[var(--color-border)]",
          "px-[var(--space-6)] py-[var(--space-8)]",
          "shrink-0",
        ].join(" ")}
        aria-label="Contextual panel"
      >
        {/* Right-panel SearchBar — Figma node 260:2919 */}
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
