/**
 * DesignSystem — dev review page
 *
 * Renders every design token and every component in the Loop design system.
 * All styling uses Tailwind classes backed by tokens.css — nothing hardcoded.
 */

import { useState } from 'react';

import { Button }       from '../components/Button';
import { Toggle }       from '../components/Toggle';
import { Tag }          from '../components/Tags';
import { SearchBar }    from '../components/SearchBar';
import { Avatar }       from '../components/Avatar';
import { SideBar }      from '../components/SideBar';
import type { SideBarItemId } from '../components/SideBar';
import { LoopLogo }     from '../components/Logo';

import { DashboardEventCard }  from '../components/Cards/DashboardEventCard';
import { DashboardPost }       from '../components/Cards/DashboardPost';
import { LoopSummary }         from '../components/Cards/LoopSummary';
import {
  DateBadge,
  ExtensionEventRow,
  ExtensionEventCard,
} from '../components/Cards/ExtensionEventCard';

import { SearchPanel, SearchResultList } from '../components/SearchPanel';

// ─── Page-internal layout helpers ─────────────────────────────────────────────
// These are NOT new design-system components — they are private page layout
// utilities used only within this file.

function DS_Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={[
        'flex flex-col gap-[var(--space-6)]',
        'bg-[var(--color-surface)]',
        'rounded-[var(--radius-card)]',
        'p-[var(--space-6)]',
        'shadow-[var(--shadow-2)]',
      ].join(' ')}
    >
      <h2
        className={[
          'font-[family-name:var(--font-heading)] font-bold',
          'text-[length:var(--font-size-sub1)] leading-[var(--line-height-sub1)]',
          'text-[var(--color-neutral-900)]',
          'pb-[var(--space-3)] border-b border-[var(--color-border)]',
        ].join(' ')}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function DS_Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      className={[
        'font-[family-name:var(--font-body)] font-semibold',
        'text-[length:var(--font-size-body3)]',
        'text-[var(--color-text-secondary)]',
        'uppercase tracking-[0.08em]',
      ].join(' ')}
    >
      {children}
    </p>
  );
}

function DS_Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <DS_Label>{label}</DS_Label>
      <div className="flex flex-wrap gap-[var(--space-3)] items-start">
        {children}
      </div>
    </div>
  );
}

// ─── Color swatch data ─────────────────────────────────────────────────────────
// hex values are displayed as text metadata — the swatch bg uses the CSS var.

type Swatch = { token: string; hex: string };
type SwatchGroup = { group: string; swatches: Swatch[] };

const COLOR_GROUPS: SwatchGroup[] = [
  {
    group: 'Primary',
    swatches: [
      { token: '--color-primary-900', hex: '#592100' },
      { token: '--color-primary-800', hex: '#a74409' },
      { token: '--color-primary-700', hex: '#eb7128' },
      { token: '--color-primary-hover', hex: '#d35910' },
      { token: '--color-primary-600', hex: '#ffa26b' },
      { token: '--color-primary-500', hex: '#ffcaaa' },
      { token: '--color-primary-400', hex: '#fff2ea' },
    ],
  },
  {
    group: 'Secondary',
    swatches: [
      { token: '--color-secondary-900', hex: '#13324e' },
      { token: '--color-secondary-700', hex: '#285781' },
      { token: '--color-secondary-600', hex: '#427fb4' },
      { token: '--color-secondary-500', hex: '#63a9e7' },
      { token: '--color-secondary-400', hex: '#acd6fb' },
      { token: '--color-secondary-300', hex: '#eaf3fc' },
    ],
  },
  {
    group: 'Neutral',
    swatches: [
      { token: '--color-neutral-900', hex: '#212529' },
      { token: '--color-neutral-700', hex: '#495057' },
      { token: '--color-neutral-600', hex: '#616972' },
      { token: '--color-neutral-500', hex: '#adb5bd' },
      { token: '--color-neutral-400', hex: '#ced4da' },
      { token: '--color-neutral-300', hex: '#dee2e6' },
      { token: '--color-neutral-200', hex: '#edeff1' },
      { token: '--color-neutral-100', hex: '#f8f9fa' },
      { token: '--color-black',       hex: '#000000' },
      { token: '--color-white',       hex: '#ffffff' },
    ],
  },
  {
    group: 'Semantic aliases',
    swatches: [
      { token: '--color-brand',          hex: '→ primary-700' },
      { token: '--color-brand-light',    hex: '→ primary-400' },
      { token: '--color-brand-dark',     hex: '→ primary-900' },
      { token: '--color-text-default',   hex: '→ neutral-900' },
      { token: '--color-text-secondary', hex: '→ neutral-600' },
      { token: '--color-text-muted',     hex: '→ neutral-500' },
      { token: '--color-text-inverse',   hex: '→ white' },
      { token: '--color-surface',        hex: '→ white' },
      { token: '--color-surface-subtle', hex: '→ neutral-100' },
      { token: '--color-surface-raised', hex: '→ neutral-200' },
      { token: '--color-border',         hex: '→ neutral-300' },
      { token: '--color-border-strong',  hex: '→ neutral-400' },
      { token: '--color-link',           hex: '→ secondary-600' },
    ],
  },
];

