/**
 * ExtensionEventCard — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Event Card (extension)
 * Node: 493:800
 *
 * The Figma page documents three related pieces shown in the "EVENT CARD" and
 * "THUMBNAIL" sections:
 *
 *  ┌──────────────────────────────────────────────────────────────┐
 *  │ Thumbnail (Frame166)                                         │
 *  │   property1 = "date"  → DateBadge with day number + month   │
 *  │   property1 = "news"  → DateBadge with newspaper icon       │
 *  ├──────────────────────────────────────────────────────────────┤
 *  │ Event Row (Frame45)                                          │
 *  │   DateBadge + title/description text + bookmark icon        │
 *  │   property1 = "Default" | "hover"                           │
 *  │   → hover implemented as CSS hover (bg-surface-subtle)      │
 *  ├──────────────────────────────────────────────────────────────┤
 *  │ Event Card (Frame90)                                         │
 *  │   Org header (avatar circle + name) + list of Event Rows    │
 *  │   border Neutral/300, rounded-[12px] (--space-3), p-[12px]  │
 *  └──────────────────────────────────────────────────────────────┘
 *
 * All three are exported so they can be composed independently.
 *
 * Bookmark states (per Figma Icons section):
 *   bookmarked=false  → bookmark.svg          (gray outline, Neutral/500)
 *   bookmarked=false + hover → darkens via --filter-icon-close-default
 *   bookmarked=true   → bookmark-filled.svg   (orange fill, Primary/700)
 *
 * SVG assets used (all via SVGR ?react):
 *   bookmark.svg, bookmark-filled.svg — from existing design system
 *   newspaper-outline.svg             — created for the "news" thumbnail variant
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import { useState, type ComponentPropsWithoutRef } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Bookmark } from "../Bookmark";
import { Avatar } from "../Avatar";
import { DateBadge } from "../DateBadge";
import type { ThumbnailVariant } from "../DateBadge";
export type { ThumbnailVariant, DateBadgeProps } from "../DateBadge";
export { DateBadge };

// ─── Shared typography class strings ──────────────────────────────────────────

const BODY2_SEMIBOLD =
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

const BODY3 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body3)] leading-[var(--line-height-body3)] " +
  "tracking-[var(--letter-spacing-body3)]";

// DateBadge, ThumbnailVariant, and DateBadgeProps are re-exported above
// from src/components/DateBadge.tsx.

// ─── Public types for rows and cards ──────────────────────────────────────────

export interface ExtensionEventItem {
  /** Controls the thumbnail badge type. Defaults to "date". */
  thumbnailVariant?: ThumbnailVariant;
  /** Day-of-month for the "date" thumbnail (e.g. 24). */
  day?: number | string;
  /** Abbreviated month for the "date" thumbnail (e.g. "Mar"). */
  month?: string;
  /** Event title — DM Sans SemiBold 14 px, Neutral/900. */
  title: string;
  /** Short supporting text shown below the title. DM Sans Regular 12 px, Neutral/700. */
  description?: string;
  /**
   * Whether this event is bookmarked / saved.
   *   true  → bookmark-filled.svg (Primary/700 orange) — Figma "saved" state
   *   false → bookmark.svg        (Neutral/500 gray)   — Figma "Default" state
   * Defaults to false.
   */
  bookmarked?: boolean;
  /** Called when the bookmark button is clicked. */
  onBookmark?: () => void;
  /**
   * Optional click handler for the whole row (e.g. edge-case events that open
   * OriginalEmailView). When provided the row gets cursor-pointer styling.
   */
  onRowClick?: () => void;
}

// ─── ExtensionEventRow ────────────────────────────────────────────────────────
//
// Single compact event row (Figma Frame45, node 493:919).
// Layout: [DateBadge] [title + description flex-1] [BookmarkIcon]
//
// Figma property1:
//   "Default" → transparent bg, normal bookmark
//   "hover"   → bg-surface-subtle (implemented as CSS hover — no prop needed)

export interface ExtensionEventRowProps
  extends ExtensionEventItem, Omit<ComponentPropsWithoutRef<"div">, "title"> {}

