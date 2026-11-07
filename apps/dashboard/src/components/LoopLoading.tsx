/**
 * LoopLoading — animated SVG progress bar for onboarding Step 3.
 *
 * Purpose:
 *   - Displays a loading animation while the user's feed is recalibrated.
 *   - Combines a moving Loop SVG with a gradient-filled progress bar.
 *
 * Props:
 *   - duration?: Animation duration in milliseconds (default: 4000ms).
 *   - onComplete?: Callback triggered when the animation reaches 100%.
 *
 * Implementation:
 *   - Uses React useState to track progress from 0 to 1.
 *   - Uses useEffect and requestAnimationFrame for smooth animation.
 *   - Calculates progress based on elapsed time / duration.
 *   - Dynamically increases the gradient bar's width as progress advances.
 *   - Moves the SVG horizontally by updating its left position.
 *   - Uses cancelAnimationFrame for cleanup when unmounted.
 *
 * Integration:
 *   - Rendered inside StepDone in Onboarding.tsx.
 *   - Calls onComplete when the animation finishes.
 *   - StepDone independently waits for the Convex completion mutation
 *     before closing the onboarding modal.
 */

import { useEffect, useState } from "react";
import loopLoadingSvg from "../assets/landing/loop_loading.svg";

interface LoopLoadingProps {
  duration?: number;
  onComplete?: () => void;
}

export default function LoopLoading({
  duration = 4000,
  onComplete,
}: LoopLoadingProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;

      const elapsed = timestamp - startTime;
      const next = Math.min(elapsed / duration, 1);

      setProgress(next);

      if (next < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [duration, onComplete]);

  return (
    <div
      className="relative h-[54px] w-full max-w-[369px] overflow-hidden"
      role="progressbar"
      aria-label="Recalibrating your feed"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      {/* Background progress track */}
      <div className="absolute top-[44px] right-[5px] left-[5px] h-[10px] rounded-full bg-[#FFF2EA]" />

      {/* Filled portion */}
      <div
        className="absolute top-[44px] left-[5px] h-[10px] rounded-full bg-gradient-to-r from-[#FFB744] to-[#F37428]"
        style={{ width: `${progress * 97}%` }}
      />

      {/* Moving SVG */}
      <img
        src={loopLoadingSvg}
        alt=""
        aria-hidden="true"
        className="absolute top-0 h-[54px] w-[369px] max-w-none"
        style={{
          left: `${-260 + progress * 260}px`,
        }}
      />
    </div>
  );
}
