---
title: "SDK provider ports and capability attestation"
status: high-level design
last-reviewed: "2026-06-21"
---

# SDK provider ports and capability attestation

This is the SDK-owned type catalog for the four production provider interfaces and the shared
`CapabilityAttestation` payload. Provider folders keep driver mappings, provider evidence,
conformance suites, and capability-specific details.

Source basis:

- SDK owns the provider interfaces and `CapabilityAttestation`: `docs/design/20-sdk-and-packaging/sdk-boundary.md#what-the-sdk-owns`,
  `docs/design/20-sdk-and-packaging/provider-interface-model.md#provider-interface-model`,
  `docs/design/40-decisions/accepted-decisions.md#ad-16--sdk-owns-provider-interfaces-and-capabilityattestation`.
- Provider seam boundaries: `docs/design/10-architecture/provider-seams.md#the-four-seams`.
- Shared attestation shape: `docs/design/10-architecture/capability-attestation.md#attestation-shape`.
- Current provider contracts: `docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md#contract-types`,
  `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md#contract-types`,
  `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md#contract-types`,
  and `docs/design/30-domain-reference/providers/work-source/contracts-and-conformance.md#contract-types`.

## Shared attestation payload

```ts
type CapabilityProvider = "agent" | "executionHost" | "forge" | "workSource";

type CapabilityAttestationResult = "positive" | "negative";

interface CapabilityAttestation<Capability extends string = string> {
  capability: Capability;
  probeMethod: string;
  result: CapabilityAttestationResult;
  evidenceRef: string;
  scope: string;
  expiry: string;
  driverVersion: string;
  platform: string;
  freshnessKey: string;
  at: string;
  details?: Record<string, unknown>;
}
```

`eventId` is intentionally absent from the payload. The run log envelope creates the event id after
append; core gates cite an appended attestation through an attestation reference, not through a
payload field.

## Agent provider

