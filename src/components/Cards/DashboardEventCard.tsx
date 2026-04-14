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

import type { ComponentPropsWithoutRef } from "react";
import { Tag } from "../Tags";
import type { TagColor } from "../Tags";
import CalendarIcon from "../../assets/calendar.svg?react";
import LocationPinIcon from "../../assets/location-pin.svg?react";
import ExternalLinkIcon from "../../assets/external-link.svg?react";
import BookmarkIcon from "../../assets/bookmark.svg?react";
import BookmarkFilledIcon from "../../assets/bookmark-filled.svg?react";

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
  /**
   * When true the description is clamped to 3 lines and a "Show more" trigger
   * is rendered. Pass `onShowMore` to handle the action. Defaults to true.
   */
  descriptionTruncated?: boolean;
  onShowMore?: () => void;
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
  descriptionTruncated = true,
  onShowMore,
  tags = [],
  onRsvp,
  onShare,
  bookmarked = false,
  onBookmark,
  className,
  ...rest
}: DashboardEventCardProps) {
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
      <div className="flex w-full flex-col gap-[var(--space-1)]">
        {/* Title row: title text | share + bookmark icons | RSVP button */}
        <div className="flex w-full items-center gap-[var(--space-3)]">
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

          {/* Action icons */}
          <div className="flex shrink-0 items-center gap-[10px] py-[var(--space-1)]">
            {/*
             * Share — external-link.svg: stroke="#ADB5BD" (Neutral/500, muted by default).
             * On hover, --filter-icon-close-default darkens it to ~Neutral/700 (#495057).
             */}
            <button
              type="button"
              aria-label="Share event"
              onClick={onShare}
              className="group size-[var(--space-4)] cursor-pointer"
            >
              <ExternalLinkIcon
                aria-hidden="true"
                className={
                  "size-full " +
                  "group-hover:[filter:var(--filter-icon-close-default)] " +
                  "transition-[filter] duration-150"
                }
              />
            </button>

            {/*
             * Bookmark — switches SVG based on `bookmarked` prop:
             *   false → BookmarkIcon       stroke="#ADB5BD" (Neutral/500) — Figma "Default"
             *   true  → BookmarkFilledIcon fill="#EB7128"   (Primary/700) — Figma "saved"
             * When unsaved, hover darkens the outline via --filter-icon-close-default.
             * Source: Figma Icons section — Bookmark icon states (node 493:1041)
             */}
            <button
              type="button"
              aria-label={bookmarked ? "Remove bookmark" : "Bookmark event"}
              aria-pressed={bookmarked}
              onClick={onBookmark}
              className="group size-[var(--space-4)] cursor-pointer"
            >
              {bookmarked ? (
                <BookmarkFilledIcon aria-hidden="true" className="size-full" />
              ) : (
                <BookmarkIcon
                  aria-hidden="true"
                  className={
                    "size-full " +
                    "group-hover:[filter:var(--filter-icon-close-default)] " +
                    "transition-[filter] duration-150"
                  }
                />
              )}
            </button>
          </div>

          {/*
           * RSVP button
           * Figma: bg white, Neutral/300 border, rounded-[16px] (--radius-card),
           * px 16px, py 6px, body-2 regular, black text.
           * Uses --radius-card intentionally — Figma pills in this card are more rounded
           * than standard inputs/buttons.
           */}
          <button
            type="button"
            onClick={onRsvp}
            className={[
              "inline-flex shrink-0 items-center justify-center",
              "px-[var(--space-4)] py-[var(--space-1-5)]",
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

        {/* Meta row: datetime + location */}
        {/* calendar.svg & location-pin.svg use stroke="#495057" (Neutral/700) natively — no filter. */}
        <div className="flex items-center gap-[var(--space-6)]">
          <div className="flex shrink-0 items-center gap-[var(--space-2)]">
            <CalendarIcon
              aria-hidden="true"
              className="size-[var(--space-4)] shrink-0"
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
            <LocationPinIcon
              aria-hidden="true"
              className="size-[var(--space-4)] shrink-0"
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
            descriptionTruncated ? "line-clamp-3 overflow-hidden" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {description}
        </p>

        {descriptionTruncated && onShowMore && (
          <button
            type="button"
            onClick={onShowMore}
            className={[
              "cursor-pointer self-start whitespace-nowrap",
              BODY2_CLASSES,
              /* Figma value #767676; approximated with --color-text-secondary (Neutral/600 #616972) */
              "text-[color:var(--color-text-secondary)]",
              "hover:text-[color:var(--color-neutral-700)]",
              "transition-colors duration-150",
            ].join(" ")}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Show more
          </button>
        )}
      </div>

      {/* ── Section 3: tags ── */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-[10px]">
          {tags.map((tag, i) => (
            <Tag key={i} color={tag.color ?? "neutral"}>
              {tag.label}
            </Tag>
          ))}
        </div>
      )}
    </article>
  );
}
