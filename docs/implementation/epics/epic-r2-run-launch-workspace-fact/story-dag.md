---
title: "Epic R2 - story DAG"
epic: "r2"
status: "story-dag: frozen"
last-reviewed: "2026-06-26"
---

# Epic R2 - story DAG

## Sources

- This epic's charter: `docs/implementation/epics/epic-r2-run-launch-workspace-fact/README.md`.
- Frozen design seam (PR #159 `de3cd04`):
  - `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` —
    `RunLaunchProjection.worktreePath` (the field this epic populates).
  - `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md` —
    the `launch` projection folds `worktreePath` from the `workspace-ready` launch fact; absent until
    recorded; consumers fail closed.
- Frozen workspace source (Epic 1): `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`
  (`WorktreeLease.worktreePath`) and `.../events.md` (`worktreePath: AbsolutePath`).
- Delivered code under forward-extension: `packages/sdk/src/core/run-lifecycle/**` (Epic 3, PR #144).
- Downstream consumer (cross-epic, recorded in Epic 4's DAG, not here):
  Epic 4 `core-03-s2-normalize-risk-decision` consumes `RunLaunchProjection.worktreePath`.

## Reading rules

- A **node** is one story: a coherent slice of delivered-code forward-extension with one owned pathset.
- An **edge** `A → B` means A depends on a shape or output B produces; it is labelled with the shared
  contract creating it.
- This epic claims **no new Story Group Signals**. The node's acceptance criteria trace to the **frozen
  design seam** (PR #159), not to a claimed signal. Signal ownership for the launch projection stays with
  Epic 3 (`core-01`); the global coverage rollup is unchanged.

## Epic-specific scope decisions (reviewable)

### Decision: zero-signal forward-extension epic

- Rationale: the run-lifecycle launch projection was already delivered (Epic 3) and owns its Story Group
  Signal. `worktreePath` is an additive field on that existing signal — surfaced from a value Epic 1
  (`WorktreeLease.worktreePath`) already produces — not a new signal. Re-claiming the signal would violate
  exactly-once coverage.
- Design trace: `docs/implementation-authoring/authoring-standard/60-coverage.md` (a signal is `covered`
  by exactly one epic); the launch projection signal is owned by Epic 3.
- Falsification: the node's `covers signals` names a Story Group Signal, or the global coverage rollup
  gains/changes a row because of this epic.
- Escalation: if surfacing `worktreePath` genuinely requires a new signal (e.g. a new event type), STOP —
  that is new behaviour beyond the frozen seam; escalate.

### Decision: single-story epic, no intra-epic edges

- Rationale: the producer is one coherent forward-extension of one reducer (the launch-projection fold).
  There is no second story and no shared shape produced within this epic.
- Falsification: a second node appears, or a shared shape produced by this node is consumed by another
  node in this epic.

### Decision: owned pathset overlaps the delivered Epic-3 run-lifecycle by design

- Rationale: a forward-extension edits already-delivered run-lifecycle code. Epic 3 is delivered and its
  charter/DAG are frozen and not re-run, so there is no live ownership contention — only this epic's story
  modifies these paths during this extension.
- Design trace: charter Scope boundaries (In: forward-extend the launch-projection reducer + tests; Out:
  editing Epic 3 planning artifacts).
- Falsification: this epic edits any Epic 3 planning artifact (charter, story DAG, story contract) rather
  than code/tests.
- Escalation: if the extension cannot be made without changing the originating `core-01` story contract,
  STOP and escalate a design-sequencing gap.

### Decision: fold an existing recorded fact, never mint a new event

- Rationale: the frozen seam says `worktreePath` folds from the `workspace-ready` launch fact (a recorded
  workspace-and-repository fact already carrying `worktreePath`). This epic adds a reducer fold, not a new
  run-lifecycle event payload or lifecycle state.
- Design trace: `projections-lifecycle-and-tests.md` (launch folds `worktreePath` from the `workspace-ready`
  fact); `event-log-writer-and-corruption.md` (sibling-domain barrier facts are recorded in the run log;
  payload schemas owned by emitting domains).
- Falsification: the story declares a new run-lifecycle-owned event type or lifecycle state.
- Escalation: if no recorded `workspace-ready` fact carries `worktreePath`, STOP — closing it needs a
  design change (the seam is frozen) or a workspace-domain change out of this epic's scope.

### Decision: downstream cross-epic dependency is recorded, not owned here

- Rationale: Epic 4 `core-03-s2` consumes `RunLaunchProjection.worktreePath`. That dependency edge lives in
  **Epic 4's** story DAG (`core-03-s2 → core-01-r2-run-launch-worktree-path`), and `core-03-s2` may not be
  `ready` against the seam until this epic is frozen. This epic only *produces* the field.
- Falsification: this epic's DAG declares a consumer of `worktreePath`, or Epic 4 is planned `ready`
  against the seam before this epic freezes.

## Story nodes

| story id | one-line job | domain(s) | claimed signals covered | owned pathset | suggested tier |
|---|---|---|---|---|---|
| `core-01-r2-run-launch-worktree-path` | Forward-extend the launch-projection reducer so `RunLaunchProjection.worktreePath` is folded from the recorded `workspace-ready` launch fact's `worktreePath`; absent (not fabricated) when no such fact is recorded; pure function of the recorded stream (replayable) | `core-01` | none (forward-extension; signal owner Epic 3 `core-01` launch projection) | `packages/sdk/src/core/run-lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/**` | elevated |

## Dependency table

| story | depends on | shared contract creating edge |
|---|---|---|
| `core-01-r2-run-launch-worktree-path` | — (consumes the frozen amended `RunLaunchProjection` design + the frozen Epic-1 `WorktreeLease.worktreePath` source only) | none intra-epic |

## Shared shapes — one producer per shape

This epic produces **no** new shared shape consumed by another story in this epic. It populates an
existing field on a frozen contract:

| shared shape | producer | public import path | consumers |
|---|---|---|---|
| `RunLaunchProjection.worktreePath` (field populated; the type is frozen amended core-01 design, this epic implements the fold) | frozen amended `core-01` design (PR #159) — implemented by `core-01-r2-run-launch-worktree-path` | `sdk` core run-lifecycle entrypoint (existing) | Epic 4 `core-03-s2-normalize-risk-decision` (cross-epic, frozen-earlier; consumes, does not redeclare) |
| `WorktreeLease.worktreePath` (source of the folded value) | Epic 1 workspace-and-repository (frozen) | existing foundation export | `core-01-r2-run-launch-worktree-path` (consumes via the recorded `workspace-ready` fact; does not redeclare) |

## Story graph

```mermaid
flowchart TB
  core01r2["core-01-r2-run-launch-worktree-path"]
```

(One node; no intra-epic edges. Downstream `core-03-s2` consumer edge is recorded in Epic 4's DAG.)

## Topological bands

| band | stories | delivery note |
|---|---|---|
| 1 | `core-01-r2-run-launch-worktree-path` | Single story; deliver in its own worktree. Must freeze and deliver before Epic 4 `core-03-s2` is delivered against the seam. |

## Gate 3 — ready to freeze

- [x] Every signal covered maps exactly-once — N/A by design: this epic claims zero signals (see scope
  decision); the node traces to the frozen PR #159 design seam.
- [x] No invented nodes — the single node corresponds to the producer side of the frozen workspace→approval
  seam, with a confirmed downstream consumer (Epic 4 `core-03-s2`).
- [x] Single producer per shape, no contract-into-consumer collapse — this epic produces no new shared
  shape; it populates `RunLaunchProjection.worktreePath` (frozen type) and consumes frozen Epic-1
  `WorktreeLease.worktreePath` (Shared shapes table).
- [x] Acyclic, labelled edges — single node; no intra-epic edges; trivially acyclic.
- [x] Defensible node sizing — one node for one reducer fold; `elevated` because it feeds the fail-closed
  approval workspace-containment boundary (a security-relevant value).
- [x] Dispatch-ready — single owned pathset traceable to the design layer (`packages/sdk/src/core/run-lifecycle/**`).
- [x] Seams importable — every declared type resolves to this epic's implementation of the frozen amended
  design (`RunLaunchProjection`) or to an already-frozen earlier epic (Epic 1 `WorktreeLease`); no forward
  reference to a later epic. The downstream Epic-4 consumer is later, not forward-referenced here.
- [x] Whole-graph producer reconciliation — `RunLaunchProjection.worktreePath` is produced by exactly this
  story; its sole declared consumer (Epic 4 `core-03-s2`) is later and depends on this frozen output. No
  consumed-but-unproduced event/record in this epic.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R2 - Run-launch workspace fact](./README.md) · **← Prev:** [core-01-r2-run-launch-worktree-path - fold RunLaunchProjection.worktreePath from the recorded workspace-ready fact](./stories/core-01-r2-run-launch-worktree-path.md) · **Next →:** [implementation coverage rollup](../../coverage.md)

<!-- /DOCS-NAV -->
