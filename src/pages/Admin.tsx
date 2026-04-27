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
type Organization = Doc<"organizations">;
type EventDoc = Doc<"events">;
type ParseRun = Doc<"parseRuns">;

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

type JoinStrategy = NonNullable<Listserv["joinStrategy"]>;
const JOIN_STRATEGIES: JoinStrategy[] = [
  "cornell_lyris",
  "cornell_lyris_owner_contact",
  "campus_groups",
  "newsletter",
  "direct_org_email",
  "manual",
  "unknown",
];
const ORG_TYPES: Organization["type"][] = [
  "club",
  "department",
  "official",
  "publication",
  "company",
  "other",
];

type EffectiveJoin = {
  joinStrategy: JoinStrategy;
  joinRecipient?: string;
  ownerRecipient?: string;
  joinSubject?: string;
  joinBody?: string;
  joinInstructions?: string;
  joinConfidence: number;
  joinDetectionReasons: string[];
};

type ConfirmationItem = {
  id: Id<"listservMessages">;
  listservName: string;
  subject: string;
  sender: string;
  receivedAt: number;
  clearedAt?: number;
  link?: string;
};

type UnassignedSender = {
  senderEmail: string;
  count: number;
  latestReceivedAt: number;
  sampleSubjects: string[];
  suggestion: {
    organizationName: string;
    organizationType: Organization["type"];
    sourceName: string;
    sourceType: NonNullable<Listserv["sourceType"]>;
  };
};

type AdminTab = "setup" | "discover" | "review" | "organizations" | "sources" | "join" | "ingest" | "parse";

const ADMIN_TABS: Array<{
  id: AdminTab;
  label: string;
  description: string;
}> = [
  { id: "setup", label: "1. Setup", description: "Connect Gmail" },
  { id: "discover", label: "2. Discover", description: "Find sources" },
  { id: "review", label: "3. Review", description: "Approve candidates" },
  { id: "organizations", label: "4. Orgs", description: "Define groups" },
  { id: "sources", label: "5. Sources", description: "Assign senders" },
  { id: "join", label: "6. Join", description: "Send requests" },
  { id: "ingest", label: "7. Ingest", description: "Poll inbox" },
  { id: "parse", label: "8. Parse", description: "Draft items" },
];

