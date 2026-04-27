import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, FormEvent, ReactNode } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

// ─── Types ────────────────────────────────────────────────────────────────────

const ADMIN_TOKEN_STORAGE_KEY = "cornell_loop_admin_token";

type Candidate = Doc<"listservCandidates">;
type Listserv = Doc<"listservs">;
type IngestionState = Doc<"listservIngestionState">;
type IngestionRun = Doc<"ingestionRuns">;
// Full doc type — kept for reference but dashboard/overview queries return projected subsets.
type _ListservMessageFull = Doc<"listservMessages">;
// Projected shape returned by the dashboard query for the recent-messages table.
type RecentMessage = Pick<_ListservMessageFull, "_id" | "_creationTime" | "receivedAt" | "listservId" | "subject" | "senderEmail" | "processingStatus">;
// Projected shape for confirmation messages (includes body fields needed for link extraction).
type ConfirmationMessage = Pick<_ListservMessageFull, "_id" | "_creationTime" | "receivedAt" | "listservId" | "subject" | "senderEmail" | "sender" | "to" | "cc" | "processingStatus" | "confirmationClearedAt" | "bodyText" | "bodyHtml">;
// Projected shape returned by parser.overview for failed/ready messages.
type ParseMessage = Pick<_ListservMessageFull, "_id" | "_creationTime" | "subject" | "senderEmail" | "processingStatus" | "parseError" | "organizationId" | "listservId" | "receivedAt">;
type Organization = Doc<"organizations">;
type EventDoc = Doc<"events">;
type ParseRun = Doc<"parseRuns">;
type JoinAttempt = Doc<"joinAttempts">;

