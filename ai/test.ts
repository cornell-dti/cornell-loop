import data from "./data/dummy_data.json"
import { generateSummary } from "./summarize"
import { weeklySummaryPrompt } from "./prompts/weeklySummary"
import { clubSummaryPrompt } from "./prompts/clubSummary"
import { eventSummaryPrompt } from "./prompts/eventSummary"

type Event = {
  listserv: string
  hosts: Array<{
    name: string
    kind: "cornell_club" | "company" | "external_org"
    role: "primary" | "cohost" | "sponsor"
  }>
  title: string
  description: string
  dates?: Array<{ timestamp: number; type: string }>
  location?: { displayText?: string }
  tags?: string[]
}

const events = data as Event[]

function formatISODate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function primaryDateISO(event: Event): string {
  if (!event.dates || event.dates.length === 0) return ""
  const primary = event.dates.find(d => d.type === "single") ?? event.dates[0]
  if (!primary) return ""
  return formatISODate(primary.timestamp)
}

function toWeeklyPromptEvent(event: Event) {
  const hostParts = event.hosts.map(h => h.name).filter(s => s.trim().length > 0)
  const host = hostParts.join(" & ")

  return {
    listserv: event.listserv,
    host,
    title: event.title,
    description: event.description,
    date: primaryDateISO(event),
    location: event.location?.displayText ?? "",
    tags: event.tags ?? [],
  }
}

function toClubPromptEvent(event: Event) {
  const primaryClub = event.hosts.find(
    h => h.kind === "cornell_club" && h.role === "primary",
  )?.name ?? event.hosts.find(h => h.kind === "cornell_club")?.name ?? "Unknown"

  return {
    club: primaryClub,
    listserv: event.listserv,
    title: event.title,
    description: event.description,
    date: primaryDateISO(event),
    location: event.location?.displayText ?? "",
    tags: event.tags ?? [],
  }
}

async function run() {
  // Example: a user subscribed to ACSU and WICC listservs
  const subscribedListservs = ["ACSU", "WICC"]
  const weeklyEvents = events.filter(e => subscribedListservs.includes(e.listserv))
  const weeklyPromptEvents = weeklyEvents.map(toWeeklyPromptEvent)

  const weeklyPrompt = weeklySummaryPrompt(weeklyPromptEvents)
  const weeklySummary = await generateSummary(weeklyPrompt)

  console.log("\nWEEKLY SUMMARY\n")
  console.log(weeklySummary)

  // Example: summarize what ACSU does based on its hosted events
  const acsuEvents = events.filter(e =>
    e.hosts.some(h => h.kind === "cornell_club" && h.name === "ACSU"),
  )
  const acsuPromptEvents = acsuEvents.map(toClubPromptEvent)

  const clubPrompt = clubSummaryPrompt(acsuPromptEvents)
  const clubSummary = await generateSummary(clubPrompt)

  console.log("\nACSU CLUB SUMMARY\n")
  console.log(clubSummary)

  // Example: create a condensed aiDescription for each event description.
  console.log("\nEVENT AI DESCRIPTIONS\n")
  for (const event of events) {
    const prompt = eventSummaryPrompt(event.description)
    const aiDescription = await generateSummary(prompt)
    console.log(`- ${event.title}: ${aiDescription}`)
  }
}

run()