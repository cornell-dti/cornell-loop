/**
 * Cornell e-list identity helpers.
 *
 * Cornell retired Lyris in favour of Simplelists, hosted at lists.cornell.edu.
 * This module is the single source of truth for recognising Cornell list
 * addresses and Simplelists subscription mail, so the Convex functions and the
 * admin page can never disagree about what counts as a list address.
 *
 * This module is imported by both the Convex backend and the React bundle, so
 * it must stay pure: no `convex/server`, no `_generated/*`, no Node APIs, and
 * no side effects at import time.
 */

/** The Simplelists host that serves every current Cornell e-list. */
export const SIMPLELISTS_DOMAIN = "lists.cornell.edu";

/** Origin used to build subscribe and confirmation URLs. */
export const SIMPLELISTS_ORIGIN = "https://lists.cornell.edu";

/**
 * Domains served by the retired Lyris platform. Still live in the data —
 * production has at least one `@list.cornell.edu` row — so these predicates
 * must keep working even though no new lists land here.
 */
export const LEGACY_LYRIS_DOMAINS = [
  "list.cornell.edu",
  "mm.list.cornell.edu",
  "list.cs.cornell.edu",
] as const;

const LEGACY_LYRIS_DOMAIN_SET: ReadonlySet<string> = new Set(
  LEGACY_LYRIS_DOMAINS,
);

/** Local part of the address Simplelists sends subscription confirmations from. */
const CONFIRMATION_SENDER_SUFFIX = "-account-manager";

/** Local part suffix for the human owner of a Simplelists list. */
const MANAGER_SUFFIX = "-manager";

/**
 * List names are interpolated into URL paths and e-mail addresses, so they are
 * restricted to a conservative charset. Anything else is treated as not a list
 * name at all rather than escaped, so a hostile local part can never introduce
 * a path segment, query string, or second address.
 */
const LIST_NAME_PATTERN = /^[a-z0-9._-]+$/;

/** The subset of a message this module needs to classify subscription mail. */
export type ListMail = {
  senderEmail: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
};

function lower(value: string) {
  return value.trim().toLowerCase();
}

function splitAddress(email: string) {
  const [local = "", domain = ""] = lower(email).split("@");
  if (!local || !domain) return null;
  return { local, domain };
}

/** True when the address is hosted on the current Simplelists platform. */
export function isSimplelistsAddress(email: string) {
  return splitAddress(email)?.domain === SIMPLELISTS_DOMAIN;
}

/** True when the address is hosted on one of the retired Lyris domains. */
export function isLegacyLyrisAddress(email: string) {
  const domain = splitAddress(email)?.domain;
  return domain !== undefined && LEGACY_LYRIS_DOMAIN_SET.has(domain);
}

/**
 * True for a Lyris address that looks like an actual list rather than an
 * administrative alias — Cornell's convention suffixes list names with `-l`.
 */
export function isLegacyLyrisListAddress(email: string) {
  const parts = splitAddress(email);
  if (!parts) return false;
  return isLegacyLyrisAddress(email) && parts.local.endsWith("-l");
}

/** True for any Cornell list domain, current or retired. */
export function isCornellListAddress(email: string) {
  return isSimplelistsAddress(email) || isLegacyLyrisAddress(email);
}

/**
 * The list name for a Cornell list address, or null when the address is not on
 * a Cornell list domain or its local part falls outside {@link LIST_NAME_PATTERN}.
 */
export function listNameFromAddress(email: string) {
  const parts = splitAddress(email);
  if (!parts || !isCornellListAddress(email)) return null;
  return LIST_NAME_PATTERN.test(parts.local) ? parts.local : null;
}

/**
 * The list name behind a Simplelists confirmation sender
 * (`<LIST>-account-manager@lists.cornell.edu`), or null for anything else.
 */
export function listNameFromConfirmationSender(senderEmail: string) {
  const parts = splitAddress(senderEmail);
  if (!parts || parts.domain !== SIMPLELISTS_DOMAIN) return null;
  if (!parts.local.endsWith(CONFIRMATION_SENDER_SUFFIX)) return null;

  const listName = parts.local.slice(0, -CONFIRMATION_SENDER_SUFFIX.length);
  if (!listName || !LIST_NAME_PATTERN.test(listName)) return null;
  return listName;
}

/**
 * The list a Simplelists address belongs to, unwrapping the administrative
 * aliases Simplelists sends from.
 *
 * Production holds `acsu-l-account-manager@lists.cornell.edu` as a listservs
 * row: that is the *confirmation sender* for `acsu-l`, not a list of its own.
 * Taking its local part verbatim would build a subscribe URL for a list that
 * does not exist, so the alias suffixes are stripped first.
 */
export function subscriptionListNameFrom(email: string) {
  const fromConfirmation = listNameFromConfirmationSender(email);
  if (fromConfirmation) return fromConfirmation;

  const parts = splitAddress(email);
  if (parts?.domain === SIMPLELISTS_DOMAIN) {
    if (parts.local.endsWith(MANAGER_SUFFIX)) {
      const listName = parts.local.slice(0, -MANAGER_SUFFIX.length);
      if (listName && LIST_NAME_PATTERN.test(listName)) return listName;
    }
  }

  return listNameFromAddress(email);
}

/** The posting address for a Simplelists list, or null for an invalid name. */
export function simplelistsAddressForList(listName: string) {
  const name = lower(listName);
  if (!LIST_NAME_PATTERN.test(name)) return null;
  return `${name}@${SIMPLELISTS_DOMAIN}`;
}

/** The owner contact address for a Simplelists list, or null for an invalid name. */
export function managerAddressForList(listName: string) {
  const name = lower(listName);
  if (!LIST_NAME_PATTERN.test(name)) return null;
  return `${name}${MANAGER_SUFFIX}@${SIMPLELISTS_DOMAIN}`;
}