```ts
type AgentCapability =
  | "canRelayApproval"
  | "canPersistApprovalAnswerChannel"
  | "canResumeOwned"
  | "emitsStructuredToolExit"
  | "emitsGuardianReview"
  | "preservesHostProcessParentage";

type AgentTerminalReason =
  | "completed"
  | "failed"
  | "interrupted"
  | "approval-parked"
  | "provider-lost"
  | "host-lost";

type ApprovalKind =
  | "command-execution"
  | "file-change"
  | "permissions"
  | "mcp-elicitation"
  | "tool-user-input"
  | "apply-patch"
  | "legacy-exec";

type ScopedGrantKind =
  | "command-once"
  | "command-session"
  | "command-policy-amendment"
  | "file-change-once"
  | "file-change-session"
  | "filesystem-permission"
  | "network-permission"
  | "mcp-elicitation-content"
  | "tool-user-input-content"
  | "deny-continue"
  | "deny-interrupt"
  | "deny-park";

type AgentFailureReason =
  | "agent-capability-unattested"
  | "agent-linkage-lost"
  | "approval-relay-unattested"
  | "approval-answer-channel-lost"
  | "agent-resume-unattested"
  | "structured-tool-exit-missing"
  | "tool-output-ref-missing"
  | "guardian-review-untrusted"
  | "host-parentage-unproven"
  | "agent-terminal-ambiguous";

interface AgentProbeScope {
  driverId: string;
  driverVersion: string;
  platform: string;
  protocolSurface: "codex-mcp-server" | "codex-app-server" | "mock";
  freshnessKey: string;
  capabilities: AgentCapability[];
  hostAttestationIds: string[];
  evidenceRequired: "schema" | "live-smoke" | "incident-replay" | "adversarial";
  at: string;
}

interface AgentStartRequest {
  runId: string;
  taskId: string;
  operationId: string;
  hostWorker: WorkerHandle;
  prompt: string;
  approvalMode: "manual" | "assisted";
  outputSink: AgentOutputSink;
  redactionSetId: string;
}

interface AgentOutputSink {
  putToolOutput(input: {
    runId: string;
    toolObservationId: string;
    stream: "stdout" | "stderr" | "combined";
    bytes: string;
    redactionSetId: string;
    contentEncoding: "utf8" | "base64";
  }): {
    outputRef: string;
    digest: string;
    redactionApplied: true;
  };
}

interface AgentSession {
  sessionId: string;
  runId: string;
  providerSessionId: string;
  providerTurnId?: string;
  hostWorkerHandleId: string;
  ownershipClass: "owned" | "owned-remote" | "observe-only";
  answerChannels: Record<string, ApprovalAnswerChannel>;
  startedAt: string;
}

interface ApprovalAnswerChannel {
  channelRef: string;
  providerRequestId: string;
  providerApprovalId?: string;
  threadId?: string;
  turnId?: string;
  expiresAt?: string;
  persistable: boolean;
  evidenceRef: string;
}

interface ScopedGrant {
  grantId: string;
  kind: ScopedGrantKind;
  scope: "request" | "turn" | "session";
  command?: string;
  commandPrefix?: string[];
  filePaths?: string[];
  networkHost?: string;
  networkAction?: "allow" | "deny";
  filesystemEntries?: unknown[];
  content?: unknown;
  grantEventId: string;
}

interface ApprovalAnswer {
  requestId: string;
  decisionEventId: string;
  grant: ScopedGrant;
}

type AgentEvent =
  | { type: "linked"; session: AgentSession; at: string }
  | { type: "progress"; sessionId: string; message?: string; itemId?: string; at: string }
  | { type: "approval-requested"; sessionId: string; request: AgentApprovalRequest; at: string }
  | { type: "tool-observed"; sessionId: string; tool: ToolObserved; at: string }
  | { type: "guardian-review"; sessionId: string; review: GuardianReviewObserved; at: string }
  | { type: "degraded"; sessionId?: string; failure: AgentFailure; at: string }
  | { type: "terminal"; sessionId: string; reason: AgentTerminalReason; exitCode?: number; at: string };

interface AgentApprovalRequest {
  requestId: string;
  kind: ApprovalKind;
  providerMethod: string;
  prompt: string;
  command?: string;
  cwd?: string;
  proposedGrant?: ScopedGrant;
  answerChannel: ApprovalAnswerChannel;
}

interface ToolObserved {
  observationId: string;
  itemId?: string;
  command: string;
  cwd?: string;
  exitCode: number;
  outputRef: string;
  outputDigest: string;
  source: "agent";
}

interface GuardianReviewObserved {
  reviewId: string;
  targetItemId?: string;
  actionType: string;
  status: "inProgress" | "approved" | "denied" | "timedOut" | "aborted";
  riskLevel?: "low" | "medium" | "high" | "critical";
  rationaleRef?: string;
  stable: boolean;
}

interface AgentFailure {
  reason: AgentFailureReason;
  message: string;
  retryable: boolean;
  evidenceRef?: string;
}

interface AgentResumeRequest {
  providerSessionId: string;
  runId: string;
  operationId: string;
  ownershipClass: "owned" | "owned-remote";
  hostWorker: WorkerHandle;
}

interface ApprovalAnswerResult {
  delivered: boolean;
  persisted: boolean;
  channelRef?: string;
  evidenceRef?: string;
  at: string;
}

interface AgentReleaseResult {
  sessionId: string;
  released: boolean;
  observationStopped: boolean;
  evidenceRef?: string;
  at: string;
}

interface AgentProvider {
  probeCapabilities(scope: AgentProbeScope): CapabilityAttestation<AgentCapability>[];
  startWorker(request: AgentStartRequest): AgentSession | AgentFailure;
  observe(session: AgentSession): AsyncIterable<AgentEvent>;
  answerApproval(session: AgentSession, answer: ApprovalAnswer): ApprovalAnswerResult;
  resumeOwned(request: AgentResumeRequest): AgentSession | AgentFailure;
  stopObserving(session: AgentSession): AgentReleaseResult;
}
```

## Execution host provider

