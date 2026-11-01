import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clock-aligned rather than `crons.interval`: interval schedules are anchored
// to deploy time, so two intervals of the same period would run in lockstep
// forever regardless of which was registered first. A fixed minute-of-hour is
// stable across deploys, which also leaves room for the parse cron to trail
// this one by five minutes when it is re-enabled.
crons.cron(
  "poll listserv inbox",
  "0,10,20,30,40,50 * * * *",
  internal.ingestion.pollListservInbox,
  { trigger: "cron" },
);

// The parse cron is deliberately not registered for launch.
//
// `runParseInternal` calls a paid LLM per message and has no run lease, so the
// scheduled job and an admin pressing "Parse now" can select the same messages
// and both pay for them. Worse, a run in which every message fails is still
// recorded as `status: "completed"` with no error and no failure count, so an
// unattended provider outage looks green while quarantining roughly 60
// messages an hour into a terminal `failed` state whose only recovery is a
// one-at-a-time requeue.
//
// Parsing therefore stays manual until both are fixed: add a `messagesFailed`
// count plus a distinct not-all-succeeded run status, and claim messages under
// a lease before calling the provider. Re-register here once that lands:
//
//   crons.cron(
//     "parse listserv messages",
//     "5,15,25,35,45,55 * * * *",
//     internal.parser.runParseInternal,
//     { trigger: "cron" },
//   );

export default crons;
