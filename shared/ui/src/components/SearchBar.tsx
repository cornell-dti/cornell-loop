/**
 * SearchBar — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Search Bar (node 389:124)
 * Input variants: node 389:169 (Blank) and node 390:192 (with input)
 *
 * Figma exposes one structural prop on the component:
 *   property1: "Blank" | "with input"
 *
 * In this implementation that maps directly to whether the input is empty or has a value:
 *   • Empty input  → "Blank"       — search icon + placeholder, no clear button
 *   • Non-empty    → "with input"  — search icon + value, clear (×) button visible
 *
 * Both controlled and uncontrolled usage are supported (value / defaultValue pattern).
 * Hover and focus states are CSS-only (no extra props required).
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react';

// Note: the file is search_icon.svg (not search.svg).
import SearchIcon      from '../assets/search_icon.svg?react';
import CloseSearchIcon from '../assets/close_search.svg?react';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SearchBarProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'defaultValue'> {
  /** Controlled value. Omit for uncontrolled usage (pair with `defaultValue`). */
  value?: string;
  /** Initial value for uncontrolled usage. */
  defaultValue?: string;
  /** Called with the new string value on every change. */
  onChange?: (value: string) => void;
  /** Called when the user clicks the × clear button. */
  onClear?: () => void;
  /** Input placeholder. Defaults to "Search". */
  placeholder?: string;
  /** Extra classes applied to the outer wrapper. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchBar({
  value,
  defaultValue = '',
  onChange,
  onClear,
  placeholder = 'Search',
  className,
  disabled,
  ...rest
}: SearchBarProps) {
  const isControlled = value !== undefined;
  const [localValue, setLocalValue] = useState<string>(defaultValue);
  const displayValue = isControlled ? value : localValue;
  const hasValue = (displayValue ?? '').length > 0;

  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setLocalValue(e.target.value);
      onChange?.(e.target.value);
    },
    [isControlled, onChange],
  );

  const handleClear = useCallback(() => {
    if (!isControlled) setLocalValue('');
    onChange?.('');
    onClear?.();
    inputRef.current?.focus();
  }, [isControlled, onChange, onClear]);

  return (
    /*
     * Wrapper — Figma: bg white, Neutral/300 border, radius 16px, px 16px, py 8px
     * focus-within: promotes a visible ring when the inner <input> is focused.
     */
    <div
      className={[
        // Layout & shape
        'flex items-center justify-between',
        'gap-[var(--space-3)]',
        'px-[var(--space-4)] py-[var(--space-2)]',
        'rounded-[var(--radius-card)]',
        // Colours
        'bg-[var(--color-surface)]',
        'border border-[var(--color-border)]',
        // Focus ring (accessibility — not shown in Figma but required for keyboard nav)
        'focus-within:outline-2 focus-within:outline-offset-0',
        'focus-within:outline-[var(--color-primary-700)]',
        // Disabled
        disabled
          ? 'opacity-[var(--opacity-40)] cursor-not-allowed'
          : 'cursor-text',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      // Forward click on the outer div to the hidden input for UX convenience
      onClick={() => !disabled && inputRef.current?.focus()}
    >
      {/* ── Left: search icon + input field ── */}
      <div className="flex items-center gap-[var(--space-3)] min-w-0 flex-1">
        {/*
         * Search icon — search_icon.svg uses stroke="#495057" (Neutral/700) natively,
         * so no filter needed. className goes directly to the <svg> via SVGR.
         */}
        <SearchIcon
          aria-hidden="true"
          className="shrink-0 size-[var(--space-4)]"
        />

        {/*
         * Native <input> — replaces the <p> placeholder in the Figma snapshot.
         * Typography: DM Sans Regular, 14px, 20.2px line-height, −0.5px tracking,
         *             Neutral/700 text colour.
         */}
        <input
          ref={inputRef}
          type="search"
          role="searchbox"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={[
            'min-w-0 flex-1 bg-transparent border-none outline-none',
            'font-[family-name:var(--font-body)] font-normal',
            'text-[var(--font-size-body2)] leading-[var(--line-height-body2)]',
            'tracking-[var(--letter-spacing-body2)]',
            'text-[var(--color-neutral-700)]',
            'placeholder:text-[var(--color-neutral-700)]',
            disabled ? 'cursor-not-allowed pointer-events-none' : '',
            // Remove browser's built-in search-cancel button (we provide our own)
            '[&::-webkit-search-cancel-button]:hidden',
            '[&::-webkit-search-decoration]:hidden',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ fontVariationSettings: "'opsz' 14" }}
          {...rest}
        />
      </div>

      {/*
       * Clear button — visible only when the input has a value (Figma "with input" state).
       * group on the button lets <CloseSearchIcon> respond to the button's hover.
       * close_search.svg uses stroke="black"; brightness(0) on a black stroke is a no-op
       * in the hover state, but --filter-icon-close-default shifts it to ~Neutral/700 (#495057)
       * in the default state.
       * Source: Figma Icons section — Close icon Default / hover states (node 493:1041)
       */}
      <button
        type="button"
        aria-label="Clear search"
        onClick={handleClear}
        tabIndex={hasValue ? 0 : -1}
        className={[
          'group shrink-0 flex items-center justify-center',
          'size-[var(--space-4)]',
          'rounded-[var(--radius-input)]',
          'cursor-pointer',
          'transition-opacity duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-1',
          'focus-visible:outline-[var(--color-primary-700)]',
          hasValue
            ? 'opacity-[var(--opacity-100)] pointer-events-auto'
            : 'opacity-0 pointer-events-none',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <CloseSearchIcon
          aria-hidden="true"
          className={
            'size-full ' +
            '[filter:var(--filter-icon-close-default)] ' +
            'group-hover:[filter:var(--filter-icon-close-hover)] ' +
            'transition-[filter] duration-150'
          }
        />
      </button>
    </div>
  );
}
