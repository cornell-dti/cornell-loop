/**
 * Onboarding — three-step full-screen first-login flow.
 *
 * Step 1: Profile fields (major / grad year / minor / interests).
 *         Continue requires major, gradYear, and ≥1 interest. On click, save
 *         the profile via `users.updateProfile`.
 *
 * Step 2: Suggested clubs. Renders cards from `orgs.getSuggestedForOnboarding`
 *         with a Follow toggle wired to `follows.follow` / `follows.unfollow`.
 *         Continue requires the user to have followed ≥3 orgs (read from
 *         `follows.myFollows` so it stays accurate even if the user toggles
 *         orgs across multiple sessions).
 *
 * Step 3: "You're all set" confirmation. Single CTA marks onboarding complete
 *         (`users.completeOnboarding`) and navigates to /home.
 *
 * Layout matches the visual language of the Profile modal and Landing page —
 * Loop wordmark top-left, step indicator top-right, content centred at
 * max-width ~640px. Tokens only; no hardcoded colours/spacing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { Avatar, Button, LoopLogo, Tag } from "@app/ui";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  ProfileFieldsForm,
  type ProfileFieldsValue,
} from "../components/ProfileFields";
import { useCurrentProfile } from "../lib/useCurrentProfile";

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
}

function OnboardingShell({ step, children }: OnboardingShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface-subtle)]">
      <header className="flex w-full items-center justify-between px-[var(--space-8)] py-[var(--space-6)]">
        <LoopLogo variant="wordmark" size="sm" />
        <span
          className={BODY2 + " text-[var(--color-text-muted)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
          aria-live="polite"
        >
          Step {step} of {TOTAL_STEPS}
        </span>
      </header>

      <main className="flex w-full flex-1 justify-center px-[var(--space-6)] pb-[var(--space-12)]">
        <div className="flex w-full max-w-[640px] flex-col items-stretch gap-[var(--space-8)] pt-[var(--space-8)]">
          {children}
        </div>
      </main>
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
      <div className="flex flex-col gap-[var(--space-2)]">
        <h1
          className={HEADING_CLASS}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {userName ? `Welcome, ${userName}!` : "Welcome to Loop!"}
        </h1>
        <p
          className={SUBTITLE_CLASS}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Tell us a little about yourself so we can tailor your feed.
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
  org: Doc<"orgs">;
  isFollowing: boolean;
  onToggle: (orgId: Id<"orgs">, nextFollowing: boolean) => void;
  pending: boolean;
}

function ClubCard({ org, isFollowing, onToggle, pending }: ClubCardProps) {
  return (
    <li
      className={[
        "flex flex-col gap-[var(--space-3)]",
        "rounded-[var(--radius-card)] bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "px-[var(--space-4)] py-[var(--space-4)]",
        "shadow-[var(--shadow-1)]",
      ].join(" ")}
    >
      <div className="flex items-start gap-[var(--space-3)]">
        <Avatar avatars={[{ name: org.name, src: org.avatarUrl }]} />
      </div>

      <p
        className={BODY2 + " text-[var(--color-text-muted)]"}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {org.description}
      </p>

      {org.tags.length > 0 && (
        <div className="flex flex-wrap gap-[var(--space-2)]">
          {org.tags.slice(0, 4).map((tag) => (
            <Tag key={tag} color="neutral">
              {tag}
            </Tag>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant={isFollowing ? "secondary" : "primary"}
          size="sm"
          onClick={() => onToggle(org._id, !isFollowing)}
          disabled={pending}
        >
          {isFollowing ? "Following" : "Follow"}
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

  return (
    <>
      <div className="flex flex-col gap-[var(--space-2)]">
        <h1
          className={HEADING_CLASS}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Pick a few clubs to follow
        </h1>
        <p
          className={SUBTITLE_CLASS}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Follow at least three to start filling your feed. You can change this
          anytime.
        </p>
        <p
          className={BODY2 + " text-[var(--color-text-muted)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
          aria-live="polite"
        >
          {followedCount} of 3 followed
        </p>
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
          className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2"
          aria-label="Suggested clubs"
        >
          {suggested.map((org) => (
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
          Continue
        </Button>
      </div>
    </>
  );
}

// ─── Step 3 — Done ────────────────────────────────────────────────────────────

interface StepDoneProps {
  onFinish: () => Promise<void>;
}

function StepDone({ onFinish }: StepDoneProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleFinish = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onFinish();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-[var(--space-6)] py-[var(--space-12)] text-center">
      <h1
        className={HEADING_CLASS}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        You&apos;re all set!
      </h1>
      <p
        className={SUBTITLE_CLASS + " max-w-[420px]"}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Your feed is ready. We&apos;ll keep it fresh as new events roll in from
        the clubs you follow.
      </p>
      <Button
        variant="primary"
        size="md"
        onClick={() => {
          void handleFinish();
        }}
        disabled={submitting}
      >
        {submitting ? "Loading…" : "Go to your feed"}
      </Button>
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, loading, isOnboarded } = useCurrentProfile();
  const updateProfile = useMutation(api.users.updateProfile);
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [step, setStep] = useState<OnboardingStep>(1);

  // Track whether the user was already onboarded *on initial mount*. The
  // shared `users.updateProfile` mutation auto-stamps `onboardingCompletedAt`
  // as soon as the user picks a major + at least one interest (so the profile
  // modal can double as an onboarding shortcut). Without this guard the
  // wizard would short-circuit out of step 2 the moment step 1's save lands.
  const initiallyOnboarded = useRef<boolean | null>(null);
  useEffect(() => {
    if (loading) return;
    if (initiallyOnboarded.current === null) {
      initiallyOnboarded.current = isOnboarded;
    }
    if (initiallyOnboarded.current === true) {
      navigate("/home", { replace: true });
    }
  }, [loading, isOnboarded, navigate]);

  const initialValue = useMemo<ProfileFieldsValue>(
    () => ({
      major: profile?.major,
      gradYear: profile?.gradYear,
      minor: profile?.minor,
      interests: profile?.interests ?? [],
    }),
    [profile?.major, profile?.gradYear, profile?.minor, profile?.interests],
  );

  if (loading) {
    return (
      <OnboardingShell step={step}>
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

  const handleFinish = async () => {
    await completeOnboarding();
    navigate("/home", { replace: true });
  };

  return (
    <OnboardingShell step={step}>
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
      {step === 3 && <StepDone onFinish={handleFinish} />}
    </OnboardingShell>
  );
}
