---
title: "Operator & Entry Surface - attention, explainability, and triggers"
status: approved
last-reviewed: "2026-06-19"
---

# Attention, explainability, and triggers

## Outbound attention

Attention is a rendered view over recorded Control plane facts:

`EvidenceEventRef` is imported from core-01 Run Lifecycle & Event State. Edge-owned
`OperatorEventRef` remains a separate reference for `OperatorActionRecorded` audit events.

```ts
type AttentionKind =
  | "approval-needed" | "needs-operator" | "approval-overdue" | "worker-stale"
  | "supervision-lost" | "recovery-parked" | "blocked" | "analysis-issue";

interface AttentionNotice {
  schema: "kit-vnext.attention-notice.v1";
  attentionId: string;
  runId: string;
  taskId?: string;
  kind: AttentionKind;
  severity: "attention" | "blocked" | "failed";
  sourceEventRef: EvidenceEventRef;
  summary: string;
  availableActions: OperatorActionKind[];
  firstSeenAt: string;
}
```

Sources include `ApprovalParked`, `ApprovalDecisionRecorded(human-required)`,
`LivenessStateChanged(approval_overdue|stale|supervision_lost)`, `SupervisionLost`,
`ReconciliationBlocked`, terminal `blocked` lifecycle transitions, and `AnalysisRecorded` issues with
operator-facing severity. The Control plane constructs notices from replay/projections; the edge only
renders them.

MCP delivery uses session notifications while a tool call or watch is active. CLI delivery prints
notices during `workflow run wait`, after commands that return parked/blocked states, and in command
exit summaries. Delivery failure is local and non-authoritative. Acknowledgement is an Operator
action through `acknowledgeAttention`; it records one `OperatorActionRecorded` event and does not
clear the underlying approval, liveness, recovery, or blocked state.

## Approval decision path

1. Core-03 records a pending approval and, when needed, an attention source event such as
   `ApprovalParked` or `ApprovalDecisionRecorded(human-required)`.
2. The edge renders an `AttentionNotice` with `workflow_decide_approval` /
   `workflow approval decide` as an available action.
3. The Operator submits one `ApprovalDecisionParams` envelope with OS-user identity, request id,
   decision, `PolicyGrantScope` (`per-command`, `per-command-prefix`, `per-host`, or `session`) when
   granting, and reason. `deny` and `park` are decision dispositions, not grant scopes.
4. The Control plane appends one `OperatorActionRecorded(actionKind = "approval-decision")` event.
5. Core-03 consumes that event id as recorded Operator input, validates it against request risk and
   policy, and appends its own decision/outcome facts.
6. The edge renders the returned result. It does not answer the Agent channel directly.

The same pattern covers protected-policy approval or profile override input: the edge records only the
Operator action through the Control plane, and the owning core/foundation logic decides whether that
input can satisfy a gate.

## Explainability

`workflow_explain` / `workflow explain` asks the Control plane to produce an `ExplanationView` from
recorded evidence:

```ts
interface ExplanationView {
  schema: "kit-vnext.explanation.v1";
  runId: string;
  question: string;
  answer: "did" | "did-not" | "unknown";
  summary: string;
  primaryEventRefs: EvidenceEventRef[];
  gateRecordRefs: EvidenceEventRef[];
  decisionRefs: EvidenceEventRef[];
  analysisRefs: EvidenceEventRef[];
  missingEvidence: string[];
}
```

For "why did X happen", the Control plane traces from the action or terminal event through
`causationId`, `sourceEventIds`, `CapabilityGateRecord`, completion/merge/recovery/approval decision
records, provider evidence refs, and any `AnalysisRecorded` report refs. For "why didn't X happen",
it returns the latest recorded deny, blocked, parked, stale, or missing-evidence reason in stable
failure order. If the log, projections, or cited artifacts are degraded, the answer is `unknown` with
`missingEvidence`; the edge must not synthesize a likely reason.

The edge may format the explanation as a short answer, table, or JSON, but every claim must cite a
recorded event or artifact ref returned by the Control plane.

## Deferred external triggers

External triggers are not implemented in v1. The future model is intentionally constrained:

- A trigger adapter authenticates and normalizes a webhook, scheduler event, or local automation into
  `OperatorCommandEnvelope<T>` with `surface = "external-trigger"` and an actor kind owned by the
  future trigger-auth design.
- The adapter calls the same `OperatorControlPort` method that MCP and CLI use. It never calls core
  domains, providers, Drivers, storage, or Work Source directly.
- Accepted trigger actions receive the same one `OperatorActionRecorded` audit event and the same
  idempotency semantics as human Operator commands.
- Trigger auth, replay defense, rate limits, allowed action kinds, and notification routing are
  deferred. Until those contracts exist, v1 returns `external-trigger-deferred` for trigger entry.

This preserves the Dependency Rule and keeps external automation from becoming a second, less-audited
control path.
