/**
 * LoopSummary — Loop Design System
 *
 * Source: Figma "Incubator-design-file" › Design System › Cards
 * Node: 520:5930 "Loop Summary"
 *
 * An AI / org summary card that stands apart from event cards via its
 * Primary/600 (#ffa26b) border and Shadow 2 elevation.
 *
 * Figma spec:
 *   Container: bg white, border Primary/600, Shadow 2, rounded-[16px],
 *              px 24px, py 16px.
 *   Header:    Loop logo icon (16 × 16) + "Loop Summary" title in text-default.
 *   Body:      DM Sans Regular 14px, Neutral/700.
 *              Org names found in the summary text are rendered bold with
 *              an OrgHoverCard tooltip on hover.
 *
 * The Loop logo is a brand asset served from a remote Figma URL.
 * Pass `logoSrc` to override with a local asset; omit it to use the inline
 * SVG placeholder that approximates the brand icon shape.
 *
 * All colours, spacing, and font values reference CSS custom properties from
 * src/styles/tokens.css — nothing is hardcoded.
 */

import {
  type ComponentPropsWithoutRef,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import type { ReactNode } from "react";
// Note: the file uses an underscore (loop_logo.svg), not a hyphen.
import LoopLogo from "../../assets/loop_logo.svg?react";
import type { Organization } from "./DashboardPost";
import { OrgHoverCard } from "../OrgHoverCard";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface LoopSummaryProps extends ComponentPropsWithoutRef<"section"> {
  /** The summary text body. */
  summary: string;
  /**
   * Optional array of organisations whose names appear in the summary.
   * Each matching name is rendered bold with an OrgHoverCard on hover.
   */
  organizations?: Organization[];
  /**
   * Optional src for the Loop logo image.
   * Falls back to an inline SVG approximation of the brand icon.
   */
  logoSrc?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Splits `text` at every occurrence of any org name, returning an array of
 * segments. Each segment is either a plain string or an object with the
 * matched org and its index in the `organizations` array.
 */
function splitByOrgNames(
  text: string,
  organizations: Organization[],
): Array<string | { org: Organization; orgIndex: number }> {
  if (organizations.length === 0) return [text];

  // Build a regex that matches any org name (longest first to avoid partial hits)
  const sorted = [...organizations].sort(
    (a, b) => b.name.length - a.name.length,
  );
  const pattern = new RegExp(
    `(${sorted.map((o) => o.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g",
  );

  const segments: Array<string | { org: Organization; orgIndex: number }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }
    // Find the org that matched
    const matchedName = match[1];
    const orgIndex = organizations.findIndex((o) => o.name === matchedName);
    segments.push({ org: organizations[orgIndex], orgIndex });
    lastIndex = pattern.lastIndex;
  }

  // Trailing text
  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoopSummary({
  summary,
  organizations,
  logoSrc,
  className,
  ...rest
}: LoopSummaryProps) {
  // Track which org index is hovered (null = none)
  const [hoveredOrgIdx, setHoveredOrgIdx] = useState<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleOrgEnter = useCallback(
    (idx: number) => {
      clearHideTimer();
      setHoveredOrgIdx(idx);
    },
    [clearHideTimer],
  );

  const handleOrgLeave = useCallback(() => {
    hideTimerRef.current = setTimeout(() => {
      setHoveredOrgIdx(null);
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  // Build body content — plain text or rich text with hoverable org names
  const bodyContent: ReactNode =
    organizations && organizations.length > 0
      ? splitByOrgNames(summary, organizations).map((segment, i) => {
          if (typeof segment === "string") {
            return <span key={i}>{segment}</span>;
          }
          return (
            <span
              key={i}
              className="relative inline cursor-pointer font-semibold hover:underline"
              onMouseEnter={() => handleOrgEnter(segment.orgIndex)}
              onMouseLeave={handleOrgLeave}
            >
              {segment.org.name}
              <OrgHoverCard
                org={segment.org}
                visible={hoveredOrgIdx === segment.orgIndex}
              />
            </span>
          );
        })
      : summary;

  return (
    <section
      className={[
        "flex flex-col gap-[var(--space-2)]",
        "px-[var(--space-6)] py-[var(--space-4)]",
        "rounded-[var(--radius-card)]",
        "bg-[var(--color-surface)]",
        /* Figma: Primary/600 (#ffa26b) border — visually distinguishes summary cards */
        "border border-[var(--color-primary-600)]",
        /* Figma: Shadow 2 — subtle elevation */
        "shadow-[var(--shadow-2)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {/* ── Header: logo + title ── */}
      <div className="flex items-center gap-[var(--space-2)]">
        {logoSrc ? (
          /* Caller-supplied override (e.g. a branded variant) */
          <img
            src={logoSrc}
            alt="Loop"
            className="size-[var(--space-4)] shrink-0"
          />
        ) : (
          /* Default: loop_logo.svg rendered inline via SVGR */
          <LoopLogo
            aria-hidden="true"
            className="size-[var(--space-4)] shrink-0"
          />
        )}

        {/* Title — Figma: DM Sans Bold 18px, text-default (neutral-900/black) */}
        <h3
          className={
            "font-[family-name:var(--font-body)] font-bold " +
            "text-[length:var(--font-size-body1)] leading-[var(--line-height-body1)] " +
            "tracking-[var(--letter-spacing-body1)] " +
            "whitespace-nowrap text-[color:var(--color-text-default)]"
          }
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          Loop Summary
        </h3>
      </div>

      {/* ── Body text — Figma: DM Sans Regular 14px, Neutral/700 ── */}
      <p
        className={
          "font-[family-name:var(--font-body)] font-normal " +
          "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
          "tracking-[var(--letter-spacing-body2)] " +
          "text-[color:var(--color-neutral-700)]"
        }
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {bodyContent}
      </p>
    </section>
  );
}
