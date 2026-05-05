/**
 * ProfileFields — shared profile-form primitives.
 *
 * Pulled out of `pages/profile.tsx` so the same field UI powers both the
 * profile modal (saved state animation included) and the `/onboarding`
 * full-screen flow. The picker visuals match Figma node 633:4436 exactly —
 * the design system's `<Dropdown>` renders its own pill-shaped trigger which
 * doesn't fit the bare-text trigger inside this label/field combo, so the
 * trigger lives here.
 *
 * Exports:
 *   • <ProfileSelectField>    single-select label + popover
 *   • <ProfileInterestsField> multi-select tag picker with a + button
 *   • <ProfileFieldsForm>     orchestrates all four fields, controlled
 *
 * All design tokens live in `tokens.css`. No hardcoded colours / spacing.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Tag } from "@app/ui";
import {
  DEFAULT_GRAD_YEAR_OPTIONS,
  DEFAULT_INTEREST_OPTIONS,
  DEFAULT_MAJOR_OPTIONS,
  DEFAULT_MINOR_OPTIONS,
} from "../data/profileOptions";

// ─── Inline icon helpers ──────────────────────────────────────────────────────

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <line x1={8} y1={3} x2={8} y2={13} />
      <line x1={3} y1={8} x2={13} y2={8} />
    </svg>
  );
}

// ─── Shared typography class strings ─────────────────────────────────────────

const BODY2_REGULAR =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

// ─── ProfilePicker — inline popover used by every select-like field ───────────

interface ProfilePickerProps {
  open: boolean;
  options: readonly string[];
  selected?: string;
  onSelect: (value: string) => void;
  onRequestClose: () => void;
  /** Listbox accessibility id linked to the trigger. */
  listboxId: string;
  /** Tailwind alignment for the menu — "start" left-aligns, "end" right-aligns. */
  align?: "start" | "end";
}

