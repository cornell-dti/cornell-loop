/**
 * FeedTagFilterBar — horizontal tag filter row shared by Home and Bookmarks.
 *
 * Shows the user's pinned filter tags (see `useFilterTags`). Filtering and
 * editing are kept separate, matching the extension's SortByTags:
 *   • Click a tag to make it the active filter (blue); click again to clear.
 *   • "+" opens a picker of canonical tags not yet on the bar; click one to
 *     pin it.
 *   • The pencil toggles edit mode, where each tag shows × to unpin it.
 * Blue only ever means "active filter" (Figma node 263:3552).
 */

import { useEffect, useRef, useState } from "react";
import { Tag } from "@app/ui";
import EditIcon from "@app/ui/assets/edit_icon.svg?react";
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
  const [isEditMode, setIsEditMode] = useState(false);

  const unpinned = CANONICAL_TAGS.filter((t) => !tags.includes(t));

  const pinTag = (tag: CanonicalTag) => {
    // Keep the bar in canonical order regardless of pin order.
    setTags(CANONICAL_TAGS.filter((t) => t === tag || tags.includes(t)));
    if (unpinned.length === 1) setPickerOpen(false);
  };

  const unpinTag = (tag: CanonicalTag) => {
    setTags(tags.filter((t) => t !== tag));
    if (selectedTag === tag) onSelectedTagChange(null);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-[var(--space-3)] overflow-x-auto">
        {tags.map((tag) =>
          isEditMode ? (
            <Tag
              key={tag}
              color="neutral"
              onDismiss={() => unpinTag(tag)}
              dismissLabel={`Remove ${tag}`}
              className="shrink-0"
            >
              {tag}
            </Tag>
          ) : (
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
          ),
        )}

        {/* "+" opens the picker of unpinned tags — hidden while editing. */}
        {!isEditMode && unpinned.length > 0 && (
          <button
            type="button"
            aria-label="Add filter tag"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
            className="shrink-0 cursor-pointer"
          >
            <Tag color="neutral">+</Tag>
          </button>
        )}

        {/* Pencil toggles edit mode (× on each tag to unpin it). */}
        <button
          type="button"
          aria-label={isEditMode ? "Done editing tags" : "Edit filter tags"}
          aria-pressed={isEditMode}
          onClick={() => {
            setIsEditMode((editing) => !editing);
            setPickerOpen(false);
          }}
          className={[
            "size-[var(--space-4)] shrink-0 cursor-pointer transition-opacity",
            isEditMode ? "opacity-100" : "opacity-60 hover:opacity-100",
          ].join(" ")}
        >
          <EditIcon className="size-full" />
        </button>
      </div>

      {pickerOpen && !isEditMode && unpinned.length > 0 && (
        <AddTagPicker
          tags={unpinned}
          onAdd={pinTag}
          onRequestClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── AddTagPicker ─────────────────────────────────────────────────────────────

interface AddTagPickerProps {
  /** Canonical tags not yet on the bar. */
  tags: readonly CanonicalTag[];
  onAdd: (tag: CanonicalTag) => void;
  onRequestClose: () => void;
}

function AddTagPicker({ tags, onAdd, onRequestClose }: AddTagPickerProps) {
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
      aria-label="Add filter tag"
      className={[
        "absolute top-[calc(100%+var(--space-2))] left-0 z-20",
        "flex max-w-[24rem] flex-wrap gap-[var(--space-2)]",
        "p-[var(--space-3)]",
        "border border-[var(--color-border)] bg-[var(--color-surface)]",
        "rounded-[var(--radius-card)] shadow-[var(--shadow-1)]",
      ].join(" ")}
    >
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onAdd(tag)}
          aria-label={`Add ${tag}`}
          className="cursor-pointer transition-transform duration-150 hover:-translate-y-[1px]"
        >
          <Tag color="neutral">+ {tag}</Tag>
        </button>
      ))}
    </div>
  );
}
