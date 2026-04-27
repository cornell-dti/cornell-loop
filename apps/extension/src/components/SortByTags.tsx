/**
 * SortByTags — reusable sort/filter tag strip.
 *
 * Used in BookmarkView and SearchView. Manages:
 *   • Active tag toggling (click to filter; active tags use primary/orange bg)
 *   • Custom tag addition via a "+" inline input (press Enter or blur to add)
 *   • Edit mode via pencil icon: Tag's built-in onDismiss renders the design-
 *     system × button; click × to delete the tag
 */

import { useRef, useState } from "react";
import { Tag } from "@app/ui";
import EditIcon from "@app/ui/assets/edit_icon.svg?react";

export interface SortByTagsProps {
  tags: string[];
  activeTags: string[];
  onTagToggle: (tag: string) => void;
  onTagAdd: (tag: string) => void;
  onTagRemove: (tag: string) => void;
}

export function SortByTags({
  tags,
  activeTags,
  onTagToggle,
  onTagAdd,
  onTagRemove,
}: SortByTagsProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commitNewTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onTagAdd(trimmed);
    }
    setInputValue("");
    setShowInput(false);
  };

  const handlePlusClick = () => {
    setShowInput(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
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

      {/* "+" add new tag — hidden while editing */}
      {!isEditMode && !showInput && (
        <Tag
          color="neutral"
          className="cursor-pointer"
          onClick={handlePlusClick}
          aria-label="Add custom tag"
        >
          +
        </Tag>
      )}

      {/* Inline custom tag input */}
      {showInput && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitNewTag();
            if (e.key === "Escape") {
              setInputValue("");
              setShowInput(false);
            }
          }}
          onBlur={commitNewTag}
          placeholder="New tag…"
          className={[
            "h-[var(--space-6)] w-[90px] rounded-[var(--radius-button)]",
            "border border-[var(--color-primary-700)] bg-white",
            "px-[var(--space-2)] text-[length:var(--font-size-body3)]",
            "font-[family-name:var(--font-body)] font-normal",
            "text-[var(--color-neutral-900)] outline-none",
          ].join(" ")}
        />
      )}

      {/* Pencil / edit-mode toggle */}
      <button
        type="button"
        aria-label={isEditMode ? "Done editing tags" : "Edit filter tags"}
        aria-pressed={isEditMode}
        onClick={() => setIsEditMode((e) => !e)}
        className={[
          "size-4 shrink-0 cursor-pointer transition-opacity",
          isEditMode ? "opacity-100" : "opacity-60 hover:opacity-100",
        ].join(" ")}
      >
        <EditIcon className="size-full" />
      </button>
    </div>
  );
}