```ts
type HostCapability =
  | "canKill"
  | "containmentStrength"
  | "emitsStructuredToolExit"
  | "egress-confinement";

type ContainmentStrength = "none" | "process-group" | "kernel-tree" | "job-object";
type CommandKind = "repo-setup" | "verify" | "diagnostic";

type HostFailureReason =
  | "host-capability-unattested"
  | "workspace-mount-unavailable"
  | "workspace-cwd-outside-mount"
  | "credential-injection-rejected"
  | "egress-confinement-unattested"
  | "worker-spawn-failed"
  | "host-observation-incomplete"
  | "termination-unproven"
  | "runner-command-capture-incomplete"
  | "credential-destroy-unconfirmed";

interface WorkspaceAttachment {
  kind: "local-worktree" | "workspace-mount";
  leaseId: string;
  runId: string;
  repoId: string;
  branchName: string;
  worktreePath?: string;
  mountRef?: string;
}

interface HostWorkspaceHandle {
  handleId: string;
  workspace: WorkspaceAttachment;
  cwdRoot: string;
  driverId: string;
  attachedAt: string;
}

interface HostInjectionContext {
  operationId: string;
  party: CredentialParty;
  credentialRefIds: string[];
  bindings: InjectionBinding[];
  egressPolicy: EgressPolicy;
  redactionSet: RedactionSet;
  requiredAuditEvent: CredentialUsePlanned;
  scopeDigest: string;
  attestationEventIds: string[];
  expiresAt: string;
}

interface WorkerLaunch {
  agentDriverId: string;
  executableRef: string;
  argv: string[];
  environmentMode: "closed";
  stdio: "pipe";
  protocolHint?: string;
}

interface SpawnWorkerRequest {
  runId: string;
  operationId: string;
  party: "worker";
  workspace: HostWorkspaceHandle;
  cwd: string;
  launch: WorkerLaunch;
  injection: HostInjectionContext;
  timeoutSeconds: number;
}

interface HostCommandRequest {
  runId: string;
  operationId: string;
  party: CredentialParty;
  kind: CommandKind;
  workspace: HostWorkspaceHandle;
  argv: string[];
  cwd: string;
  injection: HostInjectionContext;
  timeoutSeconds: number;
}

interface CommandResult {
  operationId: string;
  commandDigest: string;
  cwd: string;
  exitCode?: number;
  signal?: string;
  stdoutRef?: string;
  stderrRef?: string;
  outputDigest: string;
  redactionApplied: boolean;
  startedAt: string;
  finishedAt: string;
}

interface WorkerHandle {
  handleId: string;
  runId: string;
  operationId: string;
  workspaceHandleId: string;
  ownershipClass: "owned" | "owned-remote" | "observe-only";
  containmentRef: string;
  startedAt: string;
}

type HostObservation =
  | {
      type: "output";
      handleId: string;
      stream: "stdout" | "stderr";
      outputRef: string;
      digest: string;
      redactionApplied: true;
      at: string;
    }
  | {
      type: "structured-tool-exit";
      handleId: string;
      tool: string;
      exitCode: number;
      payloadRef?: string;
      digest: string;
      at: string;
    }
  | { type: "process-exit"; handleId: string; exitCode?: number; signal?: string; at: string }
  | { type: "host-failure"; handleId?: string; failure: HostFailure; at: string };

interface TerminationPolicy {
  initialSignal: string;
  graceSeconds: number;
  forceKill: boolean;
  proveEmptyTimeoutSeconds: number;
}

interface TerminationProof {
  signalSent: boolean;
  graceObserved: boolean;
  forceKillSent: boolean;
  reaped: boolean;
  containmentEmpty: boolean;
  evidenceRef: string;
  checkedAt: string;
}

interface TerminationResult {
  handleId: string;
  terminalExitCode?: number;
  terminalSignal?: string;
  proof: TerminationProof;
}

interface HostReleaseResult {
  workspaceHandleId: string;
  released: boolean;
  credentialMaterialDestroyed: boolean;
  evidenceRef: string;
  at: string;
}

interface HostFailure {
  reason: HostFailureReason;
  message: string;
  retryable: boolean;
  evidenceRef?: string;
  at: string;
}

interface HostProbeScope {
  driverId: string;
  driverVersion: string;
  platform: string;
  freshnessKey: string;
  capabilities: HostCapability[];
  workspaceKind?: WorkspaceAttachment["kind"];
  egressPolicy?: EgressPolicy;
  at: string;
}

interface HostAttestationDetails {
  containmentStrength?: ContainmentStrength;
  negativeProbeResults?: NegativeProbe[];
  egressPolicyDigest?: string;
}

interface ExecutionHostProvider {
  probeCapabilities(scope: HostProbeScope): CapabilityAttestation<HostCapability>[];
  attachWorkspace(workspace: WorkspaceAttachment): HostWorkspaceHandle | HostFailure;
  spawnWorker(request: SpawnWorkerRequest): WorkerHandle | HostFailure;
  observeWorker(handle: WorkerHandle): AsyncIterable<HostObservation>;
  terminateWorker(handle: WorkerHandle, policy: TerminationPolicy): TerminationResult;
  runCommand(request: HostCommandRequest): CommandResult | HostFailure;
  releaseWorkspace(handle: HostWorkspaceHandle): HostReleaseResult;
}
```

