import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ConvexError } from "convex/values";
import { LoopLogo } from "@app/ui";

// ─── Image assets ────────────────────────────────────────────────────────────
import bgTexture from "../assets/landing/bg-texture.png";
import heroStamp from "../assets/landing/hero-stamp.svg";
import heroWaveEmoji from "../assets/landing/hero-wave-emoji.svg";
import heroDtiBadge from "../assets/landing/hero-dti-badge.svg";
import heroSpeechFun from "../assets/landing/hero-speech-fun.svg";
import heroTagEvents from "../assets/landing/hero-tag-events.svg";
import heroGmailCluster from "../assets/landing/hero-gmail-cluster.png";
import dashboardScreenshot from "../assets/landing/dashboard-screenshot.png";
import statsLeft from "../assets/landing/stats-mail-left.svg";
import statsRight from "../assets/landing/stats-mail-right.svg";
import wavePattern from "../assets/landing/wave-pattern.svg";
import extensionPopup from "../assets/landing/extension-popup.png";
import featureSubscriptionFeed from "../assets/landing/feature-mockup-subscription-feed.svg";
import featureCalendar from "../assets/landing/feature-mockup-calendar.svg";
import featureClubDiscovery from "../assets/landing/feature-mockup-club-discovery.svg";
import previewEventCard from "../assets/landing/preview-event-card.png";
import previewLoopSummary from "../assets/landing/preview-loop-summary.png";
import club1 from "../assets/landing/club-1.png";
import club2 from "../assets/landing/club-2.png";
import club3 from "../assets/landing/club-3.png";
import club4 from "../assets/landing/club-4.jpeg";
import club5 from "../assets/landing/club-5.png";

// ─── Inline SVG icons ────────────────────────────────────────────────────────

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 10V2"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 10V12.67C14 13.02 13.86 13.36 13.61 13.61C13.36 13.86 13.02 14 12.67 14H3.33C2.98 14 2.64 13.86 2.39 13.61C2.14 13.36 2 13.02 2 12.67V10"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.67 6.67L8 10L11.33 6.67"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 9L12 15L18 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Reusable CTA button ─────────────────────────────────────────────────────

function CTAButton({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-3",
        "bg-[var(--color-black)] text-[var(--color-white)]",
        "font-[family-name:var(--font-body)] font-semibold",
        "text-lg leading-[30px] tracking-[-0.75px] md:text-[21px]",
        "rounded-full px-6 py-2.5",
        "transition-opacity hover:opacity-90",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ fontVariationSettings: "'opsz' 14" }}
    >
      Add to your inbox
      <DownloadIcon className="size-4" />
    </button>
  );
}

// ─── Feature card (bento box) ────────────────────────────────────────────────

const FEATURE_VARIANTS = {
  primary: {
    bg: "bg-[var(--color-primary-500)]",
    border: "border-[var(--color-primary-700)]",
    title: "text-[var(--color-primary-900)]",
    desc: "text-[var(--color-primary-800)]",
  },
  neutral: {
    bg: "bg-white",
    border: "border-[var(--color-neutral-500)]",
    title: "text-[var(--color-black)]",
    desc: "text-[var(--color-neutral-600)]",
  },
  secondary: {
    bg: "bg-[var(--color-secondary-400)]",
    border: "border-[var(--color-secondary-600)]",
    title: "text-[var(--color-secondary-900)]",
    desc: "text-[var(--color-secondary-700)]",
  },
} as const;

