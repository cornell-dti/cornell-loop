/**
 * SideBar — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Side bar (node 385:495)
 *
 * Structure (from Figma Frame28, node 386:693):
 *   ┌──────────────────────┐
 *   │  🔁  Loop            │  ← brand wordmark
 *   │  ───────────────     │
 *   │  🏠  Home            │
 *   │  🔖  Bookmarks       │  ← primary nav items
 *   │  ✉   Subscriptions   │
 *   │  ────────────────    │  ← divider
 *   │                      │
 *   │  👤  Profile         │  ← bottom / account nav
 *   └──────────────────────┘
 *
 * Tab states (Figma "Tabs" section, node 388:727):
 *   • Default:  transparent bg,  rounded-[16px] (--radius-card), text Neutral/900
 *   • Hover:    Neutral/100 bg,  rounded-[12px] (--space-3),    text Neutral/900
 *   • Selected: Primary/400 bg,  rounded-[12px] (--space-3),    text Primary/800, icon orange
 *
 * Icon colouring:
 *   SVG assets in src/assets/ use hardcoded stroke colours.  CSS filters defined in
 *   tokens.css (--filter-icon-nav, --filter-icon-nav-selected) normalise them to the
 *   correct colour for each state.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef, FC, SVGProps } from 'react';

// ── SVG imports — ?react suffix gives us inline React components via SVGR ────
import HomeIcon          from '../assets/home-icon.svg?react';
import BookmarkIcon      from '../assets/bookmark.svg?react';
import SubscriptionsIcon from '../assets/subscriptions-icon.svg?react';
import ProfileIcon       from '../assets/profile.svg?react';
import LoopLogo          from '../assets/loop_logo.svg?react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavItemId = 'home' | 'bookmarks' | 'subscriptions';
export type BottomItemId = 'profile';
export type SideBarItemId = NavItemId | BottomItemId;

type SvgIcon = FC<SVGProps<SVGSVGElement>>;

interface NavItemDef {
  id: NavItemId;
  label: string;
  Icon: SvgIcon;
}

const PRIMARY_NAV: NavItemDef[] = [
  { id: 'home',          label: 'Home',          Icon: HomeIcon },
  { id: 'bookmarks',     label: 'Bookmarks',     Icon: BookmarkIcon },
  { id: 'subscriptions', label: 'Subscriptions', Icon: SubscriptionsIcon },
];

export interface SideBarProps extends ComponentPropsWithoutRef<'nav'> {
  /**
   * The currently active nav item id.
   * Controls which tab renders in the "selected" state.
   */
  activeItem?: SideBarItemId;
  /** Called with the item id when any nav or profile tab is clicked. */
  onNavigate?: (id: SideBarItemId) => void;
}

// ─── SideBarTab sub-component ─────────────────────────────────────────────────

interface SideBarTabProps {
  id: SideBarItemId;
  label: string;
  Icon: SvgIcon;
  isSelected: boolean;
  /** 'compact' reduces vertical padding; used for the Profile tab (Figma: py 4px vs 6px). */
  size?: 'default' | 'compact';
  onClick: () => void;
}

