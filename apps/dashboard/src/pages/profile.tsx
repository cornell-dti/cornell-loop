/**
 * Profile — Loop Dashboard Popup
 *
 * Source: Figma "Incubator-design-file" › node 350:504 "Input"
 *
 * A centred modal card for collecting initial user profile information:
 *   • Greeting — "Hi {name}!" centred at the top
 *   • Major field — styled dropdown trigger (flex-1)
 *   • Grad Year field — styled dropdown trigger (shrink-0, content-width)
 *   • Minor field — optional, styled dropdown trigger (full-width)
 *   • Interests — editable neutral tag list with an "add" (+) trigger
 *   • Close button (×) — absolutely positioned in the top-right corner
 *
 * This component renders only the card itself.  The caller is responsible for
 * the backdrop overlay and centring, e.g.:
 *
 *   <div className="fixed inset-0 flex items-center justify-center
 *                   bg-black/20 z-50">
 *     <Profile ... />
 *   </div>
 *
 * Select-like fields: Figma shows pill inputs with a chevron-down icon.
 * Each field exposes an `onClick` callback so the caller can mount a native
 * <select>, sheet, or popover; the card itself is display-only for the value.
 *
 * Card shadow: Figma specifies 0px 0px 6.5px 0px rgba(149,149,149,0.25) —
 * used directly as there is no matching token in tokens.css.
 *
 * Greeting / field-label font size: Figma 22 px — used directly (1.375 rem)
 * as no token covers this exact value, matching the Org.tsx precedent.
 *
 * Field label colour: Figma #949494 — approximated with --color-text-muted
 * (--color-neutral-500 #adb5bd), the closest available muted-text token.
 *
 * All other colours, spacing, and font values reference CSS custom properties
 * from src/styles/tokens.css — nothing else is hardcoded.
 */

import type { ComponentPropsWithoutRef } from 'react';
import { Tag } from '@app/ui';

// ─── Inline icon helpers ──────────────────────────────────────────────────────
// ChevronDownIcon and XIcon are not in shared/ui/src/assets; defined inline.

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

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <line x1={3} y1={3} x2={13} y2={13} />
      <line x1={13} y1={3} x2={3} y2={13} />
    </svg>
  );
}

// ─── Shared typography class strings ─────────────────────────────────────────

const BODY2_REGULAR =
  'font-[family-name:var(--font-body)] font-normal ' +
  'text-[var(--font-size-body2)] leading-[var(--line-height-body2)] ' +
  'tracking-[var(--letter-spacing-body2)]';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ProfileProps extends ComponentPropsWithoutRef<'div'> {
  /** First name shown in the greeting, e.g. "Megan" → "Hi Megan!". */
  userName?: string;

  // ── Major ──
  major?: string;
  /** Called when the Major field is clicked so the caller can show a picker. */
  onMajorChange?: () => void;

  // ── Grad Year ──
  gradYear?: string;
  /** Called when the Grad Year field is clicked so the caller can show a picker. */
  onGradYearChange?: () => void;

  // ── Minor ──
  minor?: string;
  /** Called when the Minor field is clicked so the caller can show a picker. */
  onMinorChange?: () => void;

  // ── Interests ──
  /** Tag labels currently selected, e.g. ["Internships", "Early Career", "Tech"]. */
  interests?: string[];
  /** Called when the "+" add-interest chip is clicked. */
  onAddInterest?: () => void;

  // ── Dialog ──
  /** Called when the × close button is clicked. */
  onClose?: () => void;
}

// ─── ProfileSelectField ───────────────────────────────────────────────────────

/**
 * A labelled select-like trigger.
 * Renders a muted text label above a pill-shaped button that shows the current
 * value and a chevron-down icon. Clicking calls `onClick`.
 *
 * Figma: bg white, Neutral/300 border, rounded-[16px], px-16, py-8,
 *        body-2 regular, Neutral/700 text, 24 × 24 chevron icon.
 */
