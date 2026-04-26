/**
 * Org — Loop Dashboard Page
 *
 * Source: Figma "Incubator-design-file" › node 1:573 "club page"
 *
 * Three-column page layout:
 *   • SideBar (left)        — navigation rail, any item active
 *   • Main content (center) — cover banner, org avatar, action buttons, org info,
 *                             Loop Summary card, posts feed with search/filter bar
 *   • Right panel           — SearchBar, "This week" + "Trending" event sections
 *
 * Cover banner: 240 px tall full-width area; pass `coverImageUrl` for a real image.
 * Org avatar: 121 × 121 px circle, overlaps the cover bottom at left = 24 px.
 *   Figma: top = 179 px = 11.1875 rem within the relative cover/action wrapper.
 *
 * Verified badge: Figma annotation "Hover to show : this is a registered student
 * organization at Cornell". Rendered as a small rounded indicator with a native tooltip.
 *
 * Follow button bg: Figma #909090 — approximated with --color-neutral-600 (#616972).
 * "For you" org tag: Figma bg #ffe4d5 / text #b54400 — approximated with
 *   --color-primary-500 (#ffcaaa) / --color-primary-800 (#a74409).
 * Org name font size: Figma 22 px — used directly (1.375 rem) as no token covers
 *   this exact value, matching the precedent in Subscriptions.tsx (size-[3.75rem]).
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded except where noted above.
 */

import type { ComponentPropsWithoutRef } from "react";
import {
  SideBar,
  SearchBar,
  SearchPanel,
  LoopSummary,
  DashboardPost,
  Tag,
  Button,
} from "@app/ui";
import type {
  SideBarItemId,
  DashboardPostProps,
  RsvpGroup,
  Club,
  Organization,
} from "@app/ui";

// ─── Inline icon helpers ──────────────────────────────────────────────────────
// Globe and Mail icons are not in shared/ui/src/assets; defined inline here.

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx={12} cy={12} r={10} />
      <line x1={2} y1={12} x2={22} y2={12} />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Shared typography class strings ─────────────────────────────────────────

const BODY2_REGULAR =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface OrgTag {
  label: string;
  /**
   * 'primary' renders an orange "For you" style pill
   * (Figma: bg #ffe4d5 / text #b54400 ≈ --color-primary-500 / --color-primary-800).
   * 'neutral' renders a gray category pill (Tag component neutral variant).
   * Defaults to 'neutral'.
   */
  variant?: "primary" | "neutral";
}

export interface OrgProps extends ComponentPropsWithoutRef<"div"> {
  // ── Sidebar ──
  activeNavItem?: SideBarItemId;
  onNavigate?: (id: SideBarItemId) => void;

  // ── Org info ──
  orgName?: string;
  orgDescription?: string;
  orgAvatarUrl?: string;
  /** Background image URL for the cover banner. Falls back to the neutral surface colour. */
  coverImageUrl?: string;
  /**
   * When true a "verified RSO" badge is shown beside the org name.
   * Figma annotation: "Hover to show : this is a registered student organization at Cornell".
   */
  isVerified?: boolean;
  /** Category and relevance tags shown beneath the org description. */
  orgTags?: OrgTag[];

  // ── Loop Summary ──
  loopSummary?: string;

  // ── Action buttons ──
  isFollowing?: boolean;
  onFollow?: () => void;
  onWebsite?: () => void;
  onEmail?: () => void;

  // ── Posts feed ──
  posts?: DashboardPostProps[];
  feedSearchValue?: string;
  onFeedSearchChange?: (value: string) => void;
  onFeedSearchClear?: () => void;
  /** Display label for the tag filter button, e.g. "All tags". */
  tagFilter?: string;
  /** Called when the tag filter button is clicked (caller shows a picker). */
  onTagFilterChange?: () => void;
  /** Display label for the time filter button, e.g. "All time". */
  timeFilter?: string;
  /** Called when the time filter button is clicked (caller shows a picker). */
  onTimeFilterChange?: () => void;

