/**
 * Button — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Buttons (node 381:1681)
 *
 * Variants:
 *   primary   — filled brand orange (Primary/700); default → hover → press → disabled
 *   secondary — outlined; white bg with Neutral/300 border; default → hover → press → disabled
 *
 * Sizes:
 *   sm  — compact; px 16px, py 6px, body-2 Regular
 *   md  — standard; px 16px, py 6px, body-2 SemiBold
 *   cta — full-width call-to-action; px 16px, py 8px, body-2 SemiBold (Figma node 390:793)
 *
 * Border-radius: --radius-button (16px) — from Figma `rounded-[16px]` on all button states.
 *
 * All colours, spacing, and font values reference CSS custom properties
 * from src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef } from "react";

// ─── Public types ────────────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "sm" | "md" | "cta";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** Visual hierarchy level. Defaults to 'primary'. */
  variant?: ButtonVariant;
  /**
   * Size preset:
   *   sm  — compact pill (py 6px), body-2 Regular     — Figma Primary/Small
   *   md  — standard  (py 6px), body-2 SemiBold       — standard interactive button
   *   cta — full-width CTA (py 8px), body-2 SemiBold  — Figma CTA Buttons (node 390:793)
   */
  size?: ButtonSize;
}

// ─── Style lookup tables ─────────────────────────────────────────────────────
//
// Each entry must be a complete, static string so Tailwind's content scanner
// can detect every class at build time — do not build these strings dynamically.

const BASE_CLASSES =
  "inline-flex items-center justify-center gap-[var(--space-2)] " +
  "font-[family-name:var(--font-body)] rounded-[var(--radius-button)] " +
  "whitespace-nowrap select-none cursor-pointer " +
  "transition-[background-color,box-shadow,color] duration-150 ease-in-out " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:pointer-events-none";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  /**
   * Primary — filled brand orange.
   * Default  → Primary/700 (#eb7128)
   * Hover    → Primary/hover (#d35910) + glow ring
   * Press    → Primary/800 (#a74409) + glow ring
   * Disabled → Neutral/500 (#adb5bd)
   * Source: Figma Frame95 (node 382:822) and Frame94 CTA (node 390:793)
   */
  primary:
    "bg-[var(--color-primary-700)] text-[color:var(--color-white)] " +
    "hover:bg-[var(--color-primary-hover)] hover:shadow-[var(--shadow-primary-glow)] " +
    "active:bg-[var(--color-primary-800)] active:shadow-[var(--shadow-primary-glow)] " +
    "focus-visible:outline-[var(--color-primary-700)] " +
    "disabled:bg-[var(--color-neutral-500)] disabled:shadow-none",

  /**
   * Secondary — outlined.
   * Default  → white bg, Neutral/300 border, black text, font-normal
   * Hover    → Neutral/100 bg (surface-subtle)
   * Press    → Neutral/300 bg (fills with border colour)
   * Disabled → Neutral/500 bg, Neutral/700 border + text
   * Source: Figma Frame93 (node 383:415)
   */
  secondary:
    "bg-[var(--color-surface)] border border-[var(--color-border)] text-[color:var(--color-black)] " +
    "hover:bg-[var(--color-surface-subtle)] " +
    "active:bg-[var(--color-border)] " +
    "focus-visible:outline-[var(--color-neutral-900)] " +
    "disabled:bg-[var(--color-neutral-500)] disabled:border-[var(--color-neutral-700)] disabled:text-[color:var(--color-neutral-700)]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  /**
   * sm — Figma Primary/Small (Frame95, node 382:822).
   * px 16px, py 6px, body-2 Regular.
   */
  sm:
    "px-[var(--space-4)] py-[var(--space-1-5)] " +
    "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
    "tracking-[var(--letter-spacing-body2)] font-normal",

  /**
   * md — standard interactive size; same padding as sm, SemiBold weight.
   */
  md:
    "px-[var(--space-4)] py-[var(--space-1-5)] " +
    "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
    "tracking-[var(--letter-spacing-body2)] font-semibold",

  /**
   * cta — Figma CTA Buttons (Frame94, node 390:793).
   * Full-width, py 8px, body-2 SemiBold.
   */
  cta:
    "w-full px-[var(--space-4)] py-[var(--space-2)] " +
    "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
    "tracking-[var(--letter-spacing-body2)] font-semibold",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={[
        BASE_CLASSES,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ fontVariationSettings: "'opsz' 14" }}
      {...rest}
    >
      {children}
    </button>
  );
}
