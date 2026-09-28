const OAUTH_TAB_TIMEOUT_MS = 5 * 60 * 1000;

function isExtensionRedirect(url: string, redirectTo: string): boolean {
  const expected = redirectTo.replace(/\/$/, "");
  return (
    url === expected ||
    url === `${expected}/` ||
    url.startsWith(`${expected}/`) ||
    url.startsWith(`${expected}?`) ||
    url.includes(".chromiumapp.org/")
  );
}

/**
 * launchWebAuthFlow cannot load Google's account chooser ("Authorization
 * page could not be loaded"). A normal tab keeps convex.site PKCE cookies.
 */
export function startOAuthInTab(
  startUrl: string,
  redirectTo: string,
  returnTabId: number | undefined,
  sendResponse: (response: {
    ok: boolean;
    redirectUrl?: string;
    error?: string;
  }) => void,
): void {
  let settled = false;
  let oauthTabId: number | undefined;

  const finish = (response: {
    ok: boolean;
    redirectUrl?: string;
    error?: string;
  }) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onRemoved.removeListener(onRemoved);
    if (oauthTabId !== undefined && response.ok) {
      void chrome.tabs.remove(oauthTabId).catch(() => undefined);
    }
    if (response.ok && returnTabId !== undefined) {
      void chrome.tabs
        .update(returnTabId, { active: true })
        .catch(() => undefined);
    }
    sendResponse(response);
  };

  const onUpdated = (
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab,
  ) => {
    if (oauthTabId === undefined || tabId !== oauthTabId) return;
    const url = changeInfo.url ?? tab.url;
    if (url === undefined) return;
    if (!isExtensionRedirect(url, redirectTo)) return;
    finish({ ok: true, redirectUrl: url });
  };

  const onRemoved = (tabId: number) => {
    if (oauthTabId === undefined || tabId !== oauthTabId) return;
    finish({ ok: false, error: "sign-in tab closed" });
  };

  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onRemoved.addListener(onRemoved);

  const timeoutId = setTimeout(() => {
    finish({ ok: false, error: "sign-in timed out" });
  }, OAUTH_TAB_TIMEOUT_MS);

  chrome.tabs.create({ url: startUrl }, (tab) => {
    if (chrome.runtime.lastError !== undefined) {
      finish({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    oauthTabId = tab.id;
    if (oauthTabId === undefined) {
      finish({ ok: false, error: "sign-in tab had no id" });
    }
  });
}
