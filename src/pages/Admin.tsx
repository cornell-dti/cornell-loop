import { useEffect, useState } from "react";
import type { ButtonHTMLAttributes, FormEvent, ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

const ADMIN_TOKEN_STORAGE_KEY = "cornell_loop_admin_token";

type Candidate = Doc<"listservCandidates">;
type Listserv = Doc<"listservs">;
type IngestionState = Doc<"listservIngestionState">;
type DiscoveryRun = Doc<"discoveryRuns">;
type JoinAttempt = Doc<"joinAttempts">;
type IngestionRun = Doc<"ingestionRuns">;
type ListservMessage = Doc<"listservMessages">;

type GmailConnectionStatus = {
  email: string;
  scopes: string[];
  status: "connected" | "invalid";
  connectedAt: number;
  updatedAt: number;
  lastError?: string;
} | null;

type JoinDraft = {
  listservId: Id<"listservs">;
  recipient: string;
  subject: string;
  body: string;
};

export default function Admin() {
  const [token, setToken] = useState(() =>
    localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "",
  );
  const [tokenDraft, setTokenDraft] = useState(token);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [joinDraft, setJoinDraft] = useState<JoinDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dashboard = useQuery(
    api.listservAdmin.dashboard,
    token ? { token } : "skip",
  );
  const gmailConnection = useQuery(
    api.gmailOAuth.connectionStatus,
    token ? { token } : "skip",
  ) as GmailConnectionStatus | undefined;

  const runDiscovery = useAction(api.listservAdmin.runDiscovery);
  const runIngestionNow = useAction(api.listservAdmin.runIngestionNow);
  const sendJoinEmail = useAction(api.listservAdmin.sendJoinEmail);
  const seedCandidates = useMutation(api.listservAdmin.seedCandidates);
  const addCandidate = useMutation(api.listservAdmin.addCandidate);
  const approveCandidate = useMutation(api.listservAdmin.approveCandidate);
  const rejectCandidate = useMutation(api.listservAdmin.rejectCandidate);
  const updateListservStatus = useMutation(api.listservAdmin.updateListservStatus);
  const updateJoinStatus = useMutation(api.listservAdmin.updateJoinStatus);

  useEffect(() => {
    if (token) localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  }, [token]);

  const candidates: Candidate[] = dashboard?.candidates ?? [];
  const listservs: Listserv[] = dashboard?.listservs ?? [];
  const ingestionState: IngestionState[] = dashboard?.ingestionState ?? [];
  const discoveryRuns: DiscoveryRun[] = dashboard?.discoveryRuns ?? [];
  const joinAttempts: JoinAttempt[] = dashboard?.joinAttempts ?? [];
  const ingestionRuns: IngestionRun[] = dashboard?.ingestionRuns ?? [];
  const recentMessages: ListservMessage[] = dashboard?.recentMessages ?? [];

  const listservById = new Map(listservs.map((listserv) => [listserv._id, listserv]));

  function handleTokenSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setToken(tokenDraft.trim());
  }

  async function runAdminAction(successText: string, action: () => Promise<unknown>) {
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(successText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin action failed.");
    }
  }

  async function handleAddCandidate(event: FormEvent) {
    event.preventDefault();
    await runAdminAction("Candidate added.", async () => {
      await addCandidate({
        token,
        email: manualEmail,
        displayName: manualName || undefined,
        notes: manualNotes || undefined,
      });
      setManualEmail("");
      setManualName("");
      setManualNotes("");
    });
  }

  async function handleSendJoin(event: FormEvent) {
    event.preventDefault();
    if (!joinDraft) return;

    await runAdminAction("Join email sent.", async () => {
      await sendJoinEmail({ token, ...joinDraft });
      setJoinDraft(null);
    });
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-[var(--color-surface-subtle)] px-[var(--space-5)] py-[var(--space-10)]">
        <section className="mx-auto flex max-w-[460px] flex-col gap-[var(--space-5)] rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-6)] shadow-[var(--shadow-2)]">
          <div>
            <p className="text-[length:var(--font-size-body3)] font-semibold tracking-[0.08em] text-[color:var(--color-text-muted)] uppercase">
              Cornell Loop
            </p>
            <h1 className="mt-[var(--space-2)] font-[family-name:var(--font-heading)] text-[length:var(--font-size-h3)] leading-[var(--line-height-h3)] font-bold text-[color:var(--color-text-default)]">
              Admin Access
            </h1>
          </div>
          <form onSubmit={handleTokenSubmit} className="flex flex-col gap-[var(--space-3)]">
            <label className="flex flex-col gap-[var(--space-2)] text-left text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-neutral-700)]">
              Admin token
              <input
                value={tokenDraft}
                onChange={(event) => setTokenDraft(event.target.value)}
                type="password"
                className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-white)] px-[var(--space-3)] py-[var(--space-2)] font-normal outline-none focus:border-[var(--color-primary-700)]"
                autoComplete="current-password"
              />
            </label>
            <button className="rounded-[var(--radius-input)] bg-[var(--color-primary-700)] px-[var(--space-4)] py-[var(--space-2)] font-semibold text-[color:var(--color-white)] hover:bg-[var(--color-primary-hover)]">
              Enter admin
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-surface-subtle)] px-[var(--space-5)] py-[var(--space-6)] text-left">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-[var(--space-5)]">
        <header className="flex flex-col justify-between gap-[var(--space-4)] rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-6)] shadow-[var(--shadow-1)] md:flex-row md:items-end">
          <div>
            <p className="text-[length:var(--font-size-body3)] font-semibold tracking-[0.08em] text-[color:var(--color-text-muted)] uppercase">
              Dev Console
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-[length:var(--font-size-h2)] leading-[var(--line-height-h2)] font-bold text-[color:var(--color-text-default)]">
              Listserv Operations
            </h1>
            <p className="max-w-[760px] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
              Run discovery, approve sources, send join emails from dtiincubator@gmail.com, and inspect raw Gmail ingestion.
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
              setToken("");
              setTokenDraft("");
            }}
            className="rounded-[var(--radius-input)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-neutral-700)] hover:bg-[var(--color-surface-subtle)]"
          >
            Clear token
          </button>
        </header>

        {message && <Notice tone="success">{message}</Notice>}
        {error && <Notice tone="error">{error}</Notice>}

        <section className="grid gap-[var(--space-4)] md:grid-cols-4">
          <MetricCard label="Candidates" value={candidates.length} />
          <MetricCard label="Approved" value={listservs.length} />
          <MetricCard label="Raw messages" value={recentMessages.length ? `${recentMessages.length} recent` : "0 recent"} />
          <MetricCard label="Gmail" value={gmailConnection?.status ?? (gmailConnection === undefined ? "Loading" : "Not connected")} />
        </section>

        <GmailConnectionPanel token={token} connection={gmailConnection} />

        <DiscoverPanel
          discoveryRuns={discoveryRuns}
          onRunDiscovery={() =>
            runAdminAction("Discovery complete.", async () => {
              await runDiscovery({ token });
            })
          }
          onSeedCandidates={() =>
            runAdminAction("Cached candidates loaded.", async () => {
              await seedCandidates({ token });
            })
          }
        />

        <section className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-1)]">
          <SectionHeader
            title="Add Candidate"
            description="Use this when you already know a list address or want to track a source by hand."
          />
          <form onSubmit={handleAddCandidate} className="mt-[var(--space-4)] grid gap-[var(--space-3)] md:grid-cols-[1.2fr_1fr_1.4fr_auto] md:items-end">
            <AdminInput label="Email" value={manualEmail} onChange={setManualEmail} required />
            <AdminInput label="Display name" value={manualName} onChange={setManualName} />
            <AdminInput label="Notes" value={manualNotes} onChange={setManualNotes} />
            <PrimaryButton>Add</PrimaryButton>
          </form>
        </section>

        <CandidateTable
          candidates={candidates}
          onApprove={(candidateId, name) =>
            runAdminAction("Candidate approved.", async () => {
              await approveCandidate({ token, candidateId, name });
            })
          }
          onReject={(candidateId) =>
            runAdminAction("Candidate rejected.", async () => {
              await rejectCandidate({ token, candidateId });
            })
          }
        />

        <JoinPanel
          listservs={listservs}
          joinAttempts={joinAttempts}
          joinDraft={joinDraft}
          onPrepareJoin={setJoinDraft}
          onDraftChange={setJoinDraft}
          onSendJoin={handleSendJoin}
          onStatusChange={(listservId, status) =>
            runAdminAction("Source status updated.", async () => {
              await updateListservStatus({ token, listservId, status });
            })
          }
          onJoinStatusChange={(listservId, joinStatus) =>
            runAdminAction("Join status updated.", async () => {
              await updateJoinStatus({ token, listservId, joinStatus });
            })
          }
        />

        <IngestionPanel
          states={ingestionState}
          runs={ingestionRuns}
          messages={recentMessages}
          listservById={listservById}
          onRunNow={() =>
            runAdminAction("Ingestion run complete.", async () => {
              await runIngestionNow({ token });
            })
          }
        />
      </div>
    </main>
  );
}

