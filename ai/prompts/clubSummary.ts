/* eslint-disable @typescript-eslint/no-explicit-any */
export function clubSummaryPrompt(events: any[]) {
  return `
You are writing a very short description of what a student club does, based only on their recent events.

You are given a JSON array called "events". All events belong to the **same club**, with a "club" field that contains its name.

### Your task
- Write **2–3 concise sentences** (max **70 words total**) describing:
  - What the club focuses on (e.g. hackathons, career prep, mentorship, theory, community building).
  - The typical kinds of events they run (talks, workshops, study groups, socials, conferences, etc.).
  - The community/audience they serve (e.g. CS undergrads, women in computing, international students, etc.).
- **Start the first sentence with the club name**, taken from the "club" field (e.g. "ACSU is...", "WICC is...").
- Do **not** mention specific dates, rooms, or one‑off logistics; speak in general patterns.
- Keep the tone clear and informative; no emojis.

### Style constraints
- Output **plain text only** (no markdown headings or bullets).
- Use 2–3 sentences in a single short paragraph.

Here are the events for this club (JSON):
\`\`\`json
${JSON.stringify(events, null, 2)}
\`\`\`
`
}