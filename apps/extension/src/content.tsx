import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import FloatingPanel from "./components/FloatingPanel.tsx";
import contentStyles from "./content.css?inline";
import { showSlotPreview, removeSlotPreview } from "./gcalHighlight";
import { panelEvents } from "./panelBridge";
import type { EventItem } from "./data/types";
import type { PageContext } from "./App";
import {
  extensionStorage,
  jwtPresenceFlipped,
  wasRecentLocalStorageWrite,
} from "./extensionStorage";

const convexUrl = (() => {
  const value = import.meta.env.VITE_CONVEX_URL;
  return typeof value === "string" && value.length > 0 ? value : undefined;
})();

let activeRoot: Root | null = null;

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

  if (document.getElementById("cornell-loop-host") !== null) return;

  const convex = new ConvexReactClient(convexUrl);

  const pageContext: PageContext = window.location.hostname.includes(
    "calendar.google.com",
  )
    ? "gcal"
    : "gmail";

  loadFonts();

  const host = document.createElement("div");
  host.id = "cornell-loop-host";
  host.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;overflow:visible;pointer-events:none;";
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = contentStyles;
  shadow.appendChild(styleEl);

  const mountPoint = document.createElement("div");
  mountPoint.style.pointerEvents = "auto";
  shadow.appendChild(mountPoint);

  const handlePreviewSlot = (event: EventItem | null) => {
    if (event?.calendarEvent) {
      showSlotPreview(event.calendarEvent);
    } else {
      removeSlotPreview();
    }
  };

  activeRoot = createRoot(mountPoint);
  activeRoot.render(
    <StrictMode>
      <ConvexAuthProvider
        client={convex}
        storage={extensionStorage}
        storageNamespace={convexUrl}
        shouldHandleCode={false}
      >
        <FloatingPanel
          pageContext={pageContext}
          onPreviewSlot={handlePreviewSlot}
        />
      </ConvexAuthProvider>
    </StrictMode>,
  );
}

function unmount(): void {
  const host = document.getElementById("cornell-loop-host");
  if (activeRoot !== null) {
    activeRoot.unmount();
    activeRoot = null;
  }
  host?.remove();
}

function remountIfSessionPresenceChanged(
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string,
): void {
  try {
    if (typeof chrome.runtime?.id !== "string") return;
  } catch {
    return;
  }
  if (areaName !== "local") return;
  if (wasRecentLocalStorageWrite()) return;
  if (!jwtPresenceFlipped(changes)) return;
  unmount();
  mount();
}

mount();

chrome.storage.onChanged.addListener(remountIfSessionPresenceChanged);

function readMessageType(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  for (const [k, v] of Object.entries(raw)) {
    if (k === "type" && typeof v === "string") return v;
  }
  return null;
}

chrome.runtime.onMessage.addListener((rawMessage) => {
  try {
    if (typeof chrome.runtime?.id !== "string") return false;
  } catch {
    return false;
  }
  if (readMessageType(rawMessage) === "LOOP_SHOW_PANEL") {
    panelEvents.dispatchEvent(new Event("show"));
  }
  return false;
});
