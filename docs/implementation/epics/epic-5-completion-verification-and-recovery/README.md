---
title: Epic 5 - Completion, verification, and recovery
epic: 5
status: "epic: draft"
depends-on-epics: [3, 4]
last-reviewed: "2026-06-22"
---

# Epic 5 - Completion, Verification, and Recovery

## Purpose

Epic 5 lets the SDK decide whether a run is complete, verified, merge-ready, recoverable, or blocked
from recorded evidence. It binds completion and merge intent to exact heads, captures runner-owned
verification freshness, classifies recovery safety, and prevents duplicate story launches.

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|
| `core-05` Completion, Verification & Merge | Provides evidence-based completion and merge-readiness decisions. | Candidate-head evidence, policy snapshots, verification freshness, merge predicates, Forge intents, blocker PR intents, and post-merge classification. |
| `core-06` Recovery, Reconciliation & Coordination | Provides recovery classification and repo-level coordination. | Recovery snapshots, stable taxonomy, action-safety classes, launch leases, resume/restart eligibility, plans, applied actions, and blocked reconciliation records. |

## Why this epic exists

The control plane is not safe to compose with real providers or operator surfaces until completion,
merge, and recovery decisions are deterministic over evidence rather than worker prose. Epic 5 closes
that SDK control path by consuming the runtime spine, capability gates, approval facts, liveness facts,
storage leases, and provider-port evidence from earlier epics.

The hard dependency edge is owned by `epic-dag.md`: Epic 5 depends on Epic 3 and Epic 4, and Epic 7
depends on Epic 5 before production operator composition.

## Frozen inputs

- Epic 3 run replay, projections, lifecycle targets, cursor, gate records, and analysis records.
- Epic 4 approval, protected-policy decision, liveness, supervision-lost, and termination facts.
- Epic 1 merge policy, change allowlists, storage leases, evidence refs, and local git evidence
  contracts.
- Epic 2 Forge, Work Source, Execution Host, and Agent provider ports plus testkit mocks.
- `docs/implementation/domains/core/core-05-completion-and-merge.md`.
- `docs/implementation/domains/core/core-06-recovery-and-reconciliation.md`.
- `docs/implementation/epic-dag.md` Epic 5 dependency edges.

## Outputs

- SDK completion decision surface for candidate-head selection, exact-head evidence references,
  changed-file policy, protected-policy snapshots, and claim-evidence mismatch handling.
- Verification freshness surface over runner-owned command captures and matching local git evidence.
- Merge readiness predicate surface over policy, checks, review/thread evidence, branch freshness,
  protection, and capability gate records.
- Forge operation intent and merge intent record surface with exact-head binding.
- Blocker-evidence PR intent surface that stays separate from task completion and merge readiness.
- SDK recovery classifier surface with stable taxonomy, action-safety classes, story-launch leases,
  resume/restart eligibility, recovery plans, applied actions, blocked reconciliation, and lifecycle
  recovery-edge signals.

## Scope boundaries

- In: completion decisions, verification freshness, merge-readiness predicates, exact-head intents,
  blocker PR intent separation, post-merge classification, recovery classifier, launch leases,
  resume/restart eligibility, and reconciliation records.
- Out: raw local git evidence gathering, runner command execution, Forge reads or writes, provider
  driver implementation, approval adjudication, liveness derivation, operator UX, and scheduler design.
- STOP when: a story needs to gather raw provider evidence, execute commands, perform a real merge,
  implement a concrete provider, change Work Source records directly, or add scheduler/admission
  behavior outside the v1 scope.

## Per-domain expectations

For each included domain, the table lists the `Story Group Signals` this epic claims. Story ownership
stays `TBD` until the Epic 5 story DAG is frozen.

### `core-05` - Completion, Verification & Merge

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Candidate-head selection and exact-head evidence refs. | TBD | covered |
| Protected policy snapshot records and changed-file policy signals. | TBD | covered |
| Completion decision states and `claim-evidence-mismatch` handling. | TBD | covered |
| Verification freshness from runner-owned captures and matching local git evidence. | TBD | covered |
| Merge readiness predicate over policy, checks, review/thread evidence, branch freshness, protection, and capability gate records. | TBD | covered |
| Forge operation intent and merge intent records with `expectedHeadSha`. | TBD | covered |
| Blocker-evidence PR intent separation from task completion or merge readiness. | TBD | covered |
| Post-merge outcome classification into lifecycle targets. | TBD | covered |

- Evidence expectation: Epic 5 stories leave completion, verification, and merge-readiness decisions
  that can be checked against recorded evidence and exact-head bindings, without trusting worker prose
  or concrete Forge behavior.

### `core-06` - Recovery, Reconciliation & Coordination

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Recovery evidence snapshot and classifier result records. | TBD | covered |
| Recovery state taxonomy and stable failure ordering. | TBD | covered |
| Action-safety classes: auto-safe, operator-required, and forbidden. | TBD | covered |
| `story-launch:<workSourceId>:<trackId>:<taskId>` lease acquisition, duplicate blocking, and stale launch clearing records. | TBD | covered |
| Resume eligibility from owned, non-superseded session evidence. | TBD | covered |
| Restart eligibility only from safe empty state with verified termination, owner, launch, approval, and claim evidence. | TBD | covered |
| Recovery plan, applied action, blocked reconciliation, and lifecycle recovery-edge signals. | TBD | covered |

- Evidence expectation: Epic 5 stories leave recovery classifications and coordination records that
  repeated processes can replay to the same safe action without editing logs, projections, Work Source
  records, or provider artifacts directly.

## Epic readiness

- Epic 7 can compose production CLI/MCP flows over a control path that already knows how to decide
  completion, merge readiness, recovery state, and operator-required blockers.
- Epic 6 concrete provider evidence can be consumed through provider ports without changing SDK
  completion or recovery semantics.
- Operator-facing recovery, handoff, wait, inspect, and explain views have stable SDK read models to
  render.

## Deferred work

- Concrete Markdown, Local, GitHub, and Codex provider drivers are deferred to Epic 6.
- CLI/MCP production surfaces, default composition, attention rendering, and external trigger posture
  are deferred to Epic 7.
- Future scheduler or admission-system design remains out of v1 scope unless the design corpus is
  amended first.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [epic charters](../README.md) · **← Prev:** [Epic 4 - story DAG](../epic-4-human-control-and-liveness-loop/story-dag.md) · **Next →:** [Epic 5 - stories](./stories/README.md)

**Children:** [Epic 5 - stories](./stories/README.md) · [Epic 5 - story DAG](./story-dag.md)

<!-- /DOCS-NAV -->
