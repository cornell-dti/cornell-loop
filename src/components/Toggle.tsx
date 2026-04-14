/**
 * Toggle — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Buttons › Toggle (node 381:1685)
 *
 * A segmented pill control where exactly one option is active at a time.
 * Used for switching between top-level views (e.g. "Feed" / "Bookmarks").
 *
 * Two size variants (from Figma):
 *   compact — Figma "Extension" toggle (node 382:519)
 *             gap 8px between options, py 8px per option — more touch-friendly
 *   default — Figma "Desktop" toggle  (node 382:544)
 *             gap 32px between options, py 6px per option — wider horizontal layout
 *
 * Active tab:   Primary/700 bg, Shadow 1, --radius-button (16px), white SemiBold text
 * Inactive tab: transparent bg, --color-text-secondary, rounded-full (pill ends)
 *
 * This is always a controlled component — supply `value` and `onChange`.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef } from "react";

// ─── Public types ─────────────────────────────────────────────────────────────

export type ToggleSize = "compact" | "default";

export interface ToggleOption {
  /** The value identifier for this option. */
  value: string;
  /** Display label rendered inside the tab. */
  label: string;
}

export interface ToggleProps extends Omit<
  ComponentPropsWithoutRef<"div">,
  "onChange"
> {
  /**
   * Ordered list of options to render as tabs.
   * Accepts either plain strings (used as both value and label)
   * or explicit { value, label } objects.
   */
  options: (string | ToggleOption)[];
  /** Currently active value (controlled). */
  value: string;
  /** Called with the new value when a tab is clicked. */
  onChange: (value: string) => void;
  /**
   * Size variant:
   *   compact — Figma "Extension" toggle: gap 8px, py 8px per option
   *   default — Figma "Desktop" toggle:   gap 32px, py 6px per option
   * Defaults to 'default'.
   */
  size?: ToggleSize;
}

// ─── Style constants ──────────────────────────────────────────────────────────

const CONTAINER_BASE =
  "inline-flex items-center " +
  "p-[var(--space-1-5)] " +
  "bg-[var(--color-surface)] " +
  "border border-[var(--color-border)] " +
  "rounded-[var(--radius-toggle)]";

const CONTAINER_SIZE: Record<ToggleSize, string> = {
  compact: "gap-[var(--space-2)]" /* 8px  — Figma Extension toggle */,
  default: "gap-[var(--space-8)]" /* 32px — Figma Desktop  toggle  */,
};

const OPTION_BASE =
  "flex-1 flex items-center justify-center " +
  "px-[var(--space-5)] " +
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)] " +
  "whitespace-nowrap select-none cursor-pointer " +
  "transition-all duration-150";

const OPTION_SIZE_PY: Record<ToggleSize, string> = {
  compact: "py-[var(--space-2)]" /* 8px  — Figma Extension */,
  default: "py-[var(--space-1-5)]" /* 6px  — Figma Desktop  */,
};

const OPTION_ACTIVE =
  "rounded-[var(--radius-button)] " +
  "bg-[var(--color-primary-700)] " +
  "text-[color:var(--color-white)] " +
  "shadow-[var(--shadow-1)]";

const OPTION_INACTIVE =
  "rounded-full " +
  "text-[color:var(--color-text-secondary)] " +
  "hover:text-[color:var(--color-text-default)]";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalise(opt: string | ToggleOption): ToggleOption {
  return typeof opt === "string" ? { value: opt, label: opt } : opt;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Toggle({
  options,
  value,
  onChange,
  size = "default",
  className,
  ...rest
}: ToggleProps) {
  const normalised = options.map(normalise);

  return (
    <div
      role="tablist"
      className={[CONTAINER_BASE, CONTAINER_SIZE[size], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {normalised.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={[
              OPTION_BASE,
              OPTION_SIZE_PY[size],
              isActive ? OPTION_ACTIVE : OPTION_INACTIVE,
            ].join(" ")}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
