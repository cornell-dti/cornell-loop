/**
 * GCal grid hover highlight — content-script side.
 *
 * Injects an empty orange-bordered block into document.body at the event’s
 * date+time on the GCal week view. “Add to Calendar” uses
 * `utils/calendarUtils.buildGCalUrl` + a new tab instead of simulating
 * in-page quick create.
 *
 * DOM selectors are inherently brittle as GCal updates its markup periodically.
 * Four strategies are tried for the day column; the overlay falls back to a
 * visible position at the right edge of the viewport if all fail.
 */

import type { CalendarEvent } from "./data/types";

const OVERLAY_ID = "cl-slot-preview";
const BRAND_ORANGE = "#EB7128";
/** GCal default hour height in week view (comfortable density). */
const FALLBACK_HOUR_PX = 48;

// ── Public API ─────────────────────────────────────────────────────────────

export function showSlotPreview(event: CalendarEvent): void {
  removeOverlay();

  const start = new Date(event.startISO);
  const end = event.endISO
    ? new Date(event.endISO)
    : new Date(start.getTime() + 60 * 60 * 1000);

  const grid = findGridInfo();
  const hourPx = grid?.hourPx ?? FALLBACK_HOUR_PX;
  const scrollTop = grid?.scrollTop ?? 0;
  const gridTop = grid?.gridTop ?? 100; // default: below the GCal header

  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const durationMinutes = Math.max(endMinutes - startMinutes, 30);

  const topFromDayStart = (startMinutes / 60) * hourPx - scrollTop;
  const height = (durationMinutes / 60) * hourPx;

  const dayRect = findDayColumn(start);

  // Position: use real day column if found; fallback to right-side visible strip
  const left = dayRect ? dayRect.left + 2 : window.innerWidth - 180;
  const width = dayRect ? Math.max(dayRect.width - 4, 20) : 160;
  const top = dayRect ? gridTop + topFromDayStart : gridTop + topFromDayStart;

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;

  const styles: Record<string, string> = {
    position: "fixed",
    left: `${left}px`,
    top: `${Math.max(top, gridTop)}px`,
    width: `${width}px`,
    height: `${Math.max(height, 24)}px`,
    border: `2.5px solid ${BRAND_ORANGE}`,
    "border-radius": "8px",
    "z-index": "2147483646",
    "pointer-events": "none",
    "box-sizing": "border-box",
    transition: "opacity 0.15s ease",
  };

  overlay.style.cssText = Object.entries(styles)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

  document.body.appendChild(overlay);
}

export function removeSlotPreview(): void {
  removeOverlay();
}

// ── Internal helpers ───────────────────────────────────────────────────────

function removeOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}

/**
 * Attempts to locate the DOM column for a given calendar date using four
 * progressively looser strategies.
 */
function findDayColumn(date: Date): DOMRect | null {
  // Strategy 1: data-datekey="YYYYMMDD" — GCal week view background grid cells
  const dateKey = toDateKey(date);
  const byDateKey = document.querySelector(`[data-datekey="${dateKey}"]`);
  if (byDateKey) return byDateKey.getBoundingClientRect();

  // Strategy 2: data-date="YYYY-MM-DD"
  const isoDate = date.toISOString().slice(0, 10);
  const byDataDate = document.querySelector(`[data-date="${isoDate}"]`);
  if (byDataDate) return byDataDate.getBoundingClientRect();

  // Strategy 3: aria-label matching the full day string (e.g. "Thursday, April 24")
  const longDay = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const byAria = document.querySelector(`[aria-label="${longDay}"]`);
  if (byAria) return byAria.getBoundingClientRect();

  // Strategy 4: column header with matching day number
  const dayNum = String(date.getDate());
  const headers = Array.from(
    document.querySelectorAll("[role='columnheader']"),
  );
  const matching = headers.filter((el) =>
    el.textContent?.trim().endsWith(dayNum),
  );
  if (matching.length === 1) {
    const headerRect = matching[0].getBoundingClientRect();
    const bodyEl = document.elementFromPoint(
      headerRect.left + headerRect.width / 2,
      headerRect.bottom + 100,
    );
    if (bodyEl && bodyEl !== document.body) {
      return bodyEl.getBoundingClientRect();
    }
  }

  return null;
}

interface GridInfo {
  hourPx: number;
  scrollTop: number;
  gridTop: number;
}

function findGridInfo(): GridInfo | null {
  // Walk descendants of [role="main"] looking for the scrollable time grid
  const main = document.querySelector('[role="main"]');
  if (!main) return null;

  // Try known GCal scroll container selectors first
  const knownSelectors = [
    '[role="main"] [aria-label="Calendar"]',
    ".KF4T6b",
    '[jsname] [tabindex="-1"][style*="overflow"]',
  ];
  let scrollEl: HTMLElement | null = null;
  for (const sel of knownSelectors) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (
      el &&
      el.scrollHeight > el.clientHeight * 1.3 &&
      el.clientHeight > 200
    ) {
      scrollEl = el;
      break;
    }
  }

  // Fallback: find the tallest scrollable descendant of main
  if (!scrollEl) {
    for (const el of main.querySelectorAll("*")) {
      const htmlEl = el as HTMLElement;
      if (
        htmlEl.scrollHeight > htmlEl.clientHeight * 1.5 &&
        htmlEl.clientHeight > 200
      ) {
        const style = window.getComputedStyle(htmlEl);
        if (style.overflowY === "auto" || style.overflowY === "scroll") {
          scrollEl = htmlEl;
          break;
        }
      }
    }
  }

  if (!scrollEl) return null;

  const scrollTop = scrollEl.scrollTop;
  const rect = scrollEl.getBoundingClientRect();
  const hourPx = detectHourHeight(scrollEl) ?? FALLBACK_HOUR_PX;

  return { hourPx, scrollTop, gridTop: rect.top };
}

/**
 * Measures the pixel height of one hour in the time grid by finding
 * consecutive elements with [data-time="HH:00"].
 */
function detectHourHeight(container: Element): number | null {
  const timeEls = Array.from(container.querySelectorAll("[data-time]"))
    .filter((el) => (el.getAttribute("data-time") ?? "").endsWith(":00"))
    .sort((a, b) => {
      const ta = a.getAttribute("data-time") ?? "";
      const tb = b.getAttribute("data-time") ?? "";
      return ta.localeCompare(tb);
    });

  if (timeEls.length >= 2) {
    const r1 = timeEls[0].getBoundingClientRect();
    const r2 = timeEls[1].getBoundingClientRect();
    const diff = Math.abs(r2.top - r1.top);
    if (diff > 10 && diff < 200) return diff;
  }

  return null;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