function FeatureCard({
  variant,
  mockup,
  title,
  description,
}: {
  variant: keyof typeof FEATURE_VARIANTS;
  mockup: ReactNode;
  title: string;
  description: string;
}) {
  const v = FEATURE_VARIANTS[variant];
  return (
    <div
      className={[
        "flex min-h-[400px] flex-1 flex-col gap-6 overflow-hidden rounded-3xl border-2 p-6 lg:min-h-[553px]",
        v.bg,
        v.border,
      ].join(" ")}
    >
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center">
        {mockup}
      </div>
      <div className="flex flex-col gap-1">
        <h3
          className={[
            "font-[family-name:var(--font-body)] text-[24px] font-bold tracking-[-1px] md:text-[28px]",
            v.title,
          ].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {title}
        </h3>
        <p
          className={[
            "font-[family-name:var(--font-body)] text-[16px] leading-[28px] font-medium tracking-[-0.5px] md:text-lg",
            v.desc,
          ].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

// ─── Club discovery mockup (network graph) ──────────────────────────────────
//
// IEEE popup at the center of a small graph: club marks on the perimeter,
// dashed edges connecting marks to each other and to the IEEE hub. Hovering
// a mark brightens the edges incident on it (and its mark scales up); other
// marks dim. Static — no floating.
//
// Marks accept an optional `logoSrc`; fallback is a two-letter monogram.

type MarkSize = "sm" | "md" | "lg";

const MARK_SIZE_PX: Record<MarkSize, number> = { sm: 42, md: 54, lg: 68 };

interface ClubMark {
  name: string;
  initials: string;
  logoSrc?: string;
  size: MarkSize;
  /** Solid background. */
  bg: string;
  /** Initials colour. */
  fg: string;
  /** Center position as % of container. */
  rxPct: number;
  ryPct: number;
}

const DISCOVERY_CLUBS: ClubMark[] = [
  // Top row
  {
    name: "ACSU",
    initials: "AC",
    logoSrc: club1,
    size: "lg",
    bg: "var(--color-primary-500)",
    fg: "var(--color-primary-900)",
    rxPct: 26,
    ryPct: 16,
  },
  {
    name: "WICC",
    initials: "WI",
    logoSrc: club2,
    size: "md",
    bg: "var(--color-white)",
    fg: "var(--color-primary-700)",
    rxPct: 72,
    ryPct: 16,
  },
  // Bottom row
  {
    name: "DTI",
    initials: "DT",
    logoSrc: club3,
    size: "sm",
    bg: "var(--color-primary-600)",
    fg: "var(--color-white)",
    rxPct: 18,
    ryPct: 84,
  },
  {
    name: "GCC",
    initials: "GC",
    logoSrc: club4,
    size: "md",
    bg: "var(--color-secondary-700)",
    fg: "var(--color-white)",
    rxPct: 50,
    ryPct: 87,
  },
  {
    name: "AAP",
    initials: "AA",
    logoSrc: club5,
    size: "sm",
    bg: "var(--color-white)",
    fg: "var(--color-secondary-700)",
    rxPct: 82,
    ryPct: 84,
  },
];

function ClubDiscoveryMockup({ ieeeSrc }: { ieeeSrc: string }) {
  return (
    <div className="relative h-full min-h-[320px] w-full select-none">
      {/* Spokes from each chip to the IEEE banner center. */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        preserveAspectRatio="none"
      >
        {DISCOVERY_CLUBS.map((c, i) => (
          <line
            key={`s-${i}`}
            x1={`${c.rxPct}%`}
            y1={`${c.ryPct}%`}
            x2="50%"
            y2="50%"
            stroke="var(--color-secondary-700)"
            strokeOpacity={0.35}
            strokeDasharray="4 6"
            strokeLinecap="round"
            style={{
              strokeWidth: 3,
              vectorEffect: "non-scaling-stroke",
            }}
          />
        ))}
      </svg>

      {/* IEEE popup hub — full-width banner across the middle. */}
      <img
        src={ieeeSrc}
        alt="IEEE club discovery card"
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute top-1/2 left-0 z-10 block w-full -translate-y-1/2 drop-shadow-[0_10px_28px_rgba(20,40,80,0.14)]"
      />

      {/* Club marks (graph nodes). */}
      {DISCOVERY_CLUBS.map((c) => {
        const size = MARK_SIZE_PX[c.size];
        return (
          <div
            key={c.name}
            role="img"
            aria-label={`${c.name} club`}
            className="absolute z-20 flex items-center justify-center overflow-hidden rounded-full shadow-[0_8px_22px_rgba(20,40,80,0.16)] ring-1 ring-[color:rgba(20,40,80,0.08)]"
            style={{
              left: `calc(${c.rxPct}% - ${size / 2}px)`,
              top: `calc(${c.ryPct}% - ${size / 2}px)`,
              width: size,
              height: size,
              // When a real logo is dropped in, force a white background so
              // the surrounding `object-contain` letterbox blends into the
              // chip. Otherwise honour the designed monogram colours.
              backgroundColor: c.logoSrc ? "var(--color-white)" : c.bg,
              color: c.fg,
            }}
          >
            {c.logoSrc ? (
              <img
                src={c.logoSrc}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain p-[10%]"
              />
            ) : (
              <span
                className="font-[family-name:var(--font-brand)] font-bold tracking-[-0.02em]"
                style={{ fontSize: size * 0.42, lineHeight: 1 }}
              >
                {c.initials}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Type guard for the NON_CORNELL_EMAIL ConvexError surfaced by the auth
 * callback. Narrows the unknown error without an `as` cast so the calling
 * site stays strictly typed.
 */
function isNonCornellError(
  err: unknown,
): err is ConvexError<{ code: "NON_CORNELL_EMAIL" }> {
  if (!(err instanceof ConvexError)) return false;
  const data: unknown = err.data;
  if (typeof data !== "object" || data === null) return false;
  if (!("code" in data)) return false;
  return data.code === "NON_CORNELL_EMAIL";
}

export default function Landing() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();

  // Capture any ?error param into local state synchronously on mount so a
  // refresh doesn't re-show the banner. The cleanup-effect below strips the
  // param from the URL so subsequent reloads don't re-trigger this. The
  // banner stays visible from local state until the user takes another
  // action (handleCTA clears it).
  const [showNonCornellError, setShowNonCornellError] = useState<boolean>(
    () => searchParams.get("error") === "non-cornell",
  );
  useEffect(() => {
    if (searchParams.get("error") !== "non-cornell") return;
    const next = new URLSearchParams(searchParams);
    next.delete("error");
    setSearchParams(next, { replace: true });
    // Only run on mount — subsequent ?error toggles are driven by handleCTA.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CTA click handler: navigate straight to /home when already signed in
  // (or in dev, where ProtectedRoute bypasses auth), otherwise kick off
  // Google OAuth. After the OAuth round-trip resolves we always land on
  // /home; ProtectedRoute will bounce to /onboarding if the user hasn't
  // finished setup yet.
  //
  // If the auth callback rejects with a Cornell-only error, surface the
  // toast by routing back to "?error=non-cornell" and stay on the page.
  function handleCTA() {
    // Clear any pre-existing error toast on a fresh attempt.
    if (showNonCornellError) {
      setShowNonCornellError(false);
    }

    if (import.meta.env.DEV || isAuthenticated) {
      navigate("/home");
      return;
    }

    void signIn("google").then(
      () => {
        navigate("/home");
      },
      (err: unknown) => {
        if (isNonCornellError(err)) {
          setShowNonCornellError(true);
        }
      },
    );
  }

  // Trigger "highlights" word highlight when banner scrolls into view.
  const highlightRef = useRef<HTMLSpanElement>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);

  // Scroll cue → center preview section in viewport
  const previewRef = useRef<HTMLElement>(null);
  function scrollToPreview() {
    previewRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  useEffect(() => {
    function check() {
      const node = highlightRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.7 && rect.bottom > 0;
      setIsHighlighted(inView);
    }

    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--color-secondary-500)]">
      {/* ── Background ─────────────────────────────────────────────── */}
      {/* Texture image tiled full-page height */}
      <img
        src={bgTexture}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full max-w-none object-cover opacity-80 mix-blend-overlay"
      />

      {/* ── Sticky Navbar ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 md:py-6">
        <LoopLogo variant="wordmark-light" size="sm" />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCTA}
            className="hidden items-center justify-center rounded-[var(--radius-button)] border border-white/80 px-4 py-1.5 text-sm font-normal tracking-[-0.5px] text-white transition-colors hover:bg-white/10 sm:inline-flex"
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Go to dashboard
          </button>
          <button
            type="button"
            onClick={handleCTA}
            className="inline-flex items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-primary-800)] px-4 py-1.5 text-sm font-medium tracking-[-0.5px] text-white transition-colors hover:bg-[var(--color-primary-900)]"
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Install
          </button>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────── */}
      {/* Figma hero stage is 1280 wide. Decorations are absolute-positioned
          in pixels on the Figma canvas; we mirror those using percentage
          values so the stage can scale below 1280 without stretching at wide
          viewports. Content flows above decorations. */}
      <section className="relative pt-12 pb-4 md:pt-20 md:pb-6 lg:pt-0">
        <div className="relative mx-auto w-full max-w-[1280px] lg:h-[596px]">
          {/* Stamp card shape — white scalloped postage-stamp card behind hero content.
              Figma: visible stamp is x=333, y=204, 614×390 (stage-relative y=122).
              SVG viewBox is 626×402 with 6px shadow padding on each side, so we render
              at 626×402 and offset by -6px so the visible scalloped shape lands at 614×390. */}
          <img
            src={heroStamp}
            alt=""
            className="pointer-events-none absolute top-[116px] left-1/2 z-0 hidden h-[402px] w-[626px] lg:block"
            style={{ transform: "translateX(-50%)" }}
            aria-hidden="true"
          />

          {/* Floating decorations — desktop only. Positions and sizes
              mirror the 1280-wide Figma canvas. left% = pixel_x / 1280. */}
          <div
            className="pointer-events-none hidden lg:block"
            aria-hidden="true"
          >
            {/* DTI orange circle badge — Figma 997:4963 outer wrapper at
                left=278, top=166, 161×161 with inner 136×136 rotate -12°.
                Stage y = 166 - 88 (nav) = 78. */}
            <img
              src={heroDtiBadge}
              alt=""
              className="absolute z-[1] rotate-[-12deg] animate-[landing-float_4s_ease-in-out_infinite]"
              style={{
                left: "21.72%",
                top: "78px",
                width: "clamp(108px, 10.6vw, 136px)",
              }}
            />

            {/* #Club events pill — Figma: x=849.91, y=246, rotate 10.71°.
                Stage y = 246 - 88 = 158. */}
            <img
              src={heroTagEvents}
              alt=""
              className="absolute z-[1] rotate-[10.71deg] animate-[landing-float_3.6s_ease-in-out_infinite_0.5s]"
              style={{
                left: "66.40%",
                top: "158px",
                width: "clamp(124px, 11.8vw, 151px)",
              }}
            />

            {/* #Just for fun! speech bubble — Figma: x=262, y=474, 177×94,
                rotate -7.98°. Stage y = 474 - 88 = 386. */}
            <img
              src={heroSpeechFun}
              alt=""
              className="absolute z-[1] rotate-[-7.98deg] animate-[landing-float_4.2s_ease-in-out_infinite_0.3s]"
              style={{
                left: "20.47%",
                top: "386px",
                width: "clamp(140px, 13.84vw, 177px)",
              }}
            />

            {/* Gmail cluster (841:4898) — Figma: x=779, y=441, 236×236.
                Stage y = 441 - 88 = 353. Exported as single PNG. */}
            <img
              src={heroGmailCluster}
              alt=""
              className="absolute z-[1] animate-[landing-float_3.8s_ease-in-out_infinite_0.7s]"
              style={{
                left: "60.86%",
                top: "353px",
                width: "clamp(186px, 18.41vw, 236px)",
              }}
            />
          </div>

          {/* Hero content — pill sits above stamp; body (headline + subtitle + CTA)
              vertically centered INSIDE stamp bounds.
              Stamp visible rect: top=122, height=390 (in stage coords). */}

          {/* Badge pill — above stamp on desktop */}
          <div className="relative z-10 flex justify-center px-4 lg:absolute lg:top-[48px] lg:left-1/2 lg:-translate-x-1/2 lg:px-0">
            <div className="rounded-full border border-white/80 px-3 py-0.5">
              <span
                className="font-[family-name:var(--font-body)] text-lg font-medium tracking-[-0.5px] text-white"
                style={{ fontVariationSettings: "'opsz' 14" }}
              >
                A new product from{" "}
                <a
                  href="https://www.cornelldti.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-dotted underline-offset-[10%]"
                >
                  Cornell DTI
                </a>
              </span>
            </div>
          </div>

          {/* Body — centered inside stamp on desktop; normal flow on mobile */}
          <div className="relative z-10 mx-auto mt-6 flex max-w-[481px] flex-col items-center gap-6 px-4 lg:absolute lg:top-[122px] lg:left-1/2 lg:mt-0 lg:h-[390px] lg:-translate-x-1/2 lg:justify-center lg:px-0">
            {/* Headline */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-col items-center">
                <h1
                  className="text-center font-[family-name:var(--font-body)] text-[36px] leading-[44px] font-bold tracking-[-0.5px] text-[var(--color-black)] md:text-[48px] md:leading-[56px]"
                  style={{ fontVariationSettings: "'opsz' 14" }}
                >
                  Less inbox,
                </h1>
                <div className="flex items-center gap-2">
                  <h1
                    className="text-center font-[family-name:var(--font-body)] text-[36px] leading-[44px] font-bold tracking-[-0.5px] text-[var(--color-black)] md:text-[48px] md:leading-[56px]"
                    style={{ fontVariationSettings: "'opsz' 14" }}
                  >
                    more Cornell
                  </h1>
                  {/* Wave emoji — inline after "Cornell" */}
                  <img
                    src={heroWaveEmoji}
                    alt=""
                    className="hidden h-auto w-[64px] md:inline-block"
                  />
                </div>
              </div>

              {/* Subtitle */}
              <p className="max-w-[401px] text-center font-[family-name:var(--font-brand)] text-[16px] text-[var(--color-black)] opacity-50 md:text-[20px]">
                Never miss out on a campus opportunity again — from recruiting
                events to free food.
              </p>
            </div>

            {/* Inline error banner — shown when sign-in is rejected because
                the user's email is not @cornell.edu. */}
            {showNonCornellError && (
              <div
                role="alert"
                aria-live="polite"
                className={[
                  "max-w-[420px] rounded-[var(--radius-card)]",
                  "border border-[var(--color-border)]",
                  "bg-[var(--color-surface)]",
                  "px-[var(--space-4)] py-[var(--space-3)]",
                  "text-center",
                  "font-[family-name:var(--font-body)] font-medium",
                  "leading-[var(--line-height-body2)] text-[var(--font-size-body2)]",
                  "tracking-[var(--letter-spacing-body2)]",
                  "text-[var(--color-neutral-900)]",
                  "shadow-[var(--shadow-1)]",
                ].join(" ")}
                style={{ fontVariationSettings: "'opsz' 14" }}
              >
                Loop is open to Cornell students only. Sign in with your
                @cornell.edu account.
              </div>
            )}

            {/* CTA */}
            <CTAButton onClick={handleCTA} />
          </div>
        </div>
      </section>

      {/* ── Scroll Cue ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={scrollToPreview}
        className="relative z-10 mx-auto flex cursor-pointer items-center justify-center gap-1 py-1 text-[rgba(34,115,161,0.85)] transition-colors hover:text-[rgba(34,115,161,1)] md:py-2"
      >
        <span
          className="font-[family-name:var(--font-body)] text-lg font-medium tracking-[-0.5px]"
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Stay in the loop
        </span>
        <ChevronDownIcon className="size-6" />
      </button>

      {/* ── Product Preview ───────────────────────────────────────── */}
      {/* Figma 1280 canvas: dashboard (841:4949) centered, 871.6×544.9 @ top=758.
          Floaters positioned as % of dashboard frame so they scale together. */}
      <section ref={previewRef} className="relative pb-16 md:pb-24">
        <div className="relative mx-auto max-w-[1100px] px-4">
          <div className="relative mx-auto w-full max-w-[872px]">
            {/* Dashboard screenshot (841:4949) */}
            <img
              src={dashboardScreenshot}
              alt="Loop dashboard showing event feed with personalized recommendations"
              loading="lazy"
              decoding="async"
              className="block w-full rounded-lg shadow-[0_8px_40px_rgba(0,0,0,0.12)]"
            />

            {/* Extension popup (841:4951) — left=872 top=744 w=243.7 h=573.
                Relative to dashboard: left=76.2%, top=-2.57%, w=27.95% */}
            <div
              className="absolute hidden animate-[landing-float_5s_ease-in-out_infinite_0.5s] lg:block"
              style={{ left: "76.2%", top: "-2.57%", width: "27.95%" }}
            >
              <img
                src={extensionPopup}
                alt="Loop browser extension preview"
                loading="lazy"
                decoding="async"
                className="block w-full"
              />
            </div>

            {/* Event card (841:4975) — left=123 top=972 w=396.
                Relative to dashboard: left=-9.7%, top=39.3%, w=45.4% */}
            <img
              src={previewEventCard}
              alt="Event card preview: How to Land an Engineering Internship 101"
              loading="lazy"
              decoding="async"
              className="absolute hidden animate-[landing-float_4.5s_ease-in-out_infinite_0.2s] lg:block"
              style={{ left: "-9.7%", top: "39.3%", width: "45.4%" }}
            />

            {/* Loop Summary (841:4950) — left=342 top=1248 w=379.
                Relative to dashboard: left=15.4%, top=90%, w=43.5% */}
            <img
              src={previewLoopSummary}
              alt="Loop Summary card"
              loading="lazy"
              decoding="async"
              className="absolute hidden animate-[landing-float_5s_ease-in-out_infinite_0.8s] lg:block"
              style={{ left: "15.4%", top: "90%", width: "43.5%" }}
            />
          </div>
        </div>
      </section>

      {/* ── Stats / Social Proof ──────────────────────────────────── */}
      {/* Figma 963:5100: card at left=76 top=89 (660 wide) in stats frame.
          Left envelope: left=0 top=169 (162×126, rotate -15.76deg) → sits
          76px left of card, 80px down from card top.
          Right envelope: left=639 top=0 (167×165) → sits 70px right of
          card right edge, 89px above card top. */}
      <section className="relative overflow-visible pt-6 pb-24 md:pt-12 md:pb-32">
        <div className="relative mx-auto max-w-[820px] px-4">
          {/* Stats card wrapper — envelopes anchored to card edges */}
          <div className="relative rounded-3xl bg-white/80 px-4 py-8 text-center md:px-14">
            <img
              src={statsLeft}
              alt=""
              loading="lazy"
              decoding="async"
              className="pointer-events-none absolute hidden w-[162px] rotate-[-15.76deg] animate-[landing-float_4s_ease-in-out_infinite] lg:block"
              style={{ left: "-76px", top: "80px" }}
              aria-hidden="true"
            />
            <img
              src={statsRight}
              alt=""
              loading="lazy"
              decoding="async"
              className="pointer-events-none absolute hidden w-[168px] animate-[landing-float_3.8s_ease-in-out_infinite_0.5s] lg:block"
              style={{ right: "-70px", top: "-89px" }}
              aria-hidden="true"
            />
            <p
              className="font-[family-name:var(--font-body)] text-[20px] font-medium tracking-[-0.59px] text-[var(--color-black)] md:text-[24px]"
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              The average Cornellian has{" "}
              <span className="font-bold text-[var(--color-primary-700)]">
                10k+
              </span>{" "}
              emails in their inbox.
            </p>
            <p
              className="mt-2 font-[family-name:var(--font-body)] text-[16px] font-medium tracking-[-0.5px] text-[var(--color-black)] opacity-50 md:text-lg"
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              Most of these emails never get opened.
            </p>
          </div>
        </div>
      </section>

      {/* ── Value Proposition Banner ──────────────────────────────── */}
      <section className="relative px-4 pb-12 md:px-8 md:pb-24 lg:px-[121px]">
        <div className="relative overflow-hidden rounded-3xl bg-[var(--color-black)] px-6 py-8 text-center md:px-16 md:py-[37px] lg:px-[145px]">
          <p
            className="font-[family-name:var(--font-body)] text-[28px] leading-[36px] font-medium tracking-[-1px] text-white md:text-[40px] md:leading-[48px]"
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            <LoopLogo
              variant="mark"
              size="md"
              className="mr-2 inline-flex !size-[1em] align-[-0.18em] [&_svg]:!size-[1em]"
            />
            <span className="font-bold">Loop</span>{" "}
            <span>cuts through newsletter clutter and </span>
            <span ref={highlightRef} className="relative inline-block">
              <span
                aria-hidden="true"
                className="absolute inset-y-1 -right-1 -left-1 origin-left rounded-xl bg-[var(--color-primary-700)] transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{
                  transform: isHighlighted ? "scaleX(1)" : "scaleX(0)",
                }}
              />
              <span className="relative">highlights</span>
            </span>{" "}
            what&apos;s important.
          </p>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section className="relative px-4 pb-12 md:px-8 md:pb-24 lg:px-[121px]">
        <div className="mx-auto flex max-w-[1038px] flex-col gap-6">
          <h2
            className="text-center font-[family-name:var(--font-body)] text-[36px] leading-[56px] font-bold tracking-[-0.5px] text-[var(--color-black)] md:text-[48px]"
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Features
          </h2>

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Card A — Directly in your inbox */}
            <FeatureCard
              variant="primary"
              mockup={
                <img
                  src={featureSubscriptionFeed}
                  alt="Preview of subscription feed in email inbox"
                  loading="lazy"
                  decoding="async"
                  className="h-full max-h-full w-full object-contain object-center"
                />
              }
              title="Directly in your inbox"
              description="See the highlights from all your favorite clubs and more."
            />

            {/* Card B — See if you're free */}
            <FeatureCard
              variant="neutral"
              mockup={
                <img
                  src={featureCalendar}
                  alt="Calendar view with highlighted event"
                  loading="lazy"
                  decoding="async"
                  className="h-full max-h-full w-full object-contain object-center"
                />
              }
              title="See if you're free"
              description="Hover over any event to see it in your GCal schedule."
            />

            {/* Card C — Discover new clubs (interactive physics chips) */}
            <FeatureCard
              variant="secondary"
              mockup={<ClubDiscoveryMockup ieeeSrc={featureClubDiscovery} />}
              title="Discover new clubs"
              description="Stay in the loop with clubs across campus, tailored to your interests."
            />
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      {/* Wave pattern SVG viewBox is 1050×278; wrapper matches that aspect
          ratio so the postage-stamp scallops stay uniform across viewports. */}
      <section className="relative px-4 pb-12 md:px-8 md:pb-24 lg:px-[121px]">
        <div className="relative mx-auto aspect-[1050/278] max-w-[1038px] overflow-hidden">
          {/* Wave pattern background */}
          <img
            src={wavePattern}
            alt=""
            loading="lazy"
            decoding="async"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          />

          <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 px-6">
            <h2
              className="text-center font-[family-name:var(--font-body)] text-[36px] leading-[48px] font-bold tracking-[-0.5px] text-[var(--color-black)] md:text-[48px] md:leading-[64px]"
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              Stay in the{" "}
              <span className="text-[var(--color-primary-700)]">Loop</span> at
              Cornell.
            </h2>
            <CTAButton onClick={handleCTA} />
          </div>
        </div>
      </section>
    </div>
  );
}
