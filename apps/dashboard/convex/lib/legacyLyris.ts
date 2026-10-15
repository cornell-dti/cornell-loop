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

import { isLegacyLyrisListAddress, isValidListName } from "./cornellLists";

/** The join-request address for a Lyris list: `<LIST>-request@cornell.edu`. */
export function lyrisJoinRecipient(listName: string) {
  return `${listName}-request@cornell.edu`;
}

/** The owner address for a Lyris list: `owner-<LIST>@cornell.edu`. */
export function lyrisOwnerRecipient(listName: string) {
  return `owner-${listName}@cornell.edu`;
}

/**
 * Strips the `owner-` prefix Lyris used for administrative aliases, or null
 * when what's left isn't a safe list name. `local` comes from an
 * admin-editable `listEmail` field with no charset restriction of its own, so
 * it must be validated here before the caller builds a recipient address or
 * message text out of it.
 */
export function lyrisListNameFrom(local: string) {
  const listName = local.replace(/^owner-/, "");
  return isValidListName(listName) ? listName : null;
}

/** As {@link lyrisListNameFrom}, also dropping a trailing `-request`. */
export function lyrisOwnerContactListNameFrom(local: string) {
  const listName = lyrisListNameFrom(local);
  if (!listName) return null;
  const stripped = listName.replace(/-request$/, "");
  return isValidListName(stripped) ? stripped : null;
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
 * Shown when the stored `listEmail`'s local part doesn't survive name
 * extraction — e.g. an admin edited it to something outside the list-name
 * charset. Mirrors the Simplelists "could not be derived" fallback instead of
 * silently building a malformed recipient address.
 */
const LYRIS_INVALID_NAME_INSTRUCTIONS =
  "This looks like a retired Lyris address, but a list name could not be safely derived from it. Check the list email for typos or unexpected characters.";

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
      joinRecipient: listName ? lyrisJoinRecipient(listName) : undefined,
      ownerRecipient: listName ? lyrisOwnerRecipient(listName) : undefined,
      joinSubject: listName ? "join" : undefined,
      joinBody: listName ? "" : undefined,
      joinInstructions: listName
        ? LYRIS_JOIN_INSTRUCTIONS
        : LYRIS_INVALID_NAME_INSTRUCTIONS,
      joinConfidence: listName ? (listName.endsWith("-l") ? 95 : 75) : 20,
      joinDetectionReasons: reasons ?? ["Cornell Lyris list address"],
      joinDetectedAt: now,
    };
  }

  if (joinStrategy === "cornell_lyris_owner_contact") {
    const listName = lyrisOwnerContactListNameFrom(local);
    return {
      joinRecipient: listName ? lyrisOwnerRecipient(listName) : undefined,
      ownerRecipient: listName ? lyrisOwnerRecipient(listName) : undefined,
      joinSubject: listName ? `Request to join ${listName}` : undefined,
      joinBody: listName ? lyrisOwnerContactBody(listName) : undefined,
      joinInstructions: listName
        ? LYRIS_OWNER_CONTACT_INSTRUCTIONS
        : LYRIS_INVALID_NAME_INSTRUCTIONS,
      joinConfidence: listName ? 75 : 20,
      joinDetectionReasons: reasons ?? ["Owner contact fallback"],
      joinDetectedAt: now,
    };
  }

  return null;
}
