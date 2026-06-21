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
    projections: RunProjections): ApprovalRisk;
  decide(input: ApprovalDecisionInput): Decision;
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
```

Operator mapping note: the Operator surface may request grant, deny, or park. `requestedScope` is the
typed `PolicyGrantScope` enum on `ApprovalRequest`, never a free string; the recorded Operator
decision event id rides `ApprovalDecisionInput.operatorDecisionEventId`; and park records
`ApprovalParked` and projects `parked`, not a `Decision` value.

Consumed interfaces: core-01 `RunWriter`, `RunReplay`, `RunProjections`, `RunLifecycleTransitioned`,
and `SessionLinked`; core-02 `CapabilityGateRecord` for `escalation-auto-grant` and
`orchestrator-decide`; fnd-01 `ResolvedPolicy.policy.approval` and
`ResolvedPolicy.policy.escalationPolicy`; and Agent `AgentApprovalRequest`, `ApprovalAnswerChannel`,
`ApprovalAnswer`, `ScopedGrant`, and Agent capability attestations. If the resolved policy,
`ConfigResolved`, or field provenance is unavailable, classification and decision do not run and the
request records `approval-policy-unavailable`.

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

Consumed events: `AgentApprovalRequested`, `AgentApprovalAnswered`, `AgentSessionLinked`,
`AgentObservationDegraded`, `CapabilityAttestation`, `CapabilityGateRecord`,
`RunLifecycleTransitioned`, `SessionLinked`, `SessionLinkSuperseded`, `ConfigResolved`, and Operator
decision events from the Operator surface.

Contributed projections: pending approvals by `requestId`, latest decision/outcome, current
operator-attention reason, and approval failure state. Projections are pure folds over the Event log.

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