// ─── Typography data ───────────────────────────────────────────────────────────

const TYPE_STYLES = [
  {
    label: 'H1 — 60 px / Bold',
    className:
      'font-[family-name:var(--font-heading)] font-bold ' +
      'text-[length:var(--font-size-h1)] leading-[var(--line-height-h1)] ' +
      'tracking-[var(--letter-spacing-h1)] text-[var(--color-text-default)]',
    sample: 'Heading One',
  },
  {
    label: 'H2 — 48 px / Bold',
    className:
      'font-[family-name:var(--font-heading)] font-bold ' +
      'text-[length:var(--font-size-h2)] leading-[var(--line-height-h2)] ' +
      'tracking-[var(--letter-spacing-h2)] text-[var(--color-text-default)]',
    sample: 'Heading Two',
  },
  {
    label: 'H3 — 40 px / Bold',
    className:
      'font-[family-name:var(--font-heading)] font-bold ' +
      'text-[length:var(--font-size-h3)] leading-[var(--line-height-h3)] ' +
      'tracking-[var(--letter-spacing-h3)] text-[var(--color-text-default)]',
    sample: 'Heading Three',
  },
  {
    label: 'Sub 1 — 28 px / SemiBold',
    className:
      'font-[family-name:var(--font-body)] font-semibold ' +
      'text-[length:var(--font-size-sub1)] leading-[var(--line-height-sub1)] ' +
      'tracking-[var(--letter-spacing-sub1)] text-[var(--color-text-default)]',
    sample: 'Subtitle One',
  },
  {
    label: 'Sub 2 — 18 px / SemiBold',
    className:
      'font-[family-name:var(--font-body)] font-semibold ' +
      'text-[length:var(--font-size-sub2)] leading-[var(--line-height-sub2)] ' +
      'tracking-[var(--letter-spacing-sub2)] text-[var(--color-text-default)]',
    sample: 'Subtitle Two',
  },
  {
    label: 'Body 1 — 18 px / Regular',
    className:
      'font-[family-name:var(--font-body)] font-normal ' +
      'text-[length:var(--font-size-body1)] leading-[var(--line-height-body1)] ' +
      'tracking-[var(--letter-spacing-body1)] text-[var(--color-text-default)]',
    sample: 'Body text at 18 px. Used for prominent paragraph copy.',
  },
  {
    label: 'Body 2 — 14 px / Regular',
    className:
      'font-[family-name:var(--font-body)] font-normal ' +
      'text-[length:var(--font-size-body2)] leading-[var(--line-height-body2)] ' +
      'tracking-[var(--letter-spacing-body2)] text-[var(--color-text-default)]',
    sample: 'Body text at 14 px. The standard UI copy size across cards, inputs, and labels.',
  },
  {
    label: 'Body 3 — 12 px / Regular',
    className:
      'font-[family-name:var(--font-body)] font-normal ' +
      'text-[length:var(--font-size-body3)] leading-[var(--line-height-body3)] ' +
      'tracking-[var(--letter-spacing-body3)] text-[var(--color-text-secondary)]',
    sample: 'Body text at 12 px. Used for captions, timestamps, and metadata.',
  },
  {
    label: 'Brand wordmark (compact) — Manrope Bold 32 px',
    className:
      'font-[family-name:var(--font-brand)] font-bold ' +
      'text-[length:var(--font-size-wordmark)] leading-none ' +
      'text-[var(--color-text-default)]',
    sample: 'Loop',
  },
  {
    label: 'Brand wordmark (display) — Manrope Bold 55 px',
    className:
      'font-[family-name:var(--font-brand)] font-bold ' +
      'text-[length:var(--font-size-wordmark-display)] leading-none ' +
      'text-[var(--color-text-default)]',
    sample: 'Loop',
  },
];

