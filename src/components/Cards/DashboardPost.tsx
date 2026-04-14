/**
 * DashboardPost — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Cards
 * Node: 520:6160 "Dashboard Post"
 *
 * A feed post wrapper: an organisation attribution header (avatar stack +
 * org names + an "indicator" badge + posted date) above a DashboardEventCard.
 *
 * Structure from Figma:
 *   • The outer container has NO background — it inherits from its feed parent.
 *   • The post header renders directly on the parent's surface.
 *   • The embedded DashboardEventCard has its own white card background.
 *
 * Avatar stack: 32px avatars (--space-8) with −8px overlap (--space-2).
 * Avatars without a `url` fall back to an initial letter badge.
 *
 * Indicator badge bg: Figma uses #5f5f5f — approximated with --color-neutral-600
 * (#616972), the closest available token.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import { DashboardEventCard } from "./DashboardEventCard";
import type { DashboardEventCardProps, TagItem } from "./DashboardEventCard";
import StarIcon from "../../assets/star.svg?react";

export type { TagItem };

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Organization {
  /** Display name shown beside the avatar stack. */
  name: string;
  /** Optional avatar image URL. Falls back to an initial-letter badge. */
  avatarUrl?: string;
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
  descriptionTruncated?: boolean;
  onShowMore?: () => void;
  tags?: DashboardEventCardProps["tags"];
  onRsvp?: () => void;
  onShare?: () => void;
  onBookmark?: () => void;
  className?: string;
}

// ─── Shared body-2 class string ───────────────────────────────────────────────

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
  descriptionTruncated,
  onShowMore,
  tags,
  onRsvp,
  onShare,
  onBookmark,
  className,
}: DashboardPostProps) {
  const cardProps: DashboardEventCardProps = {
    title,
    datetime,
    location,
    description,
    descriptionTruncated,
    onShowMore,
    tags,
    onRsvp,
    onShare,
    onBookmark,
  };

  return (
    <div
      className={["flex flex-col gap-[var(--space-3)]", className]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ── Post header ── */}
      <div className="flex items-center gap-[var(--space-3)]">
        {/* Left: avatar stack + org names + indicator badge */}
        <div className="flex items-center gap-[var(--space-2)]">
          {/* Stacked avatars — overlap with negative margin on all but first */}
          {organizations.length > 0 && (
            <div className="flex items-center">
              {organizations.map((org, i) => (
                <span
                  key={i}
                  className={[
                    "relative inline-flex shrink-0 items-center justify-center",
                    "overflow-hidden rounded-full",
                    "size-[var(--space-8)]",
                    /* White ring to create visual separation between overlapping avatars */
                    "ring-2 ring-[var(--color-surface)]",
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
                    /* Fallback: initial letter badge using secondary palette */
                    <span
                      className={
                        "flex size-full items-center justify-center " +
                        "bg-[var(--color-secondary-400)] " +
                        "font-[family-name:var(--font-body)] font-semibold " +
                        "text-[length:var(--font-size-body3)] " +
                        "text-[color:var(--color-secondary-900)]"
                      }
                    >
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Org names — Figma: DM Sans SemiBold 14px, Neutral/700 */}
          <span
            className={
              "font-[family-name:var(--font-body)] font-semibold " +
              "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
              "tracking-[var(--letter-spacing-body2)] " +
              "whitespace-nowrap text-[color:var(--color-neutral-700)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {organizations.map((o) => o.name).join(", ")}
          </span>

          {/*
           * Indicator badge
           * Figma: small circular icon button, bg #5f5f5f ≈ --color-neutral-600.
           * Appears to be a "shared" or "featured" signal in the feed.
           */}
          <span
            className={
              "inline-flex items-center justify-center " +
              "rounded-full p-[var(--space-1)] " +
              "size-[var(--space-3)] " +
              "bg-[var(--color-neutral-600)] " +
              "text-[color:var(--color-white)]"
            }
            aria-hidden="true"
          >
            <StarIcon aria-hidden="true" className="size-full" />
          </span>
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