export default function Admin() {
  const [token, setToken] = useState(() =>
    localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "",
  );
  const [tokenDraft, setTokenDraft] = useState(token);
  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [joinDraft, setJoinDraft] = useState<JoinDraft | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("setup");
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgType, setNewOrgType] = useState<Organization["type"]>("club");
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
  const sourceOverview = useQuery(
    api.sourceAdmin.overview,
    token ? { token } : "skip",
  );
  const parseOverview = useQuery(
    api.parser.overview,
    token ? { token } : "skip",
  );

  const runDiscovery = useAction(api.listservAdmin.runDiscovery);
  const runIngestionNow = useAction(api.listservAdmin.runIngestionNow);
  const sendJoinEmail = useAction(api.listservAdmin.sendJoinEmail);
  const runParseNow = useAction(api.parser.runParseNow);
  const seedCandidates = useMutation(api.listservAdmin.seedCandidates);
  const addCandidate = useMutation(api.listservAdmin.addCandidate);
  const approveCandidate = useMutation(api.listservAdmin.approveCandidate);
  const rejectCandidate = useMutation(api.listservAdmin.rejectCandidate);
  const updateListservStatus = useMutation(api.listservAdmin.updateListservStatus);
  const updateJoinStrategy = useMutation(api.listservAdmin.updateJoinStrategy);
  const clearConfirmation = useMutation(api.listservAdmin.clearConfirmation);
  const createOrganization = useMutation(api.sourceAdmin.createOrganization);
  const assignSender = useMutation(api.sourceAdmin.assignSender);
  const assignSourceOrganization = useMutation(api.sourceAdmin.assignSourceOrganization);
  const publishEvent = useMutation(api.parser.publishEvent);
  const hideEvent = useMutation(api.parser.hideEvent);

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
  const clearedConfirmations: ListservMessage[] = dashboard?.clearedConfirmations ?? [];
  const organizations: Organization[] = sourceOverview?.organizations ?? [];
  const sourceListservs: Listserv[] = sourceOverview?.listservs ?? listservs;
  const unassignedSenders: UnassignedSender[] = sourceOverview?.unassignedSenders ?? [];
  const parseRuns: ParseRun[] = parseOverview?.runs ?? [];
  const draftEvents: EventDoc[] = parseOverview?.drafts ?? [];
  const failedParseMessages: ListservMessage[] = parseOverview?.failedMessages ?? [];
  const readyMessages: ListservMessage[] = parseOverview?.readyMessages ?? [];
  const needsAssignmentCount: number = parseOverview?.needsAssignmentCount ?? 0;

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

  async function handleCreateOrganization(event: FormEvent) {
    event.preventDefault();
    await runAdminAction("Organization created.", async () => {
      await createOrganization({ token, name: newOrgName, type: newOrgType });
      setNewOrgName("");
      setNewOrgType("club");
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

        <section className="grid gap-[var(--space-3)] md:grid-cols-4">
          <MetricCard label="Candidates" value={candidates.length} />
          <MetricCard label="Approved" value={listservs.length} />
          <MetricCard label="Raw messages" value={recentMessages.length ? `${recentMessages.length} recent` : "0 recent"} />
          <MetricCard label="Gmail" value={gmailConnection?.status ?? (gmailConnection === undefined ? "Loading" : "Not connected")} />
        </section>

        <TabNav activeTab={activeTab} onChange={setActiveTab} />

        <section className="rounded-[var(--radius-card)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-1)]">
          {activeTab === "setup" && (
            <GmailConnectionPanel token={token} connection={gmailConnection} />
          )}

          {activeTab === "discover" && (
            <div className="grid gap-[var(--space-5)]">
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
              <AddCandidatePanel
                manualEmail={manualEmail}
                manualName={manualName}
                manualNotes={manualNotes}
                onEmailChange={setManualEmail}
                onNameChange={setManualName}
                onNotesChange={setManualNotes}
                onSubmit={handleAddCandidate}
              />
            </div>
          )}

          {activeTab === "review" && (
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
          )}

          {activeTab === "organizations" && (
            <OrganizationsPanel
              organizations={organizations}
              newOrgName={newOrgName}
              newOrgType={newOrgType}
              onNameChange={setNewOrgName}
              onTypeChange={setNewOrgType}
              onCreate={handleCreateOrganization}
            />
          )}

          {activeTab === "sources" && (
            <SourcesPanel
              organizations={organizations}
              listservs={sourceListservs}
              unassignedSenders={unassignedSenders}
              onAssignSuggestion={(sender) =>
                runAdminAction("Sender assigned.", async () => {
                  await assignSender({
                    token,
                    senderEmail: sender.senderEmail,
                    organizationName: sender.suggestion.organizationName,
                    organizationType: sender.suggestion.organizationType,
                    sourceName: sender.suggestion.sourceName,
                    sourceType: sender.suggestion.sourceType,
                  });
                })
              }
              onAssignSource={(listservId, organizationId) =>
                runAdminAction("Source assigned.", async () => {
                  await assignSourceOrganization({ token, listservId, organizationId });
                })
              }
            />
          )}

          {activeTab === "join" && (
            <JoinPanel
              listservs={listservs}
              joinAttempts={joinAttempts}
              clearedConfirmations={clearedConfirmations}
              joinDraft={joinDraft}
              onPrepareJoin={setJoinDraft}
              onDraftChange={setJoinDraft}
              onSendJoin={handleSendJoin}
              onStatusChange={(listservId, status) =>
                runAdminAction("Source status updated.", async () => {
                  await updateListservStatus({ token, listservId, status });
                })
              }
              onJoinStrategyChange={(listservId, joinStrategy) =>
                runAdminAction("Join method updated.", async () => {
                  await updateJoinStrategy({ token, listservId, joinStrategy });
                })
              }
            />
          )}

          {activeTab === "ingest" && (
            <IngestionPanel
              states={ingestionState}
              runs={ingestionRuns}
              messages={recentMessages}
              clearedConfirmations={clearedConfirmations}
              listservById={listservById}
              onClearConfirmation={(messageId) =>
                runAdminAction("Confirmation cleared.", async () => {
                  await clearConfirmation({ token, messageId });
                })
              }
              onRunNow={() =>
                runAdminAction("Ingestion run complete.", async () => {
                  await runIngestionNow({ token });
                })
              }
            />
          )}

          {activeTab === "parse" && (
            <ParsePanel
              runs={parseRuns}
              drafts={draftEvents}
              failedMessages={failedParseMessages}
              readyMessages={readyMessages}
              needsAssignmentCount={needsAssignmentCount}
              onRunParse={() =>
                runAdminAction("Parse run complete.", async () => {
                  await runParseNow({ token });
                })
              }
              onPublish={(eventId) =>
                runAdminAction("Draft published.", async () => {
                  await publishEvent({ token, eventId });
                })
              }
              onHide={(eventId) =>
                runAdminAction("Draft hidden.", async () => {
                  await hideEvent({ token, eventId });
                })
              }
              onReparse={(messageId) =>
                runAdminAction("Message reparsed.", async () => {
                  await runParseNow({ token, messageId });
                })
              }
            />
          )}
        </section>
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
    <section>
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

function TabNav({
  activeTab,
  onChange,
}: {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
}) {
  return (
    <nav className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-1-5)] shadow-[var(--shadow-1)]">
      <div className="grid gap-[var(--space-1)] md:grid-cols-4 xl:grid-cols-8">
        {ADMIN_TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={[
                "rounded-[var(--radius-input)] px-[var(--space-3)] py-[var(--space-2)] text-left transition-colors",
                active
                  ? "bg-[var(--color-primary-400)] text-[color:var(--color-primary-900)]"
                  : "text-[color:var(--color-neutral-700)] hover:bg-[var(--color-surface-subtle)]",
              ].join(" ")}
            >
              <div className="text-[length:var(--font-size-body2)] font-bold">
                {tab.label}
              </div>
              <div className="text-[length:var(--font-size-body3)] opacity-75">
                {tab.description}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function AddCandidatePanel({
  manualEmail,
  manualName,
  manualNotes,
  onEmailChange,
  onNameChange,
  onNotesChange,
  onSubmit,
}: {
  manualEmail: string;
  manualName: string;
  manualNotes: string;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <section className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-[var(--space-4)]">
      <SectionHeader
        title="Add Candidate"
        description="Use this when you already know a list address or want to track a source by hand."
      />
      <form onSubmit={onSubmit} className="mt-[var(--space-4)] grid gap-[var(--space-3)] md:grid-cols-[1.2fr_1fr_1.4fr_auto] md:items-end">
        <AdminInput label="Email" value={manualEmail} onChange={onEmailChange} required />
        <AdminInput label="Display name" value={manualName} onChange={onNameChange} />
        <AdminInput label="Notes" value={manualNotes} onChange={onNotesChange} />
        <PrimaryButton>Add</PrimaryButton>
      </form>
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
    <section>
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
    <section>
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

function OrganizationsPanel({
  organizations,
  newOrgName,
  newOrgType,
  onNameChange,
  onTypeChange,
  onCreate,
}: {
  organizations: Organization[];
  newOrgName: string;
  newOrgType: Organization["type"];
  onNameChange: (value: string) => void;
  onTypeChange: (value: Organization["type"]) => void;
  onCreate: (event: FormEvent) => void;
}) {
  return (
    <section>
      <SectionHeader
        title="Organizations"
        description="Organizations are the user-facing groups. Sources/senders are assigned to them."
      />
      <form onSubmit={onCreate} className="mt-[var(--space-4)] grid gap-[var(--space-3)] rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-[var(--space-4)] md:grid-cols-[1fr_220px_auto] md:items-end">
        <AdminInput label="Organization name" value={newOrgName} onChange={onNameChange} required />
        <label className="flex flex-col gap-[var(--space-1)] text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-neutral-700)]">
          Type
          <select
            value={newOrgType}
            onChange={(event) => onTypeChange(event.target.value as Organization["type"])}
            className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-white)] px-[var(--space-3)] py-[var(--space-2)] font-normal"
          >
            {ORG_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <PrimaryButton>Create</PrimaryButton>
      </form>

      <div className="mt-[var(--space-4)] overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[length:var(--font-size-body2)]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[color:var(--color-text-muted)]">
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tags</TableHead>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <tr key={org._id} className="border-b border-[var(--color-border)] last:border-0">
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.type}</TableCell>
                <TableCell><StatusPill value={org.status} /></TableCell>
                <TableCell>{org.tags.join(", ") || "-"}</TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SourcesPanel({
  organizations,
  listservs,
  unassignedSenders,
  onAssignSuggestion,
  onAssignSource,
}: {
  organizations: Organization[];
  listservs: Listserv[];
  unassignedSenders: UnassignedSender[];
  onAssignSuggestion: (sender: UnassignedSender) => void;
  onAssignSource: (listservId: Id<"listservs">, organizationId: Id<"organizations">) => void;
}) {
  const unassignedSources = listservs.filter((source) => !source.organizationId);
  const totalNeedingAction = unassignedSources.length + unassignedSenders.length;

  return (
    <section>
      <SectionHeader
        title="Sources"
        description="Assign email senders to organizations so their messages can be parsed into feed items."
      />

      {totalNeedingAction === 0 ? (
        <p className="mt-[var(--space-4)] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
          All sources are assigned. Messages from known sources will be ready to parse.
        </p>
      ) : (
        <p className="mt-[var(--space-3)] text-[length:var(--font-size-body2)] text-amber-700">
          {totalNeedingAction} source{totalNeedingAction !== 1 ? "s" : ""} need organization assignment before their messages can be parsed.
        </p>
      )}

      <div className="mt-[var(--space-4)] grid gap-[var(--space-4)]">
        {unassignedSources.length > 0 && (
          <div className="rounded-[var(--radius-input)] border border-amber-200 bg-amber-50 p-[var(--space-4)]">
            <h3 className="font-semibold text-amber-900">
              Known sources without organization ({unassignedSources.length})
            </h3>
            <p className="mt-[var(--space-1)] text-[length:var(--font-size-body2)] text-amber-800">
              These are already-joined sources. Assign them to an organization and their messages will become ready to parse immediately.
            </p>
            <div className="mt-[var(--space-3)] grid gap-[var(--space-2)]">
              {unassignedSources.map((source) => {
                const suggestion = suggestFromEmail(source.listEmail);
                return (
                  <div key={source._id} className="grid gap-[var(--space-2)] rounded-[var(--radius-input)] bg-[var(--color-white)] p-[var(--space-3)] md:grid-cols-[1fr_auto_260px] md:items-center">
                    <div>
                      <div className="font-semibold">{source.name}</div>
                      <div className="text-[length:var(--font-size-body2)] text-[color:var(--color-text-muted)]">{source.listEmail}</div>
                      <div className="text-[length:var(--font-size-body3)] text-amber-700">Suggested: {suggestion.organizationName}</div>
                    </div>
                    <select
                      defaultValue=""
                      onChange={(event) => {
                        const orgId = event.target.value as Id<"organizations">;
                        if (orgId) onAssignSource(source._id, orgId);
                      }}
                      className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-white)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--font-size-body2)]"
                    >
                      <option value="">Assign to existing org...</option>
                      {organizations.map((org) => <option key={org._id} value={org._id}>{org.name}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-[var(--space-4)]">
          <h3 className="font-semibold">Unrecognized ingested senders ({unassignedSenders.length})</h3>
          <p className="mt-[var(--space-1)] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
            These senders don't match any known source. Approve to create a new source and organization.
          </p>
          {unassignedSenders.length === 0 ? (
            <p className="mt-[var(--space-2)] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">None found.</p>
          ) : (
            <div className="mt-[var(--space-3)] overflow-x-auto">
              <table className="w-full min-w-[940px] border-collapse text-[length:var(--font-size-body2)]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[color:var(--color-text-muted)]">
                    <TableHead>Sender</TableHead>
                    <TableHead>Suggested org</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Sample subjects</TableHead>
                    <TableHead>Action</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {unassignedSenders.map((sender) => (
                    <tr key={sender.senderEmail} className="border-b border-[var(--color-border)] last:border-0">
                      <TableCell>{sender.senderEmail}</TableCell>
                      <TableCell>
                        <div className="font-semibold">{sender.suggestion.organizationName}</div>
                        <div className="text-[color:var(--color-text-muted)]">{sender.suggestion.sourceName} · {sender.suggestion.sourceType}</div>
                      </TableCell>
                      <TableCell>{sender.count}</TableCell>
                      <TableCell>{sender.sampleSubjects.join(" | ") || "-"}</TableCell>
                      <TableCell><SmallButton onClick={() => onAssignSuggestion(sender)}>Approve suggestion</SmallButton></TableCell>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function JoinPanel({
  listservs,
  joinAttempts,
  clearedConfirmations,
  joinDraft,
  onPrepareJoin,
  onDraftChange,
  onSendJoin,
  onStatusChange,
  onJoinStrategyChange,
}: {
  listservs: Listserv[];
  joinAttempts: JoinAttempt[];
  clearedConfirmations: ListservMessage[];
  joinDraft: JoinDraft | null;
  onPrepareJoin: (draft: JoinDraft) => void;
  onDraftChange: (draft: JoinDraft | null) => void;
  onSendJoin: (event: FormEvent) => void;
  onStatusChange: (listservId: Id<"listservs">, status: Listserv["status"]) => void;
  onJoinStrategyChange: (listservId: Id<"listservs">, joinStrategy: JoinStrategy) => void;
}) {
  const clearedConfirmationListservIds = new Set(
    listservs
      .filter((listserv) =>
        clearedConfirmations.some((confirmation) =>
          confirmationMatchesListserv(confirmation, listserv),
        ),
      )
      .map((listserv) => listserv._id),
  );
  const isJoined = (listserv: Listserv) =>
    listserv.joinStatus === "joined" || clearedConfirmationListservIds.has(listserv._id);
  const pendingListservs = listservs.filter((listserv) => !isJoined(listserv));
  const joinedListservs = listservs.filter(isJoined);

  return (
    <section>
      <SectionHeader
        title="Join"
        description="Send join requests, then run ingestion to surface confirmations. Statuses update automatically on send and detected confirmations; use dropdowns only to correct state."
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
        {pendingListservs.length === 0 ? (
          <div className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-[var(--space-4)] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
            No sources currently need joining. Joined sources are archived below.
          </div>
        ) : (
        <table className="w-full min-w-[1120px] border-collapse text-[length:var(--font-size-body2)]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[color:var(--color-text-muted)]">
              <TableHead>Name</TableHead>
              <TableHead>List email</TableHead>
              <TableHead>Join method</TableHead>
              <TableHead>Source status</TableHead>
              <TableHead>Join status</TableHead>
              <TableHead>Last received</TableHead>
              <TableHead>Actions</TableHead>
            </tr>
          </thead>
          <tbody>
            {pendingListservs.map((listserv) => {
              const join = getEffectiveJoin(listserv);
              return (
              <tr key={listserv._id} className="border-b border-[var(--color-border)] last:border-0">
                <TableCell>{listserv.name}</TableCell>
                <TableCell>
                  <div>{listserv.listEmail}</div>
                  {join.joinRecipient && <div className="text-[color:var(--color-text-muted)]">to {join.joinRecipient}</div>}
                </TableCell>
                <TableCell>
                  <div className="grid gap-[var(--space-2)]">
                    <select
                      value={join.joinStrategy}
                      onChange={(event) => onJoinStrategyChange(listserv._id, event.target.value as JoinStrategy)}
                      className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-white)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--font-size-body2)]"
                    >
                      {JOIN_STRATEGIES.map((strategy) => (
                        <option key={strategy} value={strategy}>{strategy.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                    <div className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
                      {join.joinConfidence}% · {join.joinDetectionReasons.join(", ")}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <select
                    value={listserv.status}
                    onChange={(event) => onStatusChange(listserv._id, event.target.value as Listserv["status"])}
                    className="rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-white)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--font-size-body2)]"
                  >
                    {(["joining", "active", "paused", "failed"] as const).map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </TableCell>
                <TableCell><StatusPill value={listserv.joinStatus ?? "not_started"} /></TableCell>
                <TableCell>{formatDate(listserv.lastReceivedAt)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    <SmallButton
                      disabled={!canPrepareJoin(join)}
                      onClick={() => onPrepareJoin(defaultJoinDraft(listserv))}
                    >
                      Prepare email
                    </SmallButton>
                  </div>
                  <div className="mt-[var(--space-2)] max-w-[360px] text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
                    {join.joinInstructions}
                  </div>
                </TableCell>
              </tr>
            );})}
          </tbody>
        </table>
        )}
      </div>

      <JoinedSourcesTable listservs={joinedListservs} />

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

function JoinedSourcesTable({ listservs }: { listservs: Listserv[] }) {
  return (
    <details className="mt-[var(--space-4)] rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-[var(--space-4)]">
      <summary className="cursor-pointer font-semibold">
        Joined sources ({listservs.length})
      </summary>
      {listservs.length === 0 ? (
        <p className="mt-[var(--space-2)] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
          No joined sources yet.
        </p>
      ) : (
        <div className="mt-[var(--space-3)] overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[length:var(--font-size-body2)]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[color:var(--color-text-muted)]">
                <TableHead>Name</TableHead>
                <TableHead>List email</TableHead>
                <TableHead>Source status</TableHead>
                <TableHead>Last received</TableHead>
              </tr>
            </thead>
            <tbody>
              {listservs.map((listserv) => (
                <tr key={listserv._id} className="border-b border-[var(--color-border)] last:border-0">
                  <TableCell>{listserv.name}</TableCell>
                  <TableCell>{listserv.listEmail}</TableCell>
                  <TableCell><StatusPill value={listserv.status} /></TableCell>
                  <TableCell>{formatDate(listserv.lastReceivedAt)}</TableCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

function ConfirmationQueue({
  confirmations,
  clearedConfirmations,
  onClear,
}: {
  confirmations: ConfirmationItem[];
  clearedConfirmations: ConfirmationItem[];
  onClear: (messageId: Id<"listservMessages">) => void;
}) {
  return (
    <div className="mt-[var(--space-4)] grid gap-[var(--space-4)] rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-[var(--space-4)]">
      <div className="flex flex-col justify-between gap-[var(--space-2)] md:flex-row md:items-center">
        <div>
          <h3 className="font-semibold">Confirmation Queue</h3>
          <p className="text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
            Lyris confirmation emails detected from recent ingestion runs.
          </p>
        </div>
        <StatusPill value={`${confirmations.length} pending`} />
      </div>

      {confirmations.length === 0 ? (
        <p className="text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
          No confirmation emails detected. Run ingestion after sending join requests.
        </p>
      ) : (
        <div className="grid gap-[var(--space-2)]">
          {confirmations.map((confirmation) => (
            <ConfirmationRow
              key={confirmation.id}
              confirmation={confirmation}
              onClear={onClear}
            />
          ))}
        </div>
      )}

      <details className="rounded-[var(--radius-input)] bg-[var(--color-surface)] p-[var(--space-3)]">
        <summary className="cursor-pointer font-semibold">
          Cleared confirmations ({clearedConfirmations.length})
        </summary>
        {clearedConfirmations.length === 0 ? (
          <p className="mt-[var(--space-2)] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
            No cleared confirmations yet.
          </p>
        ) : (
          <div className="mt-[var(--space-3)] grid gap-[var(--space-2)]">
            {clearedConfirmations.map((confirmation) => (
              <ConfirmationRow
                key={confirmation.id}
                confirmation={confirmation}
                cleared
              />
            ))}
          </div>
        )}
      </details>
    </div>
  );
}

function ConfirmationRow({
  confirmation,
  cleared,
  onClear,
}: {
  confirmation: ConfirmationItem;
  cleared?: boolean;
  onClear?: (messageId: Id<"listservMessages">) => void;
}) {
  return (
    <div className="flex flex-col justify-between gap-[var(--space-2)] rounded-[var(--radius-input)] bg-[var(--color-surface)] p-[var(--space-3)] md:flex-row md:items-center">
      <div>
        <div className="font-semibold">{confirmation.listservName}</div>
        <div className="text-[length:var(--font-size-body2)] text-[color:var(--color-neutral-700)]">
          {confirmation.subject || "Subscription confirmation"}
        </div>
        <div className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
          {confirmation.sender} · received {formatDate(confirmation.receivedAt)}
          {confirmation.clearedAt && ` · cleared ${formatDate(confirmation.clearedAt)}`}
        </div>
      </div>
      <div className="flex flex-wrap gap-[var(--space-2)]">
        {confirmation.link ? (
          <a
            href={confirmation.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-[var(--radius-input)] bg-[var(--color-primary-700)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-white)] hover:bg-[var(--color-primary-hover)]"
          >
            Open confirm link
          </a>
        ) : (
          <span className="text-[length:var(--font-size-body2)] text-[color:var(--color-text-muted)]">
            No link found; reply in Gmail
          </span>
        )}
        {!cleared && onClear && (
          <SecondaryButton type="button" onClick={() => onClear(confirmation.id)}>
            Clear
          </SecondaryButton>
        )}
      </div>
    </div>
  );
}

function IngestionPanel({
  states,
  runs,
  messages,
  clearedConfirmations,
  listservById,
  onClearConfirmation,
  onRunNow,
}: {
  states: IngestionState[];
  runs: IngestionRun[];
  messages: ListservMessage[];
  clearedConfirmations: ListservMessage[];
  listservById: Map<Id<"listservs">, Listserv>;
  onClearConfirmation: (messageId: Id<"listservMessages">) => void;
  onRunNow: () => void;
}) {
  const pendingConfirmations = messages
    .filter((mail) => mail.confirmationClearedAt === undefined)
    .map((mail) => toConfirmationItem(mail, listservById))
    .filter((item): item is ConfirmationItem => item !== null);
  const clearedConfirmationItems = clearedConfirmations
    .map((mail) => toConfirmationItem(mail, listservById))
    .filter((item): item is ConfirmationItem => item !== null)
    .sort((a, b) => (b.clearedAt ?? 0) - (a.clearedAt ?? 0));

  return (
    <section>
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

      <ConfirmationQueue
        confirmations={pendingConfirmations}
        clearedConfirmations={clearedConfirmationItems}
        onClear={onClearConfirmation}
      />

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

function ParsePanel({
  runs,
  drafts,
  failedMessages,
  readyMessages,
  needsAssignmentCount,
  onRunParse,
  onPublish,
  onHide,
  onReparse,
}: {
  runs: ParseRun[];
  drafts: EventDoc[];
  failedMessages: ListservMessage[];
  readyMessages: ListservMessage[];
  needsAssignmentCount: number;
  onRunParse: () => void;
  onPublish: (eventId: Id<"events">) => void;
  onHide: (eventId: Id<"events">) => void;
  onReparse: (messageId: Id<"listservMessages">) => void;
}) {
  const blocked = readyMessages.length === 0 && needsAssignmentCount > 0;

  return (
    <section>
      <div className="flex flex-col justify-between gap-[var(--space-4)] md:flex-row md:items-start">
        <SectionHeader
          title="Parse"
          description="Convert assigned raw messages into draft feed items. Drafts require admin publish before users see them."
        />
        <PrimaryButton onClick={onRunParse} disabled={readyMessages.length === 0}>
          Run parser now
        </PrimaryButton>
      </div>

      <div className="mt-[var(--space-4)] grid gap-[var(--space-4)] md:grid-cols-4">
        <MetricCard label="Ready to parse" value={readyMessages.length} />
        <MetricCard label="Needs source assignment" value={needsAssignmentCount} />
        <MetricCard label="Drafts" value={drafts.length} />
        <MetricCard label="Failed" value={failedMessages.length} />
      </div>

      {blocked && (
        <div className="mt-[var(--space-4)] rounded-[var(--radius-input)] border border-amber-200 bg-amber-50 p-[var(--space-4)] text-[length:var(--font-size-body2)] text-amber-800">
          <strong>No messages are ready to parse.</strong> {needsAssignmentCount} message{needsAssignmentCount !== 1 ? "s" : ""} cannot be parsed because their senders are not yet assigned to an organization. Go to <strong>5. Sources</strong> to approve sender assignments.
        </div>
      )}

      <div className="mt-[var(--space-4)] rounded-[var(--radius-input)] border border-[var(--color-border)] p-[var(--space-4)]">
        <h3 className="font-semibold">Draft items</h3>
        {drafts.length === 0 ? (
          <p className="mt-[var(--space-2)] text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">No draft items yet.</p>
        ) : (
          <div className="mt-[var(--space-3)] grid gap-[var(--space-3)]">
            {drafts.map((event) => (
              <div key={event._id} className="rounded-[var(--radius-input)] bg-[var(--color-surface-subtle)] p-[var(--space-3)]">
                <div className="flex flex-col justify-between gap-[var(--space-2)] md:flex-row md:items-start">
                  <div>
                    <div className="font-semibold">{event.title}</div>
                    <div className="text-[length:var(--font-size-body2)] text-[color:var(--color-neutral-700)]">{event.aiDescription || event.description}</div>
                    <div className="mt-[var(--space-1)] text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
                      {event.listserv} · {event.eventType} · confidence {event.parseConfidence ?? 0}%
                    </div>
                    {(event.parseWarnings ?? []).length > 0 && (
                      <div className="mt-[var(--space-1)] text-[length:var(--font-size-body3)] text-amber-700">
                        {(event.parseWarnings ?? []).join("; ")}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-[var(--space-2)]">
                    <SmallButton onClick={() => onPublish(event._id)}>Publish</SmallButton>
                    <SmallButton onClick={() => onHide(event._id)}>Hide</SmallButton>
                    {event.sourceMessageId && <SmallButton onClick={() => onReparse(event.sourceMessageId!)}>Reparse source</SmallButton>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-[var(--space-4)] grid gap-[var(--space-4)] lg:grid-cols-2">
        <HistoryList
          title="Recent parse runs"
          empty="No parse runs yet."
          items={runs.map((run) => ({
            id: run._id,
            title: `${run.status} · ${run.trigger}`,
            detail: `scanned ${run.messagesScanned}, parsed ${run.messagesParsed}, created ${run.eventsCreated}, ignored ${run.messagesIgnored}${run.error ? ` · ${run.error}` : ""}`,
            time: run.startedAt,
          }))}
        />
        <HistoryList
          title="Failed messages"
          empty="No failed parse messages."
          items={failedMessages.map((message) => ({
            id: message._id,
            title: message.subject || "(no subject)",
            detail: message.parseError ?? message.senderEmail,
            time: message.receivedAt,
          }))}
        />
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
  const join = getEffectiveJoin(listserv);
  return {
    listservId: listserv._id,
    recipient: join.joinRecipient ?? listserv.listEmail,
    subject: join.joinSubject ?? `Request to join ${listserv.name}`,
    body: join.joinBody ?? "",
  };
}

function canPrepareJoin(join: EffectiveJoin) {
  return Boolean(join.joinRecipient && join.joinSubject !== undefined);
}

function toConfirmationItem(
  mail: ListservMessage,
  listservById: Map<Id<"listservs">, Listserv>,
): ConfirmationItem | null {
  if (!isConfirmationMessage(mail)) return null;

  const link = extractConfirmationLink(mail.bodyText) ?? extractConfirmationLink(mail.bodyHtml);
  return {
    id: mail._id,
    listservName: mail.listservId ? listservById.get(mail.listservId)?.name ?? "Matched list" : inferListNameFromMessage(mail),
    subject: mail.subject,
    sender: mail.senderEmail || mail.sender,
    receivedAt: mail.receivedAt,
    clearedAt: mail.confirmationClearedAt,
    link,
  };
}

function isConfirmationMessage(mail: ListservMessage) {
  const sender = mail.senderEmail.toLowerCase();
  const text = `${mail.subject}\n${mail.bodyText}`.toLowerCase();
  return (
    sender.startsWith("lyris-confirm-") ||
    /confirm your subscription|confirm.*subscribe|confirmation.*subscription|confirm.*join/.test(text)
  );
}

function confirmationMatchesListserv(mail: ListservMessage, listserv: Listserv) {
  if (!isConfirmationMessage(mail)) return false;
  if (mail.listservId === listserv._id) return true;

  const searchable = `${mail.subject}\n${mail.bodyText}\n${mail.senderEmail}\n${mail.to.join(" ")}\n${mail.cc.join(" ")}`.toLowerCase();
  const addresses = [listserv.listEmail, ...listserv.senderEmails].map((value) =>
    value.toLowerCase(),
  );
  const localParts = addresses.map((value) => value.split("@")[0]).filter(Boolean);

  return (
    addresses.some((address) => searchable.includes(address)) ||
    localParts.some((local) => searchable.includes(local))
  );
}

function extractConfirmationLink(value: string) {
  const match = value.match(/https:\/\/www\.list\.cornell\.edu\/c\?[^\s"'<>]+/i);
  return match?.[0].replace(/&amp;/g, "&");
}

function inferListNameFromMessage(mail: ListservMessage) {
  const match = `${mail.subject}\n${mail.bodyText}`.match(/(?:to|the)\s+([a-z0-9._-]+-l)\s+(?:mailing list|list)/i);
  return match?.[1] ?? "Possible confirmation";
}

function getEffectiveJoin(listserv: Listserv): EffectiveJoin {
  const auto = detectJoinDefaults(listserv);
  if (
    auto.joinStrategy === "cornell_lyris" &&
    (!listserv.joinStrategy || listserv.joinStrategy === "direct_org_email")
  ) {
    return auto;
  }

  return {
    joinStrategy: listserv.joinStrategy ?? auto.joinStrategy,
    joinRecipient: listserv.joinRecipient ?? auto.joinRecipient,
    ownerRecipient: listserv.ownerRecipient ?? auto.ownerRecipient,
    joinSubject: listserv.joinSubject ?? auto.joinSubject,
    joinBody: listserv.joinBody ?? auto.joinBody,
    joinInstructions: listserv.joinInstructions ?? auto.joinInstructions,
    joinConfidence: listserv.joinConfidence ?? auto.joinConfidence,
    joinDetectionReasons: listserv.joinDetectionReasons ?? auto.joinDetectionReasons,
  };
}

function detectJoinDefaults(listserv: Listserv): EffectiveJoin {
  const email = listserv.listEmail.toLowerCase();
  const [local = "", domain = ""] = email.split("@");

  if (["list.cornell.edu", "mm.list.cornell.edu", "list.cs.cornell.edu"].includes(domain)) {
    const listName = local.replace(/^owner-/, "");
    const canonical = listName.endsWith("-l");
    return {
      joinStrategy: "cornell_lyris",
      joinRecipient: `${listName}-request@cornell.edu`,
      ownerRecipient: `owner-${listName}@cornell.edu`,
      joinSubject: "join",
      joinBody: "",
      joinInstructions:
        "Cornell list address. Default: send subject 'join' to listname-request@cornell.edu with a blank body.",
      joinConfidence: canonical ? 95 : 75,
      joinDetectionReasons: [canonical ? "Cornell Lyris list address" : "Cornell list domain"],
    };
  }

  return {
    joinStrategy: listserv.joinStrategy ?? "unknown",
    joinRecipient: listserv.joinRecipient,
    ownerRecipient: listserv.ownerRecipient,
    joinSubject: listserv.joinSubject,
    joinBody: listserv.joinBody,
    joinInstructions: listserv.joinInstructions ?? "No reliable automated join flow detected. Review manually before sending anything.",
    joinConfidence: listserv.joinConfidence ?? 20,
    joinDetectionReasons: listserv.joinDetectionReasons ?? ["not detected"],
  };
}

function suggestFromEmail(email: string) {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  const cleaned = local.replace(/^owner-/, "").replace(/-request$/, "").replace(/-l$/, "");
  const name = cleaned
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => (part.length <= 4 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ") || domain.split(".")[0] || "Unknown";
  return { organizationName: name };
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
