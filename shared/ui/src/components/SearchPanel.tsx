/**
 * SearchPanel — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Search Panel (node 390:201)
 * The Figma page is marked "WIP"; visual hierarchy is finalised.
 *
 * This file exports TWO components:
 *
 *  SearchPanel       — the persistent right-sidebar panel showing:
 *                        • "Your RSVPs"  — RSVP'd events grouped by time period,
 *                                          each row has a DateBadge + title + description.
 *                        • "Your Clubs"  — subscribed club logos in a wrap grid,
 *                                          with optional notification count badge.
 *
 *  SearchResultList  — the autocomplete result card shown in Figma's "CARDS" section:
 *                        • Grouped event results (period label + item rows)
 *                        • Each row: title, org name, optional indicator badge, optional tag
 *                        • Optional "Show more" link
 *
 * Interactive states (Figma "tab appearance modes"):
 *   RSVP rows     : default → hover:bg-surface-subtle (bg highlight)
 *   Club items    : default → hover:opacity-80        (fade)
 *   Result rows   : default → hover:bg-surface-subtle (bg highlight)
 *   "Show more"   : default link colour → hover:underline
 *
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { Tag } from "./Tags";
import { fallbackColorsForName } from "../utils/fallbackColors";
import { DateBadge } from "./DateBadge";
import { OrgHoverCard } from "./OrgHoverCard";
import type { Organization } from "./Cards/DashboardPost";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface RsvpEvent {
  /** Day-of-month shown on the DateBadge (e.g. 24). */
  day: number | string;
  /** Abbreviated month shown on the DateBadge (e.g. "Mar"). */
  month: string;
  title: string;
  /** Short description shown below the title. Truncated at 2 lines. */
  description?: string;
}

export interface RsvpGroup {
  /**
   * Time-bucket label displayed above the group.
   * Examples: "Today" | "This week" | "Next week"
   */
  period: string;
  events: RsvpEvent[];
}

export interface Club {
  id: string;
  name: string;
  /** Circle avatar image URL. Falls back to an initial-letter badge when omitted. */
  avatarUrl?: string;
  /** When > 0 an orange notification pill is rendered over the avatar. */
  notificationCount?: number;
  /**
   * Short blurb about the club — surfaced in hover/detail contexts (e.g.
   * OrgHoverCard) and useful when the same fixture feeds both the sidebar
   * list and a richer surface.
   */
  description?: string;
}

export interface SearchPanelProps extends ComponentPropsWithoutRef<"aside"> {
  /** Grouped RSVP events. Groups are rendered in the order they are supplied. */
  rsvpGroups?: RsvpGroup[];
  /** Subscribed clubs shown in a wrap grid. */
  clubs?: Club[];
  /**
   * Called when a club row is clicked.
   * Hover still triggers the OrgHoverCard preview regardless of this handler.
   */
  onClubClick?: (club: Club) => void;
  /** Called when an RSVP'd event row is clicked. */
  onRsvpClick?: (event: RsvpEvent) => void;
}

// ── SearchResultList types ────────────────────────────────────────────────────

export interface SearchResultItem {
  title: string;
  orgName: string;
  /**
   * When true a "Following" pill badge is shown beside the org name —
   * matches the following badge used in DashboardPost.
   */
  following?: boolean;
  /**
   * Optional tag label to the right of the org row.
   * Rendered using the shared Tag component (blue colour).
   */
  tagLabel?: string;
}

export interface SearchResultGroup {
  /** Time-period label shown above this group of results (e.g. "This week"). */
  period: string;
  items: SearchResultItem[];
}

export interface SearchResultListProps extends ComponentPropsWithoutRef<"div"> {
  groups?: SearchResultGroup[];
  /** When provided, a "Show more" link is rendered at the bottom. */
  showMoreLabel?: string;
  onShowMore?: () => void;
}

// ─── Shared typography class strings ──────────────────────────────────────────

const BODY2_SEMIBOLD =
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

const BODY2_REGULAR =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

const BODY3 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body3)] leading-[var(--line-height-body3)] " +
  "tracking-[var(--letter-spacing-body3)]";

const SECTION_TITLE =
  "font-[family-name:var(--font-body)] font-bold " +
  "text-[length:var(--font-size-sub2)] leading-[var(--line-height-sub2)] " +
  "tracking-[var(--letter-spacing-body1)] " +
  "text-[color:var(--color-neutral-900)] whitespace-nowrap";

// ─── RsvpEventRow ─────────────────────────────────────────────────────────────

