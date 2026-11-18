/**
 * GmailOrgMatches — list of orgs detected via a Gmail listserv scan
 * (`useGmailScan`), each with Follow / Not a member actions.
 *
 * Shared between the onboarding "scan your Gmail" step and the Profile
 * page's "find clubs from Gmail" entry point. Purely presentational: the
 * caller owns the match list, mutation wiring (`follows.follow` /
 * `gmailMatches.dismissSuggestion`), and removes an org from `matches` once
 * the user has decided on it.
 */

import { Avatar, Button, Tag } from "@app/ui";
import type { Id } from "../../convex/_generated/dataModel";
import type { PublicOrg } from "../../convex/orgs";

const BODY2 =
  "font-[family-name:var(--font-body)] font-normal " +
  "text-[var(--font-size-body2)] leading-[var(--line-height-body2)] " +
  "tracking-[var(--letter-spacing-body2)]";

export interface GmailOrgMatchesProps {
  matches: PublicOrg[];
  pendingIds: ReadonlySet<Id<"orgs">>;
  onFollow: (orgId: Id<"orgs">) => void;
  onDismiss: (orgId: Id<"orgs">) => void;
}

interface GmailMatchCardProps {
  org: PublicOrg;
  pending: boolean;
  onFollow: () => void;
  onDismiss: () => void;
}

function GmailMatchCard({
  org,
  pending,
  onFollow,
  onDismiss,
}: GmailMatchCardProps) {
  return (
    <li
      className={[
        "flex min-w-0 flex-col gap-[var(--space-3)]",
        "rounded-[var(--radius-card)] bg-[var(--color-surface)]",
        "border border-[var(--color-border)]",
        "px-[var(--space-4)] py-[var(--space-4)]",
        "shadow-[var(--shadow-1)]",
      ].join(" ")}
    >
      {/* wrap-anywhere is inherited by Avatar's label so long org names
          (including single unbroken words) wrap instead of overflowing. */}
      <div className="flex min-w-0 items-start gap-[var(--space-3)] wrap-anywhere">
        <Avatar avatars={[{ name: org.name, src: org.avatarUrl }]} />
      </div>

      <p
        className={BODY2 + " text-[var(--color-text-muted)]"}
        style={{ fontVariationSettings: "'opsz' 14" }}
      >
        {org.description}
      </p>

      {org.tags.length > 0 && (
        <div className="flex flex-wrap gap-[var(--space-2)]">
          {org.tags.slice(0, 4).map((tag) => (
            <Tag key={tag} color="neutral">
              {tag}
            </Tag>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-[var(--space-2)]">
        <Button
          variant="secondary"
          size="sm"
          onClick={onDismiss}
          disabled={pending}
        >
          Not a member
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onFollow}
          disabled={pending}
        >
          Follow
        </Button>
      </div>
    </li>
  );
}

export function GmailOrgMatches({
  matches,
  pendingIds,
  onFollow,
  onDismiss,
}: GmailOrgMatchesProps) {
  if (matches.length === 0) return null;

  return (
    <ul
      className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2"
      aria-label="Clubs detected from your Gmail"
    >
      {matches.map((org) => (
        <GmailMatchCard
          key={org._id}
          org={org}
          pending={pendingIds.has(org._id)}
          onFollow={() => onFollow(org._id)}
          onDismiss={() => onDismiss(org._id)}
        />
      ))}
    </ul>
  );
}