// ─── Sample data for components ────────────────────────────────────────────────

const SAMPLE_TAGS = [
  { label: 'CS', color: 'neutral' as const },
  { label: 'Open to all', color: 'blue' as const },
];

const SAMPLE_EVENT_PROPS = {
  title: 'Intro to Machine Learning Workshop',
  datetime: 'Fri, Mar 14 · 6:00 – 8:00 PM',
  location: 'Gates Hall 122',
  description:
    'Join us for a hands-on intro to ML covering linear regression, decision trees, and neural networks. No prior experience required — laptops welcome.',
  tags: SAMPLE_TAGS,
};

const SAMPLE_ORGS = [
  { name: 'CDS', avatarUrl: undefined },
  { name: 'Cornell AI', avatarUrl: undefined },
];

const SAMPLE_EXT_EVENTS = [
  {
    thumbnailVariant: 'date' as const,
    day: 14,
    month: 'Mar',
    title: 'ML Workshop',
    description: 'Gates Hall 122 · 6 – 8 PM',
    bookmarked: false,
  },
  {
    thumbnailVariant: 'date' as const,
    day: 21,
    month: 'Mar',
    title: 'Cornell Hackathon Kickoff',
    description: 'Duffield Atrium · 5 PM',
    bookmarked: true,
  },
  {
    thumbnailVariant: 'news' as const,
    title: 'Spring 2025 Newsletter',
    description: 'CDS · published today',
    bookmarked: false,
  },
];

const SAMPLE_RSVP_GROUPS = [
  {
    period: 'Today',
    events: [
      { day: 14, month: 'Mar', title: 'ML Workshop', description: 'Gates Hall 122 · 6 PM' },
    ],
  },
  {
    period: 'This Week',
    events: [
      { day: 16, month: 'Mar', title: 'Hackathon Kickoff', description: 'Duffield · 5 PM' },
      { day: 17, month: 'Mar', title: 'Startup Pitch Night', description: 'Statler · 7 PM' },
    ],
  },
];

const SAMPLE_CLUBS = [
  { id: 'cds',  name: 'CDS',         notificationCount: 3 },
  { id: 'cai',  name: 'Cornell AI',  notificationCount: 0 },
  { id: 'dtx',  name: 'DTX' },
  { id: 'cuse', name: 'CUSE' },
];

