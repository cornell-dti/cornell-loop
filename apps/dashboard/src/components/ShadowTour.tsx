/**
 * ShadowTour — interactive four-step dashboard walkthrough for new Loop users.
 *
 * Purpose:
 *   - Introduces users to the dashboard after completing initial onboarding.
 *   - Highlights key features and explains how to use them.
 *
 * Tour Steps:
 *   1. Welcome: Introduces the Loop dashboard and its main features.
 *   2. Subscriptions: Highlights the sidebar button for managing followed clubs.
 *   3. RSVPs: Highlights the RSVP panel and explains event management.
 *   4. Gmail Extension: Explains how to use Loop in Gmail and links to installation.
 *
 * Implementation:
 *   - Uses React state to track the current tour step.
 *   - Locates dashboard elements using DOM queries and getBoundingClientRect.
 *   - Uses a box-shadow spotlight to dim everything outside highlighted elements.
 *   - Updates spotlight positions on window resize and scroll.
 *   - Displays Figma-based modals, tooltips, mascots, and progress indicators.
 *   - Opens the Chrome Web Store in a new tab for extension installation.
 *
 * Props:
 *   - onComplete: Callback triggered when the user finishes or skips the tour.
 */

import { useEffect, useState } from "react";

import loopMascot from "../assets/landing/loop_mascot.svg";
import subscriptionsMascot from "../assets/landing/loop_mascot_subscriptions.svg";
import subscriptionsIcon from "../assets/landing/subscriptions_icon.svg";
import rsvpIcon from "../assets/landing/rsvp_icon.svg";
import loopLogo from "../../../../shared/ui/src/assets/loop_logo.svg";

interface ShadowTourProps {
  onComplete: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const EXTENSION_URL =
  "https://chromewebstore.google.com/detail/cornell-loop/pambdlajcngmfmgkiaknpnigdhiogbfg";

export default function ShadowTour({ onComplete }: ShadowTourProps) {
  const [step, setStep] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);

