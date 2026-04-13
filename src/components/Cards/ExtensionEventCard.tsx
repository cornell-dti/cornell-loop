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

import type { ComponentPropsWithoutRef } from 'react';
import BookmarkIcon       from '../../assets/bookmark.svg?react';
import BookmarkFilledIcon from '../../assets/bookmark-filled.svg?react';
import { DateBadge } from '../DateBadge';
import type { ThumbnailVariant } from '../DateBadge';
export type { ThumbnailVariant, DateBadgeProps } from '../DateBadge';
export { DateBadge };

// ─── Shared typography class strings ──────────────────────────────────────────

const BODY2_SEMIBOLD =
  'font-[family-name:var(--font-body)] font-semibold ' +
  'text-[var(--font-size-body2)] leading-[var(--line-height-body2)] ' +
  'tracking-[var(--letter-spacing-body2)]';

const BODY3 =
  'font-[family-name:var(--font-body)] font-normal ' +
  'text-[var(--font-size-body3)] leading-[var(--line-height-body3)] ' +
  'tracking-[var(--letter-spacing-body3)]';

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
  extends ExtensionEventItem,
    Omit<ComponentPropsWithoutRef<'div'>, 'title'> {}

export function ExtensionEventRow({
  thumbnailVariant = 'date',
  day,
  month,
  title,
  description,
  bookmarked = false,
  onBookmark,
  className,
  ...rest
}: ExtensionEventRowProps) {
  return (
    /*
     * Interactive states — Figma property1 "Default" | "hover":
     *   Default  → bg white (surface)
     *   Hover    → bg-surface-subtle (#f8f9fa, Neutral/100)
     * Transition matches the nav-tab and RSVP-row hover pattern.
     */
    <div
      className={[
        'flex gap-[var(--space-3)] items-center w-full',
        'p-[var(--space-1-5)]',
        'rounded-[var(--radius-input)]',
        'bg-[var(--color-surface)]',
        'hover:bg-[var(--color-surface-subtle)]',
        'transition-colors duration-150',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {/* Thumbnail badge */}
      <DateBadge variant={thumbnailVariant} day={day} month={month} />

      {/* Text content */}
      <div className="flex-1 min-w-0 flex flex-col gap-[var(--space-1)] tracking-[var(--letter-spacing-body2)]">
        <p
          className={BODY2_SEMIBOLD + ' text-[var(--color-neutral-900)] w-full truncate'}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {title}
        </p>

        {description && (
          <p
            className={BODY3 + ' text-[var(--color-neutral-700)] w-full truncate'}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {description}
          </p>
        )}
      </div>

      {/*
       * Bookmark button — switches SVG based on `bookmarked` prop.
       * Same pattern as DashboardEventCard:
       *   false → BookmarkIcon       (stroke="#ADB5BD", gray outline)
       *   true  → BookmarkFilledIcon (fill="#EB7128",   orange filled)
       * On hover when unsaved: --filter-icon-close-default darkens to ~Neutral/700.
       * Source: Figma Icons section — Bookmark icon states (node 493:1041)
       */}
      <button
        type="button"
        aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark event'}
        aria-pressed={bookmarked}
        onClick={(e) => {
          e.stopPropagation();
          onBookmark?.();
        }}
        className="group shrink-0 size-[var(--space-6)] cursor-pointer"
      >
        {bookmarked ? (
          <BookmarkFilledIcon
            aria-hidden="true"
            className="size-full"
          />
        ) : (
          <BookmarkIcon
            aria-hidden="true"
            className={
              'size-full ' +
              'group-hover:[filter:var(--filter-icon-close-default)] ' +
              'transition-[filter] duration-150'
            }
          />
        )}
      </button>
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

export interface ExtensionEventCardProps
  extends ComponentPropsWithoutRef<'div'> {
  /** Organisation name shown in the card header. */
  orgName: string;
  /** URL for the org's circular avatar image. Falls back to an initials badge. */
  orgAvatarUrl?: string;
  /** List of events shown as rows inside the card. */
  events?: ExtensionEventItem[];
}

export function ExtensionEventCard({
  orgName,
  orgAvatarUrl,
  events = [],
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
        'flex flex-col gap-[var(--space-4)]',
        'bg-[var(--color-surface)]',
        'border border-[var(--color-border)]',
        'rounded-[var(--space-3)]',
        'p-[var(--space-3)]',
        'overflow-hidden',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {/* ── Org header ── */}
      <div className="flex items-center gap-[var(--space-2)] px-[var(--space-1-5)]">
        {/* Org avatar — 32 px circle */}
        <div
          className={[
            'relative shrink-0 size-[var(--space-8)]',
            'rounded-full overflow-hidden',
            'bg-[var(--color-surface-subtle)]',
          ].join(' ')}
        >
          {orgAvatarUrl ? (
            <img
              src={orgAvatarUrl}
              alt={orgName}
              className="size-full object-cover"
            />
          ) : (
            /* Initials fallback */
            <span
              className={
                'size-full flex items-center justify-center ' +
                'bg-[var(--color-secondary-400)] ' +
                'font-[family-name:var(--font-body)] font-semibold ' +
                'text-[var(--font-size-body3)] text-[var(--color-secondary-900)]'
              }
            >
              {orgName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Org name — Figma: DM Sans SemiBold 14px, Neutral/700 */}
        <span
          className={BODY2_SEMIBOLD + ' text-[var(--color-neutral-700)] whitespace-nowrap'}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {orgName}
        </span>
      </div>

      {/* ── Event rows ── */}
      {events.length > 0 && (
        <div className="flex flex-col gap-[var(--space-3)] w-full">
          {events.map((event, i) => (
            <ExtensionEventRow key={i} {...event} />
          ))}
        </div>
      )}
    </div>
  );
}
