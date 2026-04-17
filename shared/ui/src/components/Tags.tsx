/**
 * Tag — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Tags (node 385:205)
 * Tag frame: node 385:211
 *
 * Figma exposes two props on the component:
 *   secondary: "Secondary" (neutral/gray palette) | "Primary" (blue palette)
 *   state:     "Default" | "Hover" | "Focus"
 *
 * In this implementation:
 *   • `color`     maps to Figma's `secondary` — renamed for clarity
 *                   'neutral' = Figma "Secondary"  (Neutral/200 → Neutral/300 on hover)
 *                   'blue'    = Figma "Primary"    (Secondary/300 → Secondary/400 on hover)
 *   • `onDismiss` maps to Figma's "Focus" state — this state shows a × dismiss button.
 *                 Pass a handler to render the dismiss icon; omit it for a plain tag.
 *   • Hover is handled entirely by CSS (no prop needed).
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef } from 'react';
import CloseIcon from '../assets/close_tags.svg?react';

// ─── Public types ────────────────────────────────────────────────────────────

export type TagColor = 'neutral' | 'blue';

export interface TagProps extends Omit<ComponentPropsWithoutRef<'span'>, 'color'> {
  /**
   * Colour palette.
   *   'neutral' — gray  (Figma: Secondary)   default bg Neutral/200, hover Neutral/300
   *   'blue'    — blue  (Figma: Primary)      default bg Secondary/300, hover Secondary/400
   * Defaults to 'neutral'.
   */
  color?: TagColor;
  /**
   * When provided the tag renders a dismiss × button.
   * Corresponds to Figma's "Focus" state.
   * Called when the user clicks the × icon.
   */
  onDismiss?: () => void;
  /** Accessible label for the dismiss button; defaults to "Remove tag". */
  dismissLabel?: string;
}

// ─── Style lookup tables ──────────────────────────────────────────────────────
//
// Complete static strings so Tailwind's content scanner detects every class.

const BASE_CLASSES =
  'inline-flex items-center gap-[var(--space-2)] ' +
  'px-[var(--space-3)] py-[var(--space-0-5)] ' +
  'rounded-[var(--radius-input)] ' +
  'font-[family-name:var(--font-body)] font-medium ' +
  'text-[length:var(--font-size-body2)] leading-[var(--space-6)] ' +
  'tracking-[var(--letter-spacing-body2)] ' +
  'text-[var(--color-neutral-700)] ' +
  'whitespace-nowrap select-none transition-colors duration-150';

/**
 * Background colours per colour variant.
 *
 * Figma values (confirmed from get_design_context):
 *   neutral default → Neutral/200 #edeff1
 *   neutral hover   → Neutral/300 #dee2e6
 *   blue    default → Secondary/300 (Blue/300) #eaf3fc
 *   blue    hover   → Secondary/400 (Blue/400) #acd6fb
 *
 * Note: Figma's "Focus" (dismissible) state uses the same background as
 * Default for blue and the same background as Hover for neutral. Since the
 * close button is structurally present (controlled by `onDismiss`), the
 * background transition is handled naturally by CSS hover without special-casing.
 */
const COLOR_CLASSES: Record<TagColor, string> = {
  neutral:
    'bg-[var(--color-neutral-200)] hover:bg-[var(--color-neutral-300)]',
  blue:
    'bg-[var(--color-secondary-300)] hover:bg-[var(--color-secondary-400)]',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function Tag({
  color = 'neutral',
  onDismiss,
  dismissLabel = 'Remove tag',
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      className={[BASE_CLASSES, COLOR_CLASSES[color], className]
        .filter(Boolean)
        .join(' ')}
      style={{ fontVariationSettings: "'opsz' 14" }}
      {...rest}
    >
      {children}

      {onDismiss && (
        /*
         * group on the button so <CloseIcon> responds to the button's hover state.
         * close_tags.svg has hardcoded stroke="#ADB5BD"; brightness(0) first normalises
         * it to black, then --filter-icon-close-default → ~Neutral/700 (#495057).
         * On hover --filter-icon-close-hover keeps it at full black (#000000).
         * Source: Figma Icons section — Close icon Default / hover states (node 493:1041)
         */
        <button
          type="button"
          aria-label={dismissLabel}
          onClick={onDismiss}
          className={
            'group inline-flex items-center justify-center ' +
            'size-[var(--space-3)] ' +
            'rounded-[var(--radius-input)] ' +
            'cursor-pointer ' +
            'focus-visible:outline-2 focus-visible:outline-offset-1 ' +
            'focus-visible:outline-[var(--color-neutral-700)]'
          }
        >
          <CloseIcon
            aria-hidden="true"
            className={
              'size-full ' +
              '[filter:var(--filter-icon-close-default)] ' +
              'group-hover:[filter:var(--filter-icon-close-hover)] ' +
              'transition-[filter] duration-150'
            }
          />
        </button>
      )}
    </span>
  );
}
