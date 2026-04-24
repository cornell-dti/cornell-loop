/**
 * Dropdown — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Dropdown
 *
 * A pill-shaped dropdown selector with a chevron indicator.
 * Click the trigger to toggle the options menu; click an option to select it.
 * Clicking outside the component closes the menu.
 *
 * States:
 *   closed — pill trigger with placeholder/selected text and ChevronDown icon
 *   open   — same trigger with chevron rotated 180°, plus options menu below
 *
 * This is always a controlled component — supply `value` and `onChange`.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown } from "lucide-react";

// ─── Public types ────────────────────────────────────────────────────────────

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  /** The currently selected value (empty string = no selection). */
  value: string;
  /** Called when the user picks an option. */
  onChange: (value: string) => void;
  /** Options to display in the menu. Strings are normalised to { value, label }. */
  options: Array<DropdownOption | string>;
  /** Text shown when no value is selected. Defaults to "Select…". */
  placeholder?: string;
  /** Additional CSS classes applied to the outermost wrapper. */
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeOption(opt: DropdownOption | string): DropdownOption {
  if (typeof opt === "string") return { value: opt, label: opt };
  return opt;
}

// ─── Style constants ─────────────────────────────────────────────────────────
//
// Each entry must be a complete, static string so Tailwind's content scanner
// can detect every class at build time — do not build these strings dynamically.

const TRIGGER_CLASSES =
  "inline-flex w-full items-center justify-between " +
  "bg-[var(--color-surface)] border border-[var(--color-border)] " +
  "rounded-[var(--radius-button)] " +
  "px-[var(--space-4)] py-[var(--space-1-5)] " +
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)] " +
  "text-[color:var(--color-black)] " +
  "transition-colors duration-150 " +
  "hover:bg-[var(--color-surface-subtle)] " +
  "cursor-pointer select-none";

const MENU_CLASSES =
  "absolute left-0 right-0 top-[calc(100%+var(--space-3))] z-10 " +
  "flex flex-col gap-[var(--space-2)] " +
  "bg-[var(--color-surface)] border border-[var(--color-border)] " +
  "rounded-[var(--radius-button)] " +
  "px-[var(--space-4)] py-[var(--space-3)]";

const OPTION_CLASSES =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)] " +
  "text-[color:var(--color-black)] " +
  "rounded-[var(--radius-input)] " +
  "px-[var(--space-2)] py-[var(--space-1)] " +
  "-mx-[var(--space-2)] " +
  "hover:bg-[var(--color-surface-subtle)] " +
  "transition-colors duration-150 " +
  "cursor-pointer select-none";

const CHEVRON_BASE_CLASSES =
  "transition-transform duration-150 ease-in-out shrink-0";

const CHEVRON_OPEN_CLASSES =
  "transition-transform duration-150 ease-in-out shrink-0 rotate-180";

// ─── Component ───────────────────────────────────────────────────────────────

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select\u2026",
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (
      containerRef.current &&
      !containerRef.current.contains(e.target as Node)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open, handleOutsideClick]);

  const normalized = options.map(normalizeOption);
  const selectedOption = normalized.find((o) => o.value === value);
  const displayText = selectedOption ? selectedOption.label : placeholder;

  return (
    <div
      ref={containerRef}
      className={["relative inline-flex flex-col", className]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Trigger */}
      <button
        type="button"
        className={TRIGGER_CLASSES}
        style={{ fontVariationSettings: "'opsz' 14" }}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span
          className={
            selectedOption ? undefined : "text-[color:var(--color-neutral-700)]"
          }
        >
          {displayText}
        </span>
        <ChevronDown
          size={16}
          className={open ? CHEVRON_OPEN_CLASSES : CHEVRON_BASE_CLASSES}
        />
      </button>

      {/* Menu */}
      {open && (
        <div className={MENU_CLASSES} role="listbox">
          {normalized.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={OPTION_CLASSES}
              style={{ fontVariationSettings: "'opsz' 14" }}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(opt.value);
                  setOpen(false);
                }
              }}
              tabIndex={0}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
