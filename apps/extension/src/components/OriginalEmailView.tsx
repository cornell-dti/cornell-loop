import { Avatar } from "@app/ui";
import { useEmailContent } from "../data/useEvents";

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

export interface OriginalEmailViewProps {
  /**
   * Convex event ID string (EventItem.id) — used to fetch email content
   * from api.events.getEmailContent. When undefined, a loading state is shown.
   */
  eventId?: string;
  /**
   * Org name shown in the avatar header. Falls back to "Cornell Loop" when absent.
   */
  orgName?: string;
}

export default function OriginalEmailView({
  eventId,
  orgName,
}: OriginalEmailViewProps) {
  const content = useEmailContent(eventId);

  const displayOrgName = orgName ?? "Cornell Loop";

  let emailTitle = "Original Email";
  let paragraphs: string[] = [];

  if (content === undefined) {
    // Loading
    paragraphs = [];
  } else if (content === null) {
    // Content not found — show placeholder
    emailTitle = "Original Email";
    paragraphs = [
      "Email content could not be loaded.",
      "",
      "This event may not have an associated email in the system.",
    ];
  } else {
    emailTitle = content.subject;
    paragraphs = content.paragraphs;
  }

  return (
    <div className="flex w-full flex-col gap-[var(--space-1-5)]">
      {/* "Original Email" heading — Inter SemiBold 20px */}
      <p className={SECTION_HEADING}>Original Email</p>

      {/* Email card */}
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
        {/* Org header */}
        <Avatar avatars={[{ name: displayOrgName }]} />

        {/* Email content */}
        <div className="flex w-full flex-col gap-[var(--space-2)] tracking-[var(--letter-spacing-body2)]">
          {content === undefined ? (
            /* Loading skeleton */
            <div className="flex flex-col gap-[var(--space-2)]">
              <div className="h-5 w-2/3 animate-pulse rounded bg-[var(--color-neutral-200)]" />
              <div className="h-4 w-full animate-pulse rounded bg-[var(--color-neutral-200)]" />
              <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--color-neutral-200)]" />
              <div className="h-4 w-4/6 animate-pulse rounded bg-[var(--color-neutral-200)]" />
            </div>
          ) : (
            <>
              {/* Subject / title */}
              <p
                data-testid="email-subject"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
