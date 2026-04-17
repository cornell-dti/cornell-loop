/**
 * SearchHeader — Extension panel header
 *
 * Two variants matching the Figma designs:
 *
 *  'main'   (node 528:4032) — default view header
 *           Logo + Close | SearchBar | Toggle (Feed / Bookmarks)
 *
 *  'search' (node 554:7828) — active search / original-email view header
 *           Logo + Close | [← back] SearchBar   (no toggle)
 */

import type { ComponentPropsWithoutRef } from 'react'
import { SearchBar, Toggle, LoopLogo } from '@app/ui'
import CloseIcon      from '@app/ui/assets/close_search.svg?react'
import ChevronBackIcon from '@app/ui/assets/chevron-back.svg?react'

// ── Public types ───────────────────────────────────────────────────────────

export type SearchHeaderVariant = 'main' | 'search'

export interface SearchHeaderProps
  extends Omit<ComponentPropsWithoutRef<'div'>, 'onChange'> {
  /**
   * Layout variant:
   *   'main'   → SearchBar + Feed/Bookmarks Toggle below logo row
   *   'search' → Back chevron + SearchBar below logo row (no toggle)
   * Defaults to 'main'.
   */
  variant?: SearchHeaderVariant

  /** Called when the × close button is clicked. */
  onClose?: () => void

  /** Controlled search query string. */
  searchQuery?: string
  /** Called with the new value whenever the search input changes. */
  onSearchChange?: (value: string) => void
  /** Called when the × clear button inside the search bar is clicked. */
  onSearchClear?: () => void
  /** Called when the search input receives focus (used to switch to search view). */
  onSearchFocus?: () => void

  /**
   * Called when the ‹ back chevron is clicked.
   * Only relevant in the 'search' variant.
   */
  onBack?: () => void

  /**
   * Currently active toggle tab value ('feed' | 'bookmarks').
   * Only relevant in the 'main' variant. Defaults to 'feed'.
   */
  activeTab?: string
  /**
   * Called with the new tab value when a toggle option is selected.
   * Only relevant in the 'main' variant.
   */
  onTabChange?: (tab: string) => void
}

// ── Constants ──────────────────────────────────────────────────────────────

const TOGGLE_OPTIONS = [
  { value: 'feed',      label: 'Feed' },
  { value: 'bookmarks', label: 'Bookmarks' },
]

// Shared icon-button wrapper — 25.6 px hit target, subtle hover bg
const ICON_BTN =
  'shrink-0 flex items-center justify-center ' +
  'size-[var(--space-6)] rounded-[var(--radius-input)] cursor-pointer ' +
  'hover:bg-[var(--color-surface-subtle)] transition-colors duration-150 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 ' +
  'focus-visible:outline-[var(--color-primary-700)]'

// ── Component ──────────────────────────────────────────────────────────────

export function SearchHeader({
  variant = 'main',
  onClose,
  searchQuery = '',
  onSearchChange,
  onSearchClear,
  onSearchFocus,
  onBack,
  activeTab = 'feed',
  onTabChange,
  className,
  ...rest
}: SearchHeaderProps) {
  return (
    <div
      className={[
        'flex flex-col gap-[var(--space-3)] w-full shrink-0',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {/* ── Logo row: wordmark left, close right ── */}
      <div className="flex items-center justify-between w-full">
        {/* size="sm": 24px mark + 32px "Loop" wordmark — matches Figma panel header */}
        <LoopLogo variant="wordmark" size="sm" />

        <button
          type="button"
          aria-label="Close panel"
          onClick={onClose}
          className={ICON_BTN}
        >
          {/*
           * close_search.svg — recoloured via --filter-icon-close-default to
           * ~Neutral/700 (#495057); darkens to black on hover.
           */}
          <CloseIcon
            aria-hidden="true"
            className={
              'size-full ' +
              '[filter:var(--filter-icon-close-default)] ' +
              'hover:[filter:var(--filter-icon-close-hover)] ' +
              'transition-[filter] duration-150'
            }
          />
        </button>
      </div>

      {/* ── Search row ── */}
      {variant === 'main' ? (
        /* Main variant: search bar spans full width */
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          onClear={onSearchClear}
          onFocus={onSearchFocus}
          className="w-full"
        />
      ) : (
        /* Search variant: back chevron + search bar (flex-1).
           Figma gap between chevron and input: 4px (--space-1) */
        <div className="flex items-center gap-[var(--space-1)] w-full">
          <button
            type="button"
            aria-label="Go back"
            onClick={onBack}
            className={ICON_BTN}
          >
            {/*
             * chevron-back.svg — normalised to ~Neutral/900 via --filter-icon-nav
             * so it reads as a dark navigation arrow.
             */}
            <ChevronBackIcon
              aria-hidden="true"
              className="size-full [filter:var(--filter-icon-nav)] transition-[filter] duration-150"
            />
          </button>

          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            onClear={onSearchClear}
            autoFocus
            className="flex-1"
          />
        </div>
      )}

      {/* ── Toggle (main variant only) ── */}
      {variant === 'main' && (
        <Toggle
          options={TOGGLE_OPTIONS}
          value={activeTab}
          onChange={onTabChange ?? (() => {})}
          size="compact"
          className="w-full"
        />
      )}
    </div>
  )
}

export default SearchHeader
