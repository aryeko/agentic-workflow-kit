# Epic R2 Execution Package Plan

## Source Baseline

- Repo: `/Users/aryekogan/repos/workflow-kit`.
- Worktree: `/Users/aryekogan/repos/workflow-kit/.worktrees/epic4-workspace-seam-replan`.
- Base branch: `v-next` (protected — PR only).
- Epic slug: `epic-r2-run-launch-workspace-fact`.
- Author/date: delivery owner (Claude), 2026-06-26.
- Source files read: this epic's frozen `story-dag.md` (`story-dag: frozen`) and its single
  `story: ready` contract (`stories/core-01-r2-run-launch-worktree-path.md`); the amended
  workspace→approval seam design merged in PR #159 (`de3cd04`) — `run-lifecycle-and-state/contracts.md`
  (`RunLaunchProjection.worktreePath`, lines 65–75), `.../projections-lifecycle-and-tests.md` (the launch
  fold + replay determinism), and `foundation/workspace-and-repository/README.md`
  (`WorktreeLease.worktreePath`).

## Readiness Verdict

**ready_for_implementation.** Gate 1 is met: the story DAG is `story-dag: frozen` and the single selected
story is `story: ready`, with characterization review recorded (`run-launch-worktree-fold-not-new-event`,
verdict ready). This package projects only from those frozen artifacts; it adds no scope, no AC, and no
dependency order.

## Implementation-Readiness Evidence

`$plan-delivery` performed a deep artifact review before issuing the verdict:

- **Sources reviewed:** `story-dag.md` (frozen, suggested tier `elevated`),
  `stories/core-01-r2-run-launch-worktree-path.md`, the epic `README.md`, and the amended design seams
  cited above (PR #159, `de3cd04`).
- **Selected stories covered:** the single story in the frozen DAG is projected (1 of 1); no story is
  omitted or added.
- **Per-artifact checks performed:** the implementer and reviewer prompts and the tracker row cite the
  source story id and source AC ids (`AC-1`..`AC-4`); the owned pathset is copied verbatim from the
  contract (`packages/sdk/src/core/run-lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/**`); the
  routing carries the DAG suggested-tier floor (`elevated`) unchanged and binds no concrete provider model
  id; the boundary sweep, coverage lane, failure token, and STOP conditions are copied from the contract.
- **Preflights:** substrate-presence passes — the owned pathset is executable run-lifecycle reducer code
  (the launch-projection fold V8 measures as real statements/branches; not a `0/0`→100% vacuous lane).
  predicate-input passes — every AC closure row cites a concrete `Producer/Type.field` (the recorded
  `workspace-ready` launch fact's `worktreePath`).

## Projection Summary

| story id | source AC ids | job | wave | dependencies | dependents | owned pathset | suggested-tier floor | routing |
|---|---|---|---|---|---|---|---|---|
| `core-01-r2-run-launch-worktree-path` | AC-1..AC-4 | Fold `RunLaunchProjection.worktreePath` from the recorded `workspace-ready` launch fact's `worktreePath`; absent when no such fact; pure replay function; existing launch fields unchanged | 1 | none intra-epic | (cross-epic, recorded in Epic 4's DAG) Epic 4 `core-03-s2-normalize-risk-decision` | `packages/sdk/src/core/run-lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/**` | `elevated` | implementer: `strong-coder`; effort `high`; reasoning `elevated`; DAG floor `elevated`; rationale: a `core-01` run-lifecycle launch-reducer fold that produces the trusted `worktreePath` feeding the fail-closed workspace→approval security seam — fail-open here weakens a downstream security boundary, so an `elevated` coder. reviewer: `frontier-reviewer`; effort `high`; reasoning `elevated`; DAG floor `elevated`; rationale: same security seam — must confirm the fold reads the recorded fact (not fabricated, not agent-supplied), absence leaves the field unset, and the fold is replay-deterministic. |

## Execution Waves

- **Wave 1 (single story):** `core-01-r2-run-launch-worktree-path`. Single-story epic, no intra-epic edge;
  dispatch in its own per-story worktree.

## Prompt Inventory

| story id | source AC ids | implementer prompt | reviewer prompt |
|---|---|---|---|
| `core-01-r2-run-launch-worktree-path` | AC-1..AC-4 | `execution/prompts/core-01-r2-run-launch-worktree-path/implementer.md` | `execution/prompts/core-01-r2-run-launch-worktree-path/reviewer.md` |

## Verification Policy

- **Per-story targeted checks:** run the story's catalogued launch-reducer unit tests + the ≥95%
  statements/branches coverage lane over the owned launch-projection pathset (commands in the implementer
  prompt).
- **Required sweep:** the boundary sweep
  `rg -n "provider-codex|provider-local|testkit|child_process|Date\.now|new Date|Math\.random|fetch\(" packages/sdk/src/core/run-lifecycle/projections packages/sdk/tests/core/run-lifecycle`
  returns zero source matches (no ambient time/process/network in the reducer).
- **Evidence pack:** each AC's named fixture (`launch-worktree-path-fold`, `launch-worktree-path-absent`,
  `launch-worktree-path-replay`, `launch-fields-unchanged`), the `Date.now|new Date` spy result, the
  coverage number for the changed surface, and the sweep output.
- **Repo gate:** `pnpm check` must be green over the whole worktree before the story row is `done` and
  before the PR.

## Downstream Execution Metadata

`$orchestrated-delivery` must honor: the owned pathset (commit strictly within it); the abstract routing
(bind concrete models at dispatch); the single-wave order; the tracker `status` lifecycle; and the stop
boundary (PR boundary — owner owns PR/merge). No new public symbol is exposed — `RunLaunchProjection` is
already exported by Epic 3; this story owns no new barrel line. No provider id is bound in this package.

## Cross-Epic Note

`core-01-r2-run-launch-worktree-path` is the **producer** of the trusted `RunLaunchProjection.worktreePath`
run-launch fact. Epic 4 `core-03-s2-normalize-risk-decision` is the cross-epic **consumer**: it copies that
value through `ApprovalContext.worktreePath` to `ApprovalRequest.worktreePath` and tests workspace
containment (AC-3/AC-4) against it. That dependency is recorded in Epic 4's DAG and tracker, not here; this
package produces the value and does not thread the consumer side.

## Resume Semantics

A later run reads existing tracker rows: a row already `done` with a real commit hash and recorded gate
evidence is not re-dispatched. `changes_requested`/`blocked` rows resume from their current state. Evidence
conflicts resolve toward git state, `pnpm check` output, and live review truth over worker prose or stale
notes.

## Stop Point

Package creation ends here. The next stage is `$orchestrated-delivery` against this package.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R2 - Run-launch workspace fact](../README.md) · **← Prev:** [Epic R2 - Run-launch workspace fact](../README.md) · **Next →:** [Implementer Prompt: core-01-r2-run-launch-worktree-path](./prompts/core-01-r2-run-launch-worktree-path/implementer.md)

<!-- /DOCS-NAV -->