function RsvpEventRow({
  event,
  onClick,
}: {
  event: RsvpEvent;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  return (
    /*
     * Interactive states:
     *   Normal  → white bg, no shadow
     *   Hover   → surface-subtle bg (Figma: the same subtle wash used in nav tabs)
     * Matches Figma node 510:706 (RSVP card row)
     *
     * Renders as a button when clickable so keyboard activation + focus rings work.
     */
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={[
        "flex w-full items-center gap-[var(--space-3)]",
        "p-[var(--space-1-5)]",
        "rounded-[var(--radius-input)]",
        "bg-[var(--color-surface)]",
        interactive ? "cursor-pointer" : "",
        "hover:bg-[var(--color-surface-subtle)]",
        "transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-700)]",
      ].join(" ")}
    >
      <DateBadge day={event.day} month={event.month} />

      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-1)] tracking-[var(--letter-spacing-body2)]">
        <p
          className={
            BODY2_SEMIBOLD + " w-full text-[color:var(--color-neutral-900)]"
          }
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {event.title}
        </p>

        {event.description && (
          <p
            className={
              BODY3 +
              " line-clamp-2 w-full text-[color:var(--color-neutral-700)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {event.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── ClubItem ─────────────────────────────────────────────────────────────────

function ClubItem({ club, onClick }: { club: Club; onClick?: () => void }) {
  const count = club.notificationCount ?? 0;
  const fallback = fallbackColorsForName(club.name);

  // Hover card state — mirrors the pattern in DashboardPost so a club row
  // reveals its description on hover. The card is placed to the LEFT of the
  // row because the SearchPanel itself is a narrow right-side column; a
  // bottom dropdown would overflow the panel horizontally.
  const [hovered, setHovered] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleEnter = useCallback(() => {
    clearHideTimer();
    setHovered(true);
  }, [clearHideTimer]);

  const handleLeave = useCallback(() => {
    hideTimerRef.current = setTimeout(() => setHovered(false), 120);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Adapt Club → Organization shape for OrgHoverCard. Clubs in "Your Clubs"
  // are by definition already subscribed, so default to `following: true`.
  const org: Organization = {
    name: club.name,
    avatarUrl: club.avatarUrl,
    description: club.description,
    following: true,
  };

  const interactive = Boolean(onClick);
  return (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? `Open ${club.name}` : undefined}
      className={[
        "relative",
        "flex w-full items-center gap-[var(--space-3)]",
        "p-[var(--space-1-5)]",
        "rounded-[var(--radius-input)]",
        interactive ? "cursor-pointer" : "",
        "hover:bg-[var(--color-surface-subtle)]",
        "transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-700)]",
      ].join(" ")}
    >
      <OrgHoverCard org={org} visible={hovered} placement="left" />
      {/* Avatar + badge wrapper */}
      <div className="relative shrink-0">
        <div
          className={[
            "overflow-hidden rounded-full",
            "size-[var(--space-8)]",
            "bg-[var(--color-surface-subtle)]",
          ].join(" ")}
        >
          {club.avatarUrl ? (
            <img
              src={club.avatarUrl}
              alt={club.name}
              className="size-full object-cover"
            />
          ) : (
            <span
              className={
                "flex size-full items-center justify-center " +
                "font-[family-name:var(--font-body)] font-semibold " +
                "text-[length:var(--font-size-body3)]"
              }
              style={{ backgroundColor: fallback.bg, color: fallback.fg }}
            >
              {club.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {count > 0 && (
          <span
            className={[
              "absolute top-[-5px] right-[-5px]",
              "inline-flex items-center justify-center",
              "h-[14px] min-w-[14px]",
              "px-[3px]",
              "rounded-full",
              "bg-[var(--color-primary-700)]",
              "font-[family-name:var(--font-body)] leading-none font-normal",
              "text-[length:var(--font-size-badge)] text-[color:var(--color-white)]",
            ].join(" ")}
            aria-label={`${count} notifications`}
          >
            {count}
          </span>
        )}
      </div>

      {/* Club name */}
      <span
        className={
          BODY2_SEMIBOLD +
          " min-w-0 truncate text-[color:var(--color-neutral-900)]"
        }
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {club.name}
      </span>
    </div>
  );
}

// ─── SearchPanel ──────────────────────────────────────────────────────────────

export function SearchPanel({
  rsvpGroups = [],
  clubs = [],
  onClubClick,
  onRsvpClick,
  className,
  ...rest
}: SearchPanelProps) {
  return (
    <aside
      aria-label="Search panel"
      className={[
        "flex flex-col gap-[var(--space-6)]",
        /* Figma: w-334px; use the token so callers can override via className */
        "w-[var(--search-panel-width)]",
        "bg-[var(--color-surface)]",
        /* Figma: 1px left border, #ececec ≈ --color-border (Neutral/300) */
        "border-l border-[var(--color-border)]",
        "px-[var(--space-6)] py-[var(--space-8)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {/* ── Your RSVPs ── */}
      {rsvpGroups.length > 0 && (
        <section className="flex w-full flex-col gap-[var(--space-3)]">
          <h2 className={SECTION_TITLE}>Your RSVPs</h2>

          <div className="flex w-full flex-col gap-[var(--space-2)]">
            {rsvpGroups.map((group) => (
              <div
                key={group.period}
                className="flex flex-col gap-[var(--space-2)]"
              >
                {/* Period label — e.g. "Today" / "This week" */}
                <p
                  className={
                    BODY2_SEMIBOLD + " text-[color:var(--color-neutral-900)]"
                  }
                  style={{ fontVariationSettings: "'opsz' 14" }}
                >
                  {group.period}
                </p>

                {group.events.map((event, i) => (
                  <RsvpEventRow
                    key={i}
                    event={event}
                    onClick={onRsvpClick ? () => onRsvpClick(event) : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Your Clubs ── */}
      {clubs.length > 0 && (
        <section className="flex w-full flex-col gap-[var(--space-3)]">
          <h2 className={SECTION_TITLE}>Your Clubs</h2>

          <div className="flex flex-col gap-[var(--space-1)]">
            {clubs.map((club) => (
              <ClubItem
                key={club.id}
                club={club}
                onClick={onClubClick ? () => onClubClick(club) : undefined}
              />
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}

// ─── SearchResultList ─────────────────────────────────────────────────────────
//
// The autocomplete result card shown in Figma's "CARDS" section (node 390:207).
// Renders a list of event search results grouped by time period.

function SearchResultRow({ item }: { item: SearchResultItem }) {
  return (
    /*
     * Interactive states:
     *   Normal → transparent bg
     *   Hover  → surface-subtle bg (matches RSVP row hover pattern)
     */
    <div
      className={[
        "flex w-full flex-col gap-[var(--space-1)]",
        "rounded-[var(--radius-input)] px-[var(--space-1-5)] py-[var(--space-1)]",
        "cursor-pointer",
        "hover:bg-[var(--color-surface-subtle)]",
        "transition-colors duration-150",
      ].join(" ")}
    >
      {/* Event title — truncated at one line */}
      <p
        className={
          BODY2_SEMIBOLD +
          " w-full truncate text-[color:var(--color-neutral-700)]"
        }
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {item.title}
      </p>

      {/* Org row: name + optional indicator badge + optional tag */}
      <div className="flex items-center gap-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)]">
          <span
            className={
              BODY2_REGULAR +
              " whitespace-nowrap text-[color:var(--color-text-secondary)]"
            }
          >
            {item.orgName}
          </span>

          {/* "Following" pill badge — matches DashboardPost pattern */}
          {item.following && (
            <span
              className={[
                "inline-flex items-center",
                "rounded-full",
                "bg-[var(--color-neutral-200)]",
                "px-[var(--space-1-5)] py-0",
                "font-[family-name:var(--font-body)] font-medium",
                "text-[length:10px] leading-[18px]",
                "text-[color:var(--color-neutral-600)]",
                "whitespace-nowrap",
              ].join(" ")}
            >
              Following
            </span>
          )}
        </div>

        {item.tagLabel && <Tag color="blue">{item.tagLabel}</Tag>}
      </div>
    </div>
  );
}

export function SearchResultList({
  groups = [],
  showMoreLabel = "Show more",
  onShowMore,
  className,
  ...rest
}: SearchResultListProps) {
  if (groups.length === 0 && !onShowMore) return null;

  return (
    /*
     * Figma: bg white, border --color-border, rounded-[16px], px 16px, py 12px.
     * Width is intentionally left to flex/fill — the 254px in Figma is the
     * documentation snapshot width, not a constraint.
     */
    <div
      className={[
        "flex flex-col gap-[var(--space-3)]",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "rounded-[var(--radius-card)]",
        "px-[var(--space-4)] py-[var(--space-3)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="listbox"
      aria-label="Search results"
      {...rest}
    >
      {groups.map((group) => (
        <div key={group.period} className="flex flex-col gap-[var(--space-2)]">
          {/* Period label */}
          <p
            className={
              BODY2_SEMIBOLD + " text-[color:var(--color-neutral-900)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {group.period}
          </p>

          <div className="flex flex-col gap-[var(--space-1)]" role="group">
            {group.items.map((item, i) => (
              <SearchResultRow key={i} item={item} />
            ))}
          </div>
        </div>
      ))}

      {/*
       * "Show more" link — Figma: Inter Regular 16px, #0074bc.
       * --color-link maps to --color-secondary-600 (#427fb4), the closest token.
       */}
      {onShowMore && (
        <button
          type="button"
          onClick={onShowMore}
          className={[
            "self-start",
            BODY2_REGULAR,
            "text-[color:var(--color-link)]",
            "hover:underline",
            "cursor-pointer transition-[text-decoration] duration-150",
          ].join(" ")}
        >
          {showMoreLabel}
        </button>
      )}
    </div>
  );
}
