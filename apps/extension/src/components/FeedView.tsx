import { ExtensionEventCard } from "@app/ui";

// Figma: Inter SemiBold 20px, #5f5f5f, tracking -0.22px, leading 1.5
const SECTION_HEADING =
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[1.25rem] leading-[1.5] tracking-[-0.22px] " +
  "text-[#5f5f5f] whitespace-nowrap";

export default function FeedView() {
  return (
    <div className="flex w-full flex-col gap-[var(--space-4)]">
      {/* ── Your Subscriptions ── */}
      <section className="flex flex-col gap-[var(--space-4)]">
        <p className={SECTION_HEADING}>Your Subscriptions</p>

        <ExtensionEventCard
          orgName="Cornell DTI"
          events={[
            {
              thumbnailVariant: "date",
              day: 24,
              month: "Mar",
              title: "Datadog recruitment event",
              description: "Datadog recruitment event",
              bookmarked: true,
            },
            {
              thumbnailVariant: "news",
              title: "Datadog recruitment event",
              description: "Datadog recruitment event",
              bookmarked: false,
            },
            {
              thumbnailVariant: "date",
              day: 24,
              month: "Mar",
              title: "Datadog recruitment event",
              description: "Datadog recruitment event",
              bookmarked: false,
            },
          ]}
        />

        <ExtensionEventCard
          orgName="Cornell DTI"
          events={[
            {
              thumbnailVariant: "date",
              day: 24,
              month: "Mar",
              title: "Datadog recruitment event",
              description: "Datadog recruitment event",
              bookmarked: false,
            },
            {
              thumbnailVariant: "date",
              day: 24,
              month: "Mar",
              title: "Datadog recruitment event",
              description: "Datadog recruitment event",
              bookmarked: false,
            },
            {
              thumbnailVariant: "date",
              day: 24,
              month: "Mar",
              title: "Datadog recruitment event",
              description: "Datadog recruitment event",
              bookmarked: false,
            },
          ]}
        />
      </section>

      {/* ── Trending This Week ── */}
      <section className="flex flex-col gap-[var(--space-4)]">
        <p className={SECTION_HEADING}>Trending This Week</p>

        <ExtensionEventCard
          orgName="Cornell DTI"
          events={[
            {
              thumbnailVariant: "date",
              day: 24,
              month: "Mar",
              title: "Datadog recruitment event",
              description: "Datadog recruitment event",
              bookmarked: true,
            },
          ]}
        />

        <ExtensionEventCard
          orgName="Cornell DTI"
          events={[
            {
              thumbnailVariant: "news",
              title: "Datadog recruitment event",
              description: "Datadog recruitment event",
              bookmarked: false,
            },
          ]}
        />
      </section>
    </div>
  );
}
