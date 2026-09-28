import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clock-aligned rather than `crons.interval`: interval schedules are anchored
// to deploy time, so two intervals of the same period would run in lockstep
// forever regardless of which was registered first. Fixed minutes-of-hour
// guarantee the parse cron always trails the ingestion poll by 5 minutes,
// every cycle, independent of when this file was last deployed.
crons.cron(
  "poll listserv inbox",
  "0,10,20,30,40,50 * * * *",
  internal.ingestion.pollListservInbox,
  { trigger: "cron" },
);

crons.cron(
  "parse listserv messages",
  "5,15,25,35,45,55 * * * *",
  internal.parser.runParseInternal,
  { trigger: "cron" },
);

export default crons;
