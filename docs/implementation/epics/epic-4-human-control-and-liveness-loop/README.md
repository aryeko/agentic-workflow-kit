---
title: Epic 4 - Human control and liveness loop
epic: 4
status: "epic: ready"
depends-on-epics: [2, 3]
last-reviewed: "2026-06-25"
---

# Epic 4 - Human Control and Liveness Loop

## Purpose

Epic 4 makes human supervision and worker liveness deterministic: approval requests can be recorded,
parked, resumed, denied, or answered through policy and gates, and worker progress can be folded into
liveness facts with timer-driven termination handoff through SDK ports and testkit mocks.

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|
| `core-03` Approval & Escalation | Provides the approval relay decision model and durable human-control facts. | Approval request, decision, risk, grant, pending, parked, resumed, expired, and fail-closed records. |
| `core-04` Supervision & Liveness | Provides liveness derivation, wait wrapping, supervision timers, and termination handoff facts. | Liveness folds, current-session event classes, timers, `waitRunEvents`, supervisor facts, and termination proof signals. |

## Why this epic exists

The SDK runtime can record and gate facts after Epic 3, but it still needs a deterministic human loop
and liveness loop before completion or recovery can safely judge a run. Epic 4 closes those controls
without deciding completion, merge, or recovery outcomes.

The hard dependency edge is owned by `epic-dag.md`: Epic 4 depends on Epic 2 and Epic 3, and Epic 5
consumes Epic 4 approval, liveness, and termination facts.

## Frozen inputs

- Epic 2 Agent and Execution Host provider ports, mocks, attestations, and conformance baseline.
- Epic 3 run event, projection, cursor, and capability gate surfaces.
- Epic 1 resolved approval, escalation, and capability policy shapes.
- `docs/implementation/domains/core/core-03-approval-and-escalation.md`.
- `docs/implementation/domains/core/core-04-supervision-and-liveness.md`.
- `docs/implementation/epic-dag.md` Epic 4 dependency edges.

## Outputs

- SDK approval relay surface for neutral approval requests, deterministic risk classification, mode
  ladder decisions, pending approval state, scoped grants, park/resume facts, and outcome audit
  records.
- SDK liveness fold surface over committed current-session events and explicit clock input.
- Supervision timer evaluation surface for startup, idle, no-progress, per-tool, approval-SLA, and
  max-runtime signals.
- `waitRunEvents` wrapper over the Epic 3 cursor primitive with cursor validation.
- Termination handoff surface through the Execution Host provider port, with durable supervision and
  termination facts.

## Scope boundaries

- In: approval relay decisions, risk classification, pending approval persistence, park/resume facts,
  scoped grant mapping, liveness derivation, supervision timers, wait wrapping, and termination
  handoff records.
- Out: concrete Agent or Local driver behavior, completion decisions, verification capture, merge
  readiness, recovery classification, operator UI rendering, and auto/LLM approval.
- STOP when: a story needs to judge task completion, select a recovery action, perform a concrete
  process kill, merge a branch, or implement an operator entry surface rather than core human-control
  and liveness facts.

## Per-domain expectations

For each included domain, the table lists the `Story Group Signals` this epic claims and the frozen
story owner from the Epic 4 DAG.

### `core-03` - Approval & Escalation

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Neutral `ApprovalRequest`, decision, outcome, and scoped-grant records. | `core-03-s1-approval-contracts`; `split(records behavior: core-03-s2-normalize-risk-decision, core-03-s3-pending-park-resume, core-03-s4-grants-outcomes)` | split(contract, behavior) |
| Deterministic low, medium, and high risk classification signals. | `core-03-s2-normalize-risk-decision` | covered |
| V1 mode ladder: policy allowlist to human, with high risk always requiring a human. | `core-03-s2-normalize-risk-decision` | covered |
| Pending approval persistence before decision. | `core-03-s3-pending-park-resume` | covered |
| Parked approval, resumed approval, and expired approval facts. | `core-03-s3-pending-park-resume` | covered |
| Mapping from policy-level grants to Agent-provider scoped grants. | `core-03-s4-grants-outcomes` | covered |
| Fail-closed states for missing policy, missing relay, ambiguous session linkage, expired requests, or unwritable event records. | `core-03-s1-approval-contracts`; `split(catalog: core-03-s1-approval-contracts, policy/risk/gate behavior: core-03-s2-normalize-risk-decision, pending/session/expiry/log behavior: core-03-s3-pending-park-resume, relay/channel/mapping/outcome behavior: core-03-s4-grants-outcomes)` | split(catalog, behavior) |

- Evidence expectation: Epic 4 stories leave replayable approval and grant facts that completion,
  recovery, and operator surfaces can inspect without provider-specific approval protocol behavior.

