/**
 * Tag — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Tags (node 385:205)
 * Tag frame: node 385:211
 *
 * Figma exposes two props on the component:
 *   secondary: "Secondary" (neutral/gray palette) | "Primary" (blue palette)
 *   state:     "Default" | "Focus"
 *
 * In this implementation:
 *   • `color`     maps to Figma's `secondary` — renamed for clarity
 *                   'neutral' = Figma "Secondary"  (Neutral/200)
 *                   'blue'    = Figma "Primary"    (Secondary/300)
 *   • `onDismiss` maps to Figma's "Focus" state — this state shows a × dismiss button.
 *                 Pass a handler to render the dismiss icon; omit it for a plain tag.
 *   • Tags are non-interactive (no hover state).
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef } from "react";
import CloseIcon from "../assets/close_tags.svg?react";

// ─── Public types ────────────────────────────────────────────────────────────

export type TagColor = "neutral" | "blue";

export interface TagProps extends Omit<
  ComponentPropsWithoutRef<"span">,
  "color"
> {
  /**
   * Colour palette.
   *   'neutral' — gray  (Figma: Secondary)   bg Neutral/200
   *   'blue'    — blue  (Figma: Primary)      bg Secondary/300
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
  "inline-flex items-center gap-[var(--space-2)] " +
  "px-[var(--space-3)] py-[var(--space-0-5)] " +
  "rounded-[var(--radius-input)] " +
  "font-[family-name:var(--font-body)] font-medium " +
  "text-[length:var(--font-size-body2)] leading-[var(--space-6)] " +
  "tracking-[var(--letter-spacing-body2)] " +
  "text-[color:var(--color-neutral-700)] " +
  "whitespace-nowrap select-none transition-colors duration-150";

/**
 * Background colours per colour variant.
 *
 * Figma values (confirmed from get_design_context node 515:3339):
 *   neutral → Neutral/300 #dee2e6
 *   blue    → Secondary/400 (Blue/400) #acd6fb
 *
 * Tags are non-interactive so no hover styles are applied.
 */
const COLOR_CLASSES: Record<TagColor, string> = {
  neutral: "bg-[var(--color-neutral-300)]",
  blue: "bg-[var(--color-secondary-400)]",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function Tag({
  color = "neutral",
  onDismiss,
  dismissLabel = "Remove tag",
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      className={[BASE_CLASSES, COLOR_CLASSES[color], className]
        .filter(Boolean)
        .join(" ")}
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
            "group inline-flex items-center justify-center " +
            "-mr-[var(--space-1-5)] size-[var(--space-6)] " +
            "rounded-[var(--radius-input)] " +
            "cursor-pointer " +
            "focus-visible:outline-2 focus-visible:outline-offset-1 " +
            "focus-visible:outline-[var(--color-neutral-700)]"
          }
        >
          <CloseIcon
            aria-hidden="true"
            className={
              "size-[var(--space-3)] " +
              "[filter:var(--filter-icon-close-default)] " +
              "group-hover:[filter:var(--filter-icon-close-hover)] " +
              "transition-[filter] duration-150"
            }
          />
        </button>
      )}
    </span>
  );
}
