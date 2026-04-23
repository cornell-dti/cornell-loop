import { Tag } from "@app/ui";
import { BookmarkCard } from "./BookmarkCard";
import EditIcon from "@app/ui/assets/edit_icon.svg?react";

// Figma: Inter Regular 16px, #5f5f5f, tracking -0.176px, leading 1.5
const SORT_LABEL =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[1rem] leading-[1.5] tracking-[-0.176px] " +
  "text-[#5f5f5f] whitespace-nowrap";

// Figma: Inter SemiBold 20px, #5f5f5f, tracking -0.22px, leading 1.5
const SECTION_HEADING =
  "font-[family-name:var(--font-body)] font-semibold " +
  "text-[1.25rem] leading-[1.5] tracking-[-0.22px] " +
  "text-[#5f5f5f] whitespace-nowrap";

const SORT_TAGS = [
  "Internships",
  "Early career",
  "Tech",
  "Mentorship",
  "Just for fun",
];

export default function BookmarkView() {
  return (
    <div className="flex w-full flex-col gap-[var(--space-4)]">
      {/* ── Sort by ── */}
      <section className="flex flex-col gap-[var(--space-2)]">
        <p className={SORT_LABEL}>Sort by</p>

        {/* Figma: flex-wrap gap-[9px], tag chips + pencil icon at end */}
        <div className="flex flex-wrap items-center gap-[9px]">
          {SORT_TAGS.map((label) => (
            <Tag key={label} color="neutral">
              {label}
            </Tag>
          ))}

          {/* "+" add tag chip */}
          <Tag color="neutral">+</Tag>

          {/* Pencil / edit icon — 16px, Figma node 528:5470 */}
          <button
            type="button"
            aria-label="Edit filter tags"
            className="size-4 shrink-0 cursor-pointer opacity-60 transition-opacity hover:opacity-100"
          >
            <EditIcon className="size-full" />
          </button>
        </div>
      </section>

      {/* ── Your Bookmarks ── */}
      <section className="flex flex-col gap-[var(--space-4)]">
        <p className={SECTION_HEADING}>Your Bookmarks</p>

        <div className="flex flex-col gap-[var(--space-4)]">
          {/* Card 1 — RSVP + Add to Calendar */}
          <BookmarkCard
            orgName="Cornell DTI"
            thumbnailVariant="date"
            day={24}
            month="Mar"
            title="Datadog recruitment event"
            subtitle={["4:00 pm - 5:30 pm", "Hollister hall 312"]}
            tags={["Internships", "Early career"]}
            onRsvp={() => {}}
            onAddToCalendar={() => {}}
          />

          {/* Card 2 — Add to Calendar only */}
          <BookmarkCard
            orgName="Cornell DTI"
            thumbnailVariant="date"
            day={24}
            month="Mar"
            title="Datadog recruitment event"
            subtitle={["4:00 pm - 5:30 pm", "Hollister hall 312"]}
            tags={["Internships", "Early career"]}
            onAddToCalendar={() => {}}
          />

          {/* Card 3 — RSVP + Add to Calendar */}
          <BookmarkCard
            orgName="Cornell DTI"
            thumbnailVariant="date"
            day={24}
            month="Mar"
            title="Datadog recruitment event"
            subtitle={["4:00 pm - 5:30 pm", "Hollister hall 312"]}
            tags={["Internships", "Early career"]}
            onRsvp={() => {}}
            onAddToCalendar={() => {}}
          />
        </div>
      </section>
    </div>
  );
}
