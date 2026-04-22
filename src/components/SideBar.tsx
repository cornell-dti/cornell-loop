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
 *   Lucide icons use currentColor — text colour utilities set the icon colour
 *   for each state (Neutral/900 default, Primary/800 selected).
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { ComponentPropsWithoutRef } from "react";
import { Bookmark, Home, MailCheck, User, type LucideIcon } from "lucide-react";

// Brand logo — kept as SVG import
import LoopLogo from "../assets/loop_logo.svg?react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NavItemId = "home" | "bookmarks" | "subscriptions";
export type BottomItemId = "profile";
export type SideBarItemId = NavItemId | BottomItemId;

interface NavItemDef {
  id: NavItemId;
  label: string;
  Icon: LucideIcon;
}

const PRIMARY_NAV: NavItemDef[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "bookmarks", label: "Bookmarks", Icon: Bookmark },
  { id: "subscriptions", label: "Subscriptions", Icon: MailCheck },
];

export interface SideBarProps extends ComponentPropsWithoutRef<"nav"> {
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
  Icon: LucideIcon;
  isSelected: boolean;
  /** 'compact' reduces vertical padding; used for the Profile tab (Figma: py 4px vs 6px). */
  size?: "default" | "compact";
  onClick: () => void;
}

function SideBarTab({
  id,
  label,
  Icon,
  isSelected,
  size = "default",
  onClick,
}: SideBarTabProps) {
  const pyClass =
    size === "compact" ? "py-[var(--space-1)]" : "py-[var(--space-1-5)]";

  return (
    <button
      type="button"
      role="menuitem"
      aria-current={isSelected ? "page" : undefined}
      data-nav-id={id}
      onClick={onClick}
      className={[
        /* layout */
        "flex w-full items-center gap-[var(--space-3)]",
        "px-[var(--space-3)]",
        pyClass,
        "cursor-pointer",
        /* base radius — overridden to --space-3 (12px) on hover and when selected */
        "rounded-[var(--radius-card)]",
        /* transitions */
        "transition-all duration-150",
        /* state-specific background + radius */
        isSelected
          ? "rounded-[var(--space-3)] bg-[var(--color-primary-400)]"
          : "hover:rounded-[var(--space-3)] hover:bg-[var(--color-surface-subtle)]",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/*
       * Icon: always 24 × 24 px.  Colour is set via currentColor using text
       * colour utilities — Neutral/900 by default, Primary/800 when selected.
       */}
      <Icon
        aria-hidden="true"
        size={24}
        className={[
          "shrink-0 transition-colors duration-150",
          isSelected
            ? "text-[color:var(--color-primary-800)]"
            : "text-[color:var(--color-neutral-900)]",
        ].join(" ")}
      />

      {/* Label */}
      <span
        className={[
          "font-[family-name:var(--font-body)] font-medium",
          "text-[length:var(--font-size-body1)] leading-[var(--line-height-body1)]",
          "tracking-[var(--letter-spacing-body1)]",
          "whitespace-nowrap",
          /* Figma: selected → Primary/800 (#a74409); default → Neutral/900 */
          isSelected
            ? "text-[color:var(--color-primary-800)]"
            : "text-[color:var(--color-neutral-900)]",
          "transition-colors duration-150",
        ].join(" ")}
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
        "flex flex-col justify-between",
        "h-full w-[var(--sidebar-width)]",
        "bg-[var(--color-surface)]",
        "border-r border-[var(--color-neutral-200)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {/* ── Top section: logo + primary nav + divider ── */}
      <div
        className={
          "flex flex-col gap-[var(--space-6)] " +
          "px-[var(--space-5)] py-[var(--space-6)]"
        }
      >
        {/* Brand wordmark */}
        <div className="flex items-center gap-[var(--space-1-5)] px-[var(--space-2)]">
          <LoopLogo
            aria-hidden="true"
            className="size-[var(--space-6)] shrink-0"
          />
          <span
            className={
              "font-[family-name:var(--font-brand)] font-bold " +
              "text-[length:var(--font-size-wordmark)] leading-[normal] " +
              "whitespace-nowrap text-[color:var(--color-black)]"
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
        className={"flex flex-col " + "px-[var(--space-5)] py-[var(--space-6)]"}
        role="menu"
        aria-label="Account navigation"
      >
        <SideBarTab
          id="profile"
          label="Profile"
          Icon={User}
          isSelected={activeItem === "profile"}
          size="compact"
          onClick={() => handleClick("profile")}
        />
      </div>
    </nav>
  );
}
