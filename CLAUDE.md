# Cornell Loop — Agent Guide

Loop is an event-discovery dashboard for Cornell student orgs. Students follow clubs, RSVP to events, and browse a feed of upcoming happenings. Convex backs auth + data; a browser extension surface is also planned.

Keep this file concise — it loads every new session.

## Repo layout

- `apps/dashboard/` — Vite + React 19 + TypeScript SPA (the main web app).
- `shared/ui/` — design system (components, tokens, utils). Imported in the dashboard via the `@app/ui` alias (see `apps/dashboard/vite.config.ts`).
- `ai/`, `scripts/`, `specs/` — docs, codegen helpers, and visual-QA artefacts.

No other apps today; workspace is set up to grow (e.g. extension).

## Tech stack

- **React 19** + **React Router v7** (see `apps/dashboard/src/App.tsx` for routes).
- **Convex** (`@convex-dev/auth`) for auth. `ProtectedRoute` has a **dev bypass** — protected routes render without login when `import.meta.env.DEV`. Great for iteration. **Always read `apps/dashboard/convex/_generated/ai/guidelines.md` first** before touching Convex code — its rules override training data.
- **Tailwind CSS v4** via `@tailwindcss/vite`. No config file; content scanning is via `@source` directives inside `apps/dashboard/src/index.css`. **Important:** `shared/ui/src` is explicitly `@source`'d so design-system classes land in the generated CSS. If a design-system class silently stops working, check that this `@source` is still present.
- **Design tokens** are plain CSS custom properties in `shared/ui/src/styles/tokens.css` (`--color-*`, `--space-*`, `--font-*`, `--radius-*`, `--shadow-*`, etc.). **Never hardcode colors/spacing/fonts.** Reference tokens with Tailwind arbitrary-value syntax, e.g. `bg-[var(--color-surface)]`, `gap-[var(--space-4)]`.
- **Fonts**: DM Sans (body), Inter (UI), Manrope (brand wordmark). Loaded in `apps/dashboard/index.html`.
- **SVG** via `vite-plugin-svgr` (`import Icon from './x.svg?react'`).

## Package manager

- This repo uses **bun** (not pnpm — ignore any older doc that says otherwise).
- Root scripts forward into the dashboard package:
  - `bun run dev` — start Vite (default 5173, falls back to 5174 if busy).
  - `bun run build` — `tsc -b && vite build`.
  - `bun run type-check` — `tsc --noEmit`.
  - `bun run lint` — ESLint.
  - `bun run format` / `bun run format:check` — Prettier (with tailwind plugin).
- If bun is unavailable in a sandbox, `node scripts/*.mjs` still works for scripts.

## Automated checks (Claude Stop hook)

A `Stop` hook in `.claude/settings.json` runs `bun run type-check && bun run lint && bun run format:check` at the end of every turn. If it fails, address the errors before finishing — even pre-existing ones.

## Visual QA workflow

- **Screenshot the dashboard** with Playwright:
  - `node scripts/screenshot-home.mjs <label>` — screenshots `/home` at 1280/1440/1920 viewports into `specs/iterations/`.
  - `node scripts/screenshot-scroll.mjs <label>` — screenshots scrolled state to verify sticky sidebar behaviour.
- Requires the dev server running: `bun run dev &`. The scripts assume `http://localhost:5174/home`; override with `HOME_URL=...`.
- `specs/iterations/*.png` is gitignored.
- Design-system gallery route (dev-only): `/design-system` renders every token and component with sample data. Use it as the visual source of truth when the Figma file conflicts with component behaviour.

## Sample data

`apps/dashboard/src/data/sampleHome.ts` exports `SAMPLE_POSTS`, `SAMPLE_RSVP_GROUPS`, `SAMPLE_CLUBS`. These feed `/home` until Convex tables exist.

## Coding rules

- **Ask clarifying questions** when a prompt or approach is unclear — don't guess.
- **Default to delegating** cohesive / repetitive / multi-file tasks to subagents. Reserve the main conversation for decision-making, proposals, and review. Brief subagents with: files to touch, pattern to follow, and "run type-check/lint/format when done".
- **Fix pre-existing warnings** in files you touch, regardless of origin.
- **Never use `any` or `as` casts.** Fix the type or schema properly.
- **Never leave TODOs.** Implement everything.
- **Never hardcode design values.** Reference `tokens.css` via `var(--…)`.
- When adding files, prefer editing existing ones. Don't create docs or READMEs unless asked.

## Figma MCP rules

Required flow for any Figma-driven change:

1. `get_design_context` with the exact node id(s).
2. If truncated, `get_metadata` → re-fetch specific nodes.
3. `get_screenshot` for the visual reference.
4. Download assets only after you have both context + screenshot. Start implementation then.
5. Translate the Tailwind output into **this repo's** tokens and existing components. Do not import icon packages — assets come from Figma. Reuse `Button`, `Tag`, `Avatar`, `DashboardPost`, `SearchPanel`, etc. from `@app/ui`.
6. Validate against the Figma screenshot.

The Figma MCP output is a representation, not final code. Use localhost image URLs directly when provided; never invent placeholders when one exists.

**When Figma and the design system disagree, the design system is the source of truth.** Confirm by checking `/design-system` or `shared/ui/src/components/*`.
