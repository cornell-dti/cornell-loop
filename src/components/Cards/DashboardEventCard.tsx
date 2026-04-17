/**
 * DashboardEventCard — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Cards
 * Node: 515:3339 "Event Card - Dashboard"
 *
 * Displays a single event with title, datetime, location, description, tags,
 * and RSVP / share / bookmark actions.
 *
 * The RSVP button intentionally uses --radius-card (16px) not --radius-input (8px);
 * this matches the Figma spec where event-card pill buttons are more rounded than
 * standard form inputs.
 *
 * "Show more" text colour: Figma uses #767676 which is not a named palette colour.
 * --color-text-secondary (Neutral/600 #616972) is the closest available token.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import { useState, type ComponentPropsWithoutRef } from "react";
import { Tag } from "../Tags";
import type { TagColor } from "../Tags";
import { Calendar, ExternalLink, MapPin } from "lucide-react";
import { Bookmark } from "../Bookmark";

// ─── Shared types (re-exported for use by DashboardPost) ─────────────────────

export interface TagItem {
  label: string;
  /** Defaults to 'neutral'. Pass 'blue' for availability / highlight tags. */
  color?: TagColor;
}

// ─── Shared class strings ─────────────────────────────────────────────────────

const BODY2_CLASSES =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface DashboardEventCardProps extends ComponentPropsWithoutRef<"article"> {
  title: string;
  datetime: string;
  location: string;
  description: string;
  /** When true the description starts clamped to 2 lines with a "Show more" toggle. Defaults to true. */
  truncateDescription?: boolean;
  tags?: TagItem[];
  onRsvp?: () => void;
  onShare?: () => void;
  /**
   * Whether the event is currently bookmarked / saved.
   *   true  → bookmark-filled.svg  (Primary/700 orange fill) — Figma "saved" state
   *   false → bookmark.svg         (Neutral/500 gray outline) — Figma "Default" state
   * Defaults to false.
   */
  bookmarked?: boolean;
  /** Called when the bookmark button is clicked. Toggle `bookmarked` in the parent. */
  onBookmark?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardEventCard({
  title,
  datetime,
  location,
  description,
  truncateDescription = true,
  tags = [],
  onRsvp,
  onShare,
  bookmarked: bookmarkedProp = false,
  onBookmark,
  className,
  ...rest
}: DashboardEventCardProps) {
  const [internalBookmarked, setInternalBookmarked] = useState(bookmarkedProp);
  const bookmarked = onBookmark ? bookmarkedProp : internalBookmarked;
  const handleBookmark = onBookmark ?? (() => setInternalBookmarked(b => !b));

  const [expanded, setExpanded] = useState(false);
  const isClamped = truncateDescription && !expanded;

  return (
    <article
      className={[
        "flex flex-col gap-[11px]",
        "border border-[var(--color-border)] bg-[var(--color-surface)]",
        "rounded-[var(--radius-card)]",
        "p-[var(--space-4)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {/* ── Section 1: title row + meta row ── */}
      <div className="flex w-full flex-col gap-[var(--space-2)]">
        {/* Title row: title text | share + bookmark icons | RSVP button */}
        <div className="flex w-full items-start gap-[var(--space-3)]">
          <h3
            className={
              "min-w-0 flex-1 " +
              "font-[family-name:var(--font-body)] font-bold " +
              "text-[length:var(--font-size-body1)] leading-[var(--line-height-body1)] " +
              "tracking-[var(--letter-spacing-body1)] " +
              "text-[color:var(--color-neutral-700)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {title}
          </h3>

          {/* Actions: icons + RSVP grouped so icons vertically center with the button */}
          <div className="flex shrink-0 items-center gap-[var(--space-3)]">
            <button
              type="button"
              aria-label="Share event"
              onClick={onShare}
              className="group flex cursor-pointer items-center justify-center"
            >
              <ExternalLink
                aria-hidden="true"
                size={20}
                className={
                  "text-[color:var(--color-neutral-500)] " +
                  "group-hover:text-[color:var(--color-neutral-700)] " +
                  "transition-colors duration-150"
                }
              />
            </button>

            <Bookmark
              bookmarked={bookmarked}
              onToggle={handleBookmark}
              iconClassName="size-[var(--space-5)]"
            />

            <button
              type="button"
              onClick={onRsvp}
              className={[
                "inline-flex shrink-0 items-center justify-center",
                "px-[var(--space-3)] py-[var(--space-1)]",
                "rounded-[var(--radius-card)]",
                "border border-[var(--color-border)]",
                "bg-[var(--color-surface)]",
                BODY2_CLASSES,
                "text-[color:var(--color-black)]",
                "cursor-pointer whitespace-nowrap",
                "hover:bg-[var(--color-surface-subtle)]",
                "transition-colors duration-150",
              ].join(" ")}
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              RSVP
            </button>
          </div>
        </div>

        {/* Meta row: datetime + location */}
        {/* calendar.svg & location-pin.svg use stroke="#495057" (Neutral/700) natively — no filter. */}
        <div className="flex items-center gap-[var(--space-6)]">
          <div className="flex shrink-0 items-center gap-[var(--space-2)]">
            <Calendar
              aria-hidden="true"
              size={16}
              className="shrink-0 text-[color:var(--color-neutral-700)]"
            />
            <span
              className={
                BODY2_CLASSES +
                " whitespace-nowrap text-[color:var(--color-neutral-700)]"
              }
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {datetime}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-[var(--space-2)]">
            <MapPin
              aria-hidden="true"
              size={16}
              className="shrink-0 text-[color:var(--color-neutral-700)]"
            />
            <span
              className={
                BODY2_CLASSES +
                " whitespace-nowrap text-[color:var(--color-neutral-700)]"
              }
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {location}
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 2: description + show-more ── */}
      <div className="flex flex-col gap-[var(--space-2)]">
        <p
          className={[
            BODY2_CLASSES,
            "text-[color:var(--color-neutral-700)]",
            isClamped ? "line-clamp-2 overflow-hidden" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {description}
        </p>

        {truncateDescription && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className={[
              "cursor-pointer self-start whitespace-nowrap",
              BODY2_CLASSES,
              "text-[color:var(--color-text-secondary)]",
              "hover:text-[color:var(--color-neutral-700)]",
              "transition-colors duration-150",
            ].join(" ")}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      {/* ── Section 3: tags ── */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-[10px]">
          {[...tags]
            .sort((a, b) => {
              const aBlue = (a.color ?? "neutral") === "blue" ? 0 : 1;
              const bBlue = (b.color ?? "neutral") === "blue" ? 0 : 1;
              return aBlue - bBlue;
            })
            .map((tag, i) => (
              <Tag key={i} color={tag.color ?? "neutral"}>
                {tag.label}
              </Tag>
            ))}
        </div>
      )}
    </article>
  );
}
