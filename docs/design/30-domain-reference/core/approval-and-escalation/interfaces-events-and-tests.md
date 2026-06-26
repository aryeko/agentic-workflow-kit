---
title: "Approval & Escalation - interfaces events and tests"
status: approved
last-reviewed: "2026-06-19"
---

# Interfaces, events, and tests

## Contracts & interfaces

```ts
interface ApprovalEscalation {
  normalize(input: AgentApprovalRequest, context: ApprovalContext): ApprovalRequest;
  classify(request: ApprovalRequest, policy: ResolvedPolicy, replay: RunReplay,
    projections: RunProjections, classifiedAt: string): ApprovalRisk;
  decide(input: ApprovalDecisionInput): Decision;
  park(input: ApprovalParkInput): ParkDecision;
  recordOutcome(input: ApprovalOutcomeInput): Outcome;
  resumePending(input: ApprovalResumeInput): ResumeDecision;
}

interface ApprovalContext {
  runId: string;
  taskId: string;
  operationId: string;
  sessionId: string;
  policyRef: string;
  agentRequestEventId: string;
  // `worktreePath` is the run's trusted workspace root, resolved by the core-03 orchestration from
  // the run's `WorktreeLease.worktreePath` (foundation, frozen), keyed by `runId`, and injected here
  // so `normalize` copies it onto the recorded `ApprovalRequest`. Never read from the agent request.
  // Consumers fail closed when absent.
  worktreePath?: string;
  // Injected by the core-03 orchestration so `normalize` stays a pure total function and
  // never reads ambient time. `requestedAt` is the enclosing `AgentApprovalRequested`
  // envelope `.at`; `promptRef` is the fnd-02 `ArtifactRef.id` of the prompt persisted by
  // the orchestration before `normalize` (mirrors `AgentOutputSink.putToolOutput -> outputRef`).
  requestedAt: string;
  promptRef: string;
  // The Agent `kind` cannot express `protected-policy-change` or `network` (it arrives as a normal
  // `file-change`/`apply-patch`/command). When the orchestration's changed-path/policy evaluation
  // determines the request touches a protected policy file (or is a network-egress request), it sets
  // `subjectOverride`; `normalize` uses it in preference to the `kind` mapping. Absent → map from `kind`.
  subjectOverride?: ApprovalSubject;
}

interface ApprovalDecisionInput {
  request: ApprovalRequest;
  risk: ApprovalRisk;
  mode: ApprovalMode;
  policy: ResolvedPolicy;
  replay: RunReplay;
  projections: RunProjections;
  evaluatedAt: string;
  gateRecordEventId?: string;
  operatorDecisionEventId?: string;
}

interface ApprovalOutcomeInput {
  request: ApprovalRequest;
  decision: Decision;
  agentAnswerEventId?: string;
  failureState?: ApprovalFailureState;
  recordedAt: string;
}

interface ApprovalResumeInput {
  requestId: string;
  runId: string;
  sessionId: string;
  decisionEventId: string;
  evaluatedAt: string;
}

interface ApprovalParkInput {
  request: ApprovalRequest;
  reason: "live-window-elapsed" | "live-only-channel" | "operator-attention";
  decisionDeadline: string;
  parkedAt: string;
  sourceEventIds: string[];
}

interface ParkDecision {
  schema: "kit-vnext.approval-park-decision.v1";
  requestId: string;
  runId: string;
  sessionId: string;
  reason: "live-window-elapsed" | "live-only-channel" | "operator-attention";
  decisionDeadline: string;
  parkedAt: string;
  sourceEventIds: string[];
}

interface ResumeDecision {
  schema: "kit-vnext.approval-resume-decision.v1";
  requestId: string;
  runId: string;
  sessionId: string;
  decisionEventId: string;
  outcome: "resume" | "expired" | "blocked";
  grant?: ScopedGrant;
  failureState?: ApprovalFailureState;
  sourceEventIds: string[];
  evaluatedAt: string;
}
```

`ResumeDecision` is a pure decision result for parked or pending requests. `outcome = "resume"` means
the request is non-expired, linkage is current and non-ambiguous, the session is owned or owned-remote,
and the committed decision event carries a grant that can be pre-loaded into the Agent answer call.
`outcome = "expired"` is used only when the request reached `decisionDeadline`. `outcome = "blocked"`
names the missing guarantee through `failureState`. It is not itself an event; a successful resume is
durably recorded by `ApprovalResumed`, then closed by `ApprovalOutcomeRecorded`.

Operator mapping note: the Operator surface may request grant, deny, or park. `requestedScope` is the
typed `PolicyGrantScope` enum on `ApprovalRequest`, never a free string; the recorded Operator
decision event id rides `ApprovalDecisionInput.operatorDecisionEventId`; and park records
`ApprovalParked` and projects `parked`, not a `Decision` value.

