/**
 * BookmarkCard — Extension UI
 *
 * Source: Figma "Incubator-design-file" › Popup › Bookmarks view
 * Node: 554:5543 (single card instance)
 *
 * Layout:
 *   ┌───────────────────────────────────────┐
 *   │ [avatar] Org name                     │  ← org header
 *   │ ────────────────────────────────────  │
 *   │ [DateBadge] Title          [bookmark] │  ← event row
 *   │              Subtitle line 1          │
 *   │              Subtitle line 2          │
 *   │ [Tag] [Tag]                           │  ← tags (optional)
 *   │ ─────────────────────────────────     │
 *   │ [ RSVP ]  [ Add to Calendar ]         │  ← actions (each conditional)
 *   └───────────────────────────────────────┘
 *
 * Uses design system components: DateBadge, Tag, Button
 * Uses design system SVG: bookmark-filled.svg (always filled — this is the
 * bookmarks view so every card is already saved)
 *
 * Subtitle variants (from Figma annotations):
 *   events      → string[] e.g. ['4:00 pm – 5:30 pm', 'Hollister Hall 312']
 *   informative → string   e.g. 'For early career designers and developers'
 *   edge case   → string   e.g. 'Click to see original email'
 */

import type { ComponentPropsWithoutRef } from "react";
import { DateBadge, Tag, Button } from "@app/ui";
import type { ThumbnailVariant } from "@app/ui";
import BookmarkFilledIcon from "@app/ui/assets/bookmark-filled.svg?react";

// ── Typography shared strings ──────────────────────────────────────────────

const BODY2_SEMIBOLD =
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

const BODY3 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body3)] leading-[var(--line-height-body3)] " +
  "tracking-[var(--letter-spacing-body3)]";

// ── Props ──────────────────────────────────────────────────────────────────

export interface BookmarkCardProps extends ComponentPropsWithoutRef<"div"> {
  /** Organisation name shown in the card header. */
  orgName: string;
  /** URL for the org's circular avatar. Falls back to an initials badge. */
  orgAvatarUrl?: string;
  /** Controls the DateBadge thumbnail style. Defaults to "date". */
  thumbnailVariant?: ThumbnailVariant;
  /** Day-of-month for the "date" thumbnail (e.g. 24). */
  day?: number | string;
  /** Abbreviated month for the "date" thumbnail (e.g. "Mar"). */
  month?: string;
  /** Event title — DM Sans SemiBold 14 px, Neutral/900. */
  title: string;
  /**
   * Subtitle shown below the title in the event row.
   *   string    → single line (informative summary or edge-case message)
   *   string[]  → multiple lines, e.g. ['4:00 pm – 5:30 pm', 'Hollister Hall 312']
   */
  subtitle?: string | string[];
  /** Neutral/200 category tags shown beneath the event row. */
  tags?: string[];
  /**
   * When provided, an RSVP button is rendered.
   * Figma annotation: "appears only if there's an RSVP link".
   */
  onRsvp?: () => void;
  /**
   * When provided, an Add to Calendar button is rendered.
   * Figma annotation: "appears only when there's specific date and time".
   */
  onAddToCalendar?: () => void;
  /** Called when the filled bookmark icon is pressed to remove the save. */
  onUnbookmark?: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────

export function BookmarkCard({
  orgName,
  orgAvatarUrl,
  thumbnailVariant = "date",
  day,
  month,
  title,
  subtitle,
  tags,
  onRsvp,
  onAddToCalendar,
  onUnbookmark,
  className,
  ...rest
}: BookmarkCardProps) {
  const subtitleLines: string[] =
    subtitle == null ? [] : Array.isArray(subtitle) ? subtitle : [subtitle];

  const hasActions = onRsvp != null || onAddToCalendar != null;

  return (
    <div
      className={[
        "flex flex-col gap-[var(--space-4)]",
        "border border-[var(--color-border)]",
        "rounded-[var(--space-3)]",
        "p-[var(--space-3)]",
        "overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {/* ── Org header ── */}
      <div className="flex items-center gap-[var(--space-2)] px-[var(--space-1-5)]">
        {/* 32 px avatar circle */}
        <div className="relative size-[var(--space-8)] shrink-0 overflow-hidden rounded-full bg-[var(--color-surface-raised)]">
          {orgAvatarUrl ? (
            <img
              src={orgAvatarUrl}
              alt={orgName}
              className="size-full object-cover"
            />
          ) : (
            <span
              className={
                "flex size-full items-center justify-center " +
                "font-[family-name:var(--font-body)] font-semibold " +
                "text-[length:var(--font-size-body3)] " +
                "text-[var(--color-neutral-900)]"
              }
            >
              {orgName.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Org name — DM Sans SemiBold 14 px, Neutral/700 */}
        <span
          className={
            BODY2_SEMIBOLD +
            " whitespace-nowrap text-[var(--color-neutral-700)]"
          }
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {orgName}
        </span>
      </div>

      {/* ── Middle: event row + tags ── */}
      <div className="flex w-full flex-col gap-[var(--space-2)]">
        {/* Event row — DateBadge + text + filled bookmark */}
        <div className="flex w-full items-center gap-[var(--space-3)] rounded-[var(--radius-input)] bg-[var(--color-surface)] p-[var(--space-1-5)]">
          <DateBadge variant={thumbnailVariant} day={day} month={month} />

          {/* Title + subtitle */}
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <p
              className={
                BODY2_SEMIBOLD +
                " w-full truncate text-[var(--color-neutral-900)]"
              }
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {title}
            </p>

            {subtitleLines.length > 0 && (
              <div className="flex flex-col">
                {subtitleLines.map((line, i) => (
                  <p
                    key={i}
                    className={
                      BODY3 + " w-full truncate text-[var(--color-neutral-700)]"
                    }
                    style={{ fontVariationSettings: "'opsz' 14" }}
                  >
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Bookmark — always filled (orange) since this card is in the saved list */}
          <button
            type="button"
            aria-label="Remove bookmark"
            aria-pressed
            onClick={(e) => {
              e.stopPropagation();
              onUnbookmark?.();
            }}
            className="size-[var(--space-6)] shrink-0 cursor-pointer"
          >
            <BookmarkFilledIcon aria-hidden="true" className="size-full" />
          </button>
        </div>

        {/* Tags */}
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-[var(--space-2)]">
            {tags.map((label) => (
              <Tag key={label} color="neutral">
                {label}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {/* ── Action buttons ── */}
      {hasActions && (
        <div className="flex w-full gap-[var(--space-2)]">
          {onRsvp && (
            <Button
              variant="secondary"
              size="cta"
              className="flex-1"
              onClick={onRsvp}
            >
              RSVP
            </Button>
          )}
          {onAddToCalendar && (
            <Button
              variant="secondary"
              size="cta"
              className="flex-1"
              onClick={onAddToCalendar}
            >
              Add to Calendar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