function ProfileSelectField({
  label,
  value,
  placeholder,
  onClick,
  className,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      className={[
        'flex flex-col gap-[var(--space-2)] items-start',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Field label — Figma: Regular 16 px, #949494 ≈ --color-text-muted */}
      <span
        className={BODY2_REGULAR + ' text-[var(--color-text-muted)] whitespace-nowrap'}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {label}
      </span>

      {/* Trigger button — bg white, Neutral/300 border, rounded-card */}
      <button
        type="button"
        onClick={onClick}
        className={[
          'flex items-center justify-between w-full',
          'px-[var(--space-4)] py-[var(--space-2)]',
          'rounded-[var(--radius-card)]',
          'bg-[var(--color-surface)]',
          'border border-[var(--color-border)]',
          BODY2_REGULAR,
          'text-[var(--color-neutral-700)]',
          'cursor-pointer whitespace-nowrap',
          'hover:bg-[var(--color-surface-subtle)]',
          'transition-colors duration-150',
        ].join(' ')}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        <span>{value ?? placeholder ?? ''}</span>
        <ChevronDownIcon className="size-[var(--space-6)] shrink-0 text-[var(--color-neutral-700)]" />
      </button>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

/**
 * Profile popup card layout:
 *
 *   ┌──────────────────────────────────────┐
 *   │                                    × │  ← close button (absolute, top-right)
 *   │           Hi {userName}!             │  ← greeting, centred
 *   │                                      │
 *   │  Major ──────────────── Grad Year    │  ← side-by-side, major flex-1
 *   │  [ Computer Science      ▾ ]  [2026▾]│
 *   │                                      │
 *   │  Minor (optional)                    │
 *   │  [ Linguistics              ▾ ]      │
 *   │                                      │
 *   │  Interests                           │
 *   │  [Internships] [Early Career] [Tech] │
 *   │  [+]                                 │
 *   └──────────────────────────────────────┘
 */
export function Profile({
  userName = 'Megan',
  major,
  onMajorChange,
  gradYear,
  onGradYearChange,
  minor,
  onMinorChange,
  interests = [],
  onAddInterest,
  onClose,
  className,
  ...rest
}: ProfileProps) {
  return (
    <div
      className={[
        /*
         * Figma (node 350:504): w-518px, bg white, rounded-[16px], px-24 py-32,
         * gap-24, shadow 0px 0px 6.5px 0px rgba(149,149,149,0.25).
         * The gap-24 separates the one flow child (form section) from any siblings;
         * since the close button is absolute it does not participate in flex layout.
         */
        'relative flex flex-col gap-[var(--space-6)] items-center',
        'w-[32.375rem]',           /* 518 px — no layout token covers this value */
        'px-[var(--space-6)] py-[var(--space-8)]',
        'rounded-[var(--radius-card)]',
        'bg-[var(--color-surface)]',
        /* Figma shadow — no matching token in tokens.css */
        'shadow-[0px_0px_6.5px_0px_rgba(149,149,149,0.25)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label="Profile setup"
      {...rest}
    >
      {/*
       * Close button — absolutely positioned top-right.
       * Figma (node 350:513): pr-16 pt-16, icon 16 × 16 px.
       */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={[
          'absolute top-[var(--space-4)] right-[var(--space-4)]',
          'flex items-center justify-center',
          'size-[var(--space-4)]',
          'text-[var(--color-neutral-700)]',
          'cursor-pointer',
          'hover:text-[var(--color-neutral-900)]',
          'transition-colors duration-150',
        ].join(' ')}
      >
        <XIcon className="size-full" />
      </button>

      {/* ── Form fields (node 350:528) — gap-16 between each field group ── */}
      <div className="flex flex-col gap-[var(--space-4)] items-start w-full">

        {/*
         * Greeting — Figma: Inter SemiBold 22 px, #5f5f5f ≈ --color-neutral-700,
         * centred within a full-width row.
         * 22 px (1.375 rem) is used directly; no token covers this exact size.
         */}
        <div className="flex flex-col items-center w-full">
          <h2
            className={
              'font-[family-name:var(--font-body)] font-semibold ' +
              'text-[1.375rem] leading-[1.5] ' +
              'tracking-[var(--letter-spacing-body1)] ' +
              'text-[var(--color-neutral-700)] whitespace-nowrap'
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Hi {userName}!
          </h2>
        </div>

        {/*
         * Major + Grad Year row — Figma (node 350:816): flex gap-16 items-start.
         * Major uses flex-1 (stretches); Grad Year uses shrink-0 (content-width).
         */}
        <div className="flex gap-[var(--space-4)] items-start w-full">
          <ProfileSelectField
            label="Major"
            value={major}
            placeholder="Select major"
            onClick={onMajorChange}
            className="flex-1 min-w-0"
          />
          <ProfileSelectField
            label="Grad Year"
            value={gradYear}
            placeholder="Year"
            onClick={onGradYearChange}
            className="shrink-0"
          />
        </div>

        {/* Minor row — Figma (node 350:823): flex items-start, field flex-1 */}
        <div className="flex items-start w-full">
          <ProfileSelectField
            label="Minor (optional)"
            value={minor}
            placeholder="Select minor"
            onClick={onMinorChange}
            className="flex-1 min-w-0"
          />
        </div>

        {/* Interests — Figma (node 350:544): flex-col gap-8, label + tag chips */}
        <div className="flex flex-col gap-[var(--space-2)] items-start w-full">
          {/* Label — same muted style as field labels */}
          <span
            className={BODY2_REGULAR + ' text-[var(--color-text-muted)] whitespace-nowrap'}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Interests
          </span>

          {/*
           * Tag chips — Figma (node 350:804): flex gap-8 items-start.
           * Each selected interest is a neutral Tag. The "+" chip at the end
           * triggers onAddInterest; its radius in Figma is rounded-[8px] which
           * matches the Tag component's --radius-input (8px) default.
           */}
          <div className="flex flex-wrap gap-[var(--space-2)] items-start">
            {interests.map((interest) => (
              <Tag key={interest} color="neutral">
                {interest}
              </Tag>
            ))}

            <Tag
              color="neutral"
              onClick={() => onAddInterest?.()}
              className="cursor-pointer"
            >
              +
            </Tag>
          </div>
        </div>
      </div>
    </div>
  );
}
