import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "poll listserv inbox",
  { minutes: 10 },
  internal.ingestion.pollListservInbox,
  { trigger: "cron" },
);

export default crons;