  // Find the dashboard element to highlight.
  useEffect(() => {
    if (step !== 1 && step !== 2) {
      return;
    }

    const updateSpotlight = () => {
      let target: HTMLElement | undefined;

      if (step === 1) {
        // Subscriptions sidebar button
        target = Array.from(
          document.querySelectorAll<HTMLElement>("a, button"),
        ).find(
          (element) =>
            element.textContent?.trim() === "Subscriptions" &&
            element.getBoundingClientRect().width > 0,
        );
      }

      if (step === 2) {
        // Your RSVPs panel
        const heading = Array.from(
          document.querySelectorAll<HTMLElement>("h1, h2, h3, h4"),
        ).find((element) => element.textContent?.trim() === "Your RSVPs");

        target = heading?.parentElement ?? undefined;
      }

      if (!target) {
        setSpotlight(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      const padding = step === 2 ? 12 : 0;

      setSpotlight({
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    };

    updateSpotlight();

    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);

    return () => {
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [step]);

  return (
    <>
      {/* SCREEN 1 — Welcome to Loop */}
      {step === 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="relative w-full max-w-[540px] rounded-2xl bg-white px-7 py-6 shadow-xl">
            {/* Floating mascot */}
            <img
              src={loopMascot}
              alt="Loop mascot"
              className="absolute -top-[54px] right-[45px] z-10 h-[79px] w-[82px]"
            />

            {/* Close button */}
            <button
              type="button"
              onClick={onComplete}
              aria-label="Close tour"
              className="absolute top-4 right-5 cursor-pointer text-xl text-gray-400"
            >
              ×
            </button>

            {/* Header */}
            <div className="relative flex h-[70px] items-center justify-center pb-3">
              <img
                src={loopLogo}
                alt="Loop logo"
                className="absolute left-0 h-10 w-10 object-contain"
              />

              <h2 className="text-center text-[26px] font-medium text-[#313131]">
                Welcome to <span className="text-[#EB7128]">Loop</span>
              </h2>
            </div>

            {/* Top divider */}
            <div className="border-t border-gray-200" />

            {/* Description */}
            <p className="py-5 text-[14px] leading-[22px] text-[#313131]">
              This is the Loop dashboard. It’s where you can view highlights and
              loop summaries about the clubs you follow, manage subscriptions,
              RSVPs, bookmarks and your profile.
            </p>

            {/* Bottom divider */}
            <div className="border-t border-gray-200" />

            {/* Footer */}
            <div className="flex items-center justify-between pt-5">
              <div className="flex items-center gap-2">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={`h-[7px] w-[7px] rounded-full ${
                      index === 0 ? "bg-[#93C5FD]" : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={onComplete}
                  className="cursor-pointer text-sm text-black"
                >
                  Skip
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="cursor-pointer rounded-full bg-[#EB7128] px-5 py-2 text-sm font-medium text-white hover:bg-[#D96320]"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 2 — Subscriptions Spotlight */}
      {step === 1 && (
        <div className="pointer-events-none fixed inset-0 z-[60]">
          {/* Darken everything except Subscriptions */}
          {spotlight ? (
            <div
              className="pointer-events-none fixed z-10 rounded-lg"
              style={{
                top: spotlight.top,
                left: spotlight.left,
                width: spotlight.width,
                height: spotlight.height,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.30)",
              }}
            />
          ) : (
            <div className="pointer-events-none absolute inset-0 bg-black/30" />
          )}

          {/* Tooltip */}
          {spotlight && (
            <div
              className="pointer-events-auto fixed z-20 w-[400px] max-w-[calc(100vw-24px)] rounded-xl bg-white px-5 py-4 shadow-xl"
              style={{
                top: Math.max(85, spotlight.top - 35),
                left: Math.max(
                  12,
                  Math.min(
                    spotlight.left + spotlight.width + 14,
                    window.innerWidth - 412,
                  ),
                ),
              }}
            >
              {/* Mascot */}
              <img
                src={subscriptionsMascot}
                alt="Loop mascot"
                className="absolute -top-[48px] right-3 h-[72px] w-[76px]"
              />

              {/* Content */}
              <div className="flex items-start gap-3">
                <img
                  src={subscriptionsIcon}
                  alt="Subscriptions"
                  className="h-12 w-12 shrink-0"
                />

                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-[#313131]">
                    Manage your clubs here
                  </h3>

                  <p className="mt-1 text-[12px] leading-[18px] text-[#313131]">
                    Subscriptions lists every club you follow. Follow new ones
                    or unfollow anytime, and your feed updates to match.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3].map((index) => (
                    <span
                      key={index}
                      className={`h-[6px] w-[6px] rounded-full ${
                        index === 1 ? "bg-[#93C5FD]" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={onComplete}
                    className="cursor-pointer text-[12px] text-black"
                  >
                    Skip tour
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="cursor-pointer rounded-full bg-[#EB7128] px-5 py-2 text-[12px] text-white hover:bg-[#D96320]"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SCREEN 3 — Your RSVPs Spotlight */}
      {step === 2 && (
        <div className="pointer-events-none fixed inset-0 z-[60]">
          {/* Highlight RSVP panel with extra padding */}
          {spotlight ? (
            <div
              className="pointer-events-none fixed z-10 rounded-xl"
              style={{
                top: spotlight.top,
                left: spotlight.left,
                width: spotlight.width,
                height: spotlight.height,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.30)",
              }}
            />
          ) : (
            <div className="pointer-events-none absolute inset-0 bg-black/30" />
          )}

          {/* Wider RSVP tooltip */}
          {spotlight && (
            <div
              className="pointer-events-auto fixed z-20 w-[420px] max-w-[calc(100vw-24px)] rounded-xl bg-white px-5 py-4 shadow-xl"
              style={{
                top: Math.max(90, spotlight.top + 40),
                left: Math.max(12, spotlight.left - 435),
              }}
            >
              {/* Rotated mascot */}
              <img
                src={subscriptionsMascot}
                alt="Loop mascot"
                className="absolute -top-[48px] left-3 h-[72px] w-[76px] -rotate-12"
              />

              {/* Content */}
              <div className="flex items-start gap-3">
                <img
                  src={rsvpIcon}
                  alt="Calendar"
                  className="h-12 w-12 shrink-0"
                />

                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-[#313131]">
                    Your RSVPs, in date order
                  </h3>

                  <p className="mt-1 text-[12px] leading-[18px] text-[#313131]">
                    Hit RSVP on any post and the event appears here. Click Going
                    on the post to cancel.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3].map((index) => (
                    <span
                      key={index}
                      className={`h-[6px] w-[6px] rounded-full ${
                        index === 2 ? "bg-[#93C5FD]" : "bg-gray-300"
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={onComplete}
                    className="cursor-pointer text-[12px] text-black"
                  >
                    Skip tour
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="cursor-pointer rounded-full bg-[#EB7128] px-5 py-2 text-[12px] text-white hover:bg-[#D96320]"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SCREEN 4 — Gmail Extension */}
      {step === 3 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="relative w-full max-w-[445px] rounded-2xl bg-white px-6 py-5 shadow-xl">
            {/* Floating mascot */}
            <img
              src={subscriptionsMascot}
              alt="Loop mascot"
              className="absolute -top-[24px] right-9 h-[72px] w-[76px]"
            />

            {/* Close button */}
            <button
              type="button"
              onClick={onComplete}
              aria-label="Close tour"
              className="absolute top-3 right-4 cursor-pointer text-xl text-gray-400"
            >
              ×
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 pt-1">
              <img
                src={loopLogo}
                alt="Loop logo"
                className="h-9 w-9 object-contain"
              />

              <h2 className="text-[16px] font-semibold text-[#313131]">
                Loop works in Gmail too
              </h2>
            </div>

            {/* Subtitle */}
            <p className="mt-2 text-[12px] leading-[18px] text-gray-500">
              The extension turns club emails into event cards you can RSVP to
              without leaving your inbox.
            </p>

            {/* Divider */}
            <div className="my-4 border-t border-gray-200" />

            {/* Instructions */}
            <div className="space-y-4">
              {[
                {
                  title: "Pin Loop in Chrome",
                  description:
                    "Click the puzzle icon next to the address bar, then the pin next to Loop.",
                },
                {
                  title: "Open a club email",
                  description:
                    "Loop finds the event in the email and shows its date, location and sign-up link in a side panel.",
                },
                {
                  title: "RSVP or view the original",
                  description:
                    'RSVP from the panel, or click "View original email" to see the full message.',
                },
              ].map((instruction, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF2EA] text-[12px] font-semibold text-[#EB7128]">
                    {index + 1}
                  </div>

                  <div>
                    <h3 className="text-[12px] font-semibold text-[#313131]">
                      {instruction.title}
                    </h3>

                    <p className="mt-1 text-[11px] leading-[16px] text-[#313131]">
                      {instruction.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between">
              {/* Progress dots */}
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className={`h-[6px] w-[6px] rounded-full ${
                      index === 3 ? "bg-[#93C5FD]" : "bg-gray-300"
                    }`}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-5">
                {/* Opens the real Chrome Web Store listing */}
                <a
                  href={EXTENSION_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer text-[12px] font-medium text-[#A74409] hover:underline"
                >
                  Get the extension!
                </a>

                <button
                  type="button"
                  onClick={onComplete}
                  className="cursor-pointer rounded-full bg-[#EB7128] px-5 py-2 text-[12px] text-white hover:bg-[#D96320]"
                >
                  Go to my feed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
