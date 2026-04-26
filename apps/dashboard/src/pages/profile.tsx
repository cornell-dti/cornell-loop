/**
 * Profile — Loop Dashboard Popup
 *
 * Source: Figma "Incubator-design-file"
 *   • Default modal: node 633:4436
 *   • Saved state:   node 633:4779 ("Recalibrating your feed…" + progress bar)
 *
 * The card houses a profile-setup form: Major, Grad Year, Minor, Interests.
 * Pickers are inline popovers built on a small <ProfilePicker> primitive — the
 * design-system <Dropdown> component renders its own pill-shaped trigger which
 * doesn't match this Figma's bare-text trigger inside the labelled field, so
 * the trigger is rendered locally and only the option menu is shared logic.
 *
 * Saved state — when `saved` is true the card swaps to a smaller variant with
 * the headline "Recalibrating your feed…" and a horizontal progress bar that
 * fills from 0 → 100% over ~1.2s, matching Figma node 633:4803/5107/5108.
 *
 * Card shadow: Figma specifies drop-shadow(0px 3px 3px rgba(33,37,41,0.15))
 *              + drop-shadow(0px 0px 0.5px rgba(33,37,41,0.32)) — closest token
 *              is --shadow-1 which uses 6px / 1px radii (visually equivalent).
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing else is hardcoded.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { Tag, Button } from "@app/ui";

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

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <line x1={3} y1={3} x2={13} y2={13} />
      <line x1={13} y1={3} x2={3} y2={13} />
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

// ─── Default option lists ─────────────────────────────────────────────────────

const DEFAULT_MAJOR_OPTIONS: readonly string[] = [
  "Computer Science",
  "Information Science",
  "ECE",
  "ORIE",
  "Mechanical Engineering",
  "Economics",
  "Biology",
  "Government",
  "Psychology",
  "Mathematics",
];

const DEFAULT_GRAD_YEAR_OPTIONS: readonly string[] = [
  "2026",
  "2027",
  "2028",
  "2029",
];

const DEFAULT_MINOR_OPTIONS: readonly string[] = [
  "Linguistics",
  "Business",
  "Data Science",
  "Game Design",
  "Music",
  "Inequality Studies",
  "Statistics",
  "Creative Writing",
];

const DEFAULT_INTEREST_OPTIONS: readonly string[] = [
  "Tech",
  "Finance",
  "Health",
  "Education",
  "Outdoors",
  "Mentorship",
  "Just for Fun",
  "Entrepreneurship",
  "Arts",
  "Sports",
  "Service",
  "Research",
];

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ProfileProps extends ComponentPropsWithoutRef<"div"> {
  /** First name shown in the greeting. Falls back to "there!" when omitted. */
  userName?: string;

  major?: string;
  onMajorChange?: (next: string) => void;
  majorOptions?: readonly string[];

  gradYear?: string;
  onGradYearChange?: (next: string) => void;
  gradYearOptions?: readonly string[];

  minor?: string;
  onMinorChange?: (next: string) => void;
  minorOptions?: readonly string[];

  /** Selected interest tag labels, e.g. ["Tech", "Health"]. */
  interests?: string[];
  onInterestsChange?: (next: string[]) => void;
  interestOptions?: readonly string[];

  /** When true, render the post-save confirmation variant. */
  saved?: boolean;
  /** Called when "Save changes" is clicked. */
  onSave?: () => void;
  /** Called when × is clicked. */
  onClose?: () => void;
}

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

interface ProfileSelectFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  options: readonly string[];
  onSelect: (value: string) => void;
  className?: string;
  pickerAlign?: "start" | "end";
  /** When true the trigger uses content-width (Grad Year). */
  compact?: boolean;
}