function SideBarTab({ id, label, Icon, isSelected, size = 'default', onClick }: SideBarTabProps) {
  const pyClass = size === 'compact' ? 'py-[var(--space-1)]' : 'py-[var(--space-1-5)]';

  return (
    <button
      type="button"
      role="menuitem"
      aria-current={isSelected ? 'page' : undefined}
      data-nav-id={id}
      onClick={onClick}
      className={[
        /* layout */
        'flex items-center gap-[var(--space-3)] w-full',
        'px-[var(--space-3)]', pyClass,
        'cursor-pointer',
        /* base radius — overridden to --space-3 (12px) on hover and when selected */
        'rounded-[var(--radius-card)]',
        /* transitions */
        'transition-all duration-150',
        /* state-specific background + radius */
        isSelected
          ? 'bg-[var(--color-primary-400)] rounded-[var(--space-3)]'
          : 'hover:bg-[var(--color-surface-subtle)] hover:rounded-[var(--space-3)]',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/*
       * Icon: always 24 × 24 px.  className drives the CSS filter so both the
       * default (~Neutral/900) and selected (~Primary/800) colours are token-based.
       * brightness(0) normalises any hardcoded SVG stroke first; subsequent ops
       * produce the target colour.
       */}
      <Icon
        aria-hidden="true"
        className={[
          'shrink-0 size-[var(--space-6)] transition-[filter] duration-150',
          isSelected
            ? '[filter:var(--filter-icon-nav-selected)]'
            : '[filter:var(--filter-icon-nav)]',
        ].join(' ')}
      />

      {/* Label */}
      <span
        className={[
          'font-[family-name:var(--font-body)] font-medium',
          'text-[var(--font-size-body1)] leading-[var(--line-height-body1)]',
          'tracking-[var(--letter-spacing-body1)]',
          'whitespace-nowrap',
          /* Figma: selected → Primary/800 (#a74409); default → Neutral/900 */
          isSelected
            ? 'text-[var(--color-primary-800)]'
            : 'text-[var(--color-neutral-900)]',
          'transition-colors duration-150',
        ].join(' ')}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {label}
      </span>
    </button>
  );
}

// ─── SideBar ──────────────────────────────────────────────────────────────────

export function SideBar({
  activeItem,
  onNavigate,
  className,
  ...rest
}: SideBarProps) {
  const handleClick = (id: SideBarItemId) => {
    onNavigate?.(id);
  };

  return (
    <nav
      aria-label="Main navigation"
      className={[
        /* Figma: w-[215px], full height, white bg, right border #ececec ≈ --color-neutral-200 */
        'flex flex-col justify-between',
        'w-[var(--sidebar-width)] h-full',
        'bg-[var(--color-surface)]',
        'border-r border-[var(--color-neutral-200)]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {/* ── Top section: logo + primary nav + divider ── */}
      <div
        className={
          'flex flex-col gap-[var(--space-6)] ' +
          'px-[var(--space-5)] py-[var(--space-6)]'
        }
      >
        {/* Brand wordmark */}
        <div className="flex items-center gap-[var(--space-1-5)] px-[var(--space-2)]">
          <LoopLogo
            aria-hidden="true"
            className="shrink-0 size-[var(--space-6)]"
          />
          <span
            className={
              'font-[family-name:var(--font-brand)] font-bold ' +
              'text-[var(--font-size-wordmark)] leading-[normal] ' +
              'text-[var(--color-black)] whitespace-nowrap'
            }
          >
            Loop
          </span>
        </div>

        {/* Primary nav items */}
        <div
          className="flex flex-col gap-[var(--space-3)]"
          role="menu"
          aria-label="Primary navigation"
        >
          {PRIMARY_NAV.map((item) => (
            <SideBarTab
              key={item.id}
              id={item.id}
              label={item.label}
              Icon={item.Icon}
              isSelected={activeItem === item.id}
              onClick={() => handleClick(item.id)}
            />
          ))}
        </div>

        {/* Horizontal divider — Figma: 1px, Neutral/300 (#dee2e6) */}
        <div
          className="h-px w-full bg-[var(--color-border)]"
          role="separator"
          aria-hidden="true"
        />
      </div>

      {/* ── Bottom section: profile ── */}
      <div
        className={
          'flex flex-col ' +
          'px-[var(--space-5)] py-[var(--space-6)]'
        }
        role="menu"
        aria-label="Account navigation"
      >
        <SideBarTab
          id="profile"
          label="Profile"
          Icon={ProfileIcon}
          isSelected={activeItem === 'profile'}
          size="compact"
          onClick={() => handleClick('profile')}
        />
      </div>
    </nav>
  );
}
