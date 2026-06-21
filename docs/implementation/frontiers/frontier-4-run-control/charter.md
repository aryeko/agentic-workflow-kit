---
title: "Frontier 4 charter - run control"
frontier: 4
status: draft
last-reviewed: "2026-06-20"
included-domains:
  - core-03-approval-and-escalation
  - core-04-supervision-and-liveness
---

# Frontier 4 charter - run control

## Purpose

Frontier 4 defines the implementation contract for controlling an active Run: approval decisions enter as
durable recorded facts, and worker liveness is proven only from current-session worker events. The
frontier turns Agent and capability foundations from Frontier 3 into safe run-control behavior without
implementing completion, recovery, merge, or operator UI.

This charter defines what the frontier must deliver. It does not define execution workflow.

## Included domains

| Domain | Role in this frontier | Spec basis |
|---|---|---|
| `core-03` Approval & Escalation | Normalize, classify, decide, park, resume, and record approval outcomes. | `docs/design/30-domain-reference/core/approval-and-escalation/` |
| `core-04` Supervision & Liveness | Determine real progress, timers, liveness states, wait primitive, and termination handoff. | `docs/design/30-domain-reference/core/supervision-and-liveness/` |

Package target: contracts and control-plane logic belong in `packages/sdk`; executable rendering and
CLI/MCP command surfaces are not part of this frontier.

## Why this frontier exists

Later completion and recovery logic is unsafe unless the system can first answer two questions from
recorded evidence:

- was a worker escalation recorded, bounded, decided, and answered or parked without widening scope;
- is the worker actually active, waiting, stale, lost, or terminated.

Frontier 4 creates that run-control layer. It consumes Agent events and capability gate records but does
not gather provider evidence directly.

## Dependencies and frozen inputs

Frozen inputs for Frontier 4:

- Frontier 3 Agent event, capability attestation, `CapabilityGateRecord`, and analysis contracts;
- approved `core-01` event-log, lifecycle, session-linkage, cursor, writer, and projection contracts;
- approved `fnd-01` resolved approval/escalation policy inputs;
- approved Agent `AgentApprovalRequest`, `ApprovalAnswer`, `ScopedGrant`, answer-channel, and resume
  capability contracts;
- approved Execution Host termination contract for liveness handoff.

The frontier must not depend on Codex enums, Local driver behavior, external polling, or provider clients.

## Outputs

Frontier 4 is expected to produce:

- neutral `ApprovalRequest`, `Decision`, `Outcome`, risk, state, subject, grant-plan, and failure
  types;
- deterministic risk classification and v1 mode ladder for `manual` and `assisted`;
- durable `ApprovalPendingPersisted`, `ApprovalDecisionRecorded`, `ApprovalParked`,
  `ApprovalResumed`, and `ApprovalOutcomeRecorded` semantics;
- mapping from policy-level grant plans to Agent `ScopedGrant` values, with invalid mappings blocked;
- liveness reducer, liveness projection, timer policy, wait request/response contract, and
  supervision event payloads;
- termination handoff contract from stale owned worker to Execution Host;
- tests proving no parent poll, wait response, projection read, lifecycle-only transition, Operator
  decision, runner command, Forge event, Work Source event, or raw host output refreshes liveness.

## Scope Boundaries

In scope:

- approval request normalization, classification, decision, park/resume state, and audit facts;
- liveness states, timer expiry records, supervision-lost records, and termination request records;
- pure replay/projection behavior with explicit clock inputs;
- mock Agent and mock Execution Host behavior sufficient for core tests.

Out of scope:

- concrete Agent transport, Codex driver mapping, or provider request catching/answering mechanics;
- physical process signalling, kill, reap, or containment implementation;
- merge, completion, recovery, Work Source status writes, Forge operations, and operator command UI;
- external notification delivery and human-facing rendering.

STOP if a story requires liveness to be refreshed from anything other than current-session Agent
worker events, requires core-03 to import a concrete Agent driver, or allows an approval request to
continue without a recorded pending fact.

## Per-domain responsibilities

### core-03 Approval & Escalation

Deliver a pure decision model: `normalize -> persist pending -> classify -> decide -> answer or park
-> record outcome`. Request and pending state must be recorded before decision. High risk always
requires a human. Assisted auto-grant is limited to low-risk policy allowlist matches and requires a
committed `escalation-auto-grant` gate.