function ProfileSelectField({
  label,
  value,
  placeholder,
  options,
  onSelect,
  className,
  pickerAlign,
  compact = false,
}: ProfileSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;

  // Close picker when major/year/minor changes externally
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
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
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
          "cursor-pointer whitespace-nowrap",
          "hover:bg-[var(--color-surface-subtle)]",
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

// ─── SavedState — "Recalibrating your feed…" variant (Figma 633:4779) ────────

function SavedState() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate 0 → 100% over ~1.2s using a single rAF-driven setTimeout chain.
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const pct = Math.min(100, ((now - start) / 1200) * 100);
      setProgress(pct);
      if (pct < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex w-full flex-col items-center gap-[var(--space-6)]">
      <h2
        className={
          "font-[family-name:var(--font-heading)] font-bold " +
          "leading-[var(--line-height-body1)] text-[var(--font-size-body1)] " +
          "tracking-[var(--letter-spacing-body1)] " +
          "text-center text-[var(--color-neutral-900)]"
        }
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Recalibrating your feed…
      </h2>
      <div
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Saving your profile"
        className={[
          "relative h-[10px] w-[20.1875rem]" /* 323px from Figma */,
          "overflow-hidden rounded-[var(--space-3)] bg-[var(--color-primary-400)]",
        ].join(" ")}
      >
        <div
          className="h-full rounded-[var(--space-3)] bg-[var(--color-primary-700)]"
          style={{
            width: `${progress}%`,
            transition: "width 16ms linear",
          }}
        />
      </div>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function Profile({
  userName,
  major,
  onMajorChange,
  majorOptions = DEFAULT_MAJOR_OPTIONS,
  gradYear,
  onGradYearChange,
  gradYearOptions = DEFAULT_GRAD_YEAR_OPTIONS,
  minor,
  onMinorChange,
  minorOptions = DEFAULT_MINOR_OPTIONS,
  interests = [],
  onInterestsChange,
  interestOptions = DEFAULT_INTEREST_OPTIONS,
  saved = false,
  onSave,
  onClose,
  className,
  ...rest
}: ProfileProps) {
  const [interestPickerOpen, setInterestPickerOpen] = useState(false);

  const handleRemoveInterest = (label: string) => {
    onInterestsChange?.(interests.filter((i) => i !== label));
  };

  const handleAddInterest = (label: string) => {
    if (interests.includes(label)) return;
    onInterestsChange?.([...interests, label]);
    setInterestPickerOpen(false);
  };

  return (
    <div
      className={[
        "relative flex flex-col items-center gap-[var(--space-6)]",
        "w-[30.5rem]" /* 488px — Figma card width */,
        "px-[var(--space-6)] py-[var(--space-8)]",
        "rounded-[var(--radius-card)]",
        "bg-[var(--color-surface)]",
        "shadow-[var(--shadow-1)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label="Profile setup"
      {...rest}
    >
      {/* Close button (always visible, top-right) */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={[
          "absolute top-[var(--space-4)] right-[var(--space-4)]",
          "flex items-center justify-center",
          "size-[var(--space-4)]",
          "text-[var(--color-neutral-700)]",
          "cursor-pointer",
          "hover:text-[var(--color-neutral-900)]",
          "transition-colors duration-150",
        ].join(" ")}
      >
        <XIcon className="size-full" />
      </button>

      {saved ? (
        <SavedState />
      ) : (
        <>
          {/* Greeting — Figma: DM Sans Bold 18px, centred */}
          <h2
            className={
              "font-[family-name:var(--font-heading)] font-bold " +
              "leading-[var(--line-height-body1)] text-[var(--font-size-body1)] " +
              "tracking-[var(--letter-spacing-body1)] " +
              "w-full text-center text-[var(--color-neutral-900)]"
            }
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {userName ? `Hi ${userName}!` : "Hi there!"}
          </h2>

          {/* Form fields */}
          <div className="flex w-full flex-col items-start gap-[var(--space-3)]">
            {/* Major + Grad Year row */}
            <div className="flex w-full items-start gap-[var(--space-4)]">
              <ProfileSelectField
                label="Major"
                value={major}
                placeholder="Select major"
                options={majorOptions}
                onSelect={(v) => onMajorChange?.(v)}
                className="min-w-0 flex-1"
              />
              <ProfileSelectField
                label="Grad Year"
                value={gradYear}
                placeholder="Year"
                options={gradYearOptions}
                onSelect={(v) => onGradYearChange?.(v)}
                className="shrink-0"
                pickerAlign="end"
                compact
              />
            </div>

            {/* Minor */}
            <div className="flex w-full items-start">
              <ProfileSelectField
                label="Minor"
                value={minor}
                placeholder="Select minor"
                options={minorOptions}
                onSelect={(v) => onMinorChange?.(v)}
                className="min-w-0 flex-1"
              />
            </div>

            {/* Interests */}
            <div className="relative flex w-full flex-col items-start gap-[var(--space-1)]">
              <span
                className={
                  BODY2_REGULAR +
                  " whitespace-nowrap text-[var(--color-text-muted)]"
                }
                style={{ fontVariationSettings: "'opsz' 14" }}
              >
                Interests
              </span>

              <div className="flex flex-wrap items-start gap-[var(--space-2)]">
                {interests.map((label) => (
                  <Tag
                    key={label}
                    color="neutral"
                    onDismiss={() => handleRemoveInterest(label)}
                  >
                    {label}
                  </Tag>
                ))}

                <button
                  type="button"
                  aria-label="Add interest"
                  aria-expanded={interestPickerOpen}
                  onClick={() => setInterestPickerOpen((v) => !v)}
                  className={[
                    "inline-flex items-center justify-center",
                    "px-[var(--space-2)] py-[var(--space-0-5)]",
                    "rounded-[var(--radius-input)]",
                    "bg-[var(--color-neutral-300)]",
                    "text-[var(--color-neutral-700)]",
                    "hover:bg-[var(--color-neutral-400)]",
                    "cursor-pointer transition-colors duration-150",
                  ].join(" ")}
                >
                  <PlusIcon className="size-[var(--space-4)]" />
                </button>
              </div>

              {interestPickerOpen && (
                <InterestPicker
                  options={interestOptions}
                  selected={interests}
                  onSelect={handleAddInterest}
                  onRequestClose={() => setInterestPickerOpen(false)}
                />
              )}
            </div>
          </div>

          {/* Save changes */}
          <Button variant="secondary" size="sm" onClick={() => onSave?.()}>
            Save changes
          </Button>
        </>
      )}
    </div>
  );
}
