import { Avatar } from "@app/ui";
import type { EventItem } from "../data/types";

// Figma: Inter SemiBold 20px, #5f5f5f, tracking -0.22px, leading 1.5
const SECTION_HEADING =
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[1.25rem] leading-[1.5] tracking-[-0.22px] " +
  "text-[#5f5f5f] whitespace-nowrap";

// Figma: DM Sans Bold 18px, #5f5f5f, lh 28px, tracking -0.5px
const EMAIL_TITLE =
  "font-[family-name:var(--font-body)] font-bold " +
  "text-[length:var(--font-size-body1)] leading-[var(--line-height-body1)] " +
  "tracking-[var(--letter-spacing-body1)] text-[#5f5f5f]";

// Figma: DM Sans Regular 14px, #5f5f5f, lh 20.2px, tracking -0.5px
const EMAIL_BODY =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)] text-[#5f5f5f]";

// Fallback content shown when no event is selected (shouldn't happen in normal flow)
const FALLBACK_PARAGRAPHS = [
  "Hello Eship,",
  "",
  "For Cornell builders, aspiring VCs, and startup enthusiasts: Startup Hours is being held from 7:30–9pm Thursday, on the third floor of eHub Collegetown.",
  "",
  "Please fill out this form for catering by Wednesday 5pm so we have a proper headcount.",
  "",
  "Best,",
  "Alli",
];

export interface OriginalEmailViewProps {
  /**
   * The EventItem whose raw email content should be displayed.
   * When null/undefined (shouldn't happen in normal flow) fallback placeholder is shown.
   */
  event?: EventItem | null;
}

export default function OriginalEmailView({ event }: OriginalEmailViewProps) {
  const orgName = event?.orgName ?? "Cornell DTI";
  const emailTitle = event?.rawEmailTitle ?? event?.title ?? "Original Email";
  const paragraphs = event?.rawEmailParagraphs ?? FALLBACK_PARAGRAPHS;

  return (
    <div className="flex w-full flex-col gap-[var(--space-1-5)]">
      {/* "Original Email" heading — Inter SemiBold 20px */}
      <p className={SECTION_HEADING}>Original Email</p>

      {/* Email card — Figma: white bg, #ececec 1.5px border, rounded-[12px], p-[16px], gap-[20px] */}
      <div
        className={[
          "flex flex-col gap-[var(--space-5)]",
          "bg-[var(--color-surface)]",
          "[border:1.5px_solid_#ececec]",
          "rounded-[var(--space-3)]",
          "p-[var(--space-4)]",
          "w-full",
        ].join(" ")}
      >
        {/* Org header — avatar circle + org name */}
        <Avatar avatars={[{ name: orgName }]} />

        {/* Email content */}
        <div className="flex w-full flex-col gap-[var(--space-2)] tracking-[var(--letter-spacing-body2)]">
          {/* Subject / title — DM Sans Bold 18px */}
          <p
            className={EMAIL_TITLE}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {emailTitle}
          </p>

          {/* Body paragraphs — empty strings become blank-line spacers */}
          <div className="flex flex-col">
            {paragraphs.map((line, i) =>
              line === "" ? (
                <div
                  key={i}
                  className="h-[var(--line-height-body2)]"
                  aria-hidden="true"
                />
              ) : (
                <p
                  key={i}
                  className={EMAIL_BODY}
                  style={{ fontVariationSettings: "'opsz' 14" }}
                >
                  {line}
                </p>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