type GmailStatus = {
  email: string;
  scopes: string[];
  status: "connected" | "invalid";
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
type OrgType = Organization["type"];

type UnassignedSender = {
  senderEmail: string;
  count: number;
  latestReceivedAt: number;
  sampleSubjects: string[];
  suggestion: {
    organizationName: string;
    organizationType: OrgType;
    sourceName: string;
    sourceType: NonNullable<Listserv["sourceType"]>;
  };
};

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

type AdminTab = "setup" | "sources" | "join" | "ingest" | "publish";

const TABS: Array<{ id: AdminTab; label: string; hint: string }> = [
  { id: "setup", label: "Setup", hint: "Gmail + discovery" },
  { id: "sources", label: "Sources", hint: "Assign senders to orgs" },
  { id: "join", label: "Join", hint: "Subscribe to lists" },
  { id: "ingest", label: "Ingest", hint: "Poll inbox" },
  { id: "publish", label: "Publish", hint: "Review + publish drafts" },
];

const ORG_TYPES: OrgType[] = ["club", "department", "official", "publication", "company", "other"];
const JOIN_STRATEGIES: JoinStrategy[] = [
  "cornell_lyris", "cornell_lyris_owner_contact", "campus_groups",
  "newsletter", "direct_org_email", "manual", "unknown",
];

// ─── Root ────────────────────────────────────────────────────────────────────

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "");
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const p = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((t) => t.id === p) ? (p as AdminTab) : "setup";
  });
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(text: string, ok = true) {
    setToast({ text, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  }, [token]);

  function switchTab(tab: AdminTab) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }

  // ── queries ──
  const dashboard = useQuery(api.listservAdmin.dashboard, token ? { token } : "skip");
  const gmailStatus = useQuery(api.gmailOAuth.connectionStatus, token ? { token } : "skip") as GmailStatus | undefined;
  const sourceData = useQuery(api.sourceAdmin.overview, token ? { token } : "skip");
  const parseData = useQuery(api.parser.overview, token ? { token } : "skip");

  // ── mutations / actions ──
  const runDiscovery = useAction(api.listservAdmin.runDiscovery);
  const runIngestionNow = useAction(api.listservAdmin.runIngestionNow);
  const runParseNow = useAction(api.parser.runParseNow);
  const sendJoinEmail = useAction(api.listservAdmin.sendJoinEmail);

  const createOAuthNonce = useMutation(api.gmailOAuth.createOAuthNonce);
  const seedCandidates = useMutation(api.listservAdmin.seedCandidates);
  const addCandidate = useMutation(api.listservAdmin.addCandidate);
  const approveCandidate = useMutation(api.listservAdmin.approveCandidate);
  const rejectCandidate = useMutation(api.listservAdmin.rejectCandidate);
  const assignSender = useMutation(api.sourceAdmin.assignSender);
  const assignSourceOrg = useMutation(api.sourceAdmin.assignSourceOrganization);
  const createOrg = useMutation(api.sourceAdmin.createOrganization);
  const updateOrg = useMutation(api.sourceAdmin.updateOrganization);
  const ignoreSender = useMutation(api.sourceAdmin.ignoreSender);
  const unignoreSource = useMutation(api.sourceAdmin.unignoreSource);
  const updateListservStatus = useMutation(api.listservAdmin.updateListservStatus);
  const updateJoinStrategy = useMutation(api.listservAdmin.updateJoinStrategy);
  const clearConfirmation = useMutation(api.listservAdmin.clearConfirmation);
  const publishEvent = useMutation(api.parser.publishEvent);
  const hideEvent = useMutation(api.parser.hideEvent);

  async function act(label: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      showToast(label);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Action failed.", false);
    }
  }

  // ── derived data ──
  const candidates: Candidate[] = dashboard?.candidates ?? [];
  const listservs: Listserv[] = dashboard?.listservs ?? [];
  const ingestionStates: IngestionState[] = dashboard?.ingestionState ?? [];
  const ingestionRuns: IngestionRun[] = dashboard?.ingestionRuns ?? [];
  const recentMessages: RecentMessage[] = (dashboard?.recentMessages ?? []) as RecentMessage[];
  const pendingConfirmations: ConfirmationMessage[] = (dashboard?.pendingConfirmations ?? []) as ConfirmationMessage[];
  const clearedConfirmations: ConfirmationMessage[] = (dashboard?.clearedConfirmations ?? []) as ConfirmationMessage[];
  const joinAttempts: JoinAttempt[] = dashboard?.joinAttempts ?? [];

  const organizations: Organization[] = sourceData?.organizations ?? [];
  const sourceListservs: Listserv[] = sourceData?.listservs ?? listservs;
  const unassigned: UnassignedSender[] = sourceData?.unassignedSenders ?? [];

  const parseRuns: ParseRun[] = parseData?.runs ?? [];
  const drafts: EventDoc[] = parseData?.drafts ?? [];
  const failedMessages: ParseMessage[] = (parseData?.failedMessages ?? []) as ParseMessage[];
  const readyMessages: ParseMessage[] = (parseData?.readyMessages ?? []) as ParseMessage[];
  const needsAssignment: number = parseData?.needsAssignmentCount ?? 0;

  const listservById = new Map(listservs.map((l) => [l._id, l]));

  // ── join draft state ──
  const [joinDraft, setJoinDraft] = useState<JoinDraft | null>(null);

  if (!token) return <LoginScreen onToken={setToken} />;

  return (
    <div className="min-h-screen bg-[var(--color-neutral-100)] text-[color:var(--color-neutral-900)]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="font-[family-name:var(--font-brand)] text-[length:var(--font-size-sub2)] font-bold">Loop</span>
            <span className="text-[color:var(--color-text-muted)] text-[length:var(--font-size-body2)]">Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <GmailDot status={gmailStatus} />
            <button
              onClick={() => { sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY); setToken(""); }}
              className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-neutral-700)]"
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1400px] gap-1 px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={[
                "border-b-2 px-4 py-2 text-[length:var(--font-size-body2)] font-semibold transition-colors",
                tab.id === activeTab
                  ? "border-[var(--color-primary-700)] text-[color:var(--color-primary-800)]"
                  : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-neutral-700)]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={[
          "fixed right-5 bottom-5 z-50 max-w-sm rounded-xl px-4 py-3 text-[length:var(--font-size-body2)] font-semibold shadow-[var(--shadow-2)] transition-all",
          toast.ok ? "bg-[var(--color-neutral-900)] text-white" : "bg-red-600 text-white",
        ].join(" ")}>
          {toast.text}
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        {activeTab === "setup" && (
          <SetupTab
            gmailStatus={gmailStatus}
            candidates={candidates}
            discoveryRuns={dashboard?.discoveryRuns ?? []}
            onConnectGmail={async () => {
              try {
                const nonce = await createOAuthNonce({ token });
                const siteUrl = getConvexSiteUrl();
                if (!siteUrl) { showToast("Convex site URL not configured.", false); return; }
                window.open(`${siteUrl}/gmail/oauth/start?nonce=${encodeURIComponent(nonce)}`, "_blank");
              } catch (e) {
                showToast(e instanceof Error ? e.message : "Failed to start OAuth.", false);
              }
            }}
            onRunDiscovery={() => act("Discovery complete.", () => runDiscovery({ token }))}
            onSeedCandidates={() => act("Candidates loaded.", () => seedCandidates({ token }))}
            onAddCandidate={(email, name, notes) =>
              act("Candidate added.", () => addCandidate({ token, email, displayName: name || undefined, notes: notes || undefined }))
            }
          />
        )}

        {activeTab === "sources" && (
          <SourcesTab
            candidates={candidates}
            listservs={sourceListservs}
            organizations={organizations}
            unassigned={unassigned}
            onApproveCandidate={(id, name) =>
              act("Candidate approved.", () => approveCandidate({ token, candidateId: id, name }))
            }
            onRejectCandidate={(id) =>
              act("Candidate rejected.", () => rejectCandidate({ token, candidateId: id }))
            }
            onAssignSource={(listservId, orgId) =>
              act("Source assigned.", () => assignSourceOrg({ token, listservId, organizationId: orgId }))
            }
            onCreateAndAssignSource={(listservId, name, type) =>
              act(`${name} created and assigned.`, async () => {
                const orgId = await createOrg({ token, name, type });
                await assignSourceOrg({ token, listservId, organizationId: orgId });
              })
            }
            onAssignInboxSenderToOrg={(senderEmail, orgId) =>
              act("Source assigned.", () => assignSender({ token, senderEmail, organizationId: orgId }))
            }
            onCreateAndAssignInboxSender={(senderEmail, name, type, sourceName, sourceType) =>
              act(`${name} created and assigned.`, async () => {
                const orgId = await createOrg({ token, name, type });
                await assignSender({ token, senderEmail, organizationId: orgId, sourceName, sourceType });
              })
            }
            onIgnoreSender={(senderEmail) =>
              act("Sender ignored.", () => ignoreSender({ token, senderEmail }))
            }
            onUnignoreSource={(listservId) =>
              act("Source reactivated.", () => unignoreSource({ token, listservId }))
            }
            onCreateOrg={(name, type) =>
              act(`${name} created.`, () => createOrg({ token, name, type }))
            }
            onUpdateOrg={(orgId, name, type) =>
              act("Organization updated.", () => updateOrg({ token, organizationId: orgId, name, type, status: "active", tags: [] }))
            }
          />
        )}

        {activeTab === "join" && (
          <JoinTab
            listservs={listservs}
            joinAttempts={joinAttempts}
            clearedConfirmations={clearedConfirmations}
            joinDraft={joinDraft}
            onPrepareJoin={setJoinDraft}
            onDraftChange={setJoinDraft}
            onSendJoin={async (e) => {
              e.preventDefault();
              if (!joinDraft) return;
              await act("Join email sent.", () => sendJoinEmail({ token, ...joinDraft }));
              setJoinDraft(null);
            }}
            onStatusChange={(id, status) =>
              act("Status updated.", () => updateListservStatus({ token, listservId: id, status }))
            }
            onStrategyChange={(id, s) =>
              act("Method updated.", () => updateJoinStrategy({ token, listservId: id, joinStrategy: s }))
            }
          />
        )}

        {activeTab === "ingest" && (
          <IngestTab
            states={ingestionStates}
            runs={ingestionRuns}
            messages={recentMessages}
            pendingConfirmations={pendingConfirmations}
            clearedConfirmations={clearedConfirmations}
            listservById={listservById}
            onRunNow={() => act("Ingestion complete.", () => runIngestionNow({ token }))}
            onClearConfirmation={(id) => act("Confirmation cleared.", () => clearConfirmation({ token, messageId: id }))}
          />
        )}

        {activeTab === "publish" && (
          <PublishTab
            runs={parseRuns}
            drafts={drafts}
            failedMessages={failedMessages}
            readyCount={readyMessages.length}
            needsAssignment={needsAssignment}
            onRunParse={() => act("Parse complete.", () => runParseNow({ token }))}
            onPublish={(id) => act("Published.", () => publishEvent({ token, eventId: id }))}
            onHide={(id) => act("Hidden.", () => hideEvent({ token, eventId: id }))}
            onReparse={(id) => act("Reparsed.", () => runParseNow({ token, messageId: id }))}
            onGoToSources={() => switchTab("sources")}
          />
        )}
      </div>
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginScreen({ onToken }: { onToken: (t: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-neutral-100)] p-6">
      <form
        onSubmit={(e) => { e.preventDefault(); onToken(draft.trim()); }}
        className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-8 shadow-[var(--shadow-2)]"
      >
        <h1 className="font-[family-name:var(--font-brand)] text-[length:var(--font-size-sub1)] font-bold">Loop Admin</h1>
        <label className="mt-6 flex flex-col gap-2 text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-neutral-700)]">
          Admin token
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            type="password"
            autoComplete="current-password"
            className={input()}
          />
        </label>
        <Btn primary className="mt-4 w-full">Enter</Btn>
      </form>
    </div>
  );
}

// ─── Setup tab ────────────────────────────────────────────────────────────────