Consumed interfaces: core-01 `RunWriter`, `RunReplay`, `RunProjections`, `RunLifecycleTransitioned`,
and `SessionLinked`; core-02 `CapabilityGateRecord` for `escalation-auto-grant` and
`orchestrator-decide`; fnd-01 `ResolvedPolicy.policy.approval` and
`ResolvedPolicy.policy.escalationPolicy`; fnd-02 `ArtifactStore`/`ArtifactRef` for persisting the
Agent prompt to `promptRef` before `normalize`; and Agent `AgentApprovalRequest`,
`ApprovalAnswerChannel`, `ApprovalAnswer`, `ScopedGrant`, and Agent capability attestations. If the
resolved policy, `ConfigResolved`, or field provenance is unavailable, classification and decision do
not run and the request records `approval-policy-unavailable`.

Construction & provenance. `normalize` copies `runId`, `taskId`, `operationId`, `sessionId`,
`policyRef`, `agentRequestEventId`, `requestedAt`, `promptRef`, and `worktreePath` from `ApprovalContext`
(`worktreePath` is the trusted `WorktreeLease.worktreePath` injected into context, **never** the
agent-supplied `cwd`); maps
`AgentApprovalRequest.kind` to `ApprovalSubject` via the table in `decision-model.md` (the
`protected-policy-change` subject is set from policy/changed-path context, which has no `kind`
antecedent); copies `command`/`cwd` from the request; and projects `answerChannelRef`,
`answerChannelPersistable`, and `expiresAt` from `input.answerChannel.{channelRef, persistable,
expiresAt}`. The append-side barrier events `ApprovalRequested`, `ApprovalPendingPersisted`, and
`ApprovalParked` are appended by the core-03 orchestration through `RunWriter`; their `recordedAt`/
`parkedAt` are caller-supplied (injected) append-time values, and every other field is sourced from
the normalized `ApprovalRequest`, the pending computation, or the `ParkDecision`.

Exposed interface: host-neutral `ApprovalRequest`, `Decision`, `Outcome`, failure states, and pure
classification/decision functions. `Decision.grant` is the approved Agent `ScopedGrant` shape passed
unchanged to `ApprovalAnswer.grant`; policy-level grant plans are mapped before the decision becomes
answerable. The Agent contract remains responsible for provider-specific transport mapping.

## Events & data

Emitted events use `domain = "core-03"` and the core-01 `RunEventEnvelope`.

- `ApprovalRequested` (`barrier`): normalized request, recorded before decision.
- `ApprovalPendingPersisted` (`barrier`): durable pending state and live answer deadline. Final
  expiry is computed from request `expiresAt` or `policy.approval.decisionWindowMs`.
- `ApprovalRiskClassified` (`durable`): deterministic risk result and triggered rule ids.
- `ApprovalDecisionRecorded` (`barrier`): policy, system, or Operator decision. For
  `ApprovalSubject = "protected-policy-change"`, this is the recorded Operator approval event that
  core-05's changed-file gate cites.
- `ApprovalParked` (`barrier`): request parked for attention or durable resume.
- `ApprovalResumed` (`barrier`): pending request resumed with grant pre-loaded.
- `ApprovalOutcomeRecorded` (`barrier`): answer, denial, expiry, block, or failure result, including
  `approval-policy-unavailable` and `approval-grant-mapping-invalid`.
- `ApprovalInputJudgmentRecorded` (`barrier`, future): optional recorded input for later LLM
  judgment; not evaluated in v1 and never replayable logic.

V1 event payloads are:

