---
title: kit-vnext — human control and approvals
status: high-level design
last-reviewed: "2026-06-19"
---

# Human control and approvals

The Operator is a first-class participant in every run, not an emergency fallback. Workers
escalate requests through the Agent seam; the Control plane adjudicates them; high-risk requests
always reach a human.

```mermaid
sequenceDiagram
  participant AG as Agent
  participant SDK as Control plane (SDK)
  actor OP as Operator

  AG->>SDK: AgentApprovalRequest
  SDK->>SDK: normalize to ApprovalRequest; append to run log (barrier)
  SDK->>SDK: classify risk (low / medium / high)
  alt low-risk assisted allowlist
    SDK->>SDK: evaluate escalation-auto-grant capability gate
    SDK->>AG: ApprovalAnswer (scoped grant)
  else high-risk or manual mode or policy requires Operator
    SDK->>SDK: append ApprovalParked if live window elapses
    SDK-->>OP: attention needed
    OP->>SDK: recorded human decision
    SDK->>AG: ApprovalAnswer (scoped grant or denial)
  end
  SDK->>SDK: append ApprovalOutcomeRecorded
```

## Request and decision model

Every approval request is recorded as an event in the run log before any classification or
decision occurs. This means the request survives process death and human latency: recovery can
resume from the event log and answer the parked approval when the Operator responds.

The adjudication path:

1. Normalize the provider-specific escalation into a host-neutral `ApprovalRequest`.
2. Append `ApprovalRequested` + `ApprovalPendingPersisted` at barrier durability.
3. Classify risk deterministically from recorded evidence and resolved policy: low, medium, or
   high.
4. Apply the mode ladder. In v1, `manual` and `assisted` are supported. `auto` and LLM
   adjudication are deferred.
5. For assisted low-risk allowlist matches, evaluate the `escalation-auto-grant` capability gate
   (core-02). For all other cases, the request parks until the Operator records a decision.
6. Select the tightest scoped grant that suffices: `per-command`, `per-command-prefix`,
   `per-host`, or `session`. Denial is not a scope.
7. Answer the Agent and record the outcome.

High-risk requests always escalate to the Operator regardless of mode.

## Park and resume

When the live answer window elapses before a decision is recorded, the run transitions to a
`parked` lifecycle state. The pending approval is durable in the run log. When the Operator later
records a decision, the Control plane resumes the owned Agent session with the grant pre-loaded.
The Agent is not re-driven from scratch; the session is resumed in place.

## Authoritative reference

The complete decision model — `ApprovalRequest`, `Decision`, and `Outcome` types; risk
classification rules; the mode ladder; scoped-grant taxonomy; park/resume events and invariants;
fail-closed states — is in:

[Approval & Escalation](../30-domain-reference/core/approval-and-escalation/README.md) (core-03)
