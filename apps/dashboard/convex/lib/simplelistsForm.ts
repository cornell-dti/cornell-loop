// convex/lib/simplelistsForm.ts
//
// Reading Simplelists' subscribe form, and working out what the server did
// with a submission.
//
// Simplelists answers a *rejected* subscribe POST with HTTP 200 and the form
// rendered again, so the status code says nothing on its own. Treating 200 as
// success is what let every failed attempt be recorded as "sent" while no
// confirmation mail ever arrived.
//
// Pure module: no `convex/server`, no `_generated/*`, no Node APIs. Kept apart
// from `listservAdmin.ts` so it stays directly testable.

export type SubscribeOutcome = "accepted" | "rejected" | "unknown";

export type SubscribeVerdict = {
  outcome: SubscribeOutcome;
  /** The server's own wording where there is any, otherwise ours. */
  message: string;
};

/** Phrases Simplelists uses when a confirmation mail has been dispatched. */
const CONFIRMATION_WORDING =
  /(confirm(ation)?\s+(e-?mail|message|link)|check\s+your\s+(e-?mail|inbox)|has\s+been\s+sent)/i;

const SUBSCRIBE_FORM_TAG = /<form[^>]+action=["'][^"']*\/subscribe\/["']/i;

export function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

/**
 * What Simplelists actually did with a subscribe POST.
 *
 * Signals, in order of how far they can be trusted:
 *
 * 1. A redirect away from the list's own subscribe page. Simplelists is a
 *    post/redirect/get app, so this is the normal success path.
 * 2. An alert block in the body, whose Bootstrap class states the outcome
 *    outright and whose text is the server's own wording.
 * 3. The subscribe form appearing again, which is what a re-render looks like.
 *
 * Anything else is `unknown` rather than assumed good, because a false "sent"
 * is the failure this function exists to prevent.
 */
export function classifySubscribeResponse(input: {
  status: number;
  location: string | null;
  html: string;
  subscribeUrl: string;
}): SubscribeVerdict {
  if (isRedirect(input.status)) {
    const target = input.location ?? "";
    const backToForm =
      target === "" ||
      absoluteUrl(target, input.subscribeUrl) === input.subscribeUrl;
    return backToForm
      ? {
          outcome: "rejected",
          message: `Simplelists redirected back to the subscribe form (${input.status}), so the submission was not accepted.`,
        }
      : {
          outcome: "accepted",
          message: `Simplelists accepted the submission and redirected to ${target}.`,
        };
  }

  const alert = alertFrom(input.html);
  if (alert) {
    return {
      outcome: alert.kind === "success" ? "accepted" : "rejected",
      message: alert.text,
    };
  }

  if (CONFIRMATION_WORDING.test(stripTags(input.html))) {
    return {
      outcome: "accepted",
      message: "Simplelists reported that a confirmation email is on its way.",
    };
  }

  if (SUBSCRIBE_FORM_TAG.test(input.html)) {
    return {
      outcome: "rejected",
      message:
        "Simplelists returned the subscribe form again instead of a confirmation, so the submission was not accepted.",
    };
  }

  return {
    outcome: "unknown",
    message: `Simplelists replied with ${input.status} but neither a confirmation nor an error could be recognised. Read the response excerpt, and subscribe through the link if needed.`,
  };
}

/**
 * The subscribe form's markup. The page also carries an unrelated `/subs/`
 * login form, so fields are read from this block rather than the whole
 * document.
 */
export function subscribeFormFrom(html: string) {
  const match = html.match(
    /<form[^>]+action=["'][^"']*\/subscribe\/["'][^>]*>([\s\S]*?)<\/form>/i,
  );
  return match?.[1] ?? html;
}

export function inputValueFrom(html: string, field: string) {
  const name = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match =
    html.match(
      new RegExp(
        `<input[^>]+name=["']${name}["'][^>]+value=["']([^"']*)["']`,
        "i",
      ),
    ) ??
    html.match(
      new RegExp(
        `<input[^>]+value=["']([^"']*)["'][^>]+name=["']${name}["']`,
        "i",
      ),
    );
  return match?.[1] ?? null;
}

/**
 * The `value` of the form's submit button. Separate from
 * {@link inputValueFrom} because Simplelists renders it as a `<button>`, whose
 * value sits on the tag rather than on an `<input>`.
 */
export function submitValueFrom(html: string) {
  const match =
    html.match(/<button[^>]+name=["']submit["'][^>]*value=["']([^"']*)["']/i) ??
    html.match(/<button[^>]+value=["']([^"']*)["'][^>]*name=["']submit["']/i);
  return match?.[1] ?? null;
}

/** True when the page carries an hCaptcha or reCAPTCHA widget. */
export function hasCaptcha(html: string) {
  return /h-captcha|hcaptcha\.com|g-recaptcha|recaptcha\//i.test(html);
}

/**
 * A readable slice of a response body for the recorded attempt. Stored as text
 * rather than raw HTML because its only reader is an admin wondering why a
 * subscribe did not take.
 */
export function excerptFrom(html: string) {
  const text = stripTags(html);
  return text ? text.slice(0, 500) : undefined;
}

/**
 * The first Bootstrap alert in the page, which is how Simplelists reports both
 * success and failure, stripped back to the text an admin would have read on
 * screen.
 */
function alertFrom(html: string) {
  const match = html.match(
    /<div[^>]+class=["'][^"']*alert-(success|danger|warning|info)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  );
  if (!match) return null;

  const text = stripTags(match[2]);
  if (!text) return null;

  return {
    kind:
      match[1].toLowerCase() === "success"
        ? ("success" as const)
        : ("problem" as const),
    text: text.slice(0, 300),
  };
}

/** Resolves a possibly-relative redirect target against the page it came from. */
function absoluteUrl(target: string, base: string) {
  try {
    return new URL(target, base).toString();
  } catch {
    return target;
  }
}

/** Visible text of an HTML fragment, collapsed onto one line. */
function stripTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
