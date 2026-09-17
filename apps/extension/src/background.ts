import { startOAuthInTab } from "./backgroundOAuth";

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
