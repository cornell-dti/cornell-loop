/**
 * Onboarding — three-step first-login modal displayed over the Home dashboard.
 *
 * Step 1: Profile Setup
 *   - Collects major, graduation year, minor, and interests.
 *   - Uses searchable Major/Minor fields with removable selection tags.
 *   - Continue requires a major, gradYear, and at least one interest.
 *   - Saves profile information through `users.updateProfile`.
 *
 * Step 2: Club Subscriptions
 *   - Fetches suggested clubs using `orgs.getSuggestedForOnboarding`.
 *   - Displays clubs in a vertically stacked, searchable list.
 *   - Filters clubs by name locally using React state.
 *   - Subscribe/Unsubscribe buttons call `follows.follow` and
 *     `follows.unfollow`.
 *   - Requires at least 3 subscriptions to continue, verified through
 *     `follows.myFollows`.
 *
 * Step 3: Onboarding Completion
 *   - Displays an animated SVG progress bar using `LoopLoading`.
 *   - Calls `users.completeOnboarding` to finalize onboarding.
 *   - Tracks animation and backend completion independently.
 *   - Automatically closes the modal once both operations succeed.
 *   - Displays a Retry button if backend completion fails.
 *
 * Modal Implementation:
 *   - `OnboardingShell` provides a centered modal with a darkened backdrop.
 *   - Uses conditional rendering to display the current onboarding step.
 *   - Applies step-specific dimensions and styling using Tailwind CSS.
 *   - Supports dismissal through an optional `onClose` callback.
 *   - Hides the close button during Step 3.
 *   - Modal visibility is controlled by Home using `useCurrentProfile`
 *     to check the user's onboarding status.
 *
 * Backend:
 *   - Preserves existing Convex queries and mutations.
 *   - UI and layout changes do not require new backend endpoints.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LoopLoading from "../components/LoopLoading";
import { useMutation, useQuery } from "convex/react";
import { Avatar, Button } from "@app/ui";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { PublicOrg } from "../../convex/orgs";
import {
  ProfileFieldsForm,
  type ProfileFieldsValue,
} from "../components/ProfileFields";
import { useCurrentProfile } from "../lib/useCurrentProfile";
import loopLogo from "../../../../shared/ui/src/assets/loop_logo.svg";

type OnboardingStep = 1 | 2 | 3;

const TOTAL_STEPS = 3;

const HEADING_CLASS =
  "font-[family-name:var(--font-heading)] font-bold " +
  "text-[var(--font-size-h2)] leading-[var(--line-height-h2)] " +
  "tracking-[var(--letter-spacing-h2)] text-[var(--color-neutral-900)]";

const SUBTITLE_CLASS =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[var(--font-size-body1)] leading-[var(--line-height-body1)] " +
  "tracking-[var(--letter-spacing-body1)] text-[var(--color-text-muted)]";

const BODY2 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

// ─── Shared chrome ────────────────────────────────────────────────────────────

interface OnboardingShellProps {
  step: OnboardingStep;
  children: React.ReactNode;
  onClose?: () => void;
}

function OnboardingShell({ step, children, onClose }: OnboardingShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-[var(--space-4)]"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-[var(--radius-card)] bg-[var(--color-surface)] shadow-[var(--shadow-1)] ${
          step === 3
            ? "max-w-[500px] gap-2 px-5 py-4"
            : "max-w-[550px] gap-[var(--space-4)] p-[var(--space-5)]"
        }`}
      >
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-[var(--space-4)]">
            <span
              className={BODY2}
              style={{ color: "#A74409" }}
              aria-live="polite"
            >
              Step {step} of {TOTAL_STEPS}
            </span>
          </div>
          {onClose && step !== 3 && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close onboarding"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-neutral-900)]"
            >
              ✕
            </button>
          )}
        </header>

        {children}
      </div>
    </div>
  );
}

// ─── Step 1 — Profile fields ─────────────────────────────────────────────────

interface StepProfileProps {
  initialValue: ProfileFieldsValue;
  userName: string;
  onContinue: (value: ProfileFieldsValue) => Promise<void>;
}

function StepProfile({ initialValue, userName, onContinue }: StepProfileProps) {
  const [value, setValue] = useState<ProfileFieldsValue>(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue =
    typeof value.major === "string" &&
    value.major.length > 0 &&
    typeof value.gradYear === "string" &&
    value.gradYear.length > 0 &&
    value.interests.length >= 1;

  const handleContinue = async () => {
    if (!canContinue || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onContinue(value);
    } catch {
      setError("Couldn't save your profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-[var(--space-0.5)]">
        <div className="flex items-center gap-3">
          <img src={loopLogo} alt="Loop" className="h-10 w-10 object-contain" />
          <h1
            className={`${HEADING_CLASS} text-2xl`}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {userName ? `Hi, ${userName}!` : "Welcome to Loop!"}
          </h1>
        </div>

        <p
          className={SUBTITLE_CLASS}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Tell us a bit about yourself so we can tailor your feed. Everything is
          optional and you can change it later.
        </p>
      </div>

      <div
        className={[
          "flex w-full flex-col gap-[var(--space-6)]",
          "rounded-[var(--radius-card)] bg-[var(--color-surface)]",
          "border border-[var(--color-border)]",
          "px-[var(--space-6)] py-[var(--space-6)]",
          "shadow-[var(--shadow-1)]",
        ].join(" ")}
      >
        <ProfileFieldsForm
          value={value}
          onChange={setValue}
          disabled={submitting}
        />
      </div>

      {error !== null && (
        <p
          role="alert"
          aria-live="polite"
          className={BODY2 + " text-center text-[var(--color-primary-800)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            void handleContinue();
          }}
          disabled={!canContinue || submitting}
        >
          {submitting ? "Saving…" : "Continue"}
        </Button>
      </div>
    </>
  );
}

// ─── Step 2 — Suggested clubs ────────────────────────────────────────────────

interface StepClubsProps {
  onContinue: () => void;
  onBack: () => void;
}

interface ClubCardProps {
  org: PublicOrg;
  isFollowing: boolean;
  onToggle: (orgId: Id<"orgs">, nextFollowing: boolean) => void;
  pending: boolean;
}

function ClubCard({ org, isFollowing, onToggle, pending }: ClubCardProps) {
  return (
    <li className="flex w-full items-center justify-between gap-[var(--space-3)] py-[var(--space-2)]">
      {/* Club avatar + name + tags */}
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-1)]">
        <Avatar avatars={[{ name: org.name, src: org.avatarUrl }]} />

        {/* Tags underneath */}
        {org.tags.length > 0 && (
          <span className="pl-[var(--space-10)] text-xs text-[var(--color-text-muted)]">
            {org.tags.slice(0, 3).join(" · ")}
          </span>
        )}
      </div>

      {/* Subscribe button */}
      <div className="shrink-0">
        <Button
          variant={isFollowing ? "primary" : "secondary"}
          size="sm"
          onClick={() => onToggle(org._id, !isFollowing)}
          disabled={pending}
        >
          {isFollowing ? "Subscribed ✔" : "Subscribe"}
        </Button>
      </div>
    </li>
  );
}