const SAMPLE_RESULT_GROUPS = [
  {
    period: 'Top Results',
    items: [
      { title: 'ML Workshop',       orgName: 'CDS',       hasIndicator: true,  tag: { label: 'CS', color: 'neutral' as const } },
      { title: 'Hackathon Kickoff', orgName: 'Cornell AI', hasIndicator: false, tag: { label: 'Open to all', color: 'blue' as const } },
      { title: 'Pitch Night',       orgName: 'eLab',      hasIndicator: false },
    ],
  },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DesignSystem() {
  const [sidebarActive, setSidebarActive] = useState<SideBarItemId>('home');
  const [bookmarked, setBookmarked] = useState(false);
  const [toggleCompact, setToggleCompact] = useState('Feed');
  const [toggleDefault, setToggleDefault] = useState('Feed');

  return (
    <div
      className={[
        'min-h-screen bg-[var(--color-surface-subtle)]',
        'px-[var(--space-8)] py-[var(--space-10)]',
        'flex flex-col gap-[var(--space-8)]',
        'text-left',
      ].join(' ')}
    >
      {/* ── Page title ── */}
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1
          className={[
            'font-[family-name:var(--font-heading)] font-bold',
            'text-[length:var(--font-size-h2)] leading-[var(--line-height-h2)]',
            'text-[var(--color-neutral-900)]',
          ].join(' ')}
        >
          Loop Design System
        </h1>
        <p
          className={[
            'font-[family-name:var(--font-body)] font-normal',
            'text-[length:var(--font-size-body1)] leading-[var(--line-height-body1)]',
            'text-[var(--color-text-secondary)]',
          ].join(' ')}
        >
           Testing Page 
        </p>
      </header>

      {/* ════════════════════════════════════════
          1. COLORS
         ════════════════════════════════════════ */}
      <DS_Section id="colors" title="Colors">
        {COLOR_GROUPS.map(({ group, swatches }) => (
          <div key={group} className="flex flex-col gap-[var(--space-3)]">
            <DS_Label>{group}</DS_Label>
            <div className="flex flex-wrap gap-[var(--space-3)]">
              {swatches.map(({ token, hex }) => (
                <div
                  key={token}
                  className="flex flex-col gap-[var(--space-1)] w-[6.5rem]"
                >
                  <div
                    className={[
                      'h-[var(--space-10)] w-full rounded-[var(--radius-input)]',
                      'border border-[var(--color-border)]',
                    ].join(' ')}
                    style={{ backgroundColor: `var(${token})` }}
                  />
                  <p
                    className={[
                      'font-[family-name:var(--font-body)] font-medium',
                      'text-[length:var(--font-size-body3)]',
                      'text-[var(--color-text-default)]',
                      'break-all',
                    ].join(' ')}
                  >
                    {token}
                  </p>
                  <p
                    className={[
                      'font-[family-name:var(--font-body)] font-normal',
                      'text-[length:var(--font-size-body3)]',
                      'text-[var(--color-text-secondary)]',
                    ].join(' ')}
                  >
                    {hex}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </DS_Section>

      {/* ════════════════════════════════════════
          2. TYPOGRAPHY
         ════════════════════════════════════════ */}
      <DS_Section id="typography" title="Typography">
        {TYPE_STYLES.map(({ label, className, sample }) => (
          <div
            key={label}
            className={[
              'flex flex-col gap-[var(--space-1)]',
              'pb-[var(--space-4)] border-b border-[var(--color-surface-subtle)]',
            ].join(' ')}
          >
            <DS_Label>{label}</DS_Label>
            <p className={className}>{sample}</p>
          </div>
        ))}
      </DS_Section>

      {/* ════════════════════════════════════════
          3. LOGO
         ════════════════════════════════════════ */}
      <DS_Section id="logo" title="Logo">
        <DS_Row label="Wordmark — light bg">
          <LoopLogo variant="wordmark" size="sm" />
          <LoopLogo variant="wordmark" size="md" />
          <LoopLogo variant="wordmark" size="lg" />
        </DS_Row>

        <DS_Row label="Wordmark — dark bg">
          <div className="flex gap-[var(--space-4)] p-[var(--space-4)] rounded-[var(--radius-input)] bg-[var(--color-neutral-900)]">
            <LoopLogo variant="wordmark-light" size="sm" />
            <LoopLogo variant="wordmark-light" size="md" />
            <LoopLogo variant="wordmark-light" size="lg" />
          </div>
        </DS_Row>

        <DS_Row label="Mark only — standard">
          <LoopLogo variant="mark" size="sm" />
          <LoopLogo variant="mark" size="md" />
          <LoopLogo variant="mark" size="lg" />
        </DS_Row>

        <DS_Row label="Mark only — mixed (for coloured backgrounds)">
          <div className="flex gap-[var(--space-4)] p-[var(--space-4)] rounded-[var(--radius-input)] bg-[var(--color-primary-700)]">
            <LoopLogo variant="mark-mixed" size="sm" />
            <LoopLogo variant="mark-mixed" size="md" />
            <LoopLogo variant="mark-mixed" size="lg" />
          </div>
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          4. BUTTON
         ════════════════════════════════════════ */}
      <DS_Section id="button" title="Button">
        <DS_Row label="Primary — sm / md">
          <Button variant="primary" size="sm">Primary sm</Button>
          <Button variant="primary" size="md">Primary md</Button>
        </DS_Row>

        <DS_Row label="Primary CTA — full width">
          <div className="w-[28rem]">
            <Button variant="primary" size="cta">Get started</Button>
          </div>
        </DS_Row>

        <DS_Row label="Secondary — sm / md">
          <Button variant="secondary" size="sm">Secondary sm</Button>
          <Button variant="secondary" size="md">Secondary md</Button>
        </DS_Row>

        <DS_Row label="Secondary CTA — full width">
          <div className="w-[28rem]">
            <Button variant="secondary" size="cta">Learn more</Button>
          </div>
        </DS_Row>

        <DS_Row label="Disabled state">
          <Button variant="primary"   size="md" disabled>Primary disabled</Button>
          <Button variant="secondary" size="md" disabled>Secondary disabled</Button>
          <Button variant="primary"   size="cta" disabled>CTA disabled</Button>
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          5. TOGGLE
         ════════════════════════════════════════ */}
      <DS_Section id="toggle" title="Toggle">
        <DS_Row label='Compact — Figma "Extension" toggle (gap 8px, py 8px)'>
          <Toggle
            options={['Feed', 'Bookmarks']}
            value={toggleCompact}
            onChange={setToggleCompact}
            size="compact"
          />
        </DS_Row>

        <DS_Row label='Default — Figma "Desktop" toggle (gap 32px, py 6px)'>
          <Toggle
            options={['Feed', 'Bookmarks']}
            value={toggleDefault}
            onChange={setToggleDefault}
            size="default"
          />
        </DS_Row>

        <DS_Row label="Three options">
          <Toggle
            options={['Home', 'Bookmarks', 'Profile']}
            value={toggleDefault}
            onChange={setToggleDefault}
            size="compact"
          />
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          6. TAG
         ════════════════════════════════════════ */}
      <DS_Section id="tag" title="Tag">
        <DS_Row label="Neutral (default)">
          <Tag color="neutral">Computer Science</Tag>
          <Tag color="neutral">Open to all</Tag>
        </DS_Row>

        <DS_Row label="Blue (primary)">
          <Tag color="blue">Cornell Daily Sun</Tag>
          <Tag color="blue">Free food</Tag>
        </DS_Row>

        <DS_Row label="Dismissible (neutral + blue)">
          <Tag color="neutral" onDismiss={() => {}}>Dismissible neutral</Tag>
          <Tag color="blue"    onDismiss={() => {}}>Dismissible blue</Tag>
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          7. SEARCH BAR
         ════════════════════════════════════════ */}
      <DS_Section id="searchbar" title="Search Bar">
        <DS_Row label="Blank (no value)">
          <div className="w-[20rem]">
            <SearchBar placeholder="Search events, clubs…" />
          </div>
        </DS_Row>

        <DS_Row label="With value (shows clear button)">
          <div className="w-[20rem]">
            <SearchBar defaultValue="Machine learning" />
          </div>
        </DS_Row>

        <DS_Row label="Disabled">
          <div className="w-[20rem]">
            <SearchBar placeholder="Search disabled" disabled />
          </div>
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          8. AVATAR
         ════════════════════════════════════════ */}
      <DS_Section id="avatar" title="Avatar">
        <DS_Row label="Single — with image URL">
          <Avatar avatars={[{ src: 'https://i.pravatar.cc/64?img=1', name: 'Alice Chen' }]} />
        </DS_Row>

        <DS_Row label="Single — fallback (no src)">
          <Avatar avatars={[{ name: 'Bob Smith' }]} />
        </DS_Row>

        <DS_Row label="Multiple — stacked (fallback icons)">
          <Avatar
            avatars={[
              { name: 'CDS' },
              { name: 'Cornell AI' },
              { name: 'eLab' },
            ]}
          />
        </DS_Row>

        <DS_Row label="Multiple — stacked (with images)">
          <Avatar
            avatars={[
              { src: 'https://i.pravatar.cc/64?img=2', name: 'Alice' },
              { src: 'https://i.pravatar.cc/64?img=3', name: 'Bob' },
              { src: 'https://i.pravatar.cc/64?img=4', name: 'Carol' },
            ]}
          />
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          9. SIDE BAR
         ════════════════════════════════════════ */}
      <DS_Section id="sidebar" title="Side Bar">
        <DS_Label>
          Active item: <strong>{sidebarActive}</strong> — click tabs to change state
        </DS_Label>
        <div
          className={[
            'h-[26rem] rounded-[var(--radius-card)] overflow-hidden',
            'border border-[var(--color-border)]',
          ].join(' ')}
        >
          <SideBar activeItem={sidebarActive} onNavigate={setSidebarActive} />
        </div>
      </DS_Section>

      {/* ════════════════════════════════════════
          10. CARDS — DashboardEventCard
         ════════════════════════════════════════ */}
      <DS_Section id="dashboard-event-card" title="Cards — Dashboard Event Card">
        <DS_Row label="Default (no bookmark, truncated description)">
          <div className="w-[28rem]">
            <DashboardEventCard
              {...SAMPLE_EVENT_PROPS}
              descriptionTruncated
              bookmarked={false}
            />
          </div>
        </DS_Row>

        <DS_Row label="Bookmarked (saved state)">
          <div className="w-[28rem]">
            <DashboardEventCard
              {...SAMPLE_EVENT_PROPS}
              descriptionTruncated={false}
              bookmarked={bookmarked}
              onBookmark={() => setBookmarked((b) => !b)}
            />
          </div>
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          11. CARDS — DashboardPost
         ════════════════════════════════════════ */}
      <DS_Section id="dashboard-post" title="Cards — Dashboard Post">
        <DS_Row label="With org header (avatar stack + indicator badge)">
          <div className="w-[28rem]">
            <DashboardPost
              organizations={SAMPLE_ORGS}
              postedAt="Mar 12"
              {...SAMPLE_EVENT_PROPS}
              descriptionTruncated
            />
          </div>
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          12. CARDS — Loop Summary
         ════════════════════════════════════════ */}
      <DS_Section id="loop-summary" title="Cards — Loop Summary">
        <DS_Row label="Default">
          <div className="w-[28rem]">
            <LoopSummary
              summary="This week CDS is running an intro ML workshop and Cornell AI is hosting a neural networks deep-dive. Both events are open to all majors and offer free dinner. RSVPs close 48 hours before each session."
            />
          </div>
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          13. CARDS — Extension Event Card
         ════════════════════════════════════════ */}
      <DS_Section id="extension-event-card" title="Cards — Extension Event Card">
        <DS_Row label="DateBadge — date variant">
          <DateBadge variant="date" day={14} month="Mar" />
          <DateBadge variant="date" day={5}  month="Apr" />
        </DS_Row>

        <DS_Row label="DateBadge — news variant">
          <DateBadge variant="news" />
        </DS_Row>

        <DS_Row label="ExtensionEventRow — default / bookmarked">
          <div className="w-[22rem] flex flex-col gap-[var(--space-2)]">
            <ExtensionEventRow
              thumbnailVariant="date"
              day={14}
              month="Mar"
              title="ML Workshop"
              description="Gates Hall 122 · 6 PM"
              bookmarked={false}
            />
            <ExtensionEventRow
              thumbnailVariant="date"
              day={21}
              month="Mar"
              title="Hackathon Kickoff"
              description="Duffield · 5 PM"
              bookmarked
            />
            <ExtensionEventRow
              thumbnailVariant="news"
              title="Spring Newsletter"
              description="CDS · published today"
              bookmarked={false}
            />
          </div>
        </DS_Row>

        <DS_Row label="ExtensionEventCard — full card with org header">
          <div className="w-[22rem]">
            <ExtensionEventCard
              orgName="Cornell Data Science"
              events={SAMPLE_EXT_EVENTS}
            />
          </div>
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          14. SEARCH PANEL
         ════════════════════════════════════════ */}
      <DS_Section id="search-panel" title="Search Panel">
        <DS_Row label="SearchPanel — RSVPs + Clubs">
          <SearchPanel
            rsvpGroups={SAMPLE_RSVP_GROUPS}
            clubs={SAMPLE_CLUBS}
          />
        </DS_Row>
      </DS_Section>

      {/* ════════════════════════════════════════
          15. SEARCH RESULT LIST
         ════════════════════════════════════════ */}
      <DS_Section id="search-result-list" title="Search Result List">
        <DS_Row label="With grouped results + Show more">
          <div className="w-[22rem]">
            <SearchResultList
              groups={SAMPLE_RESULT_GROUPS}
              onShowMore={() => {}}
            />
          </div>
        </DS_Row>
      </DS_Section>
    </div>
  );
}
