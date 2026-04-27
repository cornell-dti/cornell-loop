/**
 * SearchOverlay — dropdown rendered beneath the SearchBar inside Home.
 *
 * Source: Figma "Incubator-design-file" search-experience nodes
 *   • 507:1517  Default  (recent searches)
 *   • 515:2082  Typing   (live suggestions)
 *   • 515:2413  Results  — handled by ResultsView in the page itself; this
 *                          overlay only owns the empty + typing dropdowns.
 *
 * Behaviour:
 *   • Empty input  → "Recent" panel: list of past queries with × per item
 *                    and a "Clear all" link. History (clock) icon prefix.
 *   • Typing       → live filtered suggestions. Event suggestions get a
 *                    newspaper icon, org suggestions get a coloured dot.
 *   • Keyboard     → ↑/↓ move highlight, Enter activates, Esc closes.
 *
 * The panel mirrors the Figma drop-shadow card (rounded 16, --shadow-1) and
 * is rendered absolutely below the SearchBar. The parent (Home) is
 * responsible for show/hide based on focus + mode.
 *
 * All colours, spacing, and font values reference tokens.css — nothing
 * hardcoded.
 */

import { useEffect, useRef } from "react";
import { Clock, Newspaper, X } from "lucide-react";
import type { RecentSearch, SearchSuggestion } from "../data/sampleSearch";
import { fallbackColorsForName } from "@app/ui";
import { filterSuggestions } from "./searchOverlayUtils";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SearchOverlayProps {
  /** Current input value — drives empty vs typing mode. */
  query: string;
  /** Past queries shown in the empty state. */
  recents: RecentSearch[];
  /** Suggestion pool filtered while the user types. */
  suggestions: SearchSuggestion[];
  /** Activate a recent or suggestion (sets the query and dismisses). */
  onSelect: (label: string) => void;
  /** Remove a single recent. */
  onRemoveRecent: (id: string) => void;
  /** Clear all recents. */
  onClearRecents: () => void;
  /** Highlighted index for keyboard navigation. */
  activeIndex: number;
  /** Called when the user hovers/keyboard-moves to a row. */
  onActiveIndexChange: (index: number) => void;
}

// ─── Shared typography ────────────────────────────────────────────────────────

const BODY2_REG =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

const BODY2_SEMI =
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

// ─── Subcomponents ────────────────────────────────────────────────────────────

function OrgDot({ name }: { name: string }) {
  const fb = fallbackColorsForName(name);
  return (
    <span
      aria-hidden="true"
      className="size-[var(--space-4)] shrink-0 rounded-full"
      style={{ backgroundColor: fb.bg }}
    />
  );
}

