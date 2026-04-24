import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
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
        "text-lg md:text-[21px] leading-[30px] tracking-[-0.75px]",
        "px-6 py-2.5 rounded-full",
        "hover:opacity-90 transition-opacity",
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
  mockupSrc,
  mockupAlt,
  title,
  description,
}: {
  variant: keyof typeof FEATURE_VARIANTS;
  mockupSrc: string;
  mockupAlt: string;
  title: string;
  description: string;
}) {
  const v = FEATURE_VARIANTS[variant];
  return (
    <div
      className={[
        "flex-1 border-2 rounded-3xl p-6 flex flex-col gap-6 min-h-[400px] lg:min-h-[553px] overflow-hidden",
        v.bg,
        v.border,
      ].join(" ")}
    >
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <img
          src={mockupSrc}
          alt={mockupAlt}
          loading="lazy"
          decoding="async"
          className="w-full h-full max-h-full object-contain object-center"
        />
      </div>
      <div className="flex flex-col gap-1">
        <h3
          className={[
            "font-[family-name:var(--font-body)] font-bold text-[24px] md:text-[28px] tracking-[-1px]",
            v.title,
          ].join(" ")}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {title}
        </h3>
        <p
          className={[
            "font-[family-name:var(--font-body)] font-medium text-[16px] md:text-lg tracking-[-0.5px] leading-[28px]",
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

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();

  // CTA click handler: navigate straight to /home when already signed in
  // (or in dev, where ProtectedRoute bypasses auth), otherwise kick off
  // Google OAuth and then land on /home.
  function handleCTA() {
    if (import.meta.env.DEV || isAuthenticated) {
      navigate("/home");
    } else {
      void signIn("google").then(() => navigate("/home"));
    }
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
        className="absolute inset-0 w-full h-full max-w-none object-cover pointer-events-none mix-blend-overlay opacity-80"
      />

      {/* ── Sticky Navbar ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 md:py-6">
        <LoopLogo variant="wordmark-light" size="sm" />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCTA}
            className="hidden sm:inline-flex items-center justify-center border border-white/80 text-white rounded-[var(--radius-button)] px-4 py-1.5 text-sm font-normal tracking-[-0.5px] hover:bg-white/10 transition-colors"
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Go to dashboard
          </button>
          <button
            type="button"
            onClick={handleCTA}
            className="inline-flex items-center justify-center bg-[var(--color-primary-700)] text-white rounded-[var(--radius-button)] px-4 py-1.5 text-sm font-normal tracking-[-0.5px] hover:bg-[var(--color-primary-hover)] transition-colors"
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
      <section className="relative pt-12 md:pt-20 lg:pt-0 pb-4 md:pb-6">
        <div className="relative mx-auto w-full max-w-[1280px] lg:h-[596px]">
          {/* Stamp card shape — white scalloped postage-stamp card behind hero content.
              Figma: visible stamp is x=333, y=204, 614×390 (stage-relative y=122).
              SVG viewBox is 626×402 with 6px shadow padding on each side, so we render
              at 626×402 and offset by -6px so the visible scalloped shape lands at 614×390. */}
          <img
            src={heroStamp}
            alt=""
            className="absolute hidden lg:block left-1/2 top-[116px] w-[626px] h-[402px] pointer-events-none z-0"
            style={{ transform: "translateX(-50%)" }}
            aria-hidden="true"
          />

          {/* Floating decorations — desktop only. Positions and sizes
              mirror the 1280-wide Figma canvas. left% = pixel_x / 1280. */}
          <div
            className="hidden lg:block pointer-events-none"
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
          <div className="relative z-10 flex justify-center px-4 lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:top-[48px] lg:px-0">
            <div className="border border-white/80 rounded-full px-3 py-0.5">
              <span
                className="font-[family-name:var(--font-body)] font-medium text-white text-lg tracking-[-0.5px]"
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
          <div className="relative z-10 mt-6 flex flex-col items-center gap-6 max-w-[481px] mx-auto px-4 lg:mt-0 lg:absolute lg:left-1/2 lg:-translate-x-1/2 lg:top-[122px] lg:h-[390px] lg:justify-center lg:px-0">
            {/* Headline */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-col items-center">
                <h1
                  className="font-[family-name:var(--font-body)] font-bold text-[36px] md:text-[48px] leading-[44px] md:leading-[56px] text-[var(--color-black)] text-center tracking-[-0.5px]"
                  style={{ fontVariationSettings: "'opsz' 14" }}
                >
                  Less inbox,
                </h1>
                <div className="flex items-center gap-2">
                  <h1
                    className="font-[family-name:var(--font-body)] font-bold text-[36px] md:text-[48px] leading-[44px] md:leading-[56px] text-[var(--color-black)] text-center tracking-[-0.5px]"
                    style={{ fontVariationSettings: "'opsz' 14" }}
                  >
                    more Cornell
                  </h1>
                  {/* Wave emoji — inline after "Cornell" */}
                  <img
                    src={heroWaveEmoji}
                    alt=""
                    className="hidden md:inline-block w-[64px] h-auto"
                  />
                </div>
              </div>

              {/* Subtitle */}
              <p className="font-[family-name:var(--font-brand)] text-[16px] md:text-[20px] text-[var(--color-black)] opacity-50 text-center max-w-[401px]">
                Never miss out on a campus opportunity again — from recruiting
                events to free food.
              </p>
            </div>

            {/* CTA */}
            <CTAButton onClick={handleCTA} />
          </div>
        </div>
      </section>

      {/* ── Scroll Cue ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={scrollToPreview}
        className="relative z-10 flex items-center justify-center gap-1 py-1 md:py-2 mx-auto text-[rgba(34,115,161,0.85)] hover:text-[rgba(34,115,161,1)] transition-colors cursor-pointer"
      >
        <span
          className="font-[family-name:var(--font-body)] font-medium text-lg tracking-[-0.5px]"
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
        <div className="relative max-w-[1100px] mx-auto px-4">
          <div className="relative w-full max-w-[872px] mx-auto">
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
              className="hidden lg:block absolute animate-[landing-float_5s_ease-in-out_infinite_0.5s]"
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
              className="hidden lg:block absolute animate-[landing-float_4.5s_ease-in-out_infinite_0.2s]"
              style={{ left: "-9.7%", top: "39.3%", width: "45.4%" }}
            />

            {/* Loop Summary (841:4950) — left=342 top=1248 w=379.
                Relative to dashboard: left=15.4%, top=90%, w=43.5% */}
            <img
              src={previewLoopSummary}
              alt="Loop Summary card"
              loading="lazy"
              decoding="async"
              className="hidden lg:block absolute animate-[landing-float_5s_ease-in-out_infinite_0.8s]"
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
      <section className="relative pt-6 md:pt-12 pb-24 md:pb-32 overflow-visible">
        <div className="relative max-w-[820px] mx-auto px-4">
          {/* Stats card wrapper — envelopes anchored to card edges */}
          <div className="relative bg-white/80 rounded-3xl px-4 md:px-14 py-8 text-center">
            <img
              src={statsLeft}
              alt=""
              loading="lazy"
              decoding="async"
              className="hidden lg:block absolute w-[162px] rotate-[-15.76deg] animate-[landing-float_4s_ease-in-out_infinite] pointer-events-none"
              style={{ left: "-76px", top: "80px" }}
              aria-hidden="true"
            />
            <img
              src={statsRight}
              alt=""
              loading="lazy"
              decoding="async"
              className="hidden lg:block absolute w-[168px] animate-[landing-float_3.8s_ease-in-out_infinite_0.5s] pointer-events-none"
              style={{ right: "-70px", top: "-89px" }}
              aria-hidden="true"
            />
            <p
              className="font-[family-name:var(--font-body)] font-medium text-[20px] md:text-[24px] tracking-[-0.59px] text-[var(--color-black)]"
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              The average Cornellian has{" "}
              <span className="font-bold text-[var(--color-primary-700)]">
                10k+
              </span>{" "}
              emails in their inbox.
            </p>
            <p
              className="font-[family-name:var(--font-body)] font-medium text-[16px] md:text-lg text-[var(--color-black)] opacity-50 tracking-[-0.5px] mt-2"
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              Most of these emails never get opened.
            </p>
          </div>
        </div>
      </section>

      {/* ── Value Proposition Banner ──────────────────────────────── */}
      <section className="relative px-4 md:px-8 lg:px-[121px] pb-12 md:pb-24">
        <div className="relative bg-[var(--color-black)] rounded-3xl px-6 md:px-16 lg:px-[145px] py-8 md:py-[37px] text-center overflow-hidden">
          <div className="relative flex flex-col items-center gap-1">
            <p
              className="font-[family-name:var(--font-body)] text-[28px] md:text-[40px] text-white tracking-[-1px] leading-[36px] md:leading-[48px] inline-flex flex-wrap items-center justify-center gap-2"
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              <LoopLogo
                variant="mark"
                size="md"
                className="[&_svg]:size-[30px] inline-block"
              />
              <span className="font-bold">Loop</span>
              <span className="font-medium">
                cuts through newsletter clutter and
              </span>
            </p>
            <p
              className="font-[family-name:var(--font-body)] font-medium text-[28px] md:text-[40px] text-white tracking-[-1px] leading-[36px] md:leading-[48px]"
              style={{ fontVariationSettings: "'opsz' 14" }}
            >
              <span ref={highlightRef} className="relative inline-block">
                <span
                  aria-hidden="true"
                  className="absolute top-0 bottom-0 -left-2 -right-2 rounded-xl bg-white/40 transition-opacity duration-700 ease-out"
                  style={{ opacity: isHighlighted ? 1 : 0 }}
                />
                <span className="relative">highlights</span>
              </span>{" "}
              what&apos;s important.
            </p>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section className="relative px-4 md:px-8 lg:px-[121px] pb-12 md:pb-24">
        <div className="max-w-[1038px] mx-auto flex flex-col gap-6">
          <h2
            className="font-[family-name:var(--font-body)] font-bold text-[36px] md:text-[48px] leading-[56px] text-[var(--color-black)] text-center tracking-[-0.5px]"
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            Features
          </h2>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Card A — Directly in your inbox */}
            <FeatureCard
              variant="primary"
              mockupSrc={featureSubscriptionFeed}
              mockupAlt="Preview of subscription feed in email inbox"
              title="Directly in your inbox"
              description="See the highlights from all your favorite clubs and more."
            />

            {/* Card B — See if you're free */}
            <FeatureCard
              variant="neutral"
              mockupSrc={featureCalendar}
              mockupAlt="Calendar view with highlighted event"
              title="See if you're free"
              description="Hover over any event to see it in your GCal schedule."
            />

            {/* Card C — Discover new clubs */}
            <FeatureCard
              variant="secondary"
              mockupSrc={featureClubDiscovery}
              mockupAlt="IEEE club discovery card"
              title="Discover new clubs"
              description="Stay in the loop with clubs across campus, tailored to your interests."
            />
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      {/* Wave pattern SVG viewBox is 1050×278; wrapper matches that aspect
          ratio so the postage-stamp scallops stay uniform across viewports. */}
      <section className="relative px-4 md:px-8 lg:px-[121px] pb-12 md:pb-24">
        <div className="relative max-w-[1038px] mx-auto aspect-[1050/278] overflow-hidden">
          {/* Wave pattern background */}
          <img
            src={wavePattern}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative flex flex-col items-center justify-center gap-4 w-full h-full px-6">
            <h2
              className="font-[family-name:var(--font-body)] font-bold text-[36px] md:text-[48px] leading-[48px] md:leading-[64px] text-[var(--color-black)] text-center tracking-[-0.5px]"
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
