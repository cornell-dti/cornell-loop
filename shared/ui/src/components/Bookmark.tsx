import { Bookmark as BookmarkIcon } from "lucide-react";

export interface BookmarkProps {
  /** Whether the item is currently bookmarked. */
  bookmarked: boolean;
  /** Called when the button is clicked. */
  onToggle?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** CSS class applied to the outer button. */
  className?: string;
  /** CSS class for the icon size. Defaults to 16px (--space-4). */
  iconClassName?: string;
}

/**
 * Bookmark toggle button.
 *
 * Figma states (node 493:1041):
 *   Default → Bookmark outline, stroke Neutral/500 (#ADB5BD)
 *   Saved   → Bookmark filled,  fill Primary/700 (#EB7128)
 *   Hover (unsaved) → darkens to Neutral/700
 */
export function Bookmark({
  bookmarked,
  onToggle,
  className,
  iconClassName = "size-[var(--space-4)]",
}: BookmarkProps) {
  return (
    <button
      type="button"
      data-testid="bookmark-button"
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
      aria-pressed={bookmarked}
      onClick={onToggle}
      className={["group shrink-0 cursor-pointer", className]
        .filter(Boolean)
        .join(" ")}
    >
      {bookmarked ? (
        <BookmarkIcon
          aria-hidden="true"
          fill="currentColor"
          className={`${iconClassName} text-[color:var(--color-primary-700)] transition-opacity duration-150 group-hover:opacity-70`}
        />
      ) : (
        <BookmarkIcon
          aria-hidden="true"
          className={
            `${iconClassName} ` +
            "text-[color:var(--color-neutral-500)] " +
            "group-hover:text-[color:var(--color-neutral-700)] " +
            "transition-colors duration-150"
          }
        />
      )}
    </button>
  );
}
