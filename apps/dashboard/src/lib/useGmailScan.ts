/**
 * useGmailScan — requests a short-lived, client-side Gmail OAuth token via
 * Google Identity Services (loaded in index.html), then hands it once to
 * `api.gmailMatches.scanRecentSenders`. The token never touches our own
 * server storage; Convex sees it only for the duration of that one action
 * call.
 *
 * Used by both the onboarding "scan your Gmail" step and the Profile page's
 * "find clubs from Gmail" entry point (GmailOrgMatches wraps the result).
 */

import { useCallback, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { PublicOrg } from "../../convex/orgs";
import { convexErrorMessage } from "./convexErrorMessage";
import { useCurrentProfile } from "./useCurrentProfile";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleAccountsOAuth2 {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    hosted_domain?: string;
    login_hint?: string;
    callback: (response: GoogleTokenResponse) => void;
  }) => GoogleTokenClient;
}

declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleAccountsOAuth2 } };
  }
}

export type GmailScanStatus =
  | "idle"
  | "requesting"
  | "scanning"
  | "done"
  | "error";

export interface GmailScanState {
  status: GmailScanStatus;
  matches: PublicOrg[];
  error: string | null;
  scan: () => void;
  reset: () => void;
}

export function useGmailScan(): GmailScanState {
  const { user } = useCurrentProfile();
  const scanRecentSenders = useAction(api.gmailMatches.scanRecentSenders);

  const [status, setStatus] = useState<GmailScanStatus>("idle");
  const [matches, setMatches] = useState<PublicOrg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setMatches([]);
    setError(null);
  }, []);

  const scan = useCallback(() => {
    const clientId = import.meta.env.VITE_GOOGLE_GMAIL_CLIENT_ID;
    if (!clientId) {
      setStatus("error");
      setError("Gmail scanning isn't configured.");
      return;
    }
    if (!window.google) {
      setStatus("error");
      setError("Google sign-in hasn't finished loading yet — try again.");
      return;
    }

    setStatus("requesting");
    setError(null);

    tokenClientRef.current ??= window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GMAIL_READONLY_SCOPE,
      hosted_domain: "cornell.edu",
      login_hint: user?.email,
      callback: (response) => {
        if (!response.access_token) {
          setStatus("error");
          setError(
            response.error_description ?? "Gmail access wasn't granted.",
          );
          return;
        }

        setStatus("scanning");
        scanRecentSenders({ accessToken: response.access_token })
          .then((orgs) => {
            setMatches(orgs);
            setStatus("done");
          })
          .catch((err: unknown) => {
            setStatus("error");
            setError(
              convexErrorMessage(
                err,
                "Gmail scan couldn't finish. Please try again.",
              ),
            );
          });
      },
    });

    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  }, [scanRecentSenders, user?.email]);

  return { status, matches, error, scan, reset };
}
