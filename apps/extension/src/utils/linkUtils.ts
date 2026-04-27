import type { EventItem, EventLink, LinkType } from "../data/types";

// ── Label defaults ─────────────────────────────────────────────────────────

const DEFAULT_LABELS: Record<LinkType, string> = {
  rsvp: "RSVP",
  application: "Apply",
  registration: "Register",
  info: "Learn More",
  social: "Follow",
};

export function getLinkLabel(link: EventLink): string {
  return link.label ?? DEFAULT_LABELS[link.type];
}

// ── Primary CTA selection ──────────────────────────────────────────────────

/**
 * Returns the single primary action link from an event's links array.
 *
 * Priority: rsvp → application → registration
 * (info and social are secondary and not surfaced as primary CTAs.)
 *
 * Documented here so the rule stays in one place. When the backend exposes
 * a dedicated "primaryLink" field this function can be simplified.
 */
export function getPrimaryLink(event: EventItem): EventLink | undefined {
  const priority: LinkType[] = ["rsvp", "application", "registration"];
  for (const type of priority) {
    const found = event.links.find((l) => l.type === type);
    if (found) return found;
  }
  return undefined;
}

// ── Navigation ─────────────────────────────────────────────────────────────

/**
 * Opens a URL in a new browser tab via the Chrome extension API.
 * Falls back to window.open when chrome.tabs is unavailable (dev / Storybook).
 */
export function openExternalUrl(url: string): void {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    chrome.tabs.create({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