## Forge provider

```ts
type ForgeCapability =
  | "supportsRulesets"
  | "supportsMergeQueue"
  | "supportsThreadResolution"
  | "canInspectProtection";

type ForgeFailureToken =
  | "forge-credential-unavailable"
  | "forge-auth-denied"
  | "forge-head-mismatch"
  | "forge-state-unknown"
  | "forge-protection-uninspectable"
  | "forge-rulesets-unattested"
  | "forge-merge-queue-unavailable"
  | "forge-review-threads-uninspectable"
  | "forge-admin-bypass-refused"
  | "forge-ghes-capability-unknown"
  | "forge-rate-limited"
  | "forge-redaction-unavailable";

type ForgeCredentialPhase =
  | "push"
  | "PR create/update"
  | "evidence refresh"
  | "review metadata"
  | "merge";

interface ForgeRepoRef {
  provider: string;
  host: string;
  owner: string;
  repo: string;
  defaultBaseRef: string;
  credentialRefId: string;
}

interface ForgeBranchRef {
  branchName: string;
  localHeadSha: string;
  remoteHeadSha?: string;
  pushResult?: "pushed" | "rejected" | "not-pushed";
}

interface PullRequestRef {
  providerPullRequestId: string;
  number: number;
  url: string;
  baseRef: string;
  headRef: string;
  author: string;
  headSha: string;
}

interface ForgeScope {
  driverId: string;
  driverVersion: string;
  provider: string;
  host: string;
  freshnessKey: string;
  capabilities: ForgeCapability[];
  at: string;
}

interface EvidenceRequest {
  repo: ForgeRepoRef;
  pullRequest: PullRequestRef;
  expectedHeadSha: string;
  credentialScope: CredentialScope;
}

interface ExpectedHeadActionRequest extends EvidenceRequest {
  method?: "merge" | "squash" | "rebase";
  comment?: string;
}

interface PushBranchRequest {
  repo: ForgeRepoRef;
  branch: ForgeBranchRef;
  credentialScope: CredentialScope;
}

interface PullRequestUpsertRequest {
  repo: ForgeRepoRef;
  pullRequest?: PullRequestRef;
  baseRef: string;
  headRef: string;
  title: string;
  body?: string;
  draft?: boolean;
  credentialScope: CredentialScope;
}

interface PullRequestCommentRequest {
  repo: ForgeRepoRef;
  pullRequest: PullRequestRef;
  commentId?: string;
  body: string;
  credentialScope: CredentialScope;
}

type ForgeActionResult =
  | {
      kind: "accepted";
      observedHeadSha: string;
      redactionFingerprintIds: string[];
      credentialAuditEventIds: string[];
      evidenceRef: string;
      at: string;
    }
  | {
      kind: "refused";
      token: ForgeFailureToken;
      observedHeadSha: string;
      redactionFingerprintIds: string[];
      credentialAuditEventIds: string[];
      evidenceRef: string;
      at: string;
    }
  | ForgeDegraded;

interface ForgeDegraded {
  kind: "degraded";
  token: ForgeFailureToken;
  observedHeadSha?: string;
  redactionFingerprintIds: string[];
  credentialAuditEventIds: string[];
  evidenceRef: string;
  at: string;
  observedFacts?: ForgeObservedFacts;
}

interface ForgeObservedFacts {
  prState?: ForgePrStateFacts;
  statusChecks?: ForgeStatusCheckFacts;
  reviewThreads?: ForgeReviewThreadFacts;
  protection?: ForgeProtectionFacts;
  mergeQueue?: ForgeMergeQueueFacts;
}

interface ForgePrStateFacts {
  baseRefOid: string;
  headRefOid: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  reviewDecision?: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED";
  mergeStateStatus: string;
  isInMergeQueue: boolean;
}

interface ForgeStatusCheckFacts {
  state: "EXPECTED" | "ERROR" | "FAILURE" | "PENDING" | "SUCCESS";
  contexts: ForgeStatusCheckContext[];
}

interface ForgeStatusCheckContext {
  name: string;
  state?: string;
  conclusion?: string;
}

interface ForgeReviewThreadFacts {
  threads: ForgeReviewThread[];
}

interface ForgeReviewThread {
  id: string;
  isResolved: boolean;
  viewerCanResolve: boolean;
  path: string;
  comments: ForgeReviewThreadComment[];
}

interface ForgeReviewThreadComment {
  id: string;
  author: string;
  bodyRef: string;
}

interface ForgeProtectionFacts {
  branchProtectionRules: ForgeBranchProtectionRule[];
  rulesets: ForgeRuleset[];
}

interface ForgeBranchProtectionRule {
  pattern: string;
  requiredStatusCheckContexts: string[];
  requiresApprovingReviews: boolean;
  requiresStatusChecks: boolean;
  requiresStrictStatusChecks: boolean;
  requiresCommitSignatures: boolean;
  allowsForcePushes: boolean;
  allowsDeletions: boolean;
  blocksCreations: boolean;
}

interface ForgeRuleset {
  id: string;
  name: string;
  enforcement: string;
  target?: string;
  // normalized required status checks so core-05 can derive required CI checks
  // without parsing provider-specific ruleset ASTs (empty array = no checks)
  requiredStatusChecks: string[];
}

interface ForgeMergeQueueFacts {
  mergeQueuePresent: boolean;
  mergeQueueEntry?: ForgeMergeQueueEntry;
}

interface ForgeMergeQueueEntry {
  position: number;
  state: string;
  baseCommitOid?: string;
  headCommitOid?: string;
}

interface ForgeEvidenceSnapshot {
  repo: ForgeRepoRef;
  pullRequest: PullRequestRef;
  expectedHeadSha: string;
  prState: ForgePrStateFacts;
  statusChecks: ForgeStatusCheckFacts;
  reviewThreads: ForgeReviewThreadFacts;
  protection: ForgeProtectionFacts;
  mergeQueue: ForgeMergeQueueFacts;
  scope: ForgeScope;
  evidenceRefs: string[];
  redactionFingerprintIds: string[];
  credentialAuditEventIds: string[];
  collectedAt: string;
}

interface ForgeProvider {
  probeCapabilities(scope: ForgeScope): CapabilityAttestation<ForgeCapability>[];
  pushBranch(req: PushBranchRequest): ForgeActionResult;
  upsertPullRequest(req: PullRequestUpsertRequest): ForgeActionResult;
  publishComment(req: PullRequestCommentRequest): ForgeActionResult;
  collectEvidence(req: EvidenceRequest): ForgeEvidenceSnapshot | ForgeDegraded;
  updateBranch(req: ExpectedHeadActionRequest): ForgeActionResult;
  enqueue(req: ExpectedHeadActionRequest): ForgeActionResult;
  merge(req: ExpectedHeadActionRequest): ForgeActionResult;
}
```

