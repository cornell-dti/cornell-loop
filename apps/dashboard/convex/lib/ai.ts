// convex/lib/ai.ts
//
// Provider-agnostic JSON completion for Convex actions. Reads the same env
// vars as the event parser (OPENAI_API_KEY / GEMINI_API_KEY and the
// *_PARSE_MODEL overrides), prefers OpenAI, and falls back to Gemini when both
// are configured. Results come back as `unknown` — callers own validation.

declare const process: { env: Record<string, string | undefined> };

export type AIProvider = "openai" | "gemini";

type ProviderConfig = { provider: AIProvider; model: string };

export type AIConfig = ProviderConfig & { fallback?: ProviderConfig };

export type AIJsonResult = {
  data: unknown;
  /** The provider/model that actually answered, which may be the fallback. */
  provider: AIProvider;
  model: string;
};

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function getAIConfig(): AIConfig {
  const openai: ProviderConfig | null = process.env.OPENAI_API_KEY
    ? {
        provider: "openai",
        model: process.env.OPENAI_PARSE_MODEL ?? DEFAULT_OPENAI_MODEL,
      }
    : null;
  const gemini: ProviderConfig | null = process.env.GEMINI_API_KEY
    ? {
        provider: "gemini",
        model: process.env.GEMINI_PARSE_MODEL ?? DEFAULT_GEMINI_MODEL,
      }
    : null;

  if (openai && gemini) return { ...openai, fallback: gemini };
  if (openai) return openai;
  if (gemini) return gemini;

  throw new Error(
    "No AI provider is configured. Set OPENAI_API_KEY for OpenAI or GEMINI_API_KEY for Gemini.",
  );
}

export async function completeJson(
  config: AIConfig,
  systemPrompt: string,
  prompt: string,
): Promise<AIJsonResult> {
  try {
    return await callProvider(config, systemPrompt, prompt);
  } catch (error) {
    if (!config.fallback) throw error;
    try {
      return await callProvider(config.fallback, systemPrompt, prompt);
    } catch (fallbackError) {
      throw new Error(
        `Primary ${config.provider}/${config.model} failed: ${formatError(error)}. Fallback ${config.fallback.provider}/${config.fallback.model} failed: ${formatError(fallbackError)}`,
      );
    }
  }
}

async function callProvider(
  config: ProviderConfig,
  systemPrompt: string,
  prompt: string,
): Promise<AIJsonResult> {
  const text =
    config.provider === "openai"
      ? await openAIText(config.model, systemPrompt, prompt)
      : await geminiText(config.model, systemPrompt, prompt);
  const data: unknown = JSON.parse(text);
  return { data, provider: config.provider, model: config.model };
}

async function openAIText(model: string, systemPrompt: string, prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  const payload: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      errorMessageFrom(payload) ?? "OpenAI completion request failed.",
    );
  }
  const text = stringAt(payload, ["choices", 0, "message", "content"]);
  if (!text) throw new Error("OpenAI returned no content.");
  return text;
}

async function geminiText(model: string, systemPrompt: string, prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );

  const payload: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      errorMessageFrom(payload) ?? "Gemini completion request failed.",
    );
  }
  const text = stringAt(payload, [
    "candidates",
    0,
    "content",
    "parts",
    0,
    "text",
  ]);
  if (!text) throw new Error("Gemini returned no text.");
  return text;
}

/** Walks `path` through nested objects/arrays; returns the string found, if any. */
function stringAt(
  value: unknown,
  path: Array<string | number>,
): string | undefined {
  let current: unknown = value;
  for (const key of path) {
    if (typeof key === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[key];
    } else {
      if (!isRecord(current)) return undefined;
      current = current[key];
    }
  }
  return typeof current === "string" ? current : undefined;
}

function errorMessageFrom(payload: unknown) {
  return stringAt(payload, ["error", "message"]);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