  // ── Right panel (shared SearchPanel) ──
  rsvpGroups?: RsvpGroup[];
  clubs?: Club[];
  onClubClick?: (club: Club) => void;
  /** Called when an org name in a post header is clicked. */
  onOrgClick?: (org: Organization) => void;
}

// ─── OrgTagPill ───────────────────────────────────────────────────────────────

/**
 * Renders a neutral or primary (orange "For you") pill tag for the org header.
 * Uses the Tag design-system component for neutral; a custom span for primary,
 * matching the "For you" badge style used consistently across Home / Subscriptions.
 */
function OrgTagPill({ label, variant = "neutral" }: OrgTag) {
  if (variant === "neutral") {
    return <Tag color="neutral">{label}</Tag>;
  }
  // Primary "For you" pill — match design-system Tag dimensions exactly so
  // primary and neutral pills align in height. Same px/py/radius/font as Tag,
  // only the colour palette differs.
  return (
    <span
      className={[
        "inline-flex items-center gap-[var(--space-2)]",
        "px-[var(--space-3)] py-[var(--space-0-5)]",
        "rounded-[var(--radius-input)]",
        "bg-[var(--color-primary-500)]",
        "font-[family-name:var(--font-body)] font-medium",
        "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)]",
        "tracking-[var(--letter-spacing-body2)]",
        "text-[var(--color-primary-800)]",
        "whitespace-nowrap select-none",
      ].join(" ")}
      style={{ fontVariationSettings: "'opsz' 14" }}
    >
      {label}
    </span>
  );
}

// ─── Org ──────────────────────────────────────────────────────────────────────

/**
 * Org page layout — three-column shell:
 *
 *   ┌────────────┬──────────────────────────────────┬────────────────┐
 *   │  SideBar   │  Main content                    │  Right panel   │
 *   │ (215px)    │  (flex-1)                        │ (334px)        │
 *   │            │  ┌ Cover banner (240 px) ──────┐ │  SearchBar     │
 *   │  Home      │  │  [action buttons]           │ │  This week     │
 *   │  Bookmarks │  └─────────────────────────────┘ │  Trending      │
 *   │  Subs      │  [org avatar, overlapping cover]  │                │
 *   │  ────────  │  Org name + verified badge        │                │
 *   │  Profile   │  Description                      │                │
 *   │            │  Tags                             │                │
 *   │            │  Loop Summary card                │                │
 *   │            │  ─────────────────────────────    │                │
 *   │            │  [search] [All tags] [All time]   │                │
 *   │            │  DashboardPost × n                │                │
 *   └────────────┴──────────────────────────────────┴────────────────┘
 */