Grant selection must choose the tightest scope and map to the Agent `ScopedGrant` shape before
answering. If mapping would widen scope, the result is blocked. `deny` and `park` are dispositions,
not grant scopes.

Park/resume must survive human latency and process death through recorded pending state. Resume
requires owned session linkage, non-expired request, fresh Agent relay/resume attestations, and
answer-channel persistence when the channel must survive park/resume.

### core-04 Supervision & Liveness

Deliver liveness as a pure fold over committed Run events plus explicit clock input. Only
current-session Agent startup linkage, progress, structured tool completion, approval request, and
terminal observation affect liveness. Read-side observation is inert.

Timers must cover startup, idle, no-progress, per-tool, approval-SLA, and max-runtime with policy
overrides. `waitRunEvents` delegates to core-01 cursor waiting and must never renew leases, append
events, refresh liveness, or prove worker health.

Termination is a handoff to Execution Host. Core-04 records request/proof facts; it does not signal
or kill processes directly. `WorkerTerminated` must be recorded before terminal lifecycle closure or
in the same barrier batch; `SupervisorStopped` is the single permitted post-terminal summary fact.

## Failure and degraded outcome contract

| Condition | Required outcome |
|---|---|
| Approval request or pending state cannot be appended. | Block; do not decide or answer. |
| Resolved policy, provenance, Agent relay, session ownership, or grant mapping is missing. | Fail closed to a named approval failure state. |
| High-risk approval in any mode. | Human required; no assisted auto-grant. |
| Live answer window expires or answer channel is live-only. | Park when recovery or human input can proceed; otherwise block/expire by policy. |
| Missing event cursor or ambiguous session linkage. | `supervision-lost`; autonomous capabilities absent. |
| Tool item cannot be correlated to current session. | `tool-tracking-unavailable`; broader timers remain active. |
| Stale owned worker but termination capability or proof is unavailable. | `supervision-lost`, not active or terminated. |
| Post-terminal supervision append attempted for anything except `SupervisorStopped`. | Invalid; story must stop and repair the contract. |

## Evidence expectations

Each story must include:

- spec-surface manifest naming request/decision/outcome, liveness, timer, wait, and event payloads
  touched;
- falsifiable acceptance criteria for every approval state and liveness state;
- failure/degraded outcome table covering missing policy, stale attestations, ambiguous session,
  expired approval, missing cursor, stale worker, and termination uncertainty;
- required evidence from deterministic tests, replay fixtures, and mock Agent/Host scenarios;
- explicit boundaries proving no concrete provider imports and no read-side liveness refresh.

## Readiness criteria

Frontier 4 is ready for Frontier 5 when:

- approval request, decision, park/resume, and outcome projections rebuild from the Event log;
- assisted low-risk grants cannot proceed without a committed core-02 gate record;
- every approval request is pending-recorded before classification or answer;
- liveness projections are deterministic from recorded worker events plus clock input;
- wait behavior is proven inert for liveness;
- stale/lost/terminated supervision states are distinguishable from active worker progress;
- termination handoff is represented through Execution Host contract evidence only.

## Expected story files to author next

- `docs/implementation/frontiers/frontier-4-run-control/stories/core-03-approval-decision-model.md`
- `docs/implementation/frontiers/frontier-4-run-control/stories/core-03-park-resume-state.md`
- `docs/implementation/frontiers/frontier-4-run-control/stories/core-03-scoped-grant-mapping.md`
- `docs/implementation/frontiers/frontier-4-run-control/stories/core-04-liveness-reducer.md`
- `docs/implementation/frontiers/frontier-4-run-control/stories/core-04-wait-primitive.md`
- `docs/implementation/frontiers/frontier-4-run-control/stories/core-04-termination-handoff.md`

## Deferred work

- Operator-facing approval commands and attention rendering are Frontier 6.
- Completion, merge, post-merge settlement, recovery classification, and duplicate launch
  coordination are Frontier 5.
- Concrete timeout defaults may remain policy-owned until implementation stories bind them.
- The "decision delivered but not consumed" timer remains open unless a later story accepts the
  current idle/no-progress coverage.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../../README.md) · **← Prev:** [Frontier 3 charter - agent and core gates](../frontier-3-agent-and-core-gates/charter.md) · **Next →:** [Frontier 5 charter - completion and recovery](../frontier-5-completion-and-recovery/charter.md)

<!-- /DOCS-NAV -->