```ts
interface ApprovalRequestedPayload {
  schema: "kit-vnext.approval-requested.v1";
  request: ApprovalRequest;
  sourceAgentEventId: string;
  recordedAt: string;
}

interface ApprovalPendingPersistedPayload {
  schema: "kit-vnext.approval-pending-persisted.v1";
  requestId: string;
  runId: string;
  sessionId: string;
  answerChannelRef: string;
  answerChannelPersistable: boolean;
  liveAnswerDeadline?: string;
  decisionDeadline: string;
  policyRef: string;
  sourceRequestEventId: string;
  recordedAt: string;
}

interface ApprovalRiskClassifiedPayload {
  schema: "kit-vnext.approval-risk-classified.v1";
  requestId: string;
  risk: ApprovalRisk;
  triggeredRuleIds: string[];
  evidenceEventIds: string[];
  classifiedAt: string;
}

interface ApprovalDecisionRecordedPayload {
  schema: "kit-vnext.approval-decision-recorded.v1";
  decision: Decision;
  operatorDecisionEventId?: string;
  capabilityGateEventId?: string;
  sourceEventIds: string[];
  // Required iff the approval request `subject === "protected-policy-change"`. Carries the head and policy
  // identity the operator approval covers so core-05's changed-file gate can bind to it. The old
  // policy digest and the concrete changed protected paths are NOT duplicated here; they remain
  // authoritative on core-05 `ProtectedPolicySnapshotRecorded` and Workspace `LocalGitEvidence`,
  // referenced via `protectedPolicySnapshotEventId`.
  protectedPolicyBinding?: ProtectedPolicyApprovalBinding;
}

interface ProtectedPolicyApprovalBinding {
  runId: string;
  candidateHeadSha: string;
  protectedPolicySnapshotEventId: string;
  newPolicyDigest?: string;
}

interface ApprovalParkedPayload {
  schema: "kit-vnext.approval-parked.v1";
  requestId: string;
  runId: string;
  sessionId: string;
  reason: "live-window-elapsed" | "live-only-channel" | "operator-attention";
  decisionDeadline: string;
  parkedAt: string;
  sourceEventIds: string[];
}

interface ApprovalResumedPayload {
  schema: "kit-vnext.approval-resumed.v1";
  requestId: string;
  runId: string;
  sessionId: string;
  decisionEventId: string;
  grant: ScopedGrant;
  resumedAt: string;
  sourceEventIds: string[];
}

interface ApprovalOutcomeRecordedPayload {
  schema: "kit-vnext.approval-outcome-recorded.v1";
  outcome: Outcome;
  sourceEventIds: string[];
}
```

Consumed events: `AgentApprovalRequested`, `AgentApprovalAnswered`, `AgentSessionLinked`,
`AgentObservationDegraded`, `CapabilityAttestation`, `CapabilityGateRecord`,
`RunLifecycleTransitioned`, `SessionLinked`, `SessionLinkSuperseded`, `ConfigResolved`, and Operator
decision events from the Operator surface.

Contributed projections: pending approvals by `requestId`, latest decision/outcome, current
operator-attention reason, and approval failure state. Projections are pure folds over the Event log.

```ts
interface PendingApprovalProjection {
  requestId: string;
  runId: string;
  sessionId: string;
  state: ApprovalState;
  requestEventId: string;
  pendingEventId: string;
  latestDecisionEventId?: string;
  latestOutcomeEventId?: string;
  parkedEventId?: string;
  resumedEventId?: string;
  answerChannelRef: string;
  answerChannelPersistable: boolean;
  liveAnswerDeadline?: string;
  decisionDeadline: string;
  policyRef: string;
  failureState?: ApprovalFailureState;
}

interface ApprovalProjection {
  runId: string;
  pendingByRequestId: Record<string, PendingApprovalProjection>;
  latestDecisionByRequestId: Record<string, Decision>;
  latestOutcomeByRequestId: Record<string, Outcome>;
  operatorAttention?: {
    requestId: string;
    reason: "human-required" | "parked";
    sourceEventId: string;
  };
  failureStateByRequestId: Record<string, ApprovalFailureState>;
}
```

## Testing strategy

NFR-TEST is met with a deterministic in-memory core-01 Run log, fake fnd-01 resolved policies, mock
Agent contract events, and mock core-02 gate records. Tests use zero real processes, network, Forge,
Work Source, Execution Host, filesystem, or concrete Driver behavior.

Required tests:

- table tests for low/medium/high risk classification, including all high-risk escalation rules;
- property tests proving `decide(request, policy, mode, rules)` is deterministic for replayed inputs;
- mode-ladder tests for manual, assisted allowlist, high-risk human escalation, and deferred
  `orchestrator-decide`;
- scoped-grant minimization tests for `per-command`, `per-command-prefix`, `per-host`, and `session`,
  plus denial-disposition mapping tests that prove `Decision.grant` is an Agent `ScopedGrant`
  accepted by `ApprovalAnswer.grant`, and invalid mappings fail closed as
  `approval-grant-mapping-invalid`;
- park/resume tests for process death, human latency, live-only channels, persisted channels, expired
  requests, request `expiresAt` precedence over `approval.decisionWindowMs`, live-window park before
  final expiry, and pre-loaded grants;
- fail-closed tests for missing resolved policy/provenance, missing capability, missing Agent relay,
  ambiguous ownership/session linkage, unwritable Event log, stale/negative attestations,
  gate-record append failure, invalid grant mapping, and expired pending request;
- replay tests proving request, decision, and outcome projections rebuild identically.

This satisfies FR-4 by relaying approvals through durable request/decision/outcome records,
NFR-SAFE by failing closed to named states when guarantees are unavailable, NFR-DET by making every
decision a pure function of recorded evidence, and NFR-TEST by using mocks only.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Approval & Escalation](./README.md) · **← Prev:** [Approval & Escalation - park resume and failures](./park-resume-and-failures.md) · **Next →:** [Supervision & Liveness](../supervision-and-liveness/README.md)

<!-- /DOCS-NAV -->