function StepClubs({ onContinue, onBack }: StepClubsProps) {
  const suggested = useQuery(api.orgs.getSuggestedForOnboarding);
  const followsList = useQuery(api.follows.myFollows);
  const followMutation = useMutation(api.follows.follow);
  const unfollowMutation = useMutation(api.follows.unfollow);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const followedSet = useMemo<Set<string>>(() => {
    if (!followsList) return new Set();
    return new Set(followsList);
  }, [followsList]);

  const followedCount = followedSet.size;
  const canContinue = followedCount >= 3;

  const handleToggle = async (orgId: Id<"orgs">, nextFollowing: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.add(orgId);
      return next;
    });
    try {
      if (nextFollowing) {
        await followMutation({ orgId });
      } else {
        await unfollowMutation({ orgId });
      }
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(orgId);
        return next;
      });
    }
  };

  const loading = suggested === undefined || followsList === undefined;

  // Filter clubs based on search
  const filteredClubs = (suggested ?? []).filter((org) =>
    org.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <>
      <div className="flex flex-col gap-[var(--space-2)]">
        <div className="flex items-center gap-3">
          <img src={loopLogo} alt="Loop" className="h-10 w-10 object-contain" />
          <h1
            className={`${HEADING_CLASS} text-2xl`}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Follow clubs you care about
          </h1>
        </div>
        <p
          className={SUBTITLE_CLASS}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Your feed shows events from clubs you follow. Follow as many as you
          like, or none. You can change this anytime in Subscriptions.
        </p>
        <p
          className={BODY2 + " text-[var(--color-text-muted)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
          aria-live="polite"
        ></p>
      </div>
      <div className="relative w-full">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clubs..."
          aria-label="Search clubs"
          className={[
            "w-full",
            "px-[var(--space-4)] py-[var(--space-1-5)]",
            "rounded-[var(--radius-card)]",
            "border border-[var(--color-border)]",
            "bg-[var(--color-surface)]",
            BODY2,
            "text-[var(--color-neutral-900)]",
            "outline-none",
            "focus:border-[var(--color-primary-400)]",
          ].join(" ")}
        />
      </div>

      {loading ? (
        <p
          className={BODY2 + " text-[var(--color-text-muted)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Loading clubs…
        </p>
      ) : suggested.length === 0 ? (
        <p
          className={BODY2 + " text-[var(--color-text-muted)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          No suggested clubs yet — check back soon.
        </p>
      ) : (
        <ul
          className="flex w-full flex-col gap-[var(--space-1)]"
          aria-label="Suggested clubs"
        >
          {filteredClubs.map((org) => (
            <ClubCard
              key={org._id}
              org={org}
              isFollowing={followedSet.has(org._id)}
              pending={pendingIds.has(org._id)}
              onToggle={(orgId, nextFollowing) => {
                void handleToggle(orgId, nextFollowing);
              }}
            />
          ))}
        </ul>
      )}

      <div className="flex justify-between">
        <Button variant="secondary" size="md" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onContinue}
          disabled={!canContinue}
        >
          Finish Setup
        </Button>
      </div>
    </>
  );
}

// ─── Step 3 — Loading / Completion ──────────────────────────

interface StepDoneProps {
  onFinish: () => Promise<void>;
  onClose: () => void;
}

function StepDone({ onFinish, onClose }: StepDoneProps) {
  const [animationComplete, setAnimationComplete] = useState(false);
  const [saveComplete, setSaveComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const started = useRef(false);
  const finished = useRef(false);

  const saveOnboarding = useCallback(async () => {
    setError(null);

    try {
      await onFinish();
      setSaveComplete(true);
    } catch {
      setError("Couldn't finish onboarding. Please try again.");
    }
  }, [onFinish]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void saveOnboarding();
  }, [saveOnboarding]);

  useEffect(() => {
    if (!animationComplete || !saveComplete || finished.current) {
      return;
    }

    finished.current = true;
    onClose();
  }, [animationComplete, saveComplete, onClose]);

  const handleAnimationComplete = useCallback(() => {
    setAnimationComplete(true);
  }, []);

  return (
    <div className="flex flex-col items-center gap-1 py-1 text-center">
      <h1
        className={HEADING_CLASS}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Recalibrating your feed...
      </h1>

      <div className="-mt-3 w-full max-w-[425px]">
        <div className="w-[369px] origin-left scale-x-[1.15]">
          <LoopLoading duration={3000} onComplete={handleAnimationComplete} />
        </div>
      </div>

      <p className="text-[12px] leading-[14px] whitespace-nowrap text-[#808080]">
        Matching events to your clubs and interests
      </p>

      {error && (
        <div className="flex flex-col items-center gap-3">
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>

          <Button
            variant="primary"
            size="sm"
            onClick={() => void saveOnboarding()}
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export default function Onboarding({ onClose }: { onClose?: () => void }) {
  const { user, profile, loading } = useCurrentProfile();

  const updateProfile = useMutation(api.users.updateProfile);
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  const [step, setStep] = useState<OnboardingStep>(1);

  const initialValue = useMemo<ProfileFieldsValue>(
    () => ({
      major: profile?.major,
      gradYear: profile?.gradYear,
      minor: profile?.minor,
      interests: profile?.interests ?? [],
    }),
    [profile?.major, profile?.gradYear, profile?.minor, profile?.interests],
  );

  const handleFinish = useCallback(async () => {
    await completeOnboarding();
  }, [completeOnboarding]);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (loading) {
    return (
      <OnboardingShell step={step} onClose={onClose}>
        <p
          className={BODY2 + " text-[var(--color-text-muted)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Loading…
        </p>
      </OnboardingShell>
    );
  }

  const userName = (user?.name ?? "").split(" ")[0] ?? "";

  const handleStep1Continue = async (value: ProfileFieldsValue) => {
    await updateProfile({
      major: value.major,
      gradYear: value.gradYear,
      minor: value.minor,
      interests: value.interests,
    });

    setStep(2);
  };

  const handleStep2Continue = () => setStep(3);
  const handleStep2Back = () => setStep(1);

  return (
    <OnboardingShell step={step} onClose={onClose}>
      {step === 1 && (
        <StepProfile
          initialValue={initialValue}
          userName={userName}
          onContinue={handleStep1Continue}
        />
      )}

      {step === 2 && (
        <StepClubs onContinue={handleStep2Continue} onBack={handleStep2Back} />
      )}

      {step === 3 && <StepDone onFinish={handleFinish} onClose={handleClose} />}
    </OnboardingShell>
  );
}
