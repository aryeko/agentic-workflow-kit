---
title: "Approval & Escalation - decision model"
status: approved
last-reviewed: "2026-06-19"
---

# Decision model

## Neutral shapes

```ts
type ApprovalMode = "manual" | "assisted";
type ApprovalRisk = "low" | "medium" | "high";
type ApprovalState =
  | "pending" | "auto-granted" | "human-required" | "answered" | "denied"
  | "parked" | "resumed" | "expired" | "blocked" | "failed";
type ApprovalSubject =
  | "command" | "file-change" | "permission" | "network" | "input"
  | "protected-policy-change" | "other";
type PolicyGrantScope = "per-command" | "per-command-prefix" | "per-host" | "session";
// Import ScopedGrant and ScopedGrantKind from prov-01 Agent Execution
// contracts-and-conformance.md.
// ScopedGrant.scope is "request" | "turn" | "session".

interface ApprovalRequest {
  schema: "kit-vnext.approval-request.v1";
  requestId: string;
  runId: string;
  taskId: string;
  sessionId: string;
  operationId: string;
  subject: ApprovalSubject;
  promptRef: string;
  command?: string;
  cwd?: string;
  host?: string;
  filePaths?: string[];
  requestedScope?: PolicyGrantScope;
  answerChannelRef: string;
  answerChannelPersistable: boolean;
  requestedAt: string;
  expiresAt?: string;
  policyRef: string;
  agentRequestEventId: string;
}

interface PolicyGrantPlan {
  grantId: string;
  scope: PolicyGrantScope;
  command?: string;
  commandPrefix?: string[];
  host?: string;
  sessionId?: string;
  expiresAt?: string;
  reason: string;
}

interface Decision {
  schema: "kit-vnext.approval-decision.v1";
  decisionId: string;
  requestId: string;
  risk: ApprovalRisk;
  mode: ApprovalMode;
  decision: "grant" | "deny" | "human-required" | "expired" | "blocked";
  policyGrantPlan?: PolicyGrantPlan;
  grant?: ScopedGrant;
  deniedScope?: PolicyGrantScope;
  decidedBy: "policy" | "operator" | "system";
  sourceEventIds: string[];
  capabilityGateEventId?: string;
  policyRef: string;
  reason: string;
  decidedAt: string;
}

interface Outcome {
  schema: "kit-vnext.approval-outcome.v1";
  outcomeId: string;
  requestId: string;
  decisionId: string;
  outcome: "answered" | "denied" | "parked" | "resumed" | "expired" | "blocked" | "failed";
  agentAnswerEventId?: string;
  lifecycleEventId?: string;
  failureState?: ApprovalFailureState;
  recordedAt: string;
}
```

## Deterministic risk classification

Risk is the maximum triggered rule. Rules are evaluated in this stable order: high, then medium, then
low. The classifier is a pure function of `ApprovalRequest`, resolved policy, recorded Agent
capability attestations, and recorded request evidence.

High risk:

- requested scope is `session` or broader than `EscalationPolicy.maxGrantScope`;
- request asks for a host grant and the host is absent, wildcarded, local metadata, private network,
  or not in a policy allowlist;
- command is absent for a command subject, contains shell control flow, redirection, command
  substitution, environment mutation, privilege escalation, interpreter inline code, destructive file
  operations outside the workspace, or credential/secret access terms;
- file paths are absolute outside the workspace, unresolved, or include config, credential, or system
  locations not explicitly allowed by policy;
- the Agent relay, session linkage, answer channel, or ownership data is missing or ambiguous;
- request evidence is malformed, contradictory, self-report-only, or cannot be tied to the owned
  session.

Medium risk:

- subject is `file-change`, `permission`, `network`, or `other` but does not trigger a high rule;
- command subject has an exact command but no policy prefix match;
- requested grant is `per-command-prefix` and the prefix is policy-allowed but not immutable built-in;
- answer channel is live-only, so human latency would require Park / resume;
- policy requires an Operator for the matching grant rule.

Low risk:

- subject is `command`;
- command is exact, cwd is inside the workspace, no high pattern is present, and it matches a
  resolved policy `grantRules` prefix;
- requested grant is no broader than `per-command` or policy-bounded `per-command-prefix`;
- Agent `canRelayApproval` is freshly positive, and `canPersistApprovalAnswerChannel` is positive
  whenever the request may park;
- all evidence is recorded, unambiguous, and tied to the current `SessionLinked` projection.

High risk always escalates to a human regardless of mode. If no low rule fully matches, the minimum
risk is `medium`.

## Mode ladder and scoped grant taxonomy

V1 modes are `manual` and `assisted`. `auto` and LLM adjudication are deferred by AD-14.
`orchestrator-decide` is evaluated only to record a deny with `capability-deferred`; a later LLM
judgment, if introduced, must be an input event referenced by a deterministic decision and never
replayable logic.

The v1 ladder is:

1. Persist `ApprovalRequested` and `ApprovalPendingPersisted` at `barrier` durability.
2. Classify risk. High risk returns `human-required`.
3. Apply resolved policy allowlist. In `manual`, this records the policy match but still requires an
   Operator decision. In `assisted`, low-risk allowlisted requests may proceed to the
   `escalation-auto-grant` gate.
4. Evaluate `escalation-auto-grant` through core-02. If the committed gate record allows, answer with
   the tightest grant. If it denies or cannot be recorded, require a human or block with the named
   failure state.
5. For human decisions, record the Operator input as an event, validate it against the request risk
   and maximum allowed scope, then answer, deny, or park.

Grant taxonomy:

- `per-command`: one exact command string for one request.
- `per-command-prefix`: one configured argv prefix plus bounded arguments; never a shell fragment.
- `per-host`: one exact host for one network permission; wildcard hosts are high risk and not
  auto-grantable.
- `session`: bounded to the current `sessionId` and only after human approval in v1.

The selected grant must be no broader than the request, no broader than policy, and no broader than
the minimum needed for the subject. When several scopes could satisfy a request, choose the earliest
scope in this order: `per-command`, `per-command-prefix`, `per-host`, `session`; otherwise deny.
Denial is not a `PolicyGrantScope`; it is a `Decision.decision = "deny"` disposition with continue,
interrupt, or park semantics chosen by Agent contract capabilities and policy.

`PolicyGrantPlan.scope` is the policy-level taxonomy. `Decision.grant` is always the Agent contract
grant shape passed to `ApprovalAnswer.grant`; core-03 never sends `PolicyGrantScope` values to the
Agent contract. The mapping is deterministic:

| Policy scope or decision disposition | Agent `ScopedGrant.kind` | Agent `ScopedGrant.scope` | Required fields |
|---|---|---|---|
| `per-command` | `command-once` | `request` | exact `command` |
| `per-command-prefix` | `command-policy-amendment` | `turn` | `commandPrefix` from policy |
| `per-host` | `network-permission` | `turn` | exact `networkHost`, `networkAction = "allow"` |
| `session` for command | `command-session` | `session` | exact `command` or policy prefix, `sessionId` evidence |
| `session` for file change | `file-change-session` | `session` | bounded file paths |
| `deny` disposition, continue | `deny-continue` | `request` | denial reason in `content` |
| `deny` disposition, interrupt | `deny-interrupt` | `request` | denial reason in `content` |
| `deny` disposition, park | `deny-park` | `request` | denial reason in `content` |

If a policy-level scope cannot map to an Agent `ScopedGrant` without widening the scope, the decision
is `blocked` with `approval-grant-mapping-invalid`. The `grantEventId` field is populated from the
committed `ApprovalDecisionRecorded` event id before calling Agent `answerApproval`, so the
`ApprovalAnswer` implementation path is `Decision.grant -> ApprovalAnswer.grant` with no shape
conversion at the Agent boundary.