/**
 * The public subscribe page for a Simplelists list, or null for an invalid
 * name. Simplelists treats list names case-insensitively, so the lowercased
 * name is used throughout.
 */
export function subscribeUrlForList(listName: string) {
  const name = lower(listName);
  if (!LIST_NAME_PATTERN.test(name)) return null;
  return `${SIMPLELISTS_ORIGIN}/${name}/subscribe/`;
}

/**
 * True only for a `https://lists.cornell.edu/confirm/…` URL. Parsed with `URL`
 * and compared by exact hostname so lookalikes such as
 * `https://lists.cornell.edu.evil.test/confirm/` are rejected.
 */
export function isSimplelistsConfirmUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname.toLowerCase() === SIMPLELISTS_DOMAIN &&
    url.pathname.startsWith("/confirm/")
  );
}

/**
 * The Simplelists confirmation link in a message, or null when the message has
 * none that survives {@link isSimplelistsConfirmUrl}.
 */
export function confirmationLinkFrom(
  mail: Pick<ListMail, "bodyText" | "bodyHtml">,
) {
  const sources = [mail.bodyText, mail.bodyHtml ?? ""];
  for (const source of sources) {
    const matches = source.match(/https?:\/\/[^\s"'<>)\]]+/gi) ?? [];
    for (const raw of matches) {
      const candidate = raw.replace(/&amp;/g, "&").replace(/[.,;]+$/, "");
      if (isSimplelistsConfirmUrl(candidate)) return candidate;
    }
  }
  return null;
}

/** True when the sender is a Simplelists administrative address. */
export function isSimplelistsAdminMail(mail: Pick<ListMail, "senderEmail">) {
  return listNameFromConfirmationSender(mail.senderEmail) !== null;
}

const JOIN_INTENT =
  /wish to join|confirm your subscription|confirm(?:ing)? your (?:request to )?join/i;

const LEAVE_INTENT =
  /wish to leave|wish to unsubscribe|confirm your unsubscri|remove you from|unsubscribe request/i;

/**
 * True for a Simplelists *join* confirmation specifically.
 *
 * Leave confirmations come from the same sender and also carry a `/confirm/`
 * link, so they are excluded explicitly — pushing a list into
 * `awaiting_confirmation` because someone confirmed a *departure* would be
 * worse than not detecting it at all.
 */
export function isSimplelistsJoinConfirmation(mail: ListMail) {
  if (!isSimplelistsAdminMail(mail)) return false;

  const text = `${mail.subject}\n${mail.bodyText}`;
  if (LEAVE_INTENT.test(text)) return false;

  return JOIN_INTENT.test(text) || confirmationLinkFrom(mail) !== null;
}

/**
 * The pre-Simplelists heuristic, kept verbatim so Lyris rows and non-Cornell
 * senders (Mailchimp, CampusGroups) keep matching exactly as before.
 */
function isLegacyJoinConfirmation(mail: ListMail) {
  const sender = lower(mail.senderEmail);
  const text = `${mail.subject}\n${mail.bodyText}`.toLowerCase();
  return (
    sender.startsWith("lyris-confirm-") ||
    /confirm your subscription|confirm.*subscribe|confirmation.*subscription|confirm.*join/.test(
      text,
    )
  );
}

/**
 * True for any mail asking us to confirm a *subscription* — Simplelists first,
 * then the legacy heuristic.
 */
export function isJoinConfirmationMail(mail: ListMail) {
  if (isSimplelistsAdminMail(mail)) return isSimplelistsJoinConfirmation(mail);
  return isLegacyJoinConfirmation(mail);
}

const LIST_PLUMBING =
  /unsubscribe request|delivery status notification|mail delivery (?:failed|subsystem)/i;

/**
 * True for list plumbing that should never reach the event parser: join
 * confirmations, any other Simplelists administrative mail (leave
 * confirmations, welcome notices, moderation requests), bounces, and
 * unsubscribe receipts.
 */
export function isListAdminNoise(mail: ListMail) {
  if (isSimplelistsAdminMail(mail)) return true;
  if (isJoinConfirmationMail(mail)) return true;
  return LIST_PLUMBING.test(
    `${mail.senderEmail}\n${mail.subject}\n${mail.bodyText}`,
  );
}

/**
 * True when the receiving mail server recorded a DMARC or DKIM pass for a
 * Cornell domain.
 *
 * Fails closed: a message with no `Authentication-Results` header at all is
 * treated as unauthenticated, because the confirmation link is a one-click
 * account action and an attacker who can spoof the sender would otherwise get
 * an admin-endorsed button for an arbitrary URL.
 */
export function hasAuthenticatedCornellSender(
  headers: ReadonlyArray<{ name: string; value: string }>,
) {
  const results = headers
    .filter((header) => header.name.toLowerCase() === "authentication-results")
    .map((header) => header.value.toLowerCase())
    .join("\n");
  if (!results) return false;

  const dmarcPass =
    /\bdmarc=pass\b/.test(results) &&
    isCornellAuthDomain(results.match(/header\.from=([^\s;()]+)/)?.[1]);
  const dkimPass =
    /\bdkim=pass\b/.test(results) &&
    isCornellAuthDomain(results.match(/header\.(?:i=@?|d=)([^\s;()]+)/)?.[1]);

  return dmarcPass || dkimPass;
}

/** Exact-suffix check so `notcornell.edu` and `cornell.edu.evil.test` fail. */
function isCornellAuthDomain(value: string | undefined) {
  if (!value) return false;
  const domain = value.replace(/^@/, "").replace(/\.$/, "").toLowerCase();
  return domain === "cornell.edu" || domain.endsWith(".cornell.edu");
}
