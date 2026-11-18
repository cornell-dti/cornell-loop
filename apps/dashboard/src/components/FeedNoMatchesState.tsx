/**
 * FeedNoMatchesState — shown in the Home / Bookmarks feed when posts exist
 * but none carry the active filter tag, so the list isn't silently blank.
 */

import { Button } from "@app/ui";

export interface FeedNoMatchesStateProps {
  /** The active filter tag that matched nothing. */
  tag: string;
  /** Clears the active filter. */
  onClear: () => void;
}

export function FeedNoMatchesState({ tag, onClear }: FeedNoMatchesStateProps) {
  return (
    <div
      role="status"
      className={[
        "flex w-full flex-col items-start gap-[var(--space-2)]",
        "rounded-[var(--radius-card)]",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "px-[var(--space-5)] py-[var(--space-4)]",
      ].join(" ")}
    >
      <h2
        className={[
          "font-[family-name:var(--font-body)] font-bold",
          "text-[length:var(--font-size-sub2)] leading-[var(--line-height-sub2)]",
          "tracking-[var(--letter-spacing-body1)]",
          "text-[color:var(--color-neutral-900)]",
        ].join(" ")}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        No posts found
      </h2>
      <p
        className={[
          "font-[family-name:var(--font-body)] font-normal",
          "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)]",
          "tracking-[var(--letter-spacing-body2)]",
          "text-[color:var(--color-text-secondary)]",
        ].join(" ")}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Nothing here is tagged &ldquo;{tag}&rdquo;. Try another tag or clear the
        filter.
      </p>
      <Button variant="secondary" size="sm" onClick={onClear}>
        Clear filter
      </Button>
    </div>
  );
}
