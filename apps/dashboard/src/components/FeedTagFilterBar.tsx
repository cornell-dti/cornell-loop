/**
 * FeedTagFilterBar — horizontal tag filter row shared by Home and Bookmarks.
 *
 * Shows the user's pinned filter tags (see `useFilterTags`). Clicking a tag
 * selects it as the active filter; clicking it again clears the filter. The
 * trailing "+" opens a picker over the canonical tag set where tags can be
 * pinned to or unpinned from the bar (Figma node 263:3552).
 */

import { useEffect, useRef, useState } from "react";
import { Tag } from "@app/ui";
import { CANONICAL_TAGS, type CanonicalTag } from "../../convex/lib/tags";
import { useFilterTags } from "../lib/useFilterTags";

export interface FeedTagFilterBarProps {
  /** Currently active filter tag, or null when the feed is unfiltered. */
  selectedTag: string | null;
  /** Called with the next active filter tag (null clears the filter). */
  onSelectedTagChange: (tag: string | null) => void;
}

export function FeedTagFilterBar({
  selectedTag,
  onSelectedTagChange,
}: FeedTagFilterBarProps) {
  const { tags, setTags } = useFilterTags();
  const [pickerOpen, setPickerOpen] = useState(false);

  const togglePinned = (tag: CanonicalTag) => {
    if (tags.includes(tag)) {
      setTags(tags.filter((t) => t !== tag));
      if (selectedTag === tag) onSelectedTagChange(null);
      return;
    }
    // Keep the bar in canonical order regardless of pin order.
    setTags(CANONICAL_TAGS.filter((t) => t === tag || tags.includes(t)));
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-[var(--space-3)] overflow-x-auto">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            aria-pressed={selectedTag === tag}
            onClick={() =>
              onSelectedTagChange(selectedTag === tag ? null : tag)
            }
            className="shrink-0 cursor-pointer"
          >
            <Tag color={selectedTag === tag ? "blue" : "neutral"}>{tag}</Tag>
          </button>
        ))}

        <button
          type="button"
          aria-label="Edit filter tags"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className="shrink-0 cursor-pointer"
        >
          <Tag color="neutral">+</Tag>
        </button>
      </div>

      {pickerOpen && (
        <FilterTagPicker
          pinned={tags}
          onToggle={togglePinned}
          onRequestClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── FilterTagPicker ──────────────────────────────────────────────────────────

interface FilterTagPickerProps {
  pinned: readonly CanonicalTag[];
  onToggle: (tag: CanonicalTag) => void;
  onRequestClose: () => void;
}

function FilterTagPicker({
  pinned,
  onToggle,
  onRequestClose,
}: FilterTagPickerProps) {
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (
        popRef.current &&
        e.target instanceof Node &&
        !popRef.current.contains(e.target)
      ) {
        onRequestClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onRequestClose();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onRequestClose]);

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Edit filter tags"
      className={[
        "absolute top-[calc(100%+var(--space-2))] left-0 z-20",
        "flex max-w-[24rem] flex-wrap gap-[var(--space-2)]",
        "p-[var(--space-3)]",
        "border border-[var(--color-border)] bg-[var(--color-surface)]",
        "rounded-[var(--radius-card)] shadow-[var(--shadow-1)]",
      ].join(" ")}
    >
      {CANONICAL_TAGS.map((tag) => {
        const isPinned = pinned.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={isPinned}
            onClick={() => onToggle(tag)}
            className="cursor-pointer transition-transform duration-150 hover:-translate-y-[1px]"
          >
            <Tag color={isPinned ? "blue" : "neutral"}>{tag}</Tag>
          </button>
        );
      })}
    </div>
  );
}
