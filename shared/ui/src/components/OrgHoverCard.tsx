/**
 * OrgHoverCard — Loop Design System
 *
 * A floating hover card that displays organisation details: avatar, name,
 * follow/unfollow button, description, and tags.
 *
 * Extracted from DashboardPost so it can be shared across components that
 * need inline org hover previews (e.g. LoopSummary, DashboardPost).
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import type { Organization } from "./Cards/DashboardPost";
import { fallbackColorsForName } from "../utils/fallbackColors";
import { Tag } from "./Tags";

// ─── Shared typography class strings ──────────────────────────────────────────

const BODY2 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

// ─── Public types ─────────────────────────────────────────────────────────────

export type OrgHoverCardPlacement = "bottom" | "left";

export interface OrgHoverCardProps {
  /** The organisation data to display. */
  org: Organization;
  /** Whether the hover card is currently visible. */
  visible: boolean;
  /**
   * Where the card sits relative to the trigger.
   * - `bottom` (default): drops below the trigger with an arrow on top
   *   pointing at the name. Used inline in post headers.
   * - `left`: floats to the left of the trigger with an arrow on the right,
   *   useful when the trigger lives in a narrow right-side panel where a
   *   dropdown would overflow the panel.
   */
  placement?: OrgHoverCardPlacement;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OrgHoverCard({
  org,
  visible,
  placement = "bottom",
}: OrgHoverCardProps) {
  const fallback = fallbackColorsForName(org.name);
  const isLeft = placement === "left";

  return (
    <div
      className={[
        "absolute z-50",
        /*
         * Placement-specific positioning + transparent bridge padding so the
         * mouse never leaves the hover zone between trigger and card.
         */
        isLeft
          ? "top-1/2 right-full -translate-y-1/2 pr-[var(--space-2)]"
          : "top-full left-0 pt-[var(--space-2)]",
        "transition-[opacity,transform] duration-150",
        visible
          ? isLeft
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-auto translate-y-0 opacity-100"
          : isLeft
            ? "pointer-events-none translate-x-1 opacity-0"
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
        {/* Arrow border (outer) */}
        <span
          className={
            isLeft
              ? "absolute top-1/2 -right-[7px] -translate-y-1/2 border-y-[7px] border-l-[7px] border-y-transparent border-l-[var(--color-neutral-300)]"
              : "absolute -top-[7px] left-[var(--space-6)] h-0 w-0 border-x-[7px] border-b-[7px] border-x-transparent border-b-[var(--color-neutral-300)]"
          }
        />
        {/* Arrow fill (inner, white) */}
        <span
          className={
            isLeft
              ? "absolute top-1/2 -right-[6px] -translate-y-1/2 border-y-[6px] border-l-[6px] border-y-transparent border-l-[var(--color-surface)]"
              : "absolute -top-[6px] left-[25px] h-0 w-0 border-x-[6px] border-b-[6px] border-x-transparent border-b-[var(--color-surface)]"
          }
        />
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