function ProfilePicker({
  open,
  options,
  selected,
  onSelect,
  onRequestClose,
  listboxId,
  align = "start",
}: ProfilePickerProps) {
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open, onRequestClose]);

  if (!open) return null;

  const alignClass = align === "end" ? "right-0" : "left-0";

  return (
    <div
      ref={popRef}
      id={listboxId}
      role="listbox"
      className={[
        "absolute top-[calc(100%+var(--space-1))] z-20",
        alignClass,
        "max-h-[14rem] min-w-full overflow-y-auto",
        "flex flex-col",
        "border border-[var(--color-border)] bg-[var(--color-surface)]",
        "rounded-[var(--radius-card)] shadow-[var(--shadow-1)]",
        "p-[var(--space-1)]",
      ].join(" ")}
    >
      {options.map((opt) => {
        const isSelected = opt === selected;
        return (
          <button
            key={opt}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(opt)}
            className={[
              BODY2_REGULAR,
              "cursor-pointer text-left whitespace-nowrap",
              "px-[var(--space-3)] py-[var(--space-1-5)]",
              "rounded-[var(--radius-input)]",
              "transition-colors duration-150",
              isSelected
                ? "bg-[var(--color-primary-400)] text-[var(--color-primary-800)]"
                : "text-[var(--color-neutral-900)] hover:bg-[var(--color-surface-subtle)]",
            ].join(" ")}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── ProfileSelectField ───────────────────────────────────────────────────────

export interface ProfileSelectFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  options: readonly string[];
  onSelect: (value: string) => void;
  className?: string;
  pickerAlign?: "start" | "end";
  /** When true the trigger uses content-width (Grad Year). */
  compact?: boolean;
  disabled?: boolean;
}

export function ProfileSelectField({
  label,
  value,
  placeholder,
  options,
  onSelect,
  className,
  pickerAlign,
  compact = false,
  disabled = false,
}: ProfileSelectFieldProps) {
  const [openState, setOpen] = useState(false);
  // While disabled the popover is forcibly closed without writing state from
  // an effect — keeps the component a single render away from quiescence.
  const open = openState && !disabled;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (
        wrapperRef.current &&
        e.target instanceof Node &&
        !wrapperRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className={[
        "relative flex flex-col items-start gap-[var(--space-1)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={
          BODY2_REGULAR + " whitespace-nowrap text-[var(--color-text-muted)]"
        }
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {label}
      </span>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={`${label}${value !== undefined && value.length > 0 ? `: ${value}` : ""}`}
        className={[
          "flex items-center justify-between",
          compact ? "gap-[var(--space-2)]" : "w-full",
          "px-[var(--space-4)] py-[var(--space-1-5)]",
          "rounded-[var(--radius-card)]",
          "bg-[var(--color-surface)]",
          "border border-[var(--color-border)]",
          BODY2_REGULAR,
          value
            ? "text-[var(--color-neutral-900)]"
            : "text-[var(--color-neutral-500)]",
          "whitespace-nowrap",
          disabled
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer hover:bg-[var(--color-surface-subtle)]",
          "transition-colors duration-150",
        ].join(" ")}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        <span>{value ?? placeholder ?? ""}</span>
        <ChevronDownIcon
          className={[
            "size-[var(--space-4)] shrink-0 text-[var(--color-neutral-700)]",
            "transition-transform duration-150",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      <ProfilePicker
        open={open}
        options={options}
        selected={value}
        listboxId={listboxId}
        align={pickerAlign}
        onRequestClose={() => setOpen(false)}
        onSelect={(next) => {
          onSelect(next);
          setOpen(false);
        }}
      />
    </div>
  );
}

// ─── InterestPicker ───────────────────────────────────────────────────────────

interface InterestPickerProps {
  options: readonly string[];
  selected: string[];
  onSelect: (value: string) => void;
  onRequestClose: () => void;
}

function InterestPicker({
  options,
  selected,
  onSelect,
  onRequestClose,
}: InterestPickerProps) {
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

  const remaining = options.filter((o) => !selected.includes(o));

  return (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Add interest"
      className={[
        "absolute top-[calc(100%+var(--space-2))] left-0 z-20",
        "flex flex-wrap gap-[var(--space-2)]",
        "max-w-[20rem]",
        "p-[var(--space-3)]",
        "border border-[var(--color-border)] bg-[var(--color-surface)]",
        "rounded-[var(--radius-card)] shadow-[var(--shadow-1)]",
      ].join(" ")}
    >
      {remaining.length === 0 ? (
        <span
          className={
            BODY2_REGULAR +
            " px-[var(--space-1)] text-[var(--color-text-muted)]"
          }
        >
          All set!
        </span>
      ) : (
        remaining.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className="cursor-pointer transition-transform duration-150 hover:-translate-y-[1px]"
          >
            <Tag color="neutral">{opt}</Tag>
          </button>
        ))
      )}
    </div>
  );
}

// ─── ProfileInterestsField ────────────────────────────────────────────────────

export interface ProfileInterestsFieldProps {
  label?: string;
  interests: string[];
  options: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

export function ProfileInterestsField({
  label = "Interests",
  interests,
  options,
  onChange,
  disabled = false,
}: ProfileInterestsFieldProps) {
  const [pickerOpenState, setPickerOpen] = useState(false);
  // Derived: while the field is disabled the picker is forced closed without
  // writing state from an effect.
  const pickerOpen = pickerOpenState && !disabled;

  const handleRemove = (value: string) => {
    if (disabled) return;
    onChange(interests.filter((i) => i !== value));
  };

  const handleAdd = (value: string) => {
    if (disabled) return;
    if (interests.includes(value)) return;
    onChange([...interests, value]);
    setPickerOpen(false);
  };

  return (
    <div className="relative flex w-full flex-col items-start gap-[var(--space-1)]">
      <span
        className={
          BODY2_REGULAR + " whitespace-nowrap text-[var(--color-text-muted)]"
        }
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {label}
      </span>

      <div className="flex flex-wrap items-start gap-[var(--space-2)]">
        {interests.map((value) => (
          <Tag
            key={value}
            color="neutral"
            onDismiss={disabled ? undefined : () => handleRemove(value)}
          >
            {value}
          </Tag>
        ))}

        <button
          type="button"
          aria-label="Add interest"
          aria-expanded={pickerOpen}
          disabled={disabled}
          onClick={() => setPickerOpen((v) => !v)}
          className={[
            "inline-flex items-center justify-center",
            "px-[var(--space-2)] py-[var(--space-0-5)]",
            "rounded-[var(--radius-input)]",
            "bg-[var(--color-neutral-300)]",
            "text-[var(--color-neutral-700)]",
            disabled
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:bg-[var(--color-neutral-400)]",
            "transition-colors duration-150",
          ].join(" ")}
        >
          <PlusIcon className="size-[var(--space-4)]" />
        </button>
      </div>

      {pickerOpen && (
        <InterestPicker
          options={options}
          selected={interests}
          onSelect={handleAdd}
          onRequestClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ─── ProfileFieldsForm — controlled orchestrator ──────────────────────────────

export interface ProfileFieldsValue {
  major?: string;
  gradYear?: string;
  minor?: string;
  interests: string[];
}

export interface ProfileFieldsFormProps {
  value: ProfileFieldsValue;
  onChange: (next: ProfileFieldsValue) => void;
  disabled?: boolean;
  majorOptions?: readonly string[];
  gradYearOptions?: readonly string[];
  minorOptions?: readonly string[];
  interestOptions?: readonly string[];
  className?: string;
}

export function ProfileFieldsForm({
  value,
  onChange,
  disabled = false,
  majorOptions = DEFAULT_MAJOR_OPTIONS,
  gradYearOptions = DEFAULT_GRAD_YEAR_OPTIONS,
  minorOptions = DEFAULT_MINOR_OPTIONS,
  interestOptions = DEFAULT_INTEREST_OPTIONS,
  className,
}: ProfileFieldsFormProps) {
  const update = <K extends keyof ProfileFieldsValue>(
    key: K,
    next: ProfileFieldsValue[K],
  ) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <div
      className={[
        "flex w-full flex-col items-start gap-[var(--space-3)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Major + Grad Year row */}
      <div className="flex w-full items-start gap-[var(--space-4)]">
        <ProfileSelectField
          label="Major"
          value={value.major}
          placeholder="Select major"
          options={majorOptions}
          onSelect={(v) => update("major", v)}
          className="min-w-0 flex-1"
          disabled={disabled}
        />
        <ProfileSelectField
          label="Grad Year"
          value={value.gradYear}
          placeholder="Year"
          options={gradYearOptions}
          onSelect={(v) => update("gradYear", v)}
          className="shrink-0"
          pickerAlign="end"
          compact
          disabled={disabled}
        />
      </div>

      {/* Minor */}
      <div className="flex w-full items-start">
        <ProfileSelectField
          label="Minor"
          value={value.minor}
          placeholder="Select minor"
          options={minorOptions}
          onSelect={(v) => update("minor", v)}
          className="min-w-0 flex-1"
          disabled={disabled}
        />
      </div>

      {/* Interests */}
      <ProfileInterestsField
        interests={value.interests}
        options={interestOptions}
        onChange={(next) => update("interests", next)}
        disabled={disabled}
      />
    </div>
  );
}
