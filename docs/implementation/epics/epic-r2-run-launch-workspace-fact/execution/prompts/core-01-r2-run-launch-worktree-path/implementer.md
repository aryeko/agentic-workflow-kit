# Implementer Prompt: core-01-r2-run-launch-worktree-path

## Assigned Routing

- Source story id: `core-01-r2-run-launch-worktree-path`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from
  `docs/implementation/epics/epic-r2-run-launch-workspace-fact/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: a `core-01` run-lifecycle launch-reducer fold that produces the trusted
  `RunLaunchProjection.worktreePath` feeding the fail-closed workspace→approval security seam; folding a
  fabricated, transformed, or agent-supplied value (instead of the recorded fact) would weaken a
  downstream security boundary, so an `elevated` coder. No provider-specific runtime model id.

## Exact Task

Story `core-01-r2-run-launch-worktree-path` (epic `epic-r2-run-launch-workspace-fact`). Single outcome:
forward-extend the **already-delivered** `core-01` run-lifecycle **launch** projection (Epic 3, PR #144) so
`RunLaunchProjection.worktreePath` is **populated** by folding the run's trusted workspace root from the
recorded `workspace-ready` launch fact's `worktreePath`. Leave the field **absent** when no such fact has
been recorded (consumers fail closed). Keep the fold a pure function of the ordered committed event stream
(replay-deterministic). Preserve every existing launch-projection field and behaviour. Introduce no new
lifecycle state, no new run-lifecycle-owned event payload, and no new public symbol. Do not reopen the
frozen design or Epic 1 / Epic 3 / Epic 4 planning artifacts.

## Why It Matters

This closes the **producer** side of the frozen workspace→approval seam (design merged in PR #159,
`de3cd04`): `worktreePath` is a recorded, replayable run-launch fact — never an agent-supplied value — that
downstream approval risk classification (Epic 4 `core-03-s2-normalize-risk-decision`) tests path
containment against. The field type and optionality (`worktreePath?: string`) are the frozen amended
`core-01` design shape; this story only populates an existing field on a frozen contract. This story is in
wave 1 and has no intra-epic dependency.

## Required Reading

- Source story contract:
  `docs/implementation/epics/epic-r2-run-launch-workspace-fact/stories/core-01-r2-run-launch-worktree-path.md`.
- Frozen DAG: `docs/implementation/epics/epic-r2-run-launch-workspace-fact/story-dag.md`.
- Normative design (frozen, PR #159 `de3cd04`):
  - `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` —
    `RunLaunchProjection.worktreePath?: string` (lines 65–75): the run's trusted workspace root, folded
    from the `workspace-ready` launch fact; absent until a producer records that fact; consumers fail
    closed on absence.
  - `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md` —
    the `launch` projection folds `worktreePath` from the `workspace-ready` barrier fact; projection output
    is a pure function of the ordered committed event stream; reducers perform no ambient reads.
  - `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` —
    `WorktreeLease.worktreePath: AbsolutePath`, the frozen Epic-1 source value carried by the
    `workspace-ready` sibling-domain barrier fact.
- Delivered code to change: the launch-projection reducer
  (`packages/sdk/src/core/run-lifecycle/projections/launch-projection.ts`) and its existing tests/fixtures
  under `packages/sdk/tests/core/run-lifecycle/**`.
- `docs/engineering/test-lanes.md`.

## Acceptance Criteria

Source story: `core-01-r2-run-launch-worktree-path`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`.

- **AC-1** The launch-projection reducer folds `RunLaunchProjection.worktreePath` from the recorded
  `workspace-ready` launch fact's `worktreePath` — evidence: a reducer fixture
  (`launch-worktree-path-fold.unit.test.ts`) that records a `workspace-ready` barrier fact carrying a known
  `worktreePath` (e.g. `/srv/runs/run-7/worktree`) projects `launch` and asserts
  `launch.worktreePath === "/srv/runs/run-7/worktree"` exactly.

- **AC-2** `worktreePath` is **absent** (not `""`, not fabricated) when no `workspace-ready` fact is
  recorded — evidence: a fixture (`launch-worktree-path-absent.unit.test.ts`) projecting `launch` from a
  log with no `workspace-ready` fact asserts `launch.worktreePath === undefined`.

- **AC-3** The fold is a **pure function of the recorded event stream** (replay-deterministic) — evidence:
  `launch-worktree-path-replay.unit.test.ts` projects `launch` twice from the same committed log byte
  sequence and asserts identical `launch.worktreePath` both times, and a forbidden `Date.now|new Date` spy
  over the launch reducer reports zero calls (no ambient reads).

- **AC-4** Existing launch fields (`policyDigest`, `taskSnapshotDigest`, `linkage`, `currentSession`,
  `linkHistory`) are unchanged — evidence: a regression fixture (`launch-fields-unchanged.unit.test.ts`)
  projects `launch` from a log with no `workspace-ready` fact and asserts each of those five fields equals
  its pre-existing expected value (the launch projection output for the five named fields is identical to
  the delivered behaviour).

### Failure / degraded tokens

| token | trigger | required behavior | proven by |
|---|---|---|---|
| (absent field) | no `workspace-ready` fact recorded | `launch.worktreePath` is absent (`undefined`); consumers fail closed on absence per frozen design | AC-2 |

This story raises no new runtime failure token; it folds a recorded fact or leaves the field absent.

## Allowed Writes

Exactly the source contract's owned pathset; all other writes forbidden:

- `packages/sdk/src/core/run-lifecycle/**`
- `packages/sdk/tests/core/run-lifecycle/**`

No new public symbol and no new barrel line: `RunLaunchProjection` is already exported by Epic 3, so this
story does **not** edit `packages/sdk/src/index.ts`.

## Dependency Inputs

- None intra-epic (single-story epic, Band 1). `{{DEPENDENCY_COMMITS}}`: none.
- Shared shape consumed (unchanged, frozen Epic 1): the recorded `workspace-ready` barrier fact's
  `worktreePath` field (the run's `WorktreeLease.worktreePath`), consumed via replay — not redeclared.

## Non-Goals And STOP Conditions

- Non-goals: the approval **consumer** side (Epic 4 `core-03-s2`: `ApprovalContext`/
  `ApprovalRequest.worktreePath` threading and the fail-closed classifier); minting any new
  run-lifecycle-owned event type or lifecycle state; changing the `workspace-ready` barrier fact's payload
  (owned by the workspace-and-repository domain); any other `RunLaunchProjection` field or run-lifecycle
  behaviour; editing `docs/design/**` or the Epic 1 / Epic 3 / Epic 4 charters, story DAGs, or contracts.
- STOP when: no recorded `workspace-ready` fact carries `worktreePath` (closing it would need a design
  change — the seam is frozen — or a workspace-domain change out of this epic's scope), or the fold would
  require minting a new run-lifecycle-owned event type or lifecycle state. Escalate rather than widen
  scope. Never source `worktreePath` from an agent-supplied value or a default — the only admissible source
  is the recorded `workspace-ready` fact.

## Implementation Constraints

- The fold reads `worktreePath` **exactly as recorded** on the `workspace-ready` fact — never fabricated,
  transformed, defaulted, or agent-supplied. The produced field has a single declared source.
- Leave `worktreePath` absent (`undefined`, not `""` or a placeholder) when no `workspace-ready` fact has
  been recorded, so consumers fail closed per the frozen design.
- Keep the fold a pure function of the ordered committed event stream: deterministic on replay, with no
  ambient time/process/network reads. Introduce no new ambient time/id/process usage.
- Preserve all existing launch-projection behaviour and fields (`policyDigest`, `taskSnapshotDigest`,
  `linkage`, `currentSession`, `linkHistory`).
- Imports: production source under `packages/sdk/src/core/run-lifecycle/**` imports only what it already
  depends on; must not import `testkit`, `provider-*`, `cli`, or `mcp`.
- File-size budget: no edited file exceeds 400 lines; test files ≤ 200 lines each.
- TDD: failing test first (RED) → implement (GREEN) → refactor.

## Verification

- Targeted: run the launch-reducer unit lane + coverage over the owned pathset, e.g.
  `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/sdk/tests/core/run-lifecycle/**`.
- Coverage bar: **≥95% statements/branches** on the owned launch-reducer pathset
  (`packages/sdk/src/core/run-lifecycle/projections/launch-projection.ts` within
  `packages/sdk/src/core/run-lifecycle/**`). This lane is legitimate per the Gate-4 **Proof-substrate
  match** box: the launch-projection reducer is executable code whose fold V8 measures as real
  statements/branches (proven by the AC-1/AC-2/AC-3 fold tests), not a vacuous `0/0`→100%. See
  `docs/engineering/testing-policy.md#proof-substrate`.
- Boundary sweep (zero source matches expected):
  `rg -n "provider-codex|provider-local|testkit|child_process|Date\.now|new Date|Math\.random|fetch\(" packages/sdk/src/core/run-lifecycle/projections packages/sdk/tests/core/run-lifecycle`.
- Repo gate: `pnpm check` green over the worktree.
- Evidence pack: per-AC fixture names (`launch-worktree-path-fold`, `launch-worktree-path-absent`,
  `launch-worktree-path-replay`, `launch-fields-unchanged`), the `Date.now|new Date` spy result (zero
  calls), the coverage number for the changed surface, and the sweep output.

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Delivery Report

Return: changed files; AC coverage by `AC-n`; tests/checks and results; evidence pack; open questions;
blockers. Do not claim done without `pnpm check` output.

## Mutation Limits

No staging, commits, pushes, PRs, merges, tracker/package edits, source-planning edits, or writes outside
the allowed pathset. Implement and report; the orchestrator commits the approved pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R2 - Run-launch workspace fact](../../../README.md) · **← Prev:** [Epic R2 Execution Package Plan](../../plan.md) · **Next →:** [Reviewer Prompt: core-01-r2-run-launch-worktree-path](./reviewer.md)

<!-- /DOCS-NAV -->
