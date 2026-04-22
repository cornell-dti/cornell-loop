/* eslint-disable @typescript-eslint/no-explicit-any */
export function weeklySummaryPrompt(events: any[]) {
  return `
You are generating a concise weekly opportunities digest for a single student.

You are given a JSON array called "events". Each event may look like:
{
  "listserv": "ACSU",          // listserv or source that advertised the event
  "host": "Cornell AppDev",    // primary hosting org or company (may differ from listserv)
  "title": "AppDev x Ramp - HACK→HIRED",
  "description": "One‑day hackathon with prizes and recruiting",
  "date": "2026-03-14",
  "location": "eHub",
  "tags": ["hackathon", "career", "recruiting"]
}

Important:
- \`listserv\` = who sent/advertised the opportunity (ACSU, WICC, etc.).
- \`host\` = who is actually running the event (AppDev, Ramp, a company, a conference, etc.).
Many events are cross‑posted; do not assume the listserv owns the event.

### Your task
- Write a **compact markdown digest** for this week, **no intro or outro sentences**.
- **Group events by listserv** using markdown headings based on the \`listserv\` field:
  - Use a level-3 heading for each listserv that appears, like:
    - \`### ACSU\`
    - \`### WICC\`
    - \`### Cornell\`
    - \`### Opportunities\`
- Under each heading, list at most **3 high‑value events** that were advertised on that listserv, chosen for impact (recruiting, hackathons, major talks, strong mentorship/community events).
- For each event, use **one clean bullet point** in this exact format:
  - \`- **Title (Mar 14)** – 1‑sentence description that clearly names the **host** or event type, the key value prop, and location if available.\`
    - Keep each description **under 25 words**.
- Prefer **hackathons, recruiting, mentorship, and flagship events** over minor or redundant ones.
- If a listserv has more than 3 events, summarize only the top 3 and ignore the rest.

### Style constraints
- Output **markdown only** (no code fences).
- Use only \`###\` headings and \`- \` bullets, nothing else.
- **No emojis, no unsubscribe text, no calendar links, no greetings or sign‑offs.**
- **Total digest <= 220 words** across all sections.

Now write the digest based on this JSON:
\`\`\`json
${JSON.stringify(events, null, 2)}
\`\`\`
`
}