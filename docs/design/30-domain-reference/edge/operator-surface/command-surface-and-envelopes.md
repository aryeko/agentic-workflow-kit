---
title: "Operator & Entry Surface - command surface and envelopes"
status: approved
last-reviewed: "2026-06-19"
---

# Command surface and envelopes

## Command parity

All known MCP tools and CLI commands call exactly one `OperatorControlPort` method, even when
parameters, target fields, idempotency, or OS-user identity are invalid. The Control plane records
exactly one `OperatorActionRecorded` audit event for each action and returns its event ref when the
Run log is writable.

| Action kind | MCP tool | CLI command | Control plane call | Operator audit event |
|---|---|---|---|---|
| `preview-run` | `workflow_preview_run` | `workflow run preview` | `previewRun` | `OperatorActionRecorded` |
| `start-run` | `workflow_start_run` | `workflow run start` | `startRun` | `OperatorActionRecorded` |
| `inspect-run` | `workflow_inspect_run` | `workflow run inspect` | `inspectRun` | `OperatorActionRecorded` |
| `wait-run` | `workflow_wait_run` | `workflow run wait` | `waitRun` | `OperatorActionRecorded` |
| `approval-decision` | `workflow_decide_approval` | `workflow approval decide` | `decideApproval` | `OperatorActionRecorded` |
| `stop-run` | `workflow_stop_run` | `workflow run stop` | `stopRun` | `OperatorActionRecorded` |
| `handoff-run` | `workflow_handoff_run` | `workflow run handoff` | `handoffRun` | `OperatorActionRecorded` |
| `override-field` | `workflow_override_field` | `workflow policy override-field` | `overrideProfileField` | `OperatorActionRecorded` |
| `request-recovery` | `workflow_request_recovery` | `workflow run recover` | `requestRecovery` | `OperatorActionRecorded` |
| `explain` | `workflow_explain` | `workflow explain` | `explain` | `OperatorActionRecorded` |
| `attention-ack` | `workflow_ack_attention` | `workflow attention ack` | `acknowledgeAttention` | `OperatorActionRecorded` |

The edge must not implement a command by calling multiple Control plane methods. If a command needs
several core-domain consequences, the Control plane coordinates those consequences after the single
edge call and cites the same Operator audit event.

`preview-run` and `start-run` do not require an input `runId`. The Control plane allocates the Run
identity before recording `OperatorActionRecorded`; if identity allocation or audit append fails, no
claim, worker launch, provider call, or dry-run projection is performed.

```ts
interface OperatorControlPort {
  previewRun(request: OperatorCommandEnvelope<PreviewRunParams>): OperatorCommandResult<PreviewRunView>;
  startRun(request: OperatorCommandEnvelope<StartRunParams>): OperatorCommandResult<RunStartedView>;
  inspectRun(request: OperatorCommandEnvelope<InspectRunParams>): OperatorCommandResult<RunInspectionView>;
  waitRun(request: OperatorCommandEnvelope<WaitRunParams>): OperatorCommandResult<WaitRunView>;
  decideApproval(request: OperatorCommandEnvelope<ApprovalDecisionParams>): OperatorCommandResult<ApprovalDecisionView>;
  stopRun(request: OperatorCommandEnvelope<StopRunParams>): OperatorCommandResult<StopRunView>;
  handoffRun(request: OperatorCommandEnvelope<HandoffRunParams>): OperatorCommandResult<HandoffRunView>;
  overrideProfileField(request: OperatorCommandEnvelope<OverrideFieldParams>): OperatorCommandResult<OverrideFieldView>;
  requestRecovery(request: OperatorCommandEnvelope<RecoveryRequestParams>): OperatorCommandResult<RecoveryPlanView>;
  explain(request: OperatorCommandEnvelope<ExplainParams>): OperatorCommandResult<ExplanationView>;
  acknowledgeAttention(request: OperatorCommandEnvelope<AttentionAckParams>): OperatorCommandResult<AttentionAckView>;
}
```

## Request envelope

```ts
type OperatorSurface = "mcp" | "cli" | "external-trigger";
type OperatorActionKind =
  | "preview-run" | "start-run" | "inspect-run" | "wait-run"
  | "approval-decision" | "stop-run" | "handoff-run" | "override-field"
  | "request-recovery" | "explain" | "attention-ack";

type OperatorActorRef =
  | OsUserOperatorActorRef
  | UnavailableOsUserOperatorActorRef
  | DeferredExternalTriggerActorRef;

interface OsUserOperatorActorRef {
  schema: "kit-vnext.operator-actor.v1";
  kind: "os-user";
  username: string;
  uid?: number;
  gid?: number;
  groups?: string[];
  hostname: string;
  processId: number;
  terminalRef?: string;
  surfaceClient: "mcp" | "cli";
  resolvedAt: string;
  identityConfidence: "verified-os" | "unverified";
}

interface DeferredExternalTriggerActorRef {
  schema: "kit-vnext.operator-actor.v1";
  kind: "external-trigger";
  principalRef: string;
  authEvidenceRef?: string;
  resolvedAt: string;
  identityConfidence: "unverified";
}

interface UnavailableOsUserOperatorActorRef {
  schema: "kit-vnext.operator-actor.v1";
  kind: "os-user-unavailable";
  hostname: string;
  processId: number;
  terminalRef?: string;
  surfaceClient: "mcp" | "cli";
  resolvedAt: string;
  failureReason: "lookup-failed" | "permission-denied" | "ambiguous";
  identityConfidence: "unverified";
}

interface OperatorCommandTarget {
  runId?: string;
  taskId?: string;
  trackId?: string;
  approvalRequestId?: string;
  attentionId?: string;
}

interface OperatorCommandEnvelope<TParams> {
  schema: "kit-vnext.operator-command.v1";
  actionId: string;
  actionKind: OperatorActionKind;
  commandName: string;
  surface: OperatorSurface;
  actor: OperatorActorRef;
  target: OperatorCommandTarget;
  params: TParams;
  paramsDigest: string;
  idempotencyKey: string;
  requestedAt: string;
  reason?: string;
  correlationId?: string;
  dryRun?: boolean;
  envelopeErrors?: OperatorEnvelopeError[];
}
```

`paramsDigest` is a canonical digest of the redacted command parameters. Secret-bearing values,
prompt text, raw command output, and provider response bodies are never stored in the envelope. MCP
and CLI must produce the same envelope bytes for the same logical command, except for `surface`,
`surfaceClient`, terminal/process fields, and `requestedAt`.

```ts
type OperatorEnvelopeErrorCode =
  | "params-invalid" | "target-invalid" | "idempotency-invalid"
  | "identity-unavailable" | "params-digest-unavailable";

interface OperatorEnvelopeError {
  code: OperatorEnvelopeErrorCode;
  field?: string;
  message: string;
}
```

The edge performs only transport parsing needed to identify the tool/command and build this envelope.
All validation failures are represented as `envelopeErrors` and sent to the matching Control plane
method, which records `OperatorActionRecorded(resultIntent = "reject")` and performs no domain action.
An unknown binary subcommand or unknown MCP tool is outside the Operator action set because it cannot
be mapped to a Control plane call.

## Response envelope

`OperatorEventRef` is edge-01's local reference to the Operator audit event. It is distinct from
core-01 `EvidenceEventRef`, which is imported where the edge cites arbitrary recorded evidence.

```ts
type OperatorCommandStatus = "completed" | "accepted" | "rejected" | "deferred";

interface OperatorEventRef {
  eventId: string;
  sequence: number;
  payloadDigest: string;
  type: "OperatorActionRecorded";
}

interface OperatorCommandError {
  code: string;
  message: string;
  evidenceRefs: OperatorEventRef[];
}

interface OperatorCommandResult<TView> {
  schema: "kit-vnext.operator-command-result.v1";
  actionId: string;
  status: OperatorCommandStatus;
  operatorEventRef?: OperatorEventRef;
  runId?: string;
  cursor?: RunEventCursor;
  view?: TView;
  attention?: AttentionNotice[];
  explanation?: ExplanationView;
  errors: OperatorCommandError[];
}
```

An `accepted` result means the Control plane recorded the Operator action and queued or began the
domain consequence. A `completed` result means the synchronous consequence is also recorded. A
`rejected` result may still include an `operatorEventRef` when the rejection is run-scoped and the log
was writable. A `deferred` result is used for v1 external-trigger entry.

## Operator audit payload

`PolicyGrantScope` is imported from core-03 Approval & Escalation. Its values are
`"per-command" | "per-command-prefix" | "per-host" | "session"`; denial is a decision disposition,
not a grant scope.

```ts
interface OperatorActionRecordedPayload {
  schema: "kit-vnext.operator-action-recorded.v1";
  actionId: string;
  actionKind: OperatorActionKind;
  commandName: string;
  surface: OperatorSurface;
  actor: OperatorActorRef;
  target: OperatorCommandTarget;
  paramsDigest: string;
  idempotencyKey: string;
  requestedAt: string;
  acceptedAt: string;
  reasonDigest?: string;
  resultIntent: "read" | "mutate" | "reject" | "defer";
  envelopeErrors?: OperatorEnvelopeError[];
  approvalDecision?: {
    requestId: string;
    decision: "grant" | "deny" | "park";
    requestedScope?: PolicyGrantScope;
  };
  override?: {
    fieldKey: string;
    proposedValueDigest: string;
    expiresAt?: string;
  };
}
```

The Control plane appends this payload as `OperatorActionRecorded` with `barrier` durability. The
edge constructs envelope input but never writes this payload to the Event log.

## Command parameters

Parameter shapes stay intent-level and host-neutral:

- `PreviewRunParams`: Work Source selector, track/task filters, profile name, and `dryRun = true`.
- `StartRunParams`: Work Source selector, track/task id or "next eligible", profile name, and
  optional concurrency/idempotency keys.
- `InspectRunParams`: run id, view selectors (`state`, `events`, `approvals`, `gates`, `analysis`),
  cursor, and limit.
- `WaitRunParams`: run id, cursor, timeout, and attention filters. This delegates to Control plane
  wait semantics and never refreshes liveness.
- `ApprovalDecisionParams`: approval request id, decision (`grant`, `deny`, or `park`), requested
  `PolicyGrantScope` (`per-command`, `per-command-prefix`, `per-host`, or `session`) for grants,
  optional grant bounds, and Operator reason. `deny` and `park` are decision dispositions and never
  scopes.
- `StopRunParams`: run id, stop intent (`cancel`, `terminate-owned-worker`, or `park`), and reason.
- `HandoffRunParams`: run id, target Operator/session reference, scope, and reason.
- `OverrideFieldParams`: run id, profile or protected-policy field key, proposed value digest,
  expiry, and reason.
- `RecoveryRequestParams`: run id, requested recovery action, scope, and reason.
- `ExplainParams`: run id, question kind (`did`, `did-not`, `gate`, `approval`, `merge`,
  `recovery`, or `attention`), optional action/gate/event id, and verbosity.
- `AttentionAckParams`: run id, attention id, acknowledgement reason, and optional snooze-until.

The edge validates only enough transport shape to identify the command and produce a redacted
envelope. It does not locally reject known Operator actions for bad parameters or identity lookup
failure, and it does not classify risk, inspect capabilities, evaluate policy, decide recovery, or
infer completion.