export function Org({
  activeNavItem,
  onNavigate,
  orgName = "Association of Computer Science Undergraduates (ACSU)",
  orgDescription = "CS organization for undergrads looking to find community.",
  orgAvatarUrl,
  coverImageUrl,
  orgTags = [],
  loopSummary,
  isFollowing = false,
  onFollow,
  onWebsite,
  onEmail,
  posts = [],
  feedSearchValue,
  onFeedSearchChange,
  onFeedSearchClear,
  tagFilter = "All tags",
  onTagFilterChange,
  timeFilter = "All time",
  onTimeFilterChange,
  rsvpGroups,
  clubs,
  onClubClick,
  onOrgClick,
  className,
  ...rest
}: OrgProps) {
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

      {/* ── Main content ── */}
      <main
        className={[
          "flex min-w-0 flex-1 flex-col",
          "overflow-y-auto bg-[var(--color-surface-subtle)]",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        ].join(" ")}
        aria-label="Organisation"
      >
        {/*
         * Relative wrapper: contains the cover banner and the action buttons row.
         * The org avatar is absolutely positioned within this wrapper so it
         * overlaps the bottom edge of the cover.
         *
         * Wrapper height ≈ cover (240 px) + action row (~56 px) = ~296 px.
         * Avatar: top = 179 px, size = 121 px → bottom at 300 px (~4 px overflow).
         * Figma: org-info section starts at top = 296 px with pt = 16 px,
         *        placing the first text line at ~312 px (below the avatar).
         */}
        <div className="relative w-full shrink-0">
          {/*
           * Cover banner — Figma node 613:4241 shows a sky/cloud image. We render
           * a tasteful sky gradient as the no-asset fallback so the org page has
           * a visual treatment matching the Figma frame's atmosphere instead of
           * a flat gray block. When a real `coverImageUrl` is provided it
           * overrides the gradient.
           */}
          <div
            className="h-60 w-full shrink-0 bg-[var(--color-surface-raised)]"
            style={
              coverImageUrl
                ? {
                    backgroundImage: `url(${coverImageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {
                    backgroundImage:
                      "linear-gradient(180deg, var(--color-secondary-500) 0%, var(--color-secondary-300) 100%)",
                  }
            }
          />

          {/*
           * Action buttons row — right-aligned below the cover banner.
           * py-2 (8 px × 2) + button height (~40 px) ≈ 56 px total,
           * placing the org-info section at ~296 px from the wrapper top.
           */}
          <div className="flex items-start justify-end gap-[var(--space-2)] px-[var(--space-4)] py-[var(--space-2)]">
            {/* Website / globe button — icon-only, bg Neutral/200 */}
            <button
              type="button"
              aria-label="Visit website"
              onClick={onWebsite}
              className={[
                "inline-flex shrink-0 items-center justify-center",
                "px-[var(--space-4)] py-[var(--space-2)]",
                "rounded-[var(--radius-card)]",
                "bg-[var(--color-surface-raised)]",
                "text-[var(--color-neutral-700)]",
                "cursor-pointer",
                "hover:bg-[var(--color-neutral-300)]",
                "transition-colors duration-150",
              ].join(" ")}
            >
              <GlobeIcon className="size-[var(--space-4)]" />
            </button>

            {/* Email button — icon-only, bg Neutral/200 */}
            <button
              type="button"
              aria-label="Send email"
              onClick={onEmail}
              className={[
                "inline-flex shrink-0 items-center justify-center",
                "px-[var(--space-4)] py-[var(--space-2)]",
                "rounded-[var(--radius-card)]",
                "bg-[var(--color-surface-raised)]",
                "text-[var(--color-neutral-700)]",
                "cursor-pointer",
                "hover:bg-[var(--color-neutral-300)]",
                "transition-colors duration-150",
              ].join(" ")}
            >
              <MailIcon className="size-[var(--space-4)]" />
            </button>

            {/*
             * Follow / Following button — design-system Button.
             * Primary while following (filled orange), secondary when not.
             */}
            <Button
              variant={isFollowing ? "primary" : "secondary"}
              size="sm"
              onClick={onFollow}
            >
              {isFollowing ? "Following" : "Follow"}
            </Button>
          </div>

          {/*
           * Org avatar — 121 × 121 px circle, absolutely positioned to overlap the
           * cover banner.  Figma: left = 24 px, top = 179 px (= 11.1875 rem).
           * Ring provides visual separation from the cover image.
           */}
          <span
            className={[
              "absolute top-[11.1875rem] left-[var(--space-6)]",
              "inline-flex items-center justify-center",
              "shrink-0 overflow-hidden rounded-full",
              "size-[7.5625rem]",
              "ring-4 ring-[var(--color-surface)]",
              "bg-[var(--color-surface-raised)]",
            ].join(" ")}
          >
            {orgAvatarUrl ? (
              <img
                src={orgAvatarUrl}
                alt={orgName}
                className="size-full object-cover"
              />
            ) : (
              <span
                className={
                  "flex size-full items-center justify-center " +
                  "bg-[var(--color-secondary-400)] " +
                  "font-[family-name:var(--font-brand)] font-bold " +
                  "text-[var(--font-size-sub1)] " +
                  "text-[var(--color-secondary-900)]"
                }
              >
                {orgName.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        </div>

        {/* ── Org info section ── */}
        {/*
         * pt-4 (16 px) provides enough clearance below the ~4 px avatar overflow and
         * matches the Figma org-info section's own pt-16 (content starts at ~312 px).
         */}
        <div className="flex flex-col gap-[var(--space-6)] px-[var(--space-6)] pt-[var(--space-4)] pb-[var(--space-6)]">
          {/* Org name + description + tags */}
          <div className="flex flex-col gap-[var(--space-4)]">
            {/* Name row + description */}
            <div className="flex flex-col gap-[var(--space-1)]">
              {/* Org name + optional verified RSO badge */}
              <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                <h1
                  className={
                    "font-[family-name:var(--font-body)] font-semibold " +
                    "text-[length:var(--font-size-sub2)] leading-[var(--line-height-sub2)] " +
                    "tracking-[var(--letter-spacing-body1)] " +
                    "text-[var(--color-neutral-900)]"
                  }
                  style={{ fontVariationSettings: "'opsz' 14" }}
                >
                  {orgName}
                </h1>

                {/*
                 * Verified RSO indicator omitted — the star icon is no longer
                 * used in the redesign. The `isVerified` prop remains on the
                 * interface for future re-introduction of a non-star badge.
                 */}
              </div>

              {/* Description — Figma: Inter Regular 16 px, #909090 ≈ --color-text-secondary */}
              {orgDescription && (
                <p
                  className={
                    BODY2_REGULAR + " text-[var(--color-text-secondary)]"
                  }
                  style={{ fontVariationSettings: "'opsz' 14" }}
                >
                  {orgDescription}
                </p>
              )}
            </div>

            {/* Org category / relevance tags */}
            {orgTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                {orgTags.map((tag, i) => (
                  <OrgTagPill key={i} label={tag.label} variant={tag.variant} />
                ))}
              </div>
            )}
          </div>

          {/* Loop Summary card — Figma: Primary/600 border, shadow-2, px-24 py-16 */}
          {loopSummary && (
            <LoopSummary summary={loopSummary} className="w-full" />
          )}
        </div>

        {/* Horizontal divider — Figma node 121:662 */}
        <div
          className="h-px w-full shrink-0 bg-[var(--color-border)]"
          role="separator"
          aria-hidden="true"
        />

        {/* ── Posts feed section ── */}
        {/*
         * Figma: px-24, pt-16, gap-16 between filter bar and post list.
         */}
        <div className="flex flex-col gap-[var(--space-4)] px-[var(--space-6)] py-[var(--space-4)]">
          {/* Filter bar: search input (flex-1) + tag filter + time filter */}
          <div className="flex items-center gap-[var(--space-4)]">
            {/* Search — fills remaining width */}
            <SearchBar
              value={feedSearchValue}
              onChange={onFeedSearchChange}
              onClear={onFeedSearchClear}
              placeholder="Search"
              className="min-w-0 flex-1"
            />

            {/*
             * "All tags" filter button — Figma: bg white, Neutral/300 border,
             * rounded-[16px], text + chevron-down icon.
             * Clicking calls onTagFilterChange so the caller can show a picker.
             */}
            <button
              type="button"
              onClick={onTagFilterChange}
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
            >
              {tagFilter}
              <ChevronDownIcon className="size-[var(--space-6)] shrink-0" />
            </button>

            {/* "All time" filter button */}
            <button
              type="button"
              onClick={onTimeFilterChange}
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
            >
              {timeFilter}
              <ChevronDownIcon className="size-[var(--space-6)] shrink-0" />
            </button>
          </div>

          {/* Post list — Figma: gap-16 px between posts, pb-24 px */}
          <div className="flex flex-col gap-[var(--space-8)] pb-[var(--space-6)]">
            {posts.map((post, i) => (
              <DashboardPost key={i} {...post} onOrgClick={onOrgClick} />
            ))}
          </div>
        </div>
      </main>

      {/* ── Right panel ── */}
      {/*
       * Mirrors the right-panel layout from Home and Subscriptions.
       * Figma (node 119:413): w-326px, px-24, py-32, gap-24, left border.
       * Uses --search-panel-width (334px) as the closest layout token.
       */}
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