function SetupTab({
  gmailStatus,
  candidates,
  discoveryRuns,
  onConnectGmail,
  onRunDiscovery,
  onSeedCandidates,
  onAddCandidate,
}: {
  gmailStatus: GmailStatus | undefined;
  candidates: Candidate[];
  discoveryRuns: Doc<"discoveryRuns">[];
  onConnectGmail: () => void;
  onRunDiscovery: () => void;
  onSeedCandidates: () => void;
  onAddCandidate: (email: string, name: string, notes: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Gmail */}
      <Card>
        <CardHeader title="Gmail" subtitle="Connect dtiincubator@gmail.com — used for ingestion and join emails." />
        <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-neutral-100)] px-4 py-3">
          {gmailStatus === undefined ? (
            <span className="text-[color:var(--color-text-muted)] text-[length:var(--font-size-body2)]">Loading…</span>
          ) : gmailStatus === null ? (
            <span className="text-[length:var(--font-size-body2)]">Not connected</span>
          ) : (
            <div>
              <div className="flex items-center gap-2">
                <StatusDot status={gmailStatus.status === "connected" ? "green" : "red"} />
                <span className="font-semibold text-[length:var(--font-size-body2)]">{gmailStatus.email}</span>
              </div>
              {gmailStatus.lastError && <p className="mt-1 text-[length:var(--font-size-body3)] text-red-600">{gmailStatus.lastError}</p>}
            </div>
          )}
          <Btn primary onClick={onConnectGmail}>
            {gmailStatus?.status === "connected" ? "Reconnect" : "Connect Gmail"}
          </Btn>
        </div>
      </Card>

      {/* Discover */}
      <Card>
        <CardHeader title="Discover" subtitle="Find probable Cornell list addresses from the sender dataset." />
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn primary onClick={onRunDiscovery}>Run discovery</Btn>
          <Btn onClick={onSeedCandidates}>Load cached set</Btn>
        </div>
        {discoveryRuns.length > 0 && (
          <div className="mt-4 grid gap-1">
            {discoveryRuns.slice(0, 5).map((run) => (
              <div key={run._id} className="flex items-center gap-3 text-[length:var(--font-size-body3)]">
                <StatusDot status={run.status === "completed" ? "green" : run.status === "failed" ? "red" : "yellow"} />
                <span className="text-[color:var(--color-text-muted)]">{fmtDate(run.startedAt)}</span>
                <span>found {run.candidatesFound}, inserted {run.candidatesInserted}</span>
                {run.error && <span className="text-red-600">{run.error}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add candidate */}
      <Card className="lg:col-span-2">
        <CardHeader title="Add candidate manually" subtitle="Use when you know a specific list address you want to track." />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAddCandidate(email, name, notes);
            setEmail(""); setName(""); setNotes("");
          }}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        >
          <Field label="Email" value={email} onChange={setEmail} required />
          <Field label="Display name" value={name} onChange={setName} />
          <Field label="Notes" value={notes} onChange={setNotes} />
          <Btn primary>Add</Btn>
        </form>
        {candidates.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-[length:var(--font-size-body3)] font-semibold uppercase tracking-widest text-[color:var(--color-text-muted)]">
              {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} — go to <strong>Sources</strong> to review
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Sources tab ──────────────────────────────────────────────────────────────

function SourcesTab({
  candidates,
  listservs,
  organizations,
  unassigned,
  onApproveCandidate,
  onRejectCandidate,
  onAssignSource,
  onCreateAndAssignSource,
  onAssignInboxSenderToOrg,
  onCreateAndAssignInboxSender,
  onIgnoreSender,
  onUnignoreSource,
  onCreateOrg,
  onUpdateOrg,
}: {
  candidates: Candidate[];
  listservs: Listserv[];
  organizations: Organization[];
  unassigned: UnassignedSender[];
  onApproveCandidate: (id: Id<"listservCandidates">, name?: string) => void;
  onRejectCandidate: (id: Id<"listservCandidates">) => void;
  onAssignSource: (listservId: Id<"listservs">, orgId: Id<"organizations">) => void;
  onCreateAndAssignSource: (listservId: Id<"listservs">, name: string, type: OrgType) => void;
  onAssignInboxSenderToOrg: (senderEmail: string, orgId: Id<"organizations">) => void;
  onCreateAndAssignInboxSender: (senderEmail: string, name: string, type: OrgType, sourceName: string, sourceType: NonNullable<Listserv["sourceType"]>) => void;
  onIgnoreSender: (senderEmail: string) => void;
  onUnignoreSource: (listservId: Id<"listservs">) => void;
  onCreateOrg: (name: string, type: OrgType) => void;
  onUpdateOrg: (orgId: Id<"organizations">, name: string, type: OrgType) => void;
}) {
  // Partition listservs into three buckets
  const unassignedSources = listservs.filter((s) => !s.organizationId && s.status !== "paused");
  const assignedSources   = listservs.filter((s) => !!s.organizationId);
  const ignoredSources    = listservs.filter((s) => s.status === "paused");
  const pendingCandidates = candidates.filter((c) => c.status === "candidate");

  // Unified needs-org list: unassigned known sources + inbox-only senders
  type UnifiedItem =
    | { kind: "known"; source: Listserv; suggestion: ReturnType<typeof suggestFromEmail> }
    | { kind: "inbox"; sender: UnassignedSender };

  const unifiedItems: UnifiedItem[] = [
    ...unassignedSources.map((source) => ({
      kind: "known" as const,
      source,
      suggestion: suggestFromEmail(source.listEmail),
    })),
    ...unassigned.map((sender) => ({ kind: "inbox" as const, sender })),
  ];
  unifiedItems.sort((a, b) => {
    const countA = a.kind === "inbox" ? a.sender.count : 0;
    const countB = b.kind === "inbox" ? b.sender.count : 0;
    const timeA = a.kind === "inbox" ? a.sender.latestReceivedAt : (a.source.lastReceivedAt ?? a.source.createdAt);
    const timeB = b.kind === "inbox" ? b.sender.latestReceivedAt : (b.source.lastReceivedAt ?? b.source.createdAt);
    return countB - countA || timeB - timeA;
  });

  const totalAction = pendingCandidates.length + unifiedItems.length;

  return (
    <div className="grid gap-6">
      {totalAction === 0 && unifiedItems.length === 0 && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[length:var(--font-size-body2)] text-green-800">
          All sources are assigned and ready. Messages will be parsed when you run the parser.
        </div>
      )}

      {/* Candidates awaiting review */}
      {pendingCandidates.length > 0 && (
        <Card>
          <CardHeader
            title={`${pendingCandidates.length} candidate${pendingCandidates.length !== 1 ? "s" : ""} awaiting review`}
            subtitle="Addresses found by discovery. Approve to create a source, or reject to dismiss."
          />
          <div className="mt-4 grid gap-2">
            {pendingCandidates.map((c) => (
              <CandidateRow
                key={c._id}
                candidate={c}
                onApprove={(name) => onApproveCandidate(c._id, name)}
                onReject={() => onRejectCandidate(c._id)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Unified unassigned list */}
      {unifiedItems.length > 0 && (
        <Card>
          <CardHeader
            title={`${unifiedItems.length} source${unifiedItems.length !== 1 ? "s" : ""} need an organization`}
            subtitle="Assign each source to an organization to enable parsing. Ignore sources you don't want to track."
          />
          <div className="mt-4 grid gap-2">
            {unifiedItems.map((item) =>
              item.kind === "known" ? (
                <UnassignedRow
                  key={item.source._id}
                  email={item.source.listEmail}
                  name={item.source.name}
                  isNewSource={false}
                  suggestedOrgName={item.suggestion.organizationName}
                  suggestedOrgType={"club"}
                  messageCount={undefined}
                  sampleSubjects={[]}
                  organizations={organizations}
                  onAssignToOrg={(orgId) => onAssignSource(item.source._id, orgId)}
                  onCreateAndAssign={(name, type) => onCreateAndAssignSource(item.source._id, name, type)}
                  onIgnore={() => onIgnoreSender(item.source.listEmail)}
                />
              ) : (
                <UnassignedRow
                  key={item.sender.senderEmail}
                  email={item.sender.senderEmail}
                  name={item.sender.suggestion.organizationName}
                  isNewSource={true}
                  suggestedOrgName={item.sender.suggestion.organizationName}
                  suggestedOrgType={item.sender.suggestion.organizationType}
                  messageCount={item.sender.count}
                  sampleSubjects={item.sender.sampleSubjects}
                  organizations={organizations}
                  onAssignToOrg={(orgId) => onAssignInboxSenderToOrg(item.sender.senderEmail, orgId)}
                  onCreateAndAssign={(name, type) =>
                    onCreateAndAssignInboxSender(
                      item.sender.senderEmail, name, type,
                      item.sender.suggestion.sourceName,
                      item.sender.suggestion.sourceType,
                    )
                  }
                  onIgnore={() => onIgnoreSender(item.sender.senderEmail)}
                />
              )
            )}
          </div>
        </Card>
      )}

      {/* Assigned sources — always visible so assignments can be changed */}
      {assignedSources.length > 0 && (
        <details className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4" open={unifiedItems.length === 0}>
          <summary className="cursor-pointer select-none font-semibold text-[length:var(--font-size-body2)]">
            {assignedSources.length} assigned source{assignedSources.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-3 grid gap-2">
            {assignedSources.map((src) => {
              const org = organizations.find((o) => o._id === src.organizationId);
              return (
                <AssignedSourceRow
                  key={src._id}
                  source={src}
                  orgName={org?.name ?? "Unknown org"}
                  organizations={organizations}
                  onReassign={(orgId) => onAssignSource(src._id, orgId)}
                  onIgnore={() => onIgnoreSender(src.listEmail)}
                />
              );
            })}
          </div>
        </details>
      )}

      {/* Ignored / paused sources */}
      {ignoredSources.length > 0 && (
        <details className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <summary className="cursor-pointer select-none font-semibold text-[length:var(--font-size-body2)] text-[color:var(--color-text-muted)]">
            {ignoredSources.length} ignored source{ignoredSources.length !== 1 ? "s" : ""}
          </summary>
          <div className="mt-3 grid gap-2">
            {ignoredSources.map((src) => (
              <IgnoredSourceRow
                key={src._id}
                source={src}
                organizations={organizations}
                onReactivate={() => onUnignoreSource(src._id)}
                onAssign={(orgId) => { onUnignoreSource(src._id); onAssignSource(src._id, orgId); }}
              />
            ))}
          </div>
        </details>
      )}

      {/* Organizations — view, edit, create */}
      <Card>
        <CardHeader
          title={`${organizations.length} organization${organizations.length !== 1 ? "s" : ""}`}
          subtitle="Edit name or type, or create new organizations."
        />
        {organizations.length > 0 && (
          <div className="mt-4 grid gap-2">
            {organizations.map((org) => (
              <OrgRow
                key={org._id}
                org={org}
                sourceCount={listservs.filter((s) => s.organizationId === org._id).length}
                onUpdate={(name, type) => onUpdateOrg(org._id, name, type)}
              />
            ))}
          </div>
        )}
        <CreateOrgForm className="mt-4" onCreate={onCreateOrg} />
      </Card>
    </div>
  );
}

function AssignedSourceRow({
  source,
  orgName,
  organizations,
  onReassign,
  onIgnore,
}: {
  source: Listserv;
  orgName: string;
  organizations: Organization[];
  onReassign: (orgId: Id<"organizations">) => void;
  onIgnore: () => void;
}) {
  const [reassigning, setReassigning] = useState(false);
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{source.name}</div>
          <div className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
            {source.listEmail} · <span className="text-[color:var(--color-neutral-700)]">{orgName}</span>
          </div>
        </div>
        {!reassigning && (
          <div className="flex gap-2 shrink-0">
            <Btn onClick={() => setReassigning(true)}>Reassign</Btn>
            <Btn danger onClick={onIgnore}>Ignore</Btn>
          </div>
        )}
      </div>
      {reassigning && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-neutral-100)] px-4 py-3 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 flex-1 min-w-[180px] text-[length:var(--font-size-body2)] font-semibold">
            Reassign to
            <select
              defaultValue={source.organizationId ?? ""}
              onChange={(e) => { if (e.target.value) { onReassign(e.target.value as Id<"organizations">); setReassigning(false); } }}
              className={input()}
            >
              <option value="">Choose…</option>
              {organizations.map((org) => (
                <option key={org._id} value={org._id}>{org.name}</option>
              ))}
            </select>
          </label>
          <Btn onClick={() => setReassigning(false)}>Cancel</Btn>
        </div>
      )}
    </div>
  );
}

function IgnoredSourceRow({
  source,
  organizations,
  onReactivate,
  onAssign,
}: {
  source: Listserv;
  organizations: Organization[];
  onReactivate: () => void;
  onAssign: (orgId: Id<"organizations">) => void;
}) {
  const [assigning, setAssigning] = useState(false);
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-neutral-100)] overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate text-[color:var(--color-text-muted)]">{source.name}</div>
          <div className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">{source.listEmail}</div>
        </div>
        {!assigning && (
          <div className="flex gap-2 shrink-0">
            <Btn primary onClick={onReactivate}>Reactivate</Btn>
            <Btn onClick={() => setAssigning(true)}>Assign org</Btn>
          </div>
        )}
      </div>
      {assigning && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 flex-1 min-w-[180px] text-[length:var(--font-size-body2)] font-semibold">
            Assign to org
            <select
              defaultValue=""
              onChange={(e) => { if (e.target.value) { onAssign(e.target.value as Id<"organizations">); setAssigning(false); } }}
              className={input()}
            >
              <option value="">Choose…</option>
              {organizations.map((org) => (
                <option key={org._id} value={org._id}>{org.name}</option>
              ))}
            </select>
          </label>
          <Btn onClick={() => setAssigning(false)}>Cancel</Btn>
        </div>
      )}
    </div>
  );
}

function OrgRow({
  org,
  sourceCount,
  onUpdate,
}: {
  org: Organization;
  sourceCount: number;
  onUpdate: (name: string, type: OrgType) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(org.name);
  const [type, setType] = useState<OrgType>(org.type);

  // Reset draft if org prop changes (e.g. after save)
  const savedName = org.name;
  const savedType = org.type;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {editing ? (
          <>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${input()} flex-1`}
              autoFocus
            />
            <select value={type} onChange={(e) => setType(e.target.value as OrgType)} className={`${input()} w-36`}>
              {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Btn primary onClick={() => { onUpdate(name.trim() || savedName, type); setEditing(false); }}>Save</Btn>
            <Btn onClick={() => { setName(savedName); setType(savedType); setEditing(false); }}>Cancel</Btn>
          </>
        ) : (
          <>
            <span className="flex-1 font-semibold">{org.name}</span>
            <Tag>{org.type}</Tag>
            <span className="text-[color:var(--color-text-muted)] text-[length:var(--font-size-body3)]">
              {sourceCount} source{sourceCount !== 1 ? "s" : ""}
            </span>
            <Btn onClick={() => setEditing(true)}>Edit</Btn>
          </>
        )}
      </div>
    </div>
  );
}

// Unified row for both known sources (listservs row exists, no org) and
// inbox-only senders (no listservs row yet). isNewSource distinguishes them visually.
function UnassignedRow({
  email,
  name,
  isNewSource,
  suggestedOrgName,
  suggestedOrgType,
  messageCount,
  sampleSubjects,
  organizations,
  onAssignToOrg,
  onCreateAndAssign,
  onIgnore,
}: {
  email: string;
  name: string;
  isNewSource: boolean;
  suggestedOrgName: string;
  suggestedOrgType: OrgType;
  messageCount: number | undefined;
  sampleSubjects: string[];
  organizations: Organization[];
  onAssignToOrg: (orgId: Id<"organizations">) => void;
  onCreateAndAssign: (name: string, type: OrgType) => void;
  onIgnore: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "assign" | "create">("idle");
  const [orgName, setOrgName] = useState(suggestedOrgName);
  const [orgType, setOrgType] = useState<OrgType>(suggestedOrgType);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{name}</span>
            {isNewSource && <Tag variant="amber">new source</Tag>}
          </div>
          <div className="mt-0.5 text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
            {email}
            {messageCount !== undefined && ` · ${messageCount} message${messageCount !== 1 ? "s" : ""}`}
            {sampleSubjects[0] && ` · "${sampleSubjects[0]}"`}
          </div>
          {mode === "idle" && (
            <div className="mt-1 text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
              Suggested org: <strong>{suggestedOrgName}</strong>
            </div>
          )}
        </div>
        {mode === "idle" && (
          <div className="flex gap-2 flex-wrap shrink-0">
            <Btn primary onClick={() => setMode("create")}>Create org</Btn>
            <Btn onClick={() => setMode("assign")}>Assign existing</Btn>
            <Btn danger onClick={onIgnore}>Ignore</Btn>
          </div>
        )}
      </div>

      {mode === "assign" && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-neutral-100)] px-4 py-3 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 flex-1 min-w-[180px] text-[length:var(--font-size-body2)] font-semibold">
            Organization
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) { onAssignToOrg(e.target.value as Id<"organizations">); setMode("idle"); }
              }}
              className={input()}
            >
              <option value="">Choose…</option>
              {organizations.map((org) => <option key={org._id} value={org._id}>{org.name}</option>)}
            </select>
          </label>
          <Btn onClick={() => setMode("idle")}>Cancel</Btn>
        </div>
      )}

      {mode === "create" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreateAndAssign(orgName, orgType);
            setMode("idle");
          }}
          className="border-t border-[var(--color-border)] bg-[var(--color-neutral-100)] px-4 py-3 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
        >
          <Field label="New org name" value={orgName} onChange={setOrgName} required />
          <label className="flex flex-col gap-1 text-[length:var(--font-size-body2)] font-semibold">
            Type
            <select value={orgType} onChange={(e) => setOrgType(e.target.value as OrgType)} className={input()}>
              {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <Btn primary>Create &amp; assign</Btn>
            <Btn type="button" onClick={() => setMode("idle")}>Cancel</Btn>
          </div>
        </form>
      )}
    </div>
  );
}
function CandidateRow({
  candidate,
  onApprove,
  onReject,
}: {
  candidate: Candidate;
  onApprove: (name?: string) => void;
  onReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(candidate.displayName ?? "");

  if (candidate.status !== "candidate") return null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{candidate.displayName ?? candidate.email}</span>
            <span className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">{candidate.email}</span>
            <ConfidenceBadge value={candidate.confidence} />
          </div>
          <div className="mt-0.5 text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
            {candidate.matchedReasons.join(" · ")}
            {candidate.popularity !== undefined && ` · ${candidate.popularity} overlap`}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Btn primary onClick={() => onApprove(name || undefined)}>Approve</Btn>
          <Btn onClick={() => setExpanded(!expanded)}>Rename</Btn>
          <Btn danger onClick={onReject}>Reject</Btn>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-neutral-100)] px-4 py-3">
          <label className="flex flex-col gap-1 text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-neutral-700)]">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={input()}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function CreateOrgForm({ className, onCreate }: { className?: string; onCreate: (name: string, type: OrgType) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<OrgType>("club");
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onCreate(name.trim(), type); setName(""); } }}
      className={`grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end ${className ?? ""}`}
    >
      <Field label="New organization name" value={name} onChange={setName} required />
      <label className="flex flex-col gap-1 text-[length:var(--font-size-body2)] font-semibold">
        Type
        <select value={type} onChange={(e) => setType(e.target.value as OrgType)} className={input()}>
          {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <Btn primary>Create org</Btn>
    </form>
  );
}

// ─── Join tab ─────────────────────────────────────────────────────────────────

function JoinTab({
  listservs,
  joinAttempts,
  clearedConfirmations,
  joinDraft,
  onPrepareJoin,
  onDraftChange,
  onSendJoin,
  onStatusChange,
  onStrategyChange,
}: {
  listservs: Listserv[];
  joinAttempts: JoinAttempt[];
  clearedConfirmations: ConfirmationMessage[];
  joinDraft: JoinDraft | null;
  onPrepareJoin: (draft: JoinDraft) => void;
  onDraftChange: (draft: JoinDraft | null) => void;
  onSendJoin: (e: FormEvent) => void;
  onStatusChange: (id: Id<"listservs">, status: Listserv["status"]) => void;
  onStrategyChange: (id: Id<"listservs">, strategy: JoinStrategy) => void;
}) {
  const isJoined = (l: Listserv) =>
    l.joinStatus === "joined" ||
    clearedConfirmations.some((c) => confirmationMatchesListserv(c, l));

  const pending = listservs.filter((l) => !isJoined(l));
  const joined = listservs.filter(isJoined);

  return (
    <div className="grid gap-6">
      {/* Compose email */}
      {joinDraft && (
        <Card>
          <CardHeader title="Compose join email" subtitle="Review and edit before sending. Sent from dtiincubator@gmail.com." />
          <form onSubmit={onSendJoin} className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="To" value={joinDraft.recipient} onChange={(v) => onDraftChange({ ...joinDraft, recipient: v })} required />
              <Field label="Subject" value={joinDraft.subject} onChange={(v) => onDraftChange({ ...joinDraft, subject: v })} required />
            </div>
            <label className="flex flex-col gap-1 text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-neutral-700)]">
              Body
              <textarea
                value={joinDraft.body}
                onChange={(e) => onDraftChange({ ...joinDraft, body: e.target.value })}
                rows={5}
                className={input()}
              />
            </label>
            <div className="flex gap-2">
              <Btn primary>Send</Btn>
              <Btn type="button" onClick={() => onDraftChange(null)}>Cancel</Btn>
            </div>
          </form>
        </Card>
      )}

      {/* Pending */}
      {pending.length === 0 ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[length:var(--font-size-body2)] text-green-800">
          All sources are joined. Check <strong>Ingest</strong> for confirmations.
        </div>
      ) : (
        <Card>
          <CardHeader title={`${pending.length} source${pending.length !== 1 ? "s" : ""} to join`} subtitle="Prepare a join email, review it, then send." />
          <div className="mt-4 grid gap-3">
            {pending.map((l) => (
              <JoinRow
                key={l._id}
                listserv={l}
                onPrepare={() => onPrepareJoin(defaultJoinDraft(l))}
                onStatusChange={(status) => onStatusChange(l._id, status)}
                onStrategyChange={(s) => onStrategyChange(l._id, s)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Recent attempts */}
      {joinAttempts.length > 0 && (
        <Card>
          <CardHeader title="Recent join emails sent" />
          <div className="mt-3 grid gap-2">
            {joinAttempts.map((a) => (
              <div key={a._id} className="flex items-center gap-3 rounded-lg bg-[var(--color-neutral-100)] px-3 py-2 text-[length:var(--font-size-body2)]">
                <StatusDot status={a.status === "sent" ? "green" : "red"} />
                <span className="font-semibold truncate">{a.recipient}</span>
                <span className="text-[color:var(--color-text-muted)] truncate">{a.subject}</span>
                <span className="ml-auto shrink-0 text-[color:var(--color-text-muted)]">{fmtDate(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Joined archive */}
      {joined.length > 0 && (
        <details className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <summary className="cursor-pointer font-semibold text-[length:var(--font-size-body2)]">
            Joined sources ({joined.length})
          </summary>
          <div className="mt-3 grid gap-2">
            {joined.map((l) => (
              <div key={l._id} className="flex items-center gap-3 rounded-lg bg-[var(--color-neutral-100)] px-3 py-2 text-[length:var(--font-size-body2)]">
                <StatusDot status="green" />
                <span className="font-semibold">{l.name}</span>
                <span className="text-[color:var(--color-text-muted)]">{l.listEmail}</span>
                {l.lastReceivedAt && <span className="ml-auto text-[color:var(--color-text-muted)]">last: {fmtDate(l.lastReceivedAt)}</span>}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function JoinRow({
  listserv,
  onPrepare,
  onStatusChange,
  onStrategyChange,
}: {
  listserv: Listserv;
  onPrepare: () => void;
  onStatusChange: (status: Listserv["status"]) => void;
  onStrategyChange: (s: JoinStrategy) => void;
}) {
  const [open, setOpen] = useState(false);
  const join = getEffectiveJoin(listserv);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{listserv.name}</span>
            <span className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">{listserv.listEmail}</span>
            <Tag>{listserv.joinStatus ?? "not started"}</Tag>
          </div>
          <div className="mt-0.5 text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
            {join.joinStrategy.replace(/_/g, " ")} · {join.joinConfidence}% confident
            {join.joinRecipient && ` · sends to ${join.joinRecipient}`}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn primary onClick={onPrepare}>Prepare email</Btn>
          <Btn onClick={() => setOpen(!open)}>Settings</Btn>
        </div>
      </div>
      {open && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-neutral-100)] px-4 py-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[length:var(--font-size-body2)] font-semibold">
            Join method
            <select
              value={join.joinStrategy}
              onChange={(e) => onStrategyChange(e.target.value as JoinStrategy)}
              className={input()}
            >
              {JOIN_STRATEGIES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[length:var(--font-size-body2)] font-semibold">
            Source status
            <select
              value={listserv.status}
              onChange={(e) => onStatusChange(e.target.value as Listserv["status"])}
              className={input()}
            >
              {(["joining", "active", "paused", "failed"] as const).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          {join.joinInstructions && (
            <p className="col-span-2 text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">{join.joinInstructions}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ingest tab ───────────────────────────────────────────────────────────────

function IngestTab({
  states,
  runs,
  messages,
  pendingConfirmations,
  clearedConfirmations,
  listservById,
  onRunNow,
  onClearConfirmation,
}: {
  states: IngestionState[];
  runs: IngestionRun[];
  messages: RecentMessage[];
  pendingConfirmations: ConfirmationMessage[];
  clearedConfirmations: ConfirmationMessage[];
  listservById: Map<Id<"listservs">, Listserv>;
  onRunNow: () => void;
  onClearConfirmation: (id: Id<"listservMessages">) => void;
}) {
  const pending = pendingConfirmations
    .map((m) => toConfirmationItem(m, listservById))
    .filter((i): i is ConfirmationItem => i !== null);

  const cleared = clearedConfirmations
    .map((m) => toConfirmationItem(m, listservById))
    .filter((i): i is ConfirmationItem => i !== null)
    .sort((a, b) => (b.clearedAt ?? 0) - (a.clearedAt ?? 0));

  const state = states[0];

  return (
    <div className="grid gap-6">
      {/* Status bar */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[length:var(--font-size-sub2)]">Gmail Ingestion</h2>
            <p className="mt-0.5 text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
              Polls dtiincubator@gmail.com every 10 minutes. Stores raw messages and matches them to sources.
            </p>
          </div>
          <div className="flex items-center gap-4">
            {state && (
              <div className="flex items-center gap-2 text-[length:var(--font-size-body2)]">
                <StatusDot status={state.status === "idle" ? "green" : state.status === "running" ? "yellow" : "red"} />
                <span>{state.status}</span>
                {state.lastSucceededAt && <span className="text-[color:var(--color-text-muted)]">· {fmtDate(state.lastSucceededAt)}</span>}
              </div>
            )}
            <Btn primary onClick={onRunNow}>Run now</Btn>
          </div>
        </div>
        {state?.lastError && <p className="mt-3 text-[length:var(--font-size-body2)] text-red-600">{state.lastError}</p>}
        {runs.length > 0 && (
          <div className="mt-4 grid gap-1">
            {runs.slice(0, 6).map((run) => (
              <div key={run._id} className="flex items-center gap-3 text-[length:var(--font-size-body3)]">
                <StatusDot status={run.status === "completed" ? "green" : run.status === "failed" ? "red" : "yellow"} />
                <span className="text-[color:var(--color-text-muted)]">{fmtDate(run.startedAt)}</span>
                <span>{run.trigger} · stored {run.stored}</span>
                {run.error && <span className="text-red-600 truncate">{run.error}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Confirmation queue */}
      {(pending.length > 0 || cleared.length > 0) && (
        <Card>
          <div className="flex items-center justify-between">
            <CardHeader title="Confirmation queue" subtitle="Lyris emails asking you to confirm a subscription." />
            {pending.length > 0 && <Tag variant="amber">{pending.length} pending</Tag>}
          </div>
          {pending.length === 0 ? (
            <p className="mt-3 text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">No pending confirmations.</p>
          ) : (
            <div className="mt-4 grid gap-2">
              {pending.map((c) => (
                <ConfirmationCard key={c.id} confirmation={c} onClear={onClearConfirmation} />
              ))}
            </div>
          )}
          {cleared.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)] font-semibold">
                {cleared.length} cleared
              </summary>
              <div className="mt-2 grid gap-2">
                {cleared.map((c) => <ConfirmationCard key={c.id} confirmation={c} cleared />)}
              </div>
            </details>
          )}
        </Card>
      )}

      {/* Recent messages */}
      {messages.length > 0 && (
        <Card>
          <CardHeader title="Recent messages" />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[length:var(--font-size-body2)]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[color:var(--color-text-muted)] text-[length:var(--font-size-body3)]">
                  <Th>Received</Th><Th>Source</Th><Th>Subject</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m._id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-neutral-100)]">
                    <Td>{fmtDate(m.receivedAt)}</Td>
                    <Td>{m.listservId ? listservById.get(m.listservId)?.name ?? "Matched" : <span className="text-amber-700">Unmatched</span>}</Td>
                    <Td>{m.subject || "(no subject)"}</Td>
                    <Td><Tag>{m.processingStatus}</Tag></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ConfirmationCard({
  confirmation,
  cleared,
  onClear,
}: {
  confirmation: ConfirmationItem;
  cleared?: boolean;
  onClear?: (id: Id<"listservMessages">) => void;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${cleared ? "border-[var(--color-border)] bg-[var(--color-neutral-100)]" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{confirmation.listservName}</div>
        <div className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
          {confirmation.sender} · {fmtDate(confirmation.receivedAt)}
          {confirmation.clearedAt && ` · cleared ${fmtDate(confirmation.clearedAt)}`}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {confirmation.link && (
          <a
            href={confirmation.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg bg-[var(--color-primary-700)] px-3 py-1.5 text-[length:var(--font-size-body2)] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            Open confirm link
          </a>
        )}
        {!cleared && onClear && (
          <Btn onClick={() => onClear(confirmation.id)}>Clear</Btn>
        )}
      </div>
    </div>
  );
}

// ─── Publish tab ──────────────────────────────────────────────────────────────

function PublishTab({
  runs,
  drafts,
  failedMessages,
  readyCount,
  needsAssignment,
  onRunParse,
  onPublish,
  onHide,
  onReparse,
  onGoToSources,
}: {
  runs: ParseRun[];
  drafts: EventDoc[];
  failedMessages: ParseMessage[];
  readyCount: number;
  needsAssignment: number;
  onRunParse: () => void;
  onPublish: (id: Id<"events">) => void;
  onHide: (id: Id<"events">) => void;
  onReparse: (id: Id<"listservMessages">) => void;
  onGoToSources: () => void;
}) {
  const blocked = readyCount === 0 && needsAssignment > 0;

  return (
    <div className="grid gap-6">
      {/* Header + run */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[length:var(--font-size-sub2)]">AI Parser</h2>
            <p className="mt-0.5 text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
              Extracts draft feed items from assigned messages using AI. All items default to draft — you publish them.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex gap-4 text-center">
              <div>
                <div className="text-[length:var(--font-size-sub2)] font-bold">{readyCount}</div>
                <div className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">ready</div>
              </div>
              <div>
                <div className="text-[length:var(--font-size-sub2)] font-bold text-amber-700">{needsAssignment}</div>
                <div className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">needs assignment</div>
              </div>
              <div>
                <div className="text-[length:var(--font-size-sub2)] font-bold">{drafts.length}</div>
                <div className="text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">drafts</div>
              </div>
            </div>
            <Btn primary disabled={readyCount === 0} onClick={onRunParse}>Run parser</Btn>
          </div>
        </div>
        {blocked && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[length:var(--font-size-body2)] text-amber-800">
            <span>{needsAssignment} message{needsAssignment !== 1 ? "s" : ""} can't be parsed — assign their senders to organizations first.</span>
            <button onClick={onGoToSources} className="ml-auto shrink-0 font-semibold underline">
              Go to Sources →
            </button>
          </div>
        )}
        {runs.length > 0 && (
          <div className="mt-4 grid gap-1">
            {runs.slice(0, 5).map((run) => (
              <div key={run._id} className="flex items-center gap-3 text-[length:var(--font-size-body3)]">
                <StatusDot status={run.status === "completed" ? "green" : run.status === "failed" ? "red" : "yellow"} />
                <span className="text-[color:var(--color-text-muted)]">{fmtDate(run.startedAt)}</span>
                <span>{run.trigger}{run.model ? ` · ${run.model}` : ""} · scanned {run.messagesScanned}, created {run.eventsCreated}, ignored {run.messagesIgnored}</span>
                {run.error && <span className="text-red-600 truncate">{run.error}</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Drafts */}
      <Card>
        <CardHeader
          title={`${drafts.length} draft${drafts.length !== 1 ? "s" : ""}`}
          subtitle="Review each item before publishing. Published items appear in the user-facing feed."
        />
        {drafts.length === 0 ? (
          <p className="mt-3 text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">
            No drafts. Run the parser after assigning sources to organizations.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {drafts.map((event) => (
              <DraftCard
                key={event._id}
                event={event}
                onPublish={() => onPublish(event._id)}
                onHide={() => onHide(event._id)}
                onReparse={event.sourceMessageId ? () => onReparse(event.sourceMessageId!) : undefined}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Failed */}
      {failedMessages.length > 0 && (
        <Card>
          <CardHeader title={`${failedMessages.length} failed message${failedMessages.length !== 1 ? "s" : ""}`} subtitle="Parser errors." />
          <div className="mt-3 grid gap-2">
            {failedMessages.map((m) => (
              <div key={m._id} className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[length:var(--font-size-body2)]">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{m.subject || "(no subject)"}</div>
                  <div className="text-[length:var(--font-size-body3)] text-red-700">{m.parseError ?? m.senderEmail}</div>
                </div>
                <Btn onClick={() => onReparse(m._id)}>Retry</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function DraftCard({
  event,
  onPublish,
  onHide,
  onReparse,
}: {
  event: EventDoc;
  onPublish: () => void;
  onHide: () => void;
  onReparse?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasWarnings = (event.parseWarnings ?? []).length > 0;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{event.title}</span>
            <Tag>{event.eventType}</Tag>
            <ConfidenceBadge value={event.parseConfidence ?? 0} />
          </div>
          <p className="mt-1 text-[length:var(--font-size-body2)] text-[color:var(--color-neutral-700)] line-clamp-2">
            {event.aiDescription || event.description}
          </p>
          <div className="mt-1 text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
            {event.listserv}
            {event.dates && event.dates.length > 0 && ` · ${new Date(event.dates[0].timestamp).toLocaleDateString()}`}
            {hasWarnings && <span className="ml-2 text-amber-700">⚠ {(event.parseWarnings ?? []).join("; ")}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Btn primary onClick={onPublish}>Publish</Btn>
          <Btn onClick={onHide}>Hide</Btn>
          {onReparse && <Btn onClick={onReparse}>Reparse</Btn>}
          <Btn onClick={() => setExpanded(!expanded)}>{expanded ? "Less" : "More"}</Btn>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-neutral-100)] px-4 py-3 text-[length:var(--font-size-body2)]">
          <p className="text-[color:var(--color-neutral-700)]">{event.description}</p>
          {event.links && event.links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {event.links.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noreferrer" className="text-[color:var(--color-link)] underline text-[length:var(--font-size-body3)]">
                  {link.label ?? link.type}
                </a>
              ))}
            </div>
          )}
          {event.location && (
            <p className="mt-2 text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
              📍 {event.location.displayText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Primitive components ─────────────────────────────────────────────────────

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 ${className ?? ""}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="font-semibold text-[length:var(--font-size-sub2)]">{title}</h2>
      {subtitle && <p className="mt-0.5 text-[length:var(--font-size-body2)] text-[color:var(--color-text-secondary)]">{subtitle}</p>}
    </div>
  );
}

function Btn({
  children,
  primary,
  danger,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; danger?: boolean }) {
  const base = "inline-flex items-center rounded-lg px-3 py-1.5 text-[length:var(--font-size-body2)] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const variant = primary
    ? "bg-[var(--color-primary-700)] text-white hover:bg-[var(--color-primary-hover)]"
    : danger
    ? "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
    : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[color:var(--color-neutral-700)] hover:bg-[var(--color-neutral-100)]";
  return (
    <button {...props} className={`${base} ${variant} ${className ?? ""}`}>
      {children}
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[length:var(--font-size-body2)] font-semibold text-[color:var(--color-neutral-700)]">
      {label}
      <input
        value={value}
        required={required}
        type={type ?? "text"}
        onChange={(e) => onChange(e.target.value)}
        className={input()}
      />
    </label>
  );
}

function Tag({
  children,
  variant,
}: {
  children: ReactNode;
  variant?: "default" | "amber";
}) {
  const cls = variant === "amber"
    ? "bg-amber-100 text-amber-800"
    : "bg-[var(--color-surface-raised)] text-[color:var(--color-neutral-700)]";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[length:var(--font-size-body3)] font-semibold ${cls}`}>
      {typeof children === "string" ? children.replace(/_/g, " ") : children}
    </span>
  );
}

function StatusDot({ status }: { status: "green" | "yellow" | "red" | "grey" }) {
  const color =
    status === "green" ? "bg-green-500"
    : status === "yellow" ? "bg-amber-400"
    : status === "red" ? "bg-red-500"
    : "bg-[var(--color-neutral-400)]";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
}

function GmailDot({ status }: { status: GmailStatus | undefined }) {
  if (status === undefined) return null;
  const s = status === null ? "grey" : status.status === "connected" ? "green" : "red";
  const label = status === null ? "Not connected" : status.email;
  return (
    <span className="flex items-center gap-1.5 text-[length:var(--font-size-body3)] text-[color:var(--color-text-muted)]">
      <StatusDot status={s} />{label}
    </span>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 80 ? "bg-green-100 text-green-800" : value >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-700";
  return <span className={`inline-flex rounded-md px-2 py-0.5 text-[length:var(--font-size-body3)] font-semibold ${color}`}>{value}%</span>;
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-3 align-top">{children}</td>;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function input() {
  return "rounded-lg border border-[var(--color-border)] bg-[var(--color-white)] px-3 py-2 text-[length:var(--font-size-body2)] font-normal outline-none focus:border-[var(--color-primary-700)] w-full";
}

function fmtDate(timestamp: number | undefined) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
}

function getConvexSiteUrl() {
  const explicit = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  if (explicit) return explicit.replace(/\/$/, "");
  const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!convexUrl) return "";
  return convexUrl.replace(/\/$/, "").replace(".convex.cloud", ".convex.site");
}

function suggestFromEmail(email: string) {
  const [local = "", domain = ""] = email.toLowerCase().split("@");
  const cleaned = local.replace(/^owner-/, "").replace(/-request$/, "").replace(/-l$/, "");
  const name = cleaned
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((p) => (p.length <= 4 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ") || domain.split(".")[0] || "Unknown";
  return { organizationName: name };
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

function getEffectiveJoin(listserv: Listserv): EffectiveJoin {
  const auto = detectJoinDefaults(listserv);
  if (auto.joinStrategy === "cornell_lyris" && (!listserv.joinStrategy || listserv.joinStrategy === "direct_org_email")) {
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
    return {
      joinStrategy: "cornell_lyris",
      joinRecipient: `${listName}-request@cornell.edu`,
      ownerRecipient: `owner-${listName}@cornell.edu`,
      joinSubject: "join",
      joinBody: "",
      joinInstructions: "Cornell list: send subject 'join' to listname-request@cornell.edu with blank body.",
      joinConfidence: listName.endsWith("-l") ? 95 : 75,
      joinDetectionReasons: [listName.endsWith("-l") ? "Cornell Lyris list address" : "Cornell list domain"],
    };
  }
  return {
    joinStrategy: listserv.joinStrategy ?? "unknown",
    joinRecipient: listserv.joinRecipient,
    ownerRecipient: listserv.ownerRecipient,
    joinSubject: listserv.joinSubject,
    joinBody: listserv.joinBody,
    joinInstructions: listserv.joinInstructions ?? "No reliable join flow detected. Review manually.",
    joinConfidence: listserv.joinConfidence ?? 20,
    joinDetectionReasons: listserv.joinDetectionReasons ?? ["not detected"],
  };
}

function toConfirmationItem(
  mail: ConfirmationMessage,
  listservById: Map<Id<"listservs">, Listserv>,
): ConfirmationItem | null {
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

function confirmationMatchesListserv(mail: ConfirmationMessage, listserv: Listserv) {
  if (mail.listservId === listserv._id) return true;
  const searchable = `${mail.subject}\n${mail.bodyText}\n${mail.senderEmail}\n${mail.to.join(" ")}\n${mail.cc.join(" ")}`.toLowerCase();
  const addresses = [listserv.listEmail, ...listserv.senderEmails].map((v) => v.toLowerCase());
  const localParts = addresses.map((v) => v.split("@")[0]).filter(Boolean);
  return addresses.some((a) => searchable.includes(a)) || localParts.some((lp) => searchable.includes(lp));
}

function extractConfirmationLink(value: string) {
  const match = value.match(/https:\/\/www\.list\.cornell\.edu\/c\?[^\s"'<>]+/i);
  return match?.[0].replace(/&amp;/g, "&");
}

function inferListNameFromMessage(mail: ConfirmationMessage) {
  const match = `${mail.subject}\n${mail.bodyText}`.match(/(?:to|the)\s+([a-z0-9._-]+-l)\s+(?:mailing list|list)/i);
  return match?.[1] ?? "Possible confirmation";
}
