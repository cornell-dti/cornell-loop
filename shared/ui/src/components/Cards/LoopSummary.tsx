/**
 * LoopSummary — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Cards
 * Node: 520:5930 "Loop Summary"
 *
 * An AI / org summary card that stands apart from event cards via its
 * Primary/600 (#ffa26b) border and Shadow 2 elevation.
 *
 * Figma spec:
 *   Container: bg white, border Primary/600, Shadow 2, rounded-[16px],
 *              px 24px, py 16px.
 *   Header:    Loop logo icon (16 × 16) + "Loop Summary" title in Primary/900.
 *   Body:      DM Sans Regular 14px, Neutral/700.
 *
 * The Loop logo is a brand asset served from a remote Figma URL.
 * Pass `logoSrc` to override with a local asset; omit it to use the inline
 * SVG placeholder that approximates the brand icon shape.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef } from 'react';
// Note: the file uses an underscore (loop_logo.svg), not a hyphen.
import LoopLogo from '../../assets/loop_logo.svg?react';
// ─── Public types ─────────────────────────────────────────────────────────────

export interface LoopSummaryProps extends ComponentPropsWithoutRef<'section'> {
  /** The summary text body. */
  summary: string;
  /**
   * Optional src for the Loop logo image.
   * Falls back to an inline SVG approximation of the brand icon.
   */
  logoSrc?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoopSummary({
  summary,
  logoSrc,
  className,
  ...rest
}: LoopSummaryProps) {
  return (
    <section
      className={[
        'flex flex-col gap-[var(--space-2)]',
        'px-[var(--space-6)] py-[var(--space-4)]',
        'rounded-[var(--radius-card)]',
        'bg-[var(--color-surface)]',
        /* Figma: Primary/600 (#ffa26b) border — visually distinguishes summary cards */
        'border border-[var(--color-primary-600)]',
        /* Figma: Shadow 2 — subtle elevation */
        'shadow-[var(--shadow-2)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {/* ── Header: logo + title ── */}
      <div className="flex items-center gap-[var(--space-2)]">
        {logoSrc ? (
          /* Caller-supplied override (e.g. a branded variant) */
          <img
            src={logoSrc}
            alt="Loop"
            className="shrink-0 size-[var(--space-4)]"
          />
        ) : (
          /* Default: loop_logo.svg rendered inline via SVGR */
          <LoopLogo
            aria-hidden="true"
            className="shrink-0 size-[var(--space-4)]"
          />
        )}

        {/* Title — Figma: DM Sans Bold 18px, Primary/900 (#592100) */}
        <h3
          className={
            'font-[family-name:var(--font-body)] font-bold ' +
            'text-[var(--font-size-body1)] leading-[var(--line-height-body1)] ' +
            'tracking-[var(--letter-spacing-body1)] ' +
            'text-[var(--color-primary-900)] whitespace-nowrap'
          }
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Loop Summary
        </h3>
      </div>

      {/* ── Body text — Figma: DM Sans Regular 14px, Neutral/700 ── */}
      <p
        className={
          'font-[family-name:var(--font-body)] font-normal ' +
          'text-[var(--font-size-body2)] leading-[var(--line-height-body2)] ' +
          'tracking-[var(--letter-spacing-body2)] ' +
          'text-[var(--color-neutral-700)]'
        }
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {summary}
      </p>
    </section>
  );
}
