/**
 * DashboardPost — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Cards
 * Node: 520:6160 "Dashboard Post"
 *
 * A feed post wrapper: an organisation attribution header (avatar stack +
 * org names + optional "Following" badge + posted date) above a
 * DashboardEventCard.
 *
 * Structure from Figma:
 *   • The outer container has NO background — it inherits from its feed parent.
 *   • The post header renders directly on the parent's surface.
 *   • The embedded DashboardEventCard has its own white card background.
 *
 * Avatar stack: 32px avatars (--space-8) with −8px overlap (--space-2).
 * Avatars without a `url` fall back to an initial letter badge.
 *
 * Hovering over the post header reveals an OrgHoverCard for the first org,
 * showing description, tags, and a Follow/Unfollow button.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { DashboardEventCard } from "./DashboardEventCard";
import type { DashboardEventCardProps, TagItem } from "./DashboardEventCard";
import { fallbackColorsForName } from "../../utils/fallbackColors";
import { OrgHoverCard } from "../OrgHoverCard";

export type { TagItem };

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Organization {
  /**
   * Stable identifier — typically the URL slug used for the org page route
   * (e.g. "cuauv" for /orgs/cuauv). Required for `onOrgClick` to fire.
   */
  id?: string;
  /** Display name shown beside the avatar stack. */
  name: string;
  /** Optional avatar image URL. Falls back to an initial-letter badge. */
  avatarUrl?: string;
  /** Whether the current user follows this org. Shows "Following" badge when true. */
  following?: boolean;
  /** Short org description shown in the hover card. */
  description?: string;
  /** Tags shown in the hover card (e.g. ["For you", "Tech"]). */
  tags?: { label: string; color?: "neutral" | "blue" }[];
  /** Called when the Follow/Unfollow button is clicked in the hover card. */
  onToggleFollow?: () => void;
}

export interface DashboardPostProps {
  /** List of organisations that authored / shared this post. */
  organizations: Organization[];
  /** Human-readable posted date, e.g. "Feb 12". */
  postedAt: string;
  // ── DashboardEventCard data ──
  title: string;
  datetime: string;
  location: string;
  description: string;
  truncateDescription?: boolean;
  tags?: DashboardEventCardProps["tags"];
  onRsvp?: () => void;
  onShare?: () => void;
  bookmarked?: boolean;
  onBookmark?: () => void;
  /**
   * Called when an organisation in the post header is clicked.
   * Hover preview (OrgHoverCard) is independent of this handler.
   */
  onOrgClick?: (org: Organization) => void;
  className?: string;
}

// ─── Shared typography class strings ──────────────────────────────────────────

const BODY2 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardPost({
  organizations,
  postedAt,
  title,
  datetime,
  location,
  description,
  truncateDescription,
  tags,
  onRsvp,
  onShare,
  bookmarked,
  onBookmark,
  onOrgClick,
  className,
}: DashboardPostProps) {
  const cardProps: DashboardEventCardProps = {
    title,
    datetime,
    location,
    description,
    truncateDescription,
    tags,
    onRsvp,
    onShare,
    bookmarked,
    onBookmark,
  };

  const hasFollowing = organizations.some((o) => o.following);

  // Track which org index is hovered (null = none)
  const [hoveredOrgIdx, setHoveredOrgIdx] = useState<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleOrgEnter = useCallback(
    (idx: number) => {
      clearHideTimer();
      setHoveredOrgIdx(idx);
    },
    [clearHideTimer],
  );

  const handleOrgLeave = useCallback(() => {
    hideTimerRef.current = setTimeout(() => {
      setHoveredOrgIdx(null);
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={["flex flex-col gap-[var(--space-3)]", className]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ── Post header ── */}
      <div className="flex items-center gap-[var(--space-3)]">
        {/* Left: avatar stack + org names + following badge */}
        <div className="flex items-center gap-[var(--space-2)]">
          {/* Stacked avatars */}
          {organizations.length > 0 && (
            <div className="flex items-center">
              {organizations.map((org, i) => {
                const fallback = fallbackColorsForName(org.name);
                return (
                  <span
                    key={i}
                    className={[
                      "relative inline-flex shrink-0 items-center justify-center",
                      "overflow-hidden rounded-full",
                      "size-[var(--space-8)]",
                      "outline-2 outline-[var(--color-surface)]",
                      i > 0 ? "[margin-left:calc(-1*var(--space-2))]" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{ zIndex: organizations.length - i }}
                  >
                    {org.avatarUrl ? (
                      <img
                        src={org.avatarUrl}
                        alt={org.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span
                        className={
                          "flex size-full items-center justify-center " +
                          "font-[family-name:var(--font-body)] font-semibold " +
                          "text-[length:var(--font-size-body3)]"
                        }
                        style={{
                          backgroundColor: fallback.bg,
                          color: fallback.fg,
                        }}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          {/* Org names — each is its own hover trigger with tooltip */}
          <span
            className={
              "flex items-center gap-[var(--space-1)] " +
              "font-[family-name:var(--font-body)] font-semibold " +
              "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
              "tracking-[var(--letter-spacing-body2)] " +
              "whitespace-nowrap text-[color:var(--color-neutral-700)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {organizations.map((org, i) => {
              const clickable = Boolean(onOrgClick && org.id);
              const handleClick = clickable
                ? () => onOrgClick?.(org)
                : undefined;
              return (
                <span key={i} className="flex items-center">
                  <span
                    className={[
                      "relative",
                      clickable ? "cursor-pointer hover:underline" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onMouseEnter={() => handleOrgEnter(i)}
                    onMouseLeave={handleOrgLeave}
                    onClick={handleClick}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleClick?.();
                            }
                          }
                        : undefined
                    }
                    role={clickable ? "link" : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    aria-label={clickable ? `Open ${org.name}` : undefined}
                  >
                    {org.name}
                    <OrgHoverCard org={org} visible={hoveredOrgIdx === i} />
                  </span>
                  {i < organizations.length - 1 && <span>,&nbsp;</span>}
                </span>
              );
            })}
          </span>

          {/* "Following" pill badge */}
          {hasFollowing && (
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

        {/* Right: separator bullet + date */}
        <div className="flex items-center gap-[var(--space-2)]">
          {/* Bullet — Figma: Neutral/500 */}
          <span
            className="text-[length:var(--font-size-body3)] leading-[1.5] text-[color:var(--color-neutral-500)]"
            aria-hidden="true"
          >
            •
          </span>
          <span
            className={
              BODY2 + " whitespace-nowrap text-[color:var(--color-neutral-600)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {postedAt}
          </span>
        </div>
      </div>

      {/* ── Embedded event card ── */}
      <DashboardEventCard {...cardProps} />
    </div>
  );
}