export function ExtensionEventRow({
  thumbnailVariant = "date",
  day,
  month,
  title,
  description,
  bookmarked: bookmarkedProp = false,
  onBookmark,
  onRowClick,
  className,
  ...rest
}: ExtensionEventRowProps) {
  const [internalBookmarked, setInternalBookmarked] = useState(bookmarkedProp);
  const bookmarked = onBookmark ? bookmarkedProp : internalBookmarked;
  const handleBookmark = onBookmark ?? (() => setInternalBookmarked((b) => !b));
  return (
    /*
     * Interactive states — Figma property1 "Default" | "hover":
     *   Default  → bg white (surface)
     *   Hover    → bg-surface-subtle (#f8f9fa, Neutral/100)
     * Transition matches the nav-tab and RSVP-row hover pattern.
     */
    <div
      className={[
        "flex w-full items-center gap-[var(--space-3)]",
        "p-[var(--space-1-5)]",
        "rounded-[var(--radius-input)]",
        "bg-[var(--color-surface)]",
        "hover:bg-[var(--color-surface-subtle)]",
        "transition-colors duration-150",
        onRowClick ? "cursor-pointer" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onRowClick}
      {...rest}
    >
      {/* Thumbnail badge */}
      <DateBadge variant={thumbnailVariant} day={day} month={month} />

      {/* Text content */}
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-1)] tracking-[var(--letter-spacing-body2)]">
        <p
          className={
            BODY2_SEMIBOLD +
            " w-full truncate text-[color:var(--color-neutral-900)]"
          }
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {title}
        </p>

        {description && (
          <p
            className={
              BODY3 + " w-full truncate text-[color:var(--color-neutral-700)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {description}
          </p>
        )}
      </div>

      <Bookmark
        bookmarked={bookmarked}
        onToggle={(e) => {
          e.stopPropagation();
          handleBookmark();
        }}
        iconClassName="size-[var(--space-6)]"
      />
    </div>
  );
}

// ─── ExtensionEventCard ───────────────────────────────────────────────────────
//
// Grouped card with an org attribution header above a list of event rows.
// Figma Frame90, node 494:576.
//
// Layout:
//   ┌──────────────────────────────────┐
//   │  [avatar] Org name               │  ← org header (gap-[8px], px-[6px])
//   │  ─────────────────────────────   │
//   │  [badge] Title       Description │  ← event row × N
//   │  [badge] Title       Description │
//   └──────────────────────────────────┘
//
// Figma spec:
//   bg white, border Neutral/300 (#dee2e6 = --color-border), rounded-[12px],
//   p-[12px], gap-[16px], overflow-hidden

export interface ExtensionEventCardProps extends ComponentPropsWithoutRef<"div"> {
  /** Organisation name shown in the card header. */
  orgName: string;
  /** URL for the org's circular avatar image. Falls back to an initials badge. */
  orgAvatarUrl?: string;
  /** List of events shown as rows inside the card. */
  events?: ExtensionEventItem[];
  /**
   * When provided, renders a centred "View more" footer (chevron-down + label).
   * Figma: node 554:5235 — below the event rows, centred, DM Sans Regular 12px Neutral/700.
   */
  onViewMore?: () => void;
  /**
   * When provided, renders a centred "View less" footer (chevron-up + label)
   * replacing the "View more" footer in the expanded state.
   */
  onViewLess?: () => void;
}

export function ExtensionEventCard({
  orgName,
  orgAvatarUrl,
  events = [],
  onViewMore,
  onViewLess,
  className,
  ...rest
}: ExtensionEventCardProps) {
  return (
    /*
     * Figma: bg white, 1px border --color-border (Neutral/300 #dee2e6),
     * rounded-[12px] (--space-3 = 0.75rem = 12px), p-[12px], gap-[16px],
     * overflow-hidden.
     */
    <div
      className={[
        "flex flex-col gap-[var(--space-4)]",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "rounded-[var(--space-3)]",
        "p-[var(--space-3)]",
        "overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {/* ── Org header ── */}
      <Avatar avatars={[{ name: orgName, src: orgAvatarUrl }]} />

      {/* ── Event rows ── */}
      {events.length > 0 && (
        <div className="flex w-full flex-col gap-[var(--space-3)]">
          {events.map((event, i) => (
            <ExtensionEventRow key={i} {...event} />
          ))}
        </div>
      )}

      {/* ── View more / View less footer — Figma: centred chevron + label ── */}
      {(onViewMore || onViewLess) && (
        <button
          type="button"
          onClick={onViewLess ?? onViewMore}
          className={[
            "flex w-full items-center justify-center gap-[var(--space-1)]",
            "cursor-pointer",
            BODY3,
            "text-[color:var(--color-neutral-700)]",
            "hover:text-[color:var(--color-neutral-900)] transition-colors duration-150",
          ].join(" ")}
        >
          {onViewLess ? (
            <ChevronUp
              aria-hidden="true"
              size={15}
              className="shrink-0 text-[color:var(--color-neutral-700)]"
            />
          ) : (
            <ChevronDown
              aria-hidden="true"
              size={15}
              className="shrink-0 text-[color:var(--color-neutral-700)]"
            />
          )}
          <span style={{ fontVariationSettings: "'opsz' 14" }}>
            {onViewLess ? "View less" : "View more"}
          </span>
        </button>
      )}
    </div>
  );
}
