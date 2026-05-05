# Diff vs Figma (after @source fix)

Iteration 01 baseline: `01-after-tailwind-fix-1280.png` → Figma node 506:8718.

## Root cause found and fixed in iter 01

**Tailwind v4 scoping:** `@tailwindcss/vite` auto-detected only the dashboard package. Utility classes used exclusively inside `shared/ui/src` (hover-card `opacity-0`, `pointer-events-none`, many layout classes) were absent from the generated stylesheet. Result: all `OrgHoverCard`s rendered visible, stacked inside post headers.

Fix: added `@source "../../../shared/ui/src"` to `apps/dashboard/src/index.css`.

## Remaining deltas

### Right panel (critical)

- **Now:** custom "This week" + "Trending" panels rendering `HomeEventRow`s with org avatars inline.
- **Figma / DS:** `SearchPanel` component — "Your RSVPs" grouped by period (with `DateBadge` thumbnails) + "Your Clubs" grid of 56.7px circle avatars with notification-count pill.
- **Action:** delete `HomeEventRow` / `HomeSidePanel` + `HomeEventItem` / `HomeSidePanelProps` types from `Home.tsx`. Import + render `SearchPanel` from `@app/ui`. Drop the existing `<aside>` wrapper — `SearchPanel` provides its own. Swap `HomeProps.sidePanels` → `rsvpGroups: RsvpGroup[]` + `clubs: Club[]`.
- **Sample data:** replace `SAMPLE_SIDE_PANELS` with `SAMPLE_RSVP_GROUPS` (matching `RsvpGroup[]`) and `SAMPLE_CLUBS` (matching `Club[]`). Update `RoutedHome` in `App.tsx`.

### Feed background

- Figma uses `#f8f9fa` (our `--color-surface-subtle`) for the feed column. Current impl already uses `--color-surface-subtle` on `<main>` — OK. Verify no nested white wrappers leak.

### Post list padding

- Figma: `pt 24px, pb 32px, px 32px, gap 20px` between posts. Current: `py-[var(--space-6)]` on main + `gap-[var(--space-8)] px-[var(--space-6)]` (= 32/24) on post list. Delta: `gap` should be 20px (`var(--space-5)` if exists else `[20px]`), `px` should be 32px (`var(--space-8)`).

### Search bar

- Figma has inline `close-outline` icon on right even when empty (per design spec). Our `SearchBar` only shows clear button when value is set. Acceptable — design-system behaviour. No change unless user asks.

### Minor

- Sidebar spacing, Loop logo sizing look fine at 1280. Re-verify after right-panel swap.
- Tags row gap matches.

## Steps

1. Update `Home.tsx`: replace right-panel implementation with `SearchPanel`.
2. Update `data/sampleHome.ts`: swap fixtures.
3. Update `App.tsx` `RoutedHome` wrapper to pass `rsvpGroups` + `clubs`.
4. Adjust feed list `px` and post `gap` to Figma values.
5. Re-screenshot → iterate.
