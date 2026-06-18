---
title: "Agent Execution - contract types"
status: draft
last-reviewed: "2026-06-18"
---

# Contract types

This file holds the typed Agent contract for
`docs/kit-vnext/domains/prov-01-agent-execution/design.md`. Capability and conformance detail lives
in [capabilities-and-conformance.md](capabilities-and-conformance.md).

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
  }): { outputRef: string; digest: string; redactionApplied: true };
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

interface AgentDriver {
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
