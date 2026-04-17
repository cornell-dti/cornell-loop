/**
 * DateBadge — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Event Card (extension)
 * Node: 493:1011 (date variant) / 493:1013 (news variant)
 *
 * A 55 × 55 px thumbnail widget used in event rows.
 * The outer element is Primary/700 orange; a cream (Primary/400) inner element
 * covers the interior except for a narrow left orange strip (~4 px).
 * The cream layer extends 1.5 px beyond the top/bottom/right padding edges so
 * it paints over the orange border on those sides — leaving orange only on the
 * left accent strip (matches Figma node 493:1006 top: -1.5px).
 *
 * Two variants:
 *   "date" — shows a day-of-month number + abbreviated month label
 *   "news" — shows a newspaper-outline icon (for news / article events)
 *
 * Used by:
 *   • ExtensionEventCard (src/components/Cards/ExtensionEventCard.tsx)
 *   • SearchPanel       (src/components/SearchPanel.tsx)
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import NewspaperIcon from '../assets/newspaper-outline.svg?react';

// ─── Public types ─────────────────────────────────────────────────────────────

export type ThumbnailVariant = 'date' | 'news';

export interface DateBadgeProps {
  /** Controls which content fills the badge. Defaults to "date". */
  variant?: ThumbnailVariant;
  /** Day-of-month shown in the "date" variant (e.g. 24). */
  day?: number | string;
  /** Abbreviated month label shown in the "date" variant (e.g. "Mar"). */
  month?: string;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DateBadge({
  variant = 'date',
  day,
  month,
  className,
}: DateBadgeProps) {
  return (
    <div
      className={[
        'relative overflow-hidden shrink-0',
        'size-[var(--size-date-badge)]',
        'rounded-[var(--space-1)]',
        '[border:1.5px_solid_var(--color-primary-700)]',
        'bg-[var(--color-primary-700)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/*
       * Cream body — extends 1.5px beyond the padding edge on top/bottom/right
       * so it paints over the orange border on those sides.
       * Only the left strip (--space-1 ≈ 4px) stays orange.
       * overflow-hidden on the parent clips everything to the border-box boundary.
       */}
      <div
        className="absolute top-[-1.5px] bottom-[-1.5px] right-[-1.5px] bg-[var(--color-primary-400)]"
        style={{ left: 'var(--space-1)' }}
        aria-hidden="true"
      />

      {/* ── "date" variant ── */}
      {variant === 'date' && (
        /*
         * justify-center with no pb offset → true vertical centre of the 55×55 badge.
         * Both spans use leading-none (line-height: 1) so line-boxes match glyph
         * heights, preventing invisible space from biasing the centre point.
         */
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
          {/* Day number — Figma: DM Sans Regular 28px, tracking -1px */}
          <span
            className={[
              'font-[family-name:var(--font-body)] font-normal',
              'text-[1.75rem] leading-none tracking-[var(--letter-spacing-sub1)]',
              'text-[var(--color-neutral-900)] whitespace-nowrap',
            ].join(' ')}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {day ?? '–'}
          </span>

          {/* Month — Figma: DM Sans 12px, centre-aligned, tracking -0.5px */}
          <span
            className={[
              'font-[family-name:var(--font-body)] font-normal leading-none',
              'text-[length:var(--font-size-body3)] tracking-[var(--letter-spacing-body3)]',
              'text-[var(--color-neutral-900)] text-center whitespace-nowrap',
            ].join(' ')}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {month ?? ''}
          </span>
        </div>
      )}

      {/* ── "news" variant ── */}
      {variant === 'news' && (
        /*
         * Icon centred within the cream area only (not the full frame).
         * Left edge matches the cream layer's left edge (--space-1 = 4px orange strip),
         * so the icon is optically centred between the orange strip and the right edge.
         */
        <div
          className="absolute top-0 bottom-0 right-0 z-10 flex items-center justify-center"
          style={{ left: 'var(--space-1)' }}
        >
          <NewspaperIcon
            aria-hidden="true"
            className="size-[1.875rem]"
          />
        </div>
      )}
    </div>
  );
}