## Work source provider

```ts
type StatusBucket = "eligible" | "inProgress" | "complete" | "blocked" | "unknown";
type StatusBuckets = Record<Exclude<StatusBucket, "unknown">, string[]>;

type WorkSourceCapability =
  | "supportsTracks"
  | "supportsClaim"
  | "supportsStatusWrite"
  | "supportsDependencies";

interface WorkSourceProbeScope {
  driverId: string;
  driverVersion: string;
  platform: string;
  sourceKind: "markdown" | "mock";
  freshnessKey: string;
  capabilities: WorkSourceCapability[];
  trackIds?: string[];
  at: string;
}

type TaskKey = { workSourceId: string; trackId: string; taskId: string };
type SpecRef = { kind: "path" | "url"; ref: string; label?: string; declaredDigest?: string };
type TaskStatus = { native: string; bucket: StatusBucket };
type Claim = { runId: string; holder: string; claimedAt: string; expiresAt: string; epoch: number };

type TaskView = {
  key: TaskKey;
  title: string;
  status: TaskStatus;
  target: { project: string };
  spec: { inline?: string; refs: SpecRef[] };
  dependencies: TaskKey[];
  claim?: Claim;
  sourceRecordDigest: string;
};

type TrackView = {
  trackId: string;
  workSourceId: string;
  statusBuckets: StatusBuckets;
  taskKeys: TaskKey[];
  sourceRecordDigest: string;
};

type TaskSnapshot = {
  task: TaskView;
  sourcePath: string;
  sourceRevision: string;
  sourceBytesDigest: string;
  inlineSpecDigest?: string;
  rawExcerptDigest: string;
  createdAt: string;
};

type ClaimResult = { task: TaskView; snapshotRef: ArtifactRef; snapshotDigest: string };

type AuditCitation = {
  runId: string;
  taskSnapshotRef: string;
  statusEvidenceRef?: string;
};

type StatusWriteResult = {
  written: boolean;
  updatedRecordDigest: string;
  evidenceRef?: ArtifactRef;
  auditCitation?: AuditCitation;
  at: string;
};

type WorkSourceError =
  | { kind: "work-source-unavailable"; message: string; sourceRef?: string }
  | { kind: "track-malformed"; trackId: string; diagnostic: string }
  | {
      kind: "dependency-unresolved";
      task: TaskKey;
      dependency: TaskKey;
      reason: "missing" | "malformed" | "blocked" | "unknown" | "incomplete";
    }
  | { kind: "status-bucket-unknown"; task: TaskKey; nativeStatus: string }
  | {
      kind: "claim-conflict";
      task: TaskKey;
      expectedRecordDigest: string;
      observedRecordDigest: string;
      expectedEpoch?: number;
      observedEpoch?: number;
    }
  | { kind: "claim-lock-unavailable"; task: TaskKey; leaseKey: string; priorClaim?: Claim }
  | { kind: "snapshot-artifact-unavailable"; task: TaskKey; diagnostic: string }
  | { kind: "status-write-unavailable"; task: TaskKey; diagnostic: string }
  | {
      kind: "status-authority-conflict";
      task: TaskKey;
      expectedRecordDigest?: string;
      observedRecordDigest: string;
    };

interface WorkSourceProvider {
  probeCapabilities(scope: WorkSourceProbeScope): CapabilityAttestation<WorkSourceCapability>[];
  listTracks(): TrackView[] | WorkSourceError;
  listTasks(trackId: string): TaskView[] | WorkSourceError;
  nextEligible(input: { trackIds?: string[]; targetProject?: string }): TaskView | null | WorkSourceError;
  claim(input: {
    task: TaskKey;
    runId: string;
    holder: string;
    ttlMs: number;
    expectedRecordDigest: string;
    sourceRevision: string;
  }): ClaimResult | WorkSourceError;
  release(input: {
    task: TaskKey;
    runId: string;
    reason: string;
    expectedEpoch: number;
  }): void | WorkSourceError;
  writeStatus(input: {
    task: TaskKey;
    status: TaskStatus;
    expectedRecordDigest: string;
    evidenceRef?: ArtifactRef;
    note?: string;
    auditCitation?: AuditCitation;
  }): StatusWriteResult | WorkSourceError;
}
```

## External supporting types

The SDK provider port implementation should import or cross-reference these already-owned types
instead of redefining them:

| Type | Owner |
|---|---|
| `ArtifactRef` | fnd-02 Storage & Artifacts |
| `CredentialScope`, `CredentialParty`, `CredentialUsePlanned`, `EgressPolicy`, `InjectionBinding`, `RedactionSet`, `NegativeProbe` | fnd-04 Credentials & Secrets |
| `WorkerHandle` | SDK provider ports, Execution Host section |

## Provider-folder responsibilities that stay put

Provider domain folders remain the source of truth for:

- Driver mapping to concrete platforms such as Codex, local process execution, GitHub, and markdown.
- Provider-specific capability evidence, probes, failure/degraded semantics, and conformance suites.
- Mock-driver behavior and adversarial fixtures.
- Open implementation probes and dated evidence appendices.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [SDK & packaging overview](./README.md) · **← Prev:** [provider interface model](./provider-interface-model.md) · **Next →:** [Storage port types](./storage-port-types.md)

<!-- /DOCS-NAV -->
