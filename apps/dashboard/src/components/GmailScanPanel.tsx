/**
 * GmailScanPanel — self-contained Gmail listserv scan: CTA, loading/error
 * states, and the resulting `GmailOrgMatches` list with Follow / Not a
 * member wired up.
 *
 * Owns all of the scan's state (the `useGmailScan` hook, the follow/dismiss
 * mutations, and which matches the user has already decided on this
 * session) so both call sites — the onboarding "scan your Gmail" step and
 * the Profile page's "find clubs from Gmail" entry point — share one copy
 * of that logic instead of each re-deriving it.
 */

import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { Button } from "@app/ui";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { GmailOrgMatches } from "./GmailOrgMatches";
import { convexErrorMessage } from "../lib/convexErrorMessage";
import { useGmailScan } from "../lib/useGmailScan";

const BODY2 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

export function GmailScanPanel() {
  const { status, matches, error, scan } = useGmailScan();
  const followMutation = useMutation(api.follows.follow);
  const dismissMutation = useMutation(api.gmailMatches.dismissSuggestion);
  const [decidedIds, setDecidedIds] = useState<ReadonlySet<Id<"orgs">>>(
    new Set(),
  );
  const [pendingIds, setPendingIds] = useState<ReadonlySet<Id<"orgs">>>(
    new Set(),
  );
  const [decideError, setDecideError] = useState<string | null>(null);

  const visibleMatches = useMemo(
    () => matches.filter((org) => !decidedIds.has(org._id)),
    [matches, decidedIds],
  );

  const decide = async (orgId: Id<"orgs">, mutate: () => Promise<unknown>) => {
    setPendingIds((prev) => new Set(prev).add(orgId));
    setDecideError(null);
    try {
      await mutate();
      setDecidedIds((prev) => new Set(prev).add(orgId));
    } catch (err: unknown) {
      setDecideError(
        convexErrorMessage(err, "Couldn't update that — please try again."),
      );
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(orgId);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {status === "idle" && (
        <Button
          variant="primary"
          size="md"
          onClick={scan}
          className="self-start"
        >
          Scan my Gmail
        </Button>
      )}

      {(status === "requesting" || status === "scanning") && (
        <p
          className={BODY2 + " text-[var(--color-text-muted)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {status === "requesting"
            ? "Waiting for Gmail access…"
            : "Scanning recent senders…"}
        </p>
      )}

      {status === "error" && error !== null && (
        <div className="flex flex-col items-start gap-[var(--space-2)]">
          <p
            role="alert"
            className={BODY2 + " text-[var(--color-primary-800)]"}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {error}
          </p>
          <Button variant="secondary" size="sm" onClick={scan}>
            Try again
          </Button>
        </div>
      )}

      {status === "done" && visibleMatches.length === 0 && (
        <p
          className={BODY2 + " text-[var(--color-text-muted)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          No matching clubs found — you&apos;re all caught up here.
        </p>
      )}

      {decideError !== null && (
        <p
          role="alert"
          className={BODY2 + " text-[var(--color-primary-800)]"}
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {decideError}
        </p>
      )}

      {status === "done" && visibleMatches.length > 0 && (
        <GmailOrgMatches
          matches={visibleMatches}
          pendingIds={pendingIds}
          onFollow={(orgId) => {
            void decide(orgId, () => followMutation({ orgId }));
          }}
          onDismiss={(orgId) => {
            void decide(orgId, () => dismissMutation({ orgId }));
          }}
        />
      )}
    </div>
  );
}
