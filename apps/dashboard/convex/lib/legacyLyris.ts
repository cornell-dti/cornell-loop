/**
 * Legacy Lyris join flow — quarantined.
 *
 * Cornell retired Lyris in 2026 in favour of Simplelists (lists.cornell.edu),
 * which is web-interface only: per Cornell's E-list Roles doc, joining and
 * leaving cannot be done by email at all. The `listname-request@cornell.edu`
 * subject-`join` command this module implements is therefore structurally
 * obsolete, not merely pointed at the wrong domain.
 *
 * It is kept because production still holds rows carrying a `cornell_lyris`
 * strategy, and their stored recipients/instructions must keep rendering. No
 * new row is ever classified into these strategies — `detectJoinStrategy`
 * reaches this module only for addresses on a retired Lyris domain.
 *
 * Nothing on the Simplelists path calls in here. If a prod audit confirms zero
 * Lyris rows remain, this module is a safe delete.
 *
 * Pure module: no `convex/server`, no `_generated/*`, no Node APIs.
 */

import { isLegacyLyrisListAddress } from "./cornellLists";

/** The join-request address for a Lyris list: `<LIST>-request@cornell.edu`. */
export function lyrisJoinRecipient(listName: string) {
  return `${listName}-request@cornell.edu`;
}

/** The owner address for a Lyris list: `owner-<LIST>@cornell.edu`. */
export function lyrisOwnerRecipient(listName: string) {
  return `owner-${listName}@cornell.edu`;
}

/** Strips the `owner-` prefix Lyris used for administrative aliases. */
export function lyrisListNameFrom(local: string) {
  return local.replace(/^owner-/, "");
}

/** As {@link lyrisListNameFrom}, also dropping a trailing `-request`. */
export function lyrisOwnerContactListNameFrom(local: string) {
  return lyrisListNameFrom(local).replace(/-request$/, "");
}

export function lyrisOwnerContactBody(listName: string) {
  return `Hello,\n\nCould you please add dtiincubator@gmail.com to ${listName}?\n\nThis inbox is used by Cornell Loop to aggregate public Cornell student organization announcements for Cornell students.\n\nThank you.`;
}

/** Detection reasons for a Lyris row, shared by the direct and sender-alias paths. */
export function lyrisDetectionReasons(email: string, viaSender: boolean) {
  if (viaSender) {
    return [
      isLegacyLyrisListAddress(email)
        ? "Sender alias looks like Cornell Lyris"
        : "Sender uses Cornell list domain",
      "Retired flow: sent subject 'join' to listname-request@cornell.edu",
    ];
  }
  return [
    isLegacyLyrisListAddress(email)
      ? "Cornell Lyris list address"
      : "Cornell list domain",
    "Retired flow: sent subject 'join' to listname-request@cornell.edu",
  ];
}

const LYRIS_JOIN_INSTRUCTIONS =
  "Retired platform. Cornell Lyris lists were joined by sending a blank email with subject 'join' to listname-request@cornell.edu from the receiving inbox. Cornell has since migrated to Simplelists, which only accepts web subscribes — if this row is still live, re-detect it.";

const LYRIS_OWNER_CONTACT_INSTRUCTIONS =
  "Retired platform. Used when a Lyris list was private/closed or the normal join request failed.";

/**
 * The stored join fields for the two Lyris strategies, or null for any other
 * strategy. Returning null keeps the caller's branching explicit rather than
 * having this module guess at non-Lyris defaults.
 */
export function buildLyrisJoinDefaults(
  joinStrategy: string,
  local: string,
  reasons: string[] | undefined,
  now: number,
) {
  if (joinStrategy === "cornell_lyris") {
    const listName = lyrisListNameFrom(local);
    return {
      joinRecipient: lyrisJoinRecipient(listName),
      ownerRecipient: lyrisOwnerRecipient(listName),
      joinSubject: "join",
      joinBody: "",
      joinInstructions: LYRIS_JOIN_INSTRUCTIONS,
      joinConfidence: listName.endsWith("-l") ? 95 : 75,
      joinDetectionReasons: reasons ?? ["Cornell Lyris list address"],
      joinDetectedAt: now,
    };
  }

  if (joinStrategy === "cornell_lyris_owner_contact") {
    const listName = lyrisOwnerContactListNameFrom(local);
    return {
      joinRecipient: lyrisOwnerRecipient(listName),
      ownerRecipient: lyrisOwnerRecipient(listName),
      joinSubject: `Request to join ${listName}`,
      joinBody: lyrisOwnerContactBody(listName),
      joinInstructions: LYRIS_OWNER_CONTACT_INSTRUCTIONS,
      joinConfidence: 75,
      joinDetectionReasons: reasons ?? ["Owner contact fallback"],
      joinDetectedAt: now,
    };
  }

  return null;
}