function RowChrome({
  active,
  onMouseEnter,
  onMouseDown,
  children,
  trailing,
  id,
}: {
  active: boolean;
  onMouseEnter: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  id: string;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      className={[
        "flex w-full items-center justify-between",
        "gap-[var(--space-2)]",
        "rounded-[var(--radius-input)] px-[var(--space-2)] py-[var(--space-1)]",
        "cursor-pointer",
        active ? "bg-[var(--color-surface-subtle)]" : "bg-transparent",
        "transition-colors duration-150",
      ].join(" ")}
    >
      {children}
      {trailing}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SearchOverlay({
  query,
  recents,
  suggestions,
  onSelect,
  onRemoveRecent,
  onClearRecents,
  activeIndex,
  onActiveIndexChange,
}: SearchOverlayProps) {
  const isTyping = query.trim().length > 0;
  const filtered = isTyping ? filterSuggestions(query, suggestions) : [];

  // Scroll the highlighted row into view when keyboard navigation moves it.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(
      `[data-row-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // ── Empty state — Recent ────────────────────────────────────────────────
  if (!isTyping) {
    if (recents.length === 0) {
      return (
        <div
          role="listbox"
          aria-label="Recent searches"
          className={[
            "flex flex-col items-start justify-center",
            "gap-[var(--space-3)]",
            "rounded-[var(--radius-card)]",
            "bg-[var(--color-surface)]",
            "border border-[var(--color-border)]",
            "shadow-[var(--shadow-1)]",
            "px-[var(--space-4)] py-[var(--space-3)]",
            "w-full",
          ].join(" ")}
        >
          <p
            className={BODY2_REG + " text-[color:var(--color-text-secondary)]"}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            No recent searches yet — start typing to discover events and orgs.
          </p>
        </div>
      );
    }

    return (
      <div
        role="listbox"
        aria-label="Recent searches"
        ref={listRef}
        className={[
          "flex flex-col items-start justify-center",
          "gap-[var(--space-3)]",
          "rounded-[var(--radius-card)]",
          "bg-[var(--color-surface)]",
          "border border-[var(--color-border)]",
          "shadow-[var(--shadow-1)]",
          "px-[var(--space-4)] py-[var(--space-3)]",
          "w-full",
        ].join(" ")}
      >
        {/* Header: "Recent" + Clear all */}
        <div className="flex w-full items-center justify-between">
          <p
            className={BODY2_SEMI + " text-[color:var(--color-neutral-700)]"}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Recent
          </p>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onClearRecents();
            }}
            className={[
              BODY2_REG,
              "text-[color:var(--color-text-secondary)]",
              "cursor-pointer",
              "hover:text-[color:var(--color-text-default)]",
              "hover:underline",
              "transition-colors duration-150",
            ].join(" ")}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Clear all
          </button>
        </div>

        <div className="flex w-full flex-col gap-[var(--space-1)]">
          {recents.map((r, i) => {
            const active = i === activeIndex;
            return (
              <div key={r.id} data-row-index={i}>
                <RowChrome
                  id={`search-recent-${r.id}`}
                  active={active}
                  onMouseEnter={() => onActiveIndexChange(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(r.label);
                  }}
                  trailing={
                    <button
                      type="button"
                      aria-label={`Remove "${r.label}" from recent searches`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemoveRecent(r.id);
                      }}
                      className={[
                        "shrink-0 cursor-pointer",
                        "size-[var(--space-3)]",
                        "text-[color:var(--color-neutral-500)]",
                        "hover:text-[color:var(--color-neutral-700)]",
                        "transition-colors duration-150",
                      ].join(" ")}
                    >
                      <X aria-hidden="true" className="size-full" />
                    </button>
                  }
                >
                  <div className="flex min-w-0 items-center gap-[var(--space-2)]">
                    {r.kind === "org" ? (
                      <OrgDot name={r.label} />
                    ) : (
                      <Clock
                        aria-hidden="true"
                        className="size-[var(--space-4)] shrink-0 text-[color:var(--color-neutral-600)]"
                      />
                    )}
                    <span
                      className={
                        BODY2_REG +
                        " min-w-0 truncate text-[color:var(--color-neutral-600)]"
                      }
                      style={{ fontVariationSettings: "'opsz' 14" }}
                    >
                      {r.label}
                    </span>
                  </div>
                </RowChrome>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Typing state — live suggestions ─────────────────────────────────────
  if (filtered.length === 0) {
    return (
      <div
        role="listbox"
        aria-label="Search suggestions"
        className={[
          "flex flex-col items-start justify-center",
          "rounded-[var(--radius-card)]",
          "bg-[var(--color-surface)]",
          "border border-[var(--color-border)]",
          "shadow-[var(--shadow-1)]",
          "px-[var(--space-4)] py-[var(--space-3)]",
          "w-full",
        ].join(" ")}
      >
        <p
          className={BODY2_REG + " text-[color:var(--color-text-secondary)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          No matches for &ldquo;{query}&rdquo; — press Enter to search anyway.
        </p>
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Search suggestions"
      ref={listRef}
      className={[
        "flex flex-col items-start justify-center",
        "gap-[var(--space-2)]",
        "rounded-[var(--radius-card)]",
        "bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "shadow-[var(--shadow-1)]",
        "px-[var(--space-4)] py-[var(--space-3)]",
        "w-full",
      ].join(" ")}
    >
      <div className="flex w-full flex-col gap-[var(--space-1)]">
        {filtered.map((s, i) => {
          const active = i === activeIndex;
          return (
            <div key={s.id} data-row-index={i}>
              <RowChrome
                id={`search-suggest-${s.id}`}
                active={active}
                onMouseEnter={() => onActiveIndexChange(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(s.label);
                }}
              >
                <div className="flex min-w-0 items-center gap-[var(--space-2)]">
                  {s.kind === "event" ? (
                    <Newspaper
                      aria-hidden="true"
                      className="size-[var(--space-4)] shrink-0 text-[color:var(--color-neutral-600)]"
                    />
                  ) : (
                    <OrgDot name={s.label} />
                  )}
                  <span
                    className={
                      BODY2_REG +
                      " min-w-0 truncate text-[color:var(--color-neutral-600)]"
                    }
                    style={{ fontVariationSettings: "'opsz' 14" }}
                  >
                    {s.label}
                  </span>
                  {s.meta && (
                    <span
                      className={
                        BODY2_REG +
                        " shrink-0 truncate text-[color:var(--color-text-muted)]"
                      }
                      style={{ fontVariationSettings: "'opsz' 14" }}
                    >
                      · {s.meta}
                    </span>
                  )}
                </div>
              </RowChrome>
            </div>
          );
        })}
      </div>
    </div>
  );
}
