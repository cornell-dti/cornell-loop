export function eventSummaryPrompt(description: string) {
  return `
You are summarizing a single listserv event description for structured storage.

Your output will be saved directly as a short field in a database (e.g. \`aiDescription\` in Convex).

### Goal
Rewrite the description into one compact, high-signal summary.

### Requirements
- Keep the meaning accurate to the input.
- Focus on: what it is, who it is for, and the key value/CTA.
- Keep it between **14 and 28 words**.
- Use plain, neutral language.
- Do not include hype, emojis, hashtags, or marketing fluff.
- Do not invent details that are not present in the input.
- Avoid repeating exact phrases from the original when possible.

### Output format
- Return **only** the final condensed summary text.
- No labels, no quotes, no bullets, no markdown.

Description to summarize:
"""${description}"""
`;
}
