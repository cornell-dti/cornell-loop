// When the user clicks the toolbar icon, tell the active tab's content script
// to re-show the floating panel (in case it was previously dismissed).
chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) return;
  void chrome.tabs
    .sendMessage(tab.id, { type: "LOOP_SHOW_PANEL" })
    .catch(() => {
      // Content script not injected on this page — silently ignore.
    });
});
