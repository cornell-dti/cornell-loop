// Shared Gmail REST helpers: authenticated fetches, and the batch-endpoint
// request/response plumbing used by both the admin listserv-ingestion
// pipeline (`ingestion.ts`) and the per-user Gmail listserv scan
// (`gmailMatches.ts`).

const GMAIL_BATCH_ENDPOINT = "https://www.googleapis.com/batch/gmail/v1";

/** Carries the HTTP status so callers can react to specific failures. */
export class GmailApiError extends Error {
  readonly status: number;

  constructor(status: number, body: string) {
    super(`Gmail API error ${status}: ${body}`);
    this.name = "GmailApiError";
    this.status = status;
  }
}

export async function gmailFetch<T>(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new GmailApiError(response.status, await response.text());
  }

  return (await response.json()) as T;
}

type BatchFetchOptions = {
  /** Gmail `messages.get` `format` param, e.g. `"full"` or `"metadata"`. */
  format: string;
  /** Only used with `format: "metadata"` — restricts which headers return. */
  metadataHeaders?: string[];
  batchSize: number;
};

export async function batchFetchMessages<T extends { id?: string }>(
  ids: string[],
  accessToken: string,
  { format, metadataHeaders, batchSize }: BatchFetchOptions,
): Promise<T[]> {
  const messages: T[] = [];
  const query =
    `format=${format}` +
    (metadataHeaders ?? [])
      .map((header) => `&metadataHeaders=${encodeURIComponent(header)}`)
      .join("");

  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const boundary = `batch_${crypto.randomUUID()}`;
    const body =
      chunk
        .map(
          (id) =>
            `--${boundary}\r\nContent-Type: application/http\r\n\r\nGET /gmail/v1/users/me/messages/${id}?${query} HTTP/1.1\r\n\r\n`,
        )
        .join("") + `--${boundary}--`;

    const response = await fetch(GMAIL_BATCH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Gmail batch fetch failed (${response.status}): ${await response.text()}`,
      );
    }

    messages.push(...parseBatchResponse<T>(await response.text()));
  }

  return messages;
}

export function parseBatchResponse<T extends { id?: string }>(
  responseText: string,
): T[] {
  const results: T[] = [];
  const parts = responseText.split(/--batch_[^\r\n]+/);

  for (const part of parts) {
    const jsonStart = part.indexOf("{");
    const jsonEnd = part.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) continue;

    try {
      const message = JSON.parse(part.slice(jsonStart, jsonEnd + 1)) as T;
      if (message.id) results.push(message);
    } catch {
      continue;
    }
  }

  return results;
}

export function extractEmailAddress(value: string) {
  const angleMatch = value.match(/<([^>]+)>/);
  if (angleMatch) return normalizeEmail(angleMatch[1]);

  const bareMatch = value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (bareMatch) return normalizeEmail(bareMatch[0]);

  return normalizeEmail(value);
}

export function extractEmails(value: string) {
  const matches = value.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi);
  return matches ? matches.map(normalizeEmail) : [];
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