### `core-04` - Supervision & Liveness

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Liveness state fold over committed events and explicit clock input. | `core-04-s2-liveness-fold` | covered |
| Current-session event classes that advance liveness. | `core-04-s2-liveness-fold` | covered |
| Event classes that explicitly never refresh liveness. | `core-04-s2-liveness-fold` | covered |
| Startup, idle, no-progress, per-tool, approval-SLA, and max-runtime timer signals. | `core-04-s3-timers-wait` | covered |
| `waitRunEvents` wrapper behavior and cursor validation. | `core-04-s3-timers-wait` | covered |
| Supervisor start, liveness advanced, timer expired, supervision lost, termination requested, worker terminated, and supervisor stopped facts. | `core-04-s1-supervision-contracts`; `split(contract: core-04-s1-supervision-contracts, behavior: core-04-s4-termination-facts)` | split(contract, behavior) |
| Fail-closed signals for unavailable cursor, ambiguous session linkage, missing progress guarantee, stale workers, overdue approvals, or unproven termination. | `core-04-s1-supervision-contracts`; `split(catalog: core-04-s1-supervision-contracts, liveness behavior: core-04-s2-liveness-fold, timer/wait behavior: core-04-s3-timers-wait, termination behavior: core-04-s4-termination-facts)` | split(catalog, behavior) |

- Evidence expectation: Epic 4 stories leave liveness and termination-handoff facts that completion
  and recovery can consume without treating parent polling, process presence, or worker prose as
  proof of progress.

## Epic readiness

- Epic 5 can evaluate completion and recovery against durable approval, parked/resumed approval,
  liveness, supervision-lost, termination-requested, and worker-terminated facts.
- Epic 7 can expose pending approvals, wait status, liveness state, and resume controls through core
  read models without creating a second control path.
- Concrete drivers remain unnecessary for Epic 4; the Agent and Execution Host provider ports and
  testkit mocks are sufficient for story authoring.

## Deferred work

- Completion predicates, verification freshness, merge readiness, and post-merge classification are
  deferred to Epic 5.
- Recovery classification, duplicate launch blocking, resume/restart selection, and reconciliation
  actions are deferred to Epic 5.
- Concrete Codex and Local provider behavior is deferred to Epic 6.
- Operator approval entry and attention rendering are deferred to Epic 7.
- A short timer for "decision delivered but not consumed" remains deferred until the core-04 design
  resolves whether idle/no-progress coverage is sufficient after an approval answer. Epic 4 stories must
  not author acceptance criteria for that timer.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [epic charters](../README.md) · **← Prev:** [edge-01-s2-cli-mcp-parity-smoke - CLI and MCP parity smoke implementation story](../epic-3-core-runtime-spine/stories/edge-01-s2-cli-mcp-parity-smoke.md) · **Next →:** [Epic 4 Execution Package Plan](./execution/plan.md)

**Children:** [Epic 4 Execution Package Plan](./execution/plan.md) · [Implementer Prompt: core-03-s1-approval-contracts](./execution/prompts/core-03-s1-approval-contracts/implementer.md) · [Reviewer Prompt: core-03-s1-approval-contracts](./execution/prompts/core-03-s1-approval-contracts/reviewer.md) · [Implementer Prompt: core-03-s2-normalize-risk-decision](./execution/prompts/core-03-s2-normalize-risk-decision/implementer.md) · [Reviewer Prompt: core-03-s2-normalize-risk-decision](./execution/prompts/core-03-s2-normalize-risk-decision/reviewer.md) · [Implementer Prompt: core-03-s3-pending-park-resume](./execution/prompts/core-03-s3-pending-park-resume/implementer.md) · [Reviewer Prompt: core-03-s3-pending-park-resume](./execution/prompts/core-03-s3-pending-park-resume/reviewer.md) · [Implementer Prompt: core-03-s4-grants-outcomes](./execution/prompts/core-03-s4-grants-outcomes/implementer.md) · [Reviewer Prompt: core-03-s4-grants-outcomes](./execution/prompts/core-03-s4-grants-outcomes/reviewer.md) · [Implementer Prompt: core-04-s1-supervision-contracts](./execution/prompts/core-04-s1-supervision-contracts/implementer.md) · [Reviewer Prompt: core-04-s1-supervision-contracts](./execution/prompts/core-04-s1-supervision-contracts/reviewer.md) · [Implementer Prompt: core-04-s2-liveness-fold](./execution/prompts/core-04-s2-liveness-fold/implementer.md) · [Reviewer Prompt: core-04-s2-liveness-fold](./execution/prompts/core-04-s2-liveness-fold/reviewer.md) · [Implementer Prompt: core-04-s3-timers-wait](./execution/prompts/core-04-s3-timers-wait/implementer.md) · [Reviewer Prompt: core-04-s3-timers-wait](./execution/prompts/core-04-s3-timers-wait/reviewer.md) · [Implementer Prompt: core-04-s4-termination-facts](./execution/prompts/core-04-s4-termination-facts/implementer.md) · [Reviewer Prompt: core-04-s4-termination-facts](./execution/prompts/core-04-s4-termination-facts/reviewer.md) · [Epic 4 Execution Tracker](./execution/tracker.md) · [Epic 4 - stories](./stories/README.md) · [Epic 4 - story DAG](./story-dag.md)

<!-- /DOCS-NAV -->
