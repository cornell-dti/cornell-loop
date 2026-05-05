import data from "./data/dummy_data.json";
import { generateSummary } from "./summarize";
import { weeklySummaryPrompt } from "./prompts/weeklySummary";
import { clubSummaryPrompt } from "./prompts/clubSummary";

async function run() {
  // Example: a user subscribed to ACSU and WICC listservs
  const subscribedListservs = ["ACSU", "WICC"];
  const weeklyEvents = data.filter((e) =>
    subscribedListservs.includes(e.listserv),
  );

  const weeklyPrompt = weeklySummaryPrompt(weeklyEvents);
  const weeklySummary = await generateSummary(weeklyPrompt);

  console.log("\nWEEKLY SUMMARY\n");
  console.log(weeklySummary);

  // Example: summarize what ACSU does based on its hosted events
  const acsuEvents = data.filter((e) => e.club === "ACSU");

  const clubPrompt = clubSummaryPrompt(acsuEvents);
  const clubSummary = await generateSummary(clubPrompt);

  console.log("\nACSU CLUB SUMMARY\n");
  console.log(clubSummary);
}

run();
