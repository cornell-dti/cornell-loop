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
import { Tag } from "../Tags";

export type { TagItem };

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Organization {
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
  className?: string;
}

// ─── Shared typography class strings ──────────────────────────────────────────

const BODY2 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

// ─── OrgHoverCard ─────────────────────────────────────────────────────────────

function OrgHoverCard({
  org,
  visible,
}: {
  org: Organization;
  visible: boolean;
}) {
  const fallback = fallbackColorsForName(org.name);

  return (
    <div
      className={[
        "absolute top-full left-0 z-50",
        /* Transparent bridge padding fills the gap between trigger and card
           so the mouse never leaves the hover zone */
        "pt-[var(--space-2)]",
        "transition-[opacity,transform] duration-150",
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-1 opacity-0",
      ].join(" ")}
    >
      <div
        className={[
          "relative",
          "flex w-[var(--search-panel-width)] flex-col gap-[var(--space-2)]",
          "rounded-[var(--radius-card)]",
          "border border-[var(--color-neutral-300)]",
          "bg-[var(--color-surface)]",
          "px-[var(--space-4)] py-[var(--space-3)]",
          "shadow-[var(--shadow-1)]",
        ].join(" ")}
      >
        {/* Arrow border (outer) — centered on trigger name */}
        <span className="absolute -top-[7px] left-[var(--space-6)] h-0 w-0 border-x-[7px] border-b-[7px] border-x-transparent border-b-[var(--color-neutral-300)]" />
        {/* Arrow fill (inner, white) */}
        <span className="absolute -top-[6px] left-[25px] h-0 w-0 border-x-[6px] border-b-[6px] border-x-transparent border-b-[var(--color-surface)]" />
        {/* Top row: avatar + name + follow button */}
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <div className="flex items-center gap-[var(--space-2)]">
            {/* 24px avatar circle */}
            <span
              className={[
                "inline-flex shrink-0 items-center justify-center",
                "overflow-hidden rounded-full",
                "size-[var(--space-6)]",
              ].join(" ")}
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
                  style={{ backgroundColor: fallback.bg, color: fallback.fg }}
                >
                  {org.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            {/* Org name — bold 18px body1 */}
            <span
              className={
                "font-[family-name:var(--font-body)] font-bold " +
                "text-[length:var(--font-size-body1)] leading-[var(--line-height-body1)] " +
                "tracking-[var(--letter-spacing-body1)] " +
                "text-[color:var(--color-neutral-700)]"
              }
            >
              {org.name}
            </span>
          </div>

          {/* Follow / Following button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              org.onToggleFollow?.();
            }}
            className={[
              "shrink-0 cursor-pointer",
              "rounded-[var(--radius-card)]",
              "px-[var(--space-4)] py-[var(--space-1-5)]",
              BODY2,
              "transition-colors duration-150",
              org.following
                ? "bg-[var(--color-neutral-300)] text-[color:var(--color-black)] hover:bg-[var(--color-neutral-400)]"
                : "bg-[var(--color-primary-700)] text-[color:var(--color-white)] hover:bg-[var(--color-primary-hover)]",
            ].join(" ")}
          >
            {org.following ? "Following" : "Follow"}
          </button>
        </div>

        {/* Description */}
        {org.description && (
          <p
            className={
              BODY2 + " whitespace-normal text-[color:var(--color-neutral-600)]"
            }
          >
            {org.description}
          </p>
        )}

        {/* Tags row */}
        {org.tags && org.tags.length > 0 && (
          <div className="flex gap-[var(--space-2)]">
            {org.tags.map((tag) => (
              <Tag key={tag.label} color={tag.color ?? "neutral"}>
                {tag.label}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
            {organizations.map((org, i) => (
              <span key={i} className="flex items-center">
                <span
                  className="relative cursor-pointer hover:underline"
                  onMouseEnter={() => handleOrgEnter(i)}
                  onMouseLeave={handleOrgLeave}
                >
                  {org.name}
                  <OrgHoverCard org={org} visible={hoveredOrgIdx === i} />
                </span>
                {i < organizations.length - 1 && <span>,&nbsp;</span>}
              </span>
            ))}
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
