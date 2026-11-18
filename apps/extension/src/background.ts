import { startOAuthInTab } from "./backgroundOAuth";
import { parseAnalyticsMessage } from "./analytics/messages";
import { captureInstall, handleAnalyticsMessage } from "./analytics/worker";

// Registered at the top level so Chrome can replay the event to a restarted
// worker. `install` only — an update would otherwise re-count every student.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  void captureInstall();
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  void chrome.tabs
    .sendMessage(tab.id, { type: "LOOP_SHOW_PANEL" })
    .catch(() => {
      // Content script not injected on this page — silently ignore.
    });
});

function readStringField(value: object, key: string): string | null {
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (entryKey === key && typeof entryValue === "string") return entryValue;
  }
  return null;
}

chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
  if (typeof rawMessage !== "object" || rawMessage === null) return false;

  // Analytics is fire-and-forget: no response, so the message channel closes
  // immediately and a slow PostHog request can never stall the panel.
  const analyticsMessage = parseAnalyticsMessage(rawMessage);
  if (analyticsMessage !== null) {
    void handleAnalyticsMessage(analyticsMessage);
    return false;
  }

  const type = readStringField(rawMessage, "type");
  if (type === "LOOP_GET_REDIRECT_URL") {
    sendResponse({
      ok: true,
      redirectTo: chrome.identity.getRedirectURL(),
    });
    return false;
  }

  if (type !== "LOOP_START_OAUTH") return false;

  const url = readStringField(rawMessage, "url");
  const redirectTo = readStringField(rawMessage, "redirectTo");
  if (url === null || redirectTo === null) {
    sendResponse({ ok: false, error: "missing url or redirectTo" });
    return false;
  }

  startOAuthInTab(url, redirectTo, sender.tab?.id, sendResponse);
  return true;
});
