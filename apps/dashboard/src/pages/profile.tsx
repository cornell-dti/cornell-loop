/**
 * Profile — Loop Dashboard Popup
 *
 * Source: Figma "Incubator-design-file"
 *   • Default modal: node 633:4436
 *   • Saved state:   node 633:4779 ("Recalibrating your feed…" + progress bar)
 *
 * The card houses a profile-setup form: Major, Grad Year, Minor, Interests.
 * The picker primitives (ProfileSelectField, ProfileInterestsField) and the
 * full ProfileFieldsForm orchestrator now live in
 * `src/components/ProfileFields.tsx` so the same UI powers the
 * `/onboarding` flow. This file keeps the modal chrome (close button,
 * greeting, save button, saved-state animation) and wires the form to
 * `users.updateProfile`.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing else is hardcoded.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import { useMutation } from "convex/react";
import { Button } from "@app/ui";
import { api } from "../../convex/_generated/api";
import {
  ProfileFieldsForm,
  type ProfileFieldsValue,
} from "../components/ProfileFields";
import { useCurrentProfile } from "../lib/useCurrentProfile";

// ─── Inline icon helpers ──────────────────────────────────────────────────────

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

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ProfileProps extends ComponentPropsWithoutRef<"div"> {
  /** First name shown in the greeting. Falls back to "there!" when omitted. */
  userName?: string;

  value: ProfileFieldsValue;
  onValueChange: (next: ProfileFieldsValue) => void;

  /** When true, render the post-save confirmation variant. */
  saved?: boolean;
  /** When true, the form is disabled (e.g. while a save is in flight). */
  saving?: boolean;
  /**
   * Inline error message to surface beneath the form. When set, the form is
   * re-enabled so the user can retry. Cleared by the caller on a fresh save.
   */
  error?: string | null;
  /** Called when "Save changes" is clicked. */
  onSave?: () => void;
  /** Called when × is clicked. */
  onClose?: () => void;
}

// ─── SavedState — "Recalibrating your feed…" variant (Figma 633:4779) ────────

/**
 * Renders a determinate-looking progress strip driven by the actual save
 * lifecycle:
 *   • `saving` → indeterminate spinner-style fill, "Saving…"
 *   • `saved`  → full bar, "Saved" — caller dismisses after a brief moment
 */
function SavedState({ saving }: { saving: boolean }) {
  const label = saving ? "Saving…" : "Saved";
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
        {label}
      </h2>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={saving ? undefined : 100}
        aria-label="Saving your profile"
        className={[
          "relative h-[10px] w-[20.1875rem]" /* 323px from Figma */,
          "overflow-hidden rounded-[var(--space-3)] bg-[var(--color-primary-400)]",
        ].join(" ")}
      >
        <div
          className={[
            "h-full rounded-[var(--space-3)] bg-[var(--color-primary-700)]",
            saving ? "animate-pulse" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            width: saving ? "60%" : "100%",
            transition: "width 200ms ease-out",
          }}
        />
      </div>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function Profile({
  userName,
  value,
  onValueChange,
  saved = false,
  saving = false,
  error = null,
  onSave,
  onClose,
  className,
  ...rest
}: ProfileProps) {
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

      {saved || saving ? (
        <SavedState saving={saving} />
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

          <ProfileFieldsForm
            value={value}
            onChange={onValueChange}
            disabled={saving}
          />

          {error !== null && (
            <p
              role="alert"
              aria-live="polite"
              className={
                "w-full text-center " +
                "font-[family-name:var(--font-body)] font-medium " +
                "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
                "tracking-[var(--letter-spacing-body2)] " +
                "text-[var(--color-primary-800)]"
              }
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              {error}
            </p>
          )}

          {/* Save changes */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSave?.()}
            disabled={saving}
          >
            Save changes
          </Button>
        </>
      )}
    </div>
  );
}

// ─── ProfileModalRoute — owns the persisted form state ──────────────────────

/**
 * ProfileModalRoute renders the modal-style profile picker on top of an
 * existing route. State is hydrated from `useCurrentProfile` so the form
 * reflects the persisted values; saving calls `users.updateProfile` and shows
 * the "Recalibrating your feed…" confirmation for ~1.5s before navigating
 * back to /home.
 */
interface ProfileModalInnerProps {
  initialValue: ProfileFieldsValue;
  userName: string;
  onDismiss: () => void;
}

/**
 * Inner component — owns the editable form state. Mounted with a `key` tied
 * to the profile id so React resets state automatically when the underlying
 * Convex query resolves (avoids manual setState-in-effect hydration).
 */
function ProfileModalInner({
  initialValue,
  userName,
  onDismiss,
}: ProfileModalInnerProps) {
  const updateProfile = useMutation(api.users.updateProfile);
  const [value, setValue] = useState<ProfileFieldsValue>(initialValue);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismissTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (dismissTimer.current !== null) {
        window.clearTimeout(dismissTimer.current);
      }
    };
  }, []);

  const handleSave = async () => {
    if (saving || saved) return;
    setError(null);
    setSaving(true);
    try {
      await updateProfile({
        major: value.major,
        gradYear: value.gradYear,
        minor: value.minor,
        interests: value.interests,
      });
      setSaving(false);
      setSaved(true);
      // Show "Saved" briefly (~600ms), then dismiss the modal.
      dismissTimer.current = window.setTimeout(() => {
        onDismiss();
      }, 600);
    } catch {
      setSaving(false);
      setError("Couldn't save — please try again");
    }
  };

  const handleClose = () => {
    if (dismissTimer.current !== null) {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    onDismiss();
  };

  return (
    <Profile
      userName={userName}
      value={value}
      onValueChange={setValue}
      saved={saved}
      saving={saving}
      error={error}
      onSave={() => {
        void handleSave();
      }}
      onClose={handleClose}
    />
  );
}

export function ProfileModalRoute({
  onDismiss,
}: {
  /** Called when the modal should close (× / backdrop click / save complete). */
  onDismiss: () => void;
}) {
  const { user, profile, loading } = useCurrentProfile();

  const initialValue = useMemo<ProfileFieldsValue>(
    () => ({
      major: profile?.major,
      gradYear: profile?.gradYear,
      minor: profile?.minor,
      interests: profile?.interests ?? [],
    }),
    [profile?.major, profile?.gradYear, profile?.minor, profile?.interests],
  );

  const userName = (user?.name ?? "Megan").split(" ")[0] || "Megan";

  // Stable identity for the inner form — when the persisted profile lands the
  // key flips, remounting the inner component with the freshly-hydrated value.
  // While loading we mount with `loading` so the user sees a disabled card
  // immediately rather than waiting on the network round-trip.
  const innerKey = loading
    ? "loading"
    : profile === null
      ? "no-profile"
      : profile._id;

  return (
    <ProfileModalInner
      key={innerKey}
      initialValue={initialValue}
      userName={userName}
      onDismiss={onDismiss}
    />
  );
}