function DiscoverPanel({
  discoveryRuns,
  onRunDiscovery,
  onSeedCandidates,
}: {
  discoveryRuns: DiscoveryRun[];
  onRunDiscovery: () => void;
  onSeedCandidates: () => void;
}) {
  return (
    <section className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-1)]">
      <div className="flex flex-col justify-between gap-[var(--space-4)] md:flex-row md:items-start">
        <SectionHeader
          title="Discover"
          description="Find likely Cornell list addresses from the initial sender dataset and add them to the review queue."
        />
        <div className="flex flex-wrap gap-[var(--space-2)]">
          <PrimaryButton onClick={onRunDiscovery}>Run discovery</PrimaryButton>
          <SecondaryButton onClick={onSeedCandidates}>Load cached set</SecondaryButton>
        </div>
      </div>
      <RunTable runs={discoveryRuns} />
    </section>
  );
}

function GmailConnectionPanel({
  token,
  connection,
}: {
  token: string;
  connection: GmailConnectionStatus | undefined;
}) {
  const convexSiteUrl = getConvexSiteUrl();
  const connectUrl = convexSiteUrl
    ? `${convexSiteUrl}/gmail/oauth/start?token=${encodeURIComponent(token)}`
    : "";

  return (
    <section className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-1)]">
      <div className="flex flex-col justify-between gap-[var(--space-4)] md:flex-row md:items-start">
        <SectionHeader
          title="Gmail Connection"
          description="Connect dtiincubator@gmail.com once. Convex stores the refresh token and cron uses it for ingestion and join emails."
        />
        <a
          href={connectUrl}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!connectUrl}
          className="inline-flex rounded-[var(--radius-input)] bg-[var(--color-primary-700)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-white)] hover:bg-[var(--color-primary-hover)] aria-disabled:pointer-events-none aria-disabled:opacity-40"
        >
          {connection?.status === "connected" ? "Reconnect Gmail" : "Connect Gmail"}
        </a>
      </div>
      <div className="mt-[var(--space-4)] rounded-[var(--radius-input)] border border-[var(--color-border)] p-[var(--space-4)] text-[length:var(--font-size-body2)]">
        {connection === undefined ? (
          <p className="text-[color:var(--color-text-secondary)]">Loading Gmail status...</p>
        ) : connection === null ? (
          <p className="text-[color:var(--color-text-secondary)]">No Gmail account connected yet.</p>
        ) : (
          <div className="grid gap-[var(--space-2)]">
            <div className="flex flex-wrap items-center gap-[var(--space-2)]">
              <StatusPill value={connection.status} />
              <span className="font-semibold">{connection.email}</span>
            </div>
            <p className="text-[color:var(--color-text-muted)]">Updated {formatDate(connection.updatedAt)}</p>
            <p className="text-[color:var(--color-text-muted)]">Scopes: {connection.scopes.join(", ")}</p>
            {connection.lastError && <p className="text-red-700">{connection.lastError}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function getConvexSiteUrl() {
  const explicit = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, "");

  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!convexUrl) return "";

  return convexUrl.replace(/\/$/, "").replace(".convex.cloud", ".convex.site");
}

function CandidateTable({
  candidates,
  onApprove,
  onReject,
}: {
  candidates: Candidate[];
  onApprove: (candidateId: Id<"listservCandidates">, name?: string) => void;
  onReject: (candidateId: Id<"listservCandidates">) => void;
}) {
  return (
    <section className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-1)]">
      <SectionHeader
        title="Review"
        description="Approve only broad, relevant sources. Mark private or questionable addresses rejected."
      />
      <div className="mt-[var(--space-3)] overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-[length:var(--font-size-body2)]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[color:var(--color-text-muted)]">
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Overlap</TableHead>
              <TableHead>Reasons</TableHead>
              <TableHead>Actions</TableHead>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate._id} className="border-b border-[var(--color-border)] last:border-0">
                <TableCell>
                  <div className="font-semibold text-[color:var(--color-neutral-900)]">{candidate.displayName ?? candidate.email}</div>
                  <div className="text-[color:var(--color-text-muted)]">{candidate.email}</div>
                </TableCell>
                <TableCell><StatusPill value={candidate.status} /></TableCell>
                <TableCell>{candidate.confidence}</TableCell>
                <TableCell>{candidate.popularity ?? "-"}</TableCell>
                <TableCell>{candidate.matchedReasons.join(", ")}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    <SmallButton disabled={candidate.status === "approved"} onClick={() => onApprove(candidate._id, candidate.displayName)}>
                      Approve
                    </SmallButton>
                    <SmallButton disabled={candidate.status === "rejected"} onClick={() => onReject(candidate._id)}>
                      Reject
                    </SmallButton>
                  </div>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function JoinPanel({
  listservs,
  joinAttempts,
  joinDraft,
  onPrepareJoin,
  onDraftChange,
  onSendJoin,
  onStatusChange,
  onJoinStatusChange,
}: {
  listservs: Listserv[];
  joinAttempts: JoinAttempt[];
  joinDraft: JoinDraft | null;
  onPrepareJoin: (draft: JoinDraft) => void;
  onDraftChange: (draft: JoinDraft | null) => void;
  onSendJoin: (event: FormEvent) => void;
  onStatusChange: (listservId: Id<"listservs">, status: Listserv["status"]) => void;
  onJoinStatusChange: (listservId: Id<"listservs">, joinStatus: Listserv["joinStatus"]) => void;
}) {
  return (
    <section className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-1)]">
      <SectionHeader
        title="Join"
        description="Prepare and send join requests from the Gmail account. Edit the message before sending."
      />

      {joinDraft && (
        <form onSubmit={onSendJoin} className="mt-[var(--space-4)] grid gap-[var(--space-3)] rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-[var(--space-4)]">
          <div className="grid gap-[var(--space-3)] md:grid-cols-2">
            <AdminInput
              label="Recipient"
              value={joinDraft.recipient}
              onChange={(recipient) => onDraftChange({ ...joinDraft, recipient })}
              required
            />
            <AdminInput
              label="Subject"
              value={joinDraft.subject}
              onChange={(subject) => onDraftChange({ ...joinDraft, subject })}
              required
            />
          </div>
          <label className="flex flex-col gap-[var(--space-1)] text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-neutral-700)]">
            Body
            <textarea
              value={joinDraft.body}
              onChange={(event) => onDraftChange({ ...joinDraft, body: event.target.value })}
              rows={5}
              className="rounded-[var(--radius-input)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] font-normal outline-none focus:border-[var(--color-primary-700)]"
            />
          </label>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <PrimaryButton>Send join email</PrimaryButton>
            <SecondaryButton type="button" onClick={() => onDraftChange(null)}>Cancel</SecondaryButton>
          </div>
        </form>
      )}

      <div className="mt-[var(--space-4)] overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-[length:var(--font-size-body2)]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[color:var(--color-text-muted)]">
              <TableHead>Name</TableHead>
              <TableHead>List email</TableHead>
              <TableHead>Source status</TableHead>
              <TableHead>Join status</TableHead>
              <TableHead>Last received</TableHead>
              <TableHead>Actions</TableHead>
            </tr>
          </thead>
          <tbody>
            {listservs.map((listserv) => (
              <tr key={listserv._id} className="border-b border-[var(--color-border)] last:border-0">
                <TableCell>{listserv.name}</TableCell>
                <TableCell>{listserv.listEmail}</TableCell>
                <TableCell><StatusPill value={listserv.status} /></TableCell>
                <TableCell><StatusPill value={listserv.joinStatus ?? "not_started"} /></TableCell>
                <TableCell>{formatDate(listserv.lastReceivedAt)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    <SmallButton onClick={() => onPrepareJoin(defaultJoinDraft(listserv))}>Prepare join</SmallButton>
                    <SmallButton onClick={() => onJoinStatusChange(listserv._id, "awaiting_confirmation")}>Awaiting</SmallButton>
                    <SmallButton onClick={() => onJoinStatusChange(listserv._id, "joined")}>Joined</SmallButton>
                    <SmallButton onClick={() => onStatusChange(listserv._id, listserv.status === "active" ? "paused" : "active")}>
                      {listserv.status === "active" ? "Pause" : "Activate"}
                    </SmallButton>
                  </div>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <HistoryList
        title="Recent join attempts"
        empty="No join emails sent yet."
        items={joinAttempts.map((attempt) => ({
          id: attempt._id,
          title: `${attempt.status} to ${attempt.recipient}`,
          detail: attempt.error ?? attempt.subject,
          time: attempt.createdAt,
        }))}
      />
    </section>
  );
}

function IngestionPanel({
  states,
  runs,
  messages,
  listservById,
  onRunNow,
}: {
  states: IngestionState[];
  runs: IngestionRun[];
  messages: ListservMessage[];
  listservById: Map<Id<"listservs">, Listserv>;
  onRunNow: () => void;
}) {
  return (
    <section className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-1)]">
      <div className="flex flex-col justify-between gap-[var(--space-4)] md:flex-row md:items-start">
        <SectionHeader
          title="Ingest"
          description="Poll dtiincubator@gmail.com, store raw messages, and match them to approved sources. Cron runs every 10 minutes."
        />
        <PrimaryButton onClick={onRunNow}>Run ingestion now</PrimaryButton>
      </div>

      <div className="mt-[var(--space-4)] grid gap-[var(--space-4)] lg:grid-cols-2">
        <div className="rounded-[var(--radius-input)] border border-[var(--color-border)] p-[var(--space-4)]">
          <h3 className="font-semibold">State</h3>
          {states.length === 0 ? (
            <p className="mt-[var(--space-2)] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
              No ingestion state recorded yet.
            </p>
          ) : (
            <div className="mt-[var(--space-2)] grid gap-[var(--space-2)] text-[length:var(--font-size-body2)]">
              {states.map((state) => (
                <div key={state._id} className="grid gap-[var(--space-1)]">
                  <div className="flex items-center gap-[var(--space-2)]">
                    <StatusPill value={state.status} />
                    <span>{state.key}</span>
                  </div>
                  <p className="text-[color:var(--color-text-muted)]">Last success: {formatDate(state.lastSucceededAt)}</p>
                  {state.lastError && <p className="text-red-700">{state.lastError}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[var(--radius-input)] border border-[var(--color-border)] p-[var(--space-4)]">
          <h3 className="font-semibold">Recent runs</h3>
          <div className="mt-[var(--space-2)] grid gap-[var(--space-2)] text-[length:var(--font-size-body2)]">
            {runs.length === 0 ? (
              <p className="text-[color:var(--color-text-secondary)]">No runs yet.</p>
            ) : (
              runs.map((run) => (
                <div key={run._id} className="flex flex-wrap items-center gap-[var(--space-2)] border-b border-[var(--color-border)] pb-[var(--space-2)] last:border-0">
                  <StatusPill value={run.status} />
                  <span>{run.trigger}</span>
                  <span>{formatDate(run.startedAt)}</span>
                  <span>stored {run.stored}</span>
                  {run.error && <span className="text-red-700">{run.error}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-[var(--space-4)] overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-[length:var(--font-size-body2)]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[color:var(--color-text-muted)]">
              <TableHead>Received</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Sender</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
            </tr>
          </thead>
          <tbody>
            {messages.map((mail) => (
              <tr key={mail._id} className="border-b border-[var(--color-border)] last:border-0">
                <TableCell>{formatDate(mail.receivedAt)}</TableCell>
                <TableCell>{mail.listservId ? listservById.get(mail.listservId)?.name ?? "Matched" : "Unmatched"}</TableCell>
                <TableCell>{mail.senderEmail || mail.sender}</TableCell>
                <TableCell>{mail.subject || "(no subject)"}</TableCell>
                <TableCell><StatusPill value={mail.processingStatus} /></TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RunTable({ runs }: { runs: DiscoveryRun[] }) {
  if (runs.length === 0) {
    return <p className="mt-[var(--space-3)] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">No discovery runs yet.</p>;
  }

  return (
    <div className="mt-[var(--space-3)] overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-[length:var(--font-size-body2)]">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[color:var(--color-text-muted)]">
            <TableHead>Started</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Found</TableHead>
            <TableHead>Inserted</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Error</TableHead>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run._id} className="border-b border-[var(--color-border)] last:border-0">
              <TableCell>{formatDate(run.startedAt)}</TableCell>
              <TableCell><StatusPill value={run.status} /></TableCell>
              <TableCell>{run.candidatesFound}</TableCell>
              <TableCell>{run.candidatesInserted}</TableCell>
              <TableCell>{run.candidatesUpdated}</TableCell>
              <TableCell>{run.error ?? "-"}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; title: string; detail: string; time: number }>;
}) {
  return (
    <div className="mt-[var(--space-4)] rounded-[var(--radius-input)] border border-[var(--color-border)] p-[var(--space-4)]">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-[var(--space-2)] grid gap-[var(--space-2)] text-[length:var(--font-size-body2)]">
        {items.length === 0 ? (
          <p className="text-[color:var(--color-text-secondary)]">{empty}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="border-b border-[var(--color-border)] pb-[var(--space-2)] last:border-0">
              <div className="font-semibold">{item.title}</div>
              <div className="text-[color:var(--color-text-muted)]">{item.detail}</div>
              <div className="text-[color:var(--color-text-muted)]">{formatDate(item.time)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-heading)] text-[length:var(--font-size-sub1)] font-bold">
        {title}
      </h2>
      <p className="mt-[var(--space-1)] max-w-[760px] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
        {description}
      </p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-1)]">
      <p className="text-[length:var(--font-size-body3)] font-semibold tracking-[0.08em] text-[color:var(--color-text-muted)] uppercase">
        {label}
      </p>
      <p className="mt-[var(--space-2)] font-[family-name:var(--font-heading)] text-[length:var(--font-size-sub1)] font-bold text-[color:var(--color-text-default)]">
        {value}
      </p>
    </div>
  );
}

function Notice({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  const classes = tone === "success"
    ? "border-green-200 bg-green-50 text-green-800"
    : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`rounded-[var(--radius-input)] border px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--font-size-body2)] ${classes}`}>
      {children}
    </div>
  );
}

function AdminInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-[var(--space-1)] text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-neutral-700)]">
      {label}
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[var(--radius-input)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] font-normal outline-none focus:border-[var(--color-primary-700)]"
      />
    </label>
  );
}

function PrimaryButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-[var(--radius-input)] bg-[var(--color-primary-700)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-white)] hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-[var(--radius-input)] border border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-neutral-700)] hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SmallButton({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-[var(--radius-input)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--font-size-body3)] font-semibold hover:bg-[var(--color-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full bg-[var(--color-surface-subtle)] px-[var(--space-2)] py-[2px] text-[length:var(--font-size-body3)] font-semibold text-[color:var(--color-neutral-700)]">
      {value.replace(/_/g, " ")}
    </span>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-[var(--space-2)] py-[var(--space-2)] text-left font-semibold">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="px-[var(--space-2)] py-[var(--space-3)] align-top">{children}</td>;
}

function defaultJoinDraft(listserv: Listserv): JoinDraft {
  return {
    listservId: listserv._id,
    recipient: listserv.listEmail,
    subject: `Subscribe request for ${listserv.name}`,
    body: `Hello,\n\nPlease subscribe dtiincubator@gmail.com to ${listserv.listEmail}.\n\nThanks,\nCornell Loop`,
  };
}

function formatDate(timestamp: number | undefined) {
  if (!timestamp) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
