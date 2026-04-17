import { Tag } from '@app/ui'
import { BookmarkCard } from './BookmarkCard'
import EditIcon from '@app/ui/assets/edit_icon.svg?react'

// ── Shared typography ──────────────────────────────────────────────────────

// Figma: Inter Regular 16px, #5f5f5f, tracking -0.176px, leading 1.5
const UI_BODY =
  'font-[family-name:var(--font-body)] font-normal ' +
  'text-[1rem] leading-[1.5] tracking-[-0.176px] text-[#5f5f5f]'

// Figma: Inter Regular 16px label for "Sort by" (same style as UI_BODY)
const SORT_LABEL = UI_BODY + ' whitespace-nowrap'

const SORT_TAGS = ['Internships', 'Early career', 'Tech', 'Mentorship', 'Just for fun']

const POPULAR_SEARCHES = [
  { rank: '#1', term: 'Recruitment' },
  { rank: '#2', term: 'Sports' },
  { rank: '#3', term: 'Concert' },
  { rank: '#4', term: 'Housing' },
  { rank: '#5', term: 'A&S' },
]

// ── SearchEmptyState ───────────────────────────────────────────────────────
// Figma 554:7828 — shown when the search bar is focused but has no query.
// Displays "Popular searches this week" + 5 ranked trending rows.

function SearchEmptyState() {
  return (
    <div className="flex flex-col gap-[var(--space-3)] w-full">
      {/* Heading — Figma: DM Sans Medium 18px, #5f5f5f, lh 28px, tracking -0.5px */}
      <p
        className={
          'font-[family-name:var(--font-body)] font-medium ' +
          'text-[length:var(--font-size-body1)] leading-[var(--line-height-body1)] ' +
          'tracking-[var(--letter-spacing-body1)] text-[#5f5f5f] whitespace-nowrap'
        }
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        Popular searches this week
      </p>

      {/* Ranked rows — Figma: bg #f9f9f9, rounded-[16px], px-16 py-8, gap-12 */}
      <div className="flex flex-col gap-[var(--space-2)] w-full">
        {POPULAR_SEARCHES.map(({ rank, term }) => (
          <button
            key={rank}
            type="button"
            className={
              'flex items-center gap-[var(--space-3)] w-full ' +
              'bg-[#f9f9f9] rounded-[var(--radius-button)] ' +
              'px-[var(--space-4)] py-[var(--space-2)] ' +
              'hover:bg-[var(--color-neutral-200)] transition-colors duration-150 ' +
              'text-left'
            }
          >
            <span className={UI_BODY + ' shrink-0'}>{rank}</span>
            <span className={UI_BODY}>{term}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── SearchResultsState ─────────────────────────────────────────────────────
// Figma 554:6324 — shown when there are search results.
// Displays "Sort by" tags + BookmarkCards.

function SearchResultsState() {
  return (
    <div className="flex flex-col gap-[var(--space-4)] w-full">

      {/* Sort by */}
      <section className="flex flex-col gap-[var(--space-2)]">
        <p className={SORT_LABEL}>Sort by</p>
        <div className="flex flex-wrap gap-[9px] items-center">
          {SORT_TAGS.map((label) => (
            <Tag key={label} color="neutral">{label}</Tag>
          ))}
          <Tag color="neutral">+</Tag>
          <button
            type="button"
            aria-label="Edit filter tags"
            className="shrink-0 size-4 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
          >
            <EditIcon className="size-full" />
          </button>
        </div>
      </section>

      {/* Result cards */}
      <div className="flex flex-col gap-[var(--space-4)]">
        {/* Card 1 — date, RSVP + Add to Calendar */}
        <BookmarkCard
          orgName="Cornell DTI"
          thumbnailVariant="date"
          day={24}
          month="Mar"
          title="Datadog recruitment event"
          subtitle={['4:00 pm - 5:30 pm', 'Hollister hall 312']}
          tags={['Internships', 'Early career']}
          onRsvp={() => {}}
          onAddToCalendar={() => {}}
        />

        {/* Card 2 — news, single-line subtitle, Add to Calendar only */}
        <BookmarkCard
          orgName="Cornell DTI"
          thumbnailVariant="news"
          title="Datadog recruitment event"
          subtitle="For early career designers and developers"
          tags={['Internships', 'Early career']}
          onAddToCalendar={() => {}}
        />

        {/* Card 3 — date, no action buttons */}
        <BookmarkCard
          orgName="Cornell DTI"
          thumbnailVariant="date"
          day={24}
          month="Mar"
          title="Datadog recruitment event"
          subtitle={['4:00 pm - 5:30 pm', 'Hollister hall 312']}
          tags={['Internships', 'Early career']}
        />
      </div>
    </div>
  )
}

// ── SearchView ─────────────────────────────────────────────────────────────
// Root export. Switches between the empty / popular state and the results
// state based on whether a query string is present.

export interface SearchViewProps {
  /** The current search query. Empty string or undefined → popular state. */
  query?: string
}

export default function SearchView({ query = '' }: SearchViewProps) {
  return query.trim() === '' ? <SearchEmptyState /> : <SearchResultsState />
}
