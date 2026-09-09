import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import FloatingPanel from "./components/FloatingPanel.tsx";
import contentStyles from "./content.css?inline";
import { showSlotPreview, removeSlotPreview } from "./gcalHighlight";
import { panelEvents } from "./panelBridge";
import type { EventItem } from "./data/types";
import type { PageContext } from "./App";

const convexUrl = (() => {
  const value = import.meta.env.VITE_CONVEX_URL;
  return typeof value === "string" && value.length > 0 ? value : undefined;
})();

function loadFonts() {
  if (document.getElementById("cornell-loop-fonts")) return;
  const link = document.createElement("link");
  link.id = "cornell-loop-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700&display=swap";
  document.head.appendChild(link);
}

function mount() {
  if (!convexUrl) {
    console.warn(
      "[Cornell Loop] VITE_CONVEX_URL is not set. " +
        "Create apps/extension/.env.local with VITE_CONVEX_URL=<your-convex-url> and rebuild.",
    );
    return;
  }

  if (document.getElementById("cornell-loop-host")) return;

  const convex = new ConvexReactClient(convexUrl);

  // Detect which Google product the content script is running in.
  const pageContext: PageContext = window.location.hostname.includes(
    "calendar.google.com",
  )
    ? "gcal"
    : "gmail";

  loadFonts();

  const host = document.createElement("div");
  host.id = "cornell-loop-host";
  // Explicit styles prevent Gmail/Calendar from accidentally hiding or
  // reflowing the host. Fixed + zero-size keeps it out of the page layout
  // while still allowing the shadow DOM children to use fixed positioning.
  host.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;overflow:visible;pointer-events:none;";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Use a <style> node instead of adoptedStyleSheets + replaceSync: constructable
  // stylesheets disallow @import (Tailwind may emit them) and can mishandle
  // @property compared to a document stylesheet.
  const styleEl = document.createElement("style");
  styleEl.textContent = contentStyles;
  shadow.appendChild(styleEl);

  const mountPoint = document.createElement("div");
  mountPoint.style.pointerEvents = "auto";
  shadow.appendChild(mountPoint);

  /**
   * Bridge: called by BookmarkView (inside shadow DOM) when a card is hovered.
   * This function runs in the content-script context and has access to
   * document.body, so it can inject the GCal grid overlay.
   */
  const handlePreviewSlot = (event: EventItem | null) => {
    if (event?.calendarEvent) {
      showSlotPreview(event.calendarEvent);
    } else {
      removeSlotPreview();
    }
  };

  createRoot(mountPoint).render(
    <StrictMode>
      <ConvexAuthProvider client={convex}>
        <FloatingPanel
          pageContext={pageContext}
          onPreviewSlot={handlePreviewSlot}
        />
      </ConvexAuthProvider>
    </StrictMode>,
  );
}

mount();

// Re-show the floating panel when the user clicks the toolbar icon
// (handled in background.ts via chrome.action.onClicked).
function readMessageType(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  for (const [k, v] of Object.entries(raw)) {
    if (k === "type" && typeof v === "string") return v;
  }
  return null;
}

chrome.runtime.onMessage.addListener((rawMessage) => {
  if (readMessageType(rawMessage) === "LOOP_SHOW_PANEL") {
    panelEvents.dispatchEvent(new Event("show"));
  }
  return false;
});
