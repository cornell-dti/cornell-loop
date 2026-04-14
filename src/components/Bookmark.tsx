import BookmarkIcon from "../assets/bookmark.svg?react";
import BookmarkFilledIcon from "../assets/bookmark-filled.svg?react";

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
 *   Default → bookmark.svg       stroke Neutral/500 (#ADB5BD)
 *   Saved   → bookmark-filled.svg fill Primary/700 (#EB7128)
 *   Hover (unsaved) → darkens via --filter-icon-close-default
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
      aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
      aria-pressed={bookmarked}
      onClick={onToggle}
      className={["group shrink-0 cursor-pointer", className]
        .filter(Boolean)
        .join(" ")}
    >
      {bookmarked ? (
        <BookmarkFilledIcon
          aria-hidden="true"
          className={`${iconClassName} transition-opacity duration-150 group-hover:opacity-70`}
        />
      ) : (
        <BookmarkIcon
          aria-hidden="true"
          className={
            `${iconClassName} ` +
            "group-hover:[filter:var(--filter-icon-close-default)] " +
            "transition-[filter] duration-150"
          }
        />
      )}
    </button>
  );
}
