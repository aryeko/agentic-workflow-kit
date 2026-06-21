---
title: "Agent Execution - contract types"
status: approved
last-reviewed: "2026-06-18"
---

# Contract types

This file holds provider-specific Agent contract detail for
`design/30-domain-reference/providers/agent-execution/README.md`. The SDK-owned canonical port name
is `AgentProvider`; capability and conformance detail lives in
[capabilities-and-conformance.md](capabilities-and-conformance.md).

## Contract types

```ts
type AgentCapability =
  | "canRelayApproval" | "canPersistApprovalAnswerChannel" | "canResumeOwned"
  | "emitsStructuredToolExit" | "emitsGuardianReview" | "preservesHostProcessParentage";

type AgentTerminalReason =
  | "completed" | "failed" | "interrupted" | "approval-parked" | "provider-lost" | "host-lost";

type ApprovalKind =
  | "command-execution" | "file-change" | "permissions" | "mcp-elicitation"
  | "tool-user-input" | "apply-patch" | "legacy-exec";

type ScopedGrantKind =
  | "command-once" | "command-session" | "command-policy-amendment"
  | "file-change-once" | "file-change-session" | "filesystem-permission"
  | "network-permission" | "mcp-elicitation-content" | "tool-user-input-content"
  | "deny-continue" | "deny-interrupt" | "deny-park";

type AgentFailureReason =
  | "agent-capability-unattested" | "agent-linkage-lost" | "approval-relay-unattested"
  | "approval-answer-channel-lost" | "agent-resume-unattested" | "structured-tool-exit-missing"
  | "tool-output-ref-missing" | "guardian-review-untrusted" | "host-parentage-unproven"
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

interface CapabilityAttestation {
  capability: AgentCapability;
  probeMethod: string;
  result: "positive" | "negative";
  evidenceRef: string;
  scope: string;
  expiry: string;
  driverVersion: string;
  platform: string;
  freshnessKey: string;
  at: string;
  details?: Record<string, unknown>;
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
    // fnd-02 ArtifactRef.id; resolve via ArtifactStore.resolve(id).
    outputRef: string; digest: string; redactionApplied: true;
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
  // fnd-02 ArtifactRef.id; resolve via ArtifactStore.resolve(id).
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

// Input to resumeOwned(request). Carries the provider session to re-own, the operation context,
// and the (possibly new) host worker to attach. ownershipClass must be "owned" or "owned-remote";
// "observe-only" sessions cannot be resumed via this path.
interface AgentResumeRequest {
  providerSessionId: string;
  runId: string;
  operationId: string;
  ownershipClass: "owned" | "owned-remote";
  hostWorker: WorkerHandle;
}

// Return of answerApproval(session, answer). delivered reflects whether the answer reached the
// provider channel. persisted reflects ApprovalAnswerChannel.persistable — true only when the
// driver confirmed durable storage. On failure token approval-answer-channel-lost, delivered is
// false and persisted is false; evidenceRef is omitted.
interface ApprovalAnswerResult {
  delivered: boolean;
  persisted: boolean;
  channelRef?: string;
  evidenceRef?: string;
  at: string;
}

// Return of stopObserving(session). Mirrors HostReleaseResult but scoped to the agent session.
// released: the provider linkage was cleanly severed. observationStopped: the observation stream
// was terminated. evidenceRef is omitted when no confirmatory evidence is available.
interface AgentReleaseResult {
  sessionId: string;
  released: boolean;
  observationStopped: boolean;
  evidenceRef?: string;
  at: string;
}

interface AgentProvider {
  probeCapabilities(scope: AgentProbeScope): CapabilityAttestation[];
  startWorker(request: AgentStartRequest): AgentSession | AgentFailure;
  observe(session: AgentSession): AsyncIterable<AgentEvent>;
  answerApproval(session: AgentSession, answer: ApprovalAnswer): ApprovalAnswerResult;
  resumeOwned(request: AgentResumeRequest): AgentSession | AgentFailure;
  stopObserving(session: AgentSession): AgentReleaseResult;
}
```

`WorkerHandle` is consumed from the Execution Host contract. Worker-safe injection and redaction
inputs are consumed through the host launch and `AgentOutputSink`; this contract does not resolve or
issue credentials.

The v1 Agent provider surface is frozen: methods, events, capabilities, failure tokens,
`ScopedGrant`, and `ScopedGrantKind` remain the contract core-03 and core-04 consume. Concrete Codex
mapping is provider-driver work behind this SDK-owned `AgentProvider` port.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Agent Execution](./README.md) · **← Prev:** [Agent Execution](./README.md) · **Next →:** [Agent Execution - capabilities and conformance](./capabilities-and-conformance.md)

<!-- /DOCS-NAV -->
