---
title: "core-01-r2-run-launch-worktree-path - fold RunLaunchProjection.worktreePath from the recorded workspace-ready fact"
id: "core-01-r2-run-launch-worktree-path"
epic: "r2"
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md"
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md"
  - "docs/design/30-domain-reference/foundation/workspace-and-repository/README.md"
---

# core-01-r2-run-launch-worktree-path - Run-launch worktree path fold

## Purpose

Forward-extend the **already-delivered** `core-01` run-lifecycle launch projection (Epic 3, PR #144) so
`RunLaunchProjection.worktreePath` is **populated** by folding the run's trusted workspace root from the
recorded `workspace-ready` launch fact. This closes the **producer** side of the frozen
workspace→approval seam (design merged in PR #159, `de3cd04`): `worktreePath` is a recorded, replayable
run-launch fact — never an agent-supplied value — that downstream approval risk classification
(Epic 4 `core-03-s2`) tests path containment against. No new lifecycle state, no new run-lifecycle-owned
event payload, no new public symbol is introduced; this story only populates an existing field on a
frozen contract.

## Normative design

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md`
  — `RunLaunchProjection.worktreePath?: string` (lines 65–75): the run's trusted workspace root (an
  absolute path), folded from the `workspace-ready` launch fact; absent until a producer records that
  fact; consumers fail closed when it is absent.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  — the `launch` projection folds `worktreePath` from the `workspace-ready` barrier fact that records the
  run's `WorktreeLease.worktreePath`; projection output is a pure function of the ordered committed event
  stream (deterministic for a given log byte sequence); reducers perform no ambient reads.
- `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`
  — `WorktreeLease.worktreePath` (the run's absolute worktree path; `worktreePath: AbsolutePath`), the
  frozen Epic-1 source value carried by the `workspace-ready` sibling-domain barrier fact.

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Field populated (frozen design; not invented here): `RunLaunchProjection.worktreePath` is folded from
  the `worktreePath` carried by the recorded `workspace-ready` launch fact. The field type and its
  optionality (`worktreePath?: string`) are the frozen amended `core-01` design shape.
- Reducer extended: the launch-projection reducer (`projectLaunch` over `RunReplay`) gains the fold for
  `worktreePath`, alongside its existing `policyDigest` / `taskSnapshotDigest` / `linkage` /
  `currentSession` / `linkHistory` folds.
- Source consumed (unchanged, frozen Epic 1): the recorded `workspace-ready` barrier fact's
  `worktreePath` field (the run's `WorktreeLease.worktreePath`).
- No new public symbol: `RunLaunchProjection` is already exported by Epic 3; this story exposes no new
  barrel line.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Fold `RunLaunchProjection.worktreePath` from the recorded `workspace-ready` launch fact's
  `worktreePath`, exactly as recorded — never fabricated, transformed, or agent-supplied.
- Leave `worktreePath` **absent** (not `""`, not a placeholder) when no `workspace-ready` fact has been
  recorded, so consumers fail closed per the frozen design.
- Keep the fold a pure function of the ordered committed event stream: deterministic on replay, with no
  ambient time/process/network reads.
- Preserve all existing launch-projection behaviour and fields (`policyDigest`, `taskSnapshotDigest`,
  `linkage`, `currentSession`, `linkHistory`).
- Update the `core-01` run-lifecycle launch-projection tests and fixtures to record a `workspace-ready`
  fact carrying a known `worktreePath` and assert the fold.

## Out of scope

- The approval **consumer** side (Epic 4 `core-03-s2`: `ApprovalContext`/`ApprovalRequest.worktreePath`
  threading and the fail-closed classifier).
- Minting any new run-lifecycle-owned event type or lifecycle state; changing the `workspace-ready`
  barrier fact's payload (owned by the workspace-and-repository domain).
- Any other `RunLaunchProjection` field or run-lifecycle behaviour.
- Editing `docs/design/**` or the Epic 1 / Epic 3 / Epic 4 charters, story DAGs, or story contracts.

## Dependencies and Inputs

- Covers signals: **none** — forward-extension of a delivered surface; the launch-projection Story Group
  Signal stays owned by Epic 3 `core-01`. ACs trace to the frozen amended design seam above, not to a
  claimed signal. The global coverage rollup is unchanged.
- Depends on: nothing intra-epic (single-story epic). Band 1.
- Depended on by (cross-epic, recorded in Epic 4's DAG, not here): Epic 4
  `core-03-s2-normalize-risk-decision` consumes `RunLaunchProjection.worktreePath`.
- Shared shapes consumed: the recorded `workspace-ready` barrier fact's `worktreePath`
  (`WorktreeLease.worktreePath`, frozen Epic 1) — consumed via replay, not redeclared.

## Acceptance Criteria

- **AC-1** The launch-projection reducer folds `RunLaunchProjection.worktreePath` from the recorded
  `workspace-ready` launch fact's `worktreePath` — evidence: a reducer fixture
  (`launch-worktree-path-fold.unit.test.ts`) that records a `workspace-ready` barrier fact carrying a
  known `worktreePath` (e.g. `/srv/runs/run-7/worktree`) projects `launch` and asserts
  `launch.worktreePath === "/srv/runs/run-7/worktree"` exactly.

- **AC-2** `worktreePath` is **absent** (not `""`, not fabricated) when no `workspace-ready` fact is
  recorded — evidence: a fixture (`launch-worktree-path-absent.unit.test.ts`) projecting `launch` from a
  log with no `workspace-ready` fact asserts `launch.worktreePath === undefined`.

- **AC-3** The fold is a **pure function of the recorded event stream** (replay-deterministic) —
  evidence: `launch-worktree-path-replay.unit.test.ts` projects `launch` twice from the same committed
  log byte sequence and asserts identical `launch.worktreePath` both times, and a forbidden
  `Date.now|new Date` spy over the launch reducer reports zero calls (no ambient reads).

- **AC-4** Existing launch fields (`policyDigest`, `taskSnapshotDigest`, `linkage`, `currentSession`,
  `linkHistory`) are unchanged — evidence: a regression fixture
  (`launch-fields-unchanged.unit.test.ts`) projects `launch` from a log with no `workspace-ready` fact
  and asserts each of those five fields equals its pre-existing expected value (the launch projection
  output for the five named fields is identical to the delivered behaviour).

## Predicate and Producer Closure

| AC / output | Produced field | Source |
|---|---|---|
| AC-1 | `RunLaunchProjection.worktreePath` (present) | the `worktreePath` field of the recorded `workspace-ready` launch fact — a workspace-and-repository sibling-domain barrier fact already carrying `worktreePath: AbsolutePath` (`WorktreeLease.worktreePath`, frozen Epic 1); no value invented |
| AC-2 | `RunLaunchProjection.worktreePath` (absent) | absence of any recorded `workspace-ready` fact (fail-closed; not fabricated) |
| AC-3 | replay determinism | the ordered committed event stream only; no ambient time/process/network input |
| AC-4 | `policyDigest`, `taskSnapshotDigest`, `linkage`, `currentSession`, `linkHistory` | unchanged folds over the recorded stream (`RunPolicyBound`, `TaskSnapshotRecorded`, `SessionLinked` facts) |

Every produced value has a recorded source; `worktreePath` is never minted, defaulted, or read from an
agent-supplied value.

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| (absent field) | no `workspace-ready` fact recorded | `launch.worktreePath` is absent (`undefined`); consumers fail closed on absence per frozen design | AC-2 |

This story raises no new failure token at runtime; it folds a recorded fact or leaves the field absent.

## Quality Bar

- Coverage: ≥95% statements/branches on the owned run-lifecycle launch-reducer pathset
  (`packages/sdk/src/core/run-lifecycle/projections/launch-projection.ts` within
  `packages/sdk/src/core/run-lifecycle/**`). This lane is legitimate per the **Proof-substrate match**
  Gate-4 box: the owned pathset emits real runtime substrate — the launch-projection reducer is
  executable code whose fold V8 measures as real statements/branches (proven by the AC-1/AC-2/AC-3 fold
  tests over the reducer), not a vacuous `0/0`→100%. See `docs/engineering/testing-policy.md#proof-substrate`.
- Gate lane: `pnpm check`.
- Boundary sweep:
  `rg -n "provider-codex|provider-local|testkit|child_process|Date\\.now|new Date|Math\\.random|fetch\\(" packages/sdk/src/core/run-lifecycle/projections packages/sdk/tests/core/run-lifecycle`
  returns zero source matches (no ambient time/process/network in the reducer).
- Public exposure: none — `RunLaunchProjection` is already exported by Epic 3; this story adds no new
  public symbol and owns no new barrel line.
- Determinism constraints: the fold reads only the recorded event stream; no new ambient time/id/process
  usage introduced.
- Dependency boundaries: `packages/sdk/src/core/run-lifecycle/**` imports only what it already depends
  on; must not import `testkit`, `provider-*`, `cli`, or `mcp` in production source.
- File-size budget: no edited file exceeds 400 lines; test files ≤ 200 lines each.

## STOP Conditions

- Owned pathset (the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/**`.
- Forbidden dependencies (production source): `testkit`, any `provider-*` package, `cli`, `mcp`.
- STOP when: no recorded `workspace-ready` fact carries `worktreePath` (closing it would need a design
  change — the seam is frozen — or a workspace-domain change out of this epic's scope), or the fold would
  require minting a new run-lifecycle-owned event type or lifecycle state. Escalate rather than widen
  scope.

## Characterization Review

### Decision: run-launch-worktree-fold-not-new-event

- Rationale: the frozen seam (PR #159) says `worktreePath` folds from the `workspace-ready` launch fact —
  a recorded workspace-and-repository sibling-domain barrier fact already carrying `worktreePath`. This
  story adds a reducer fold over that recorded fact, never mints a new run-lifecycle event payload or
  lifecycle state.
- Design trace: `contracts.md` lines 65–75 (`RunLaunchProjection.worktreePath` folded from the
  `workspace-ready` fact); `projections-lifecycle-and-tests.md` (launch folds `worktreePath`; absent
  until recorded; pure replay function); `workspace-and-repository/README.md`
  (`WorktreeLease.worktreePath: AbsolutePath`, the source value).
- Falsification: the story declares a new run-lifecycle-owned event type or lifecycle state, fabricates a
  `worktreePath` default, or sources the field from an agent-supplied value rather than the recorded fact.
- Escalation: if no recorded `workspace-ready` fact carries `worktreePath`, STOP — closing it needs a
  design change (the seam is frozen) or a workspace-domain change out of scope.

- Verdict: ready; the produced field has a single recorded source, the fold is a pure replay function,
  and no new signal, event type, lifecycle state, or public symbol is introduced.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R2 - stories](./README.md) · **← Prev:** [Epic R2 - stories](./README.md) · **Next →:** [Epic R2 - story DAG](../story-dag.md)

<!-- /DOCS-NAV -->
