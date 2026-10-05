/**
 * SortByTags — reusable sort/filter tag strip.
 *
 * Used in BookmarkView and SearchView. Manages:
 *   • Active tag toggling (click to filter; active tags use the blue bg)
 *   • "+" opens a picker of canonical tags not yet in the strip; click one to
 *     pin it (tags are limited to the shared set in `convex/lib/tags.ts`)
 *   • Edit mode via pencil icon: Tag's built-in onDismiss renders the design-
 *     system × button; click × to unpin the tag
 */

import { useState } from "react";
import { Tag } from "@app/ui";
import EditIcon from "@app/ui/assets/edit_icon.svg?react";
import { CANONICAL_TAGS, type CanonicalTag } from "@app/convex/lib/tags";

export interface SortByTagsProps {
  tags: CanonicalTag[];
  activeTags: string[];
  onTagToggle: (tag: CanonicalTag) => void;
  onTagAdd: (tag: CanonicalTag) => void;
  onTagRemove: (tag: CanonicalTag) => void;
}

export function SortByTags({
  tags,
  activeTags,
  onTagToggle,
  onTagAdd,
  onTagRemove,
}: SortByTagsProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const unpinned = CANONICAL_TAGS.filter((t) => !tags.includes(t));

  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <div className="flex flex-wrap items-center gap-[9px]">
        {tags.map((label) => {
          const isActive = activeTags.includes(label);

          return (
            <Tag
              key={label}
              color={isActive ? "blue" : "neutral"}
              className={!isEditMode ? "cursor-pointer" : undefined}
              onClick={!isEditMode ? () => onTagToggle(label) : undefined}
              // In edit mode: show the design-system × dismiss button
              onDismiss={isEditMode ? () => onTagRemove(label) : undefined}
              dismissLabel={`Remove ${label}`}
              aria-pressed={!isEditMode ? isActive : undefined}
            >
              {label}
            </Tag>
          );
        })}

        {/* "+" opens the canonical tag picker — hidden while editing */}
        {!isEditMode && unpinned.length > 0 && (
          <button
            type="button"
            aria-label="Add filter tag"
            aria-expanded={showPicker}
            onClick={() => setShowPicker((open) => !open)}
            className="cursor-pointer"
          >
            <Tag color={showPicker ? "blue" : "neutral"}>+</Tag>
          </button>
        )}

        {/* Pencil / edit-mode toggle */}
        <button
          type="button"
          aria-label={isEditMode ? "Done editing tags" : "Edit filter tags"}
          aria-pressed={isEditMode}
          onClick={() => {
            setIsEditMode((e) => !e);
            setShowPicker(false);
          }}
          className={[
            "size-4 shrink-0 cursor-pointer transition-opacity",
            isEditMode ? "opacity-100" : "opacity-60 hover:opacity-100",
          ].join(" ")}
        >
          <EditIcon className="size-full" />
        </button>
      </div>

      {/* Canonical tag picker */}
      {showPicker && !isEditMode && unpinned.length > 0 && (
        <div
          role="group"
          aria-label="Add filter tag"
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowPicker(false);
          }}
          className={[
            "flex flex-wrap gap-[var(--space-2)] p-[var(--space-2)]",
            "rounded-[var(--radius-card)] border border-[var(--color-border)]",
            "bg-[var(--color-surface)]",
          ].join(" ")}
        >
          {unpinned.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onTagAdd(label);
                if (unpinned.length === 1) setShowPicker(false);
              }}
              className="cursor-pointer"
            >
              <Tag color="neutral">{label}</Tag>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
