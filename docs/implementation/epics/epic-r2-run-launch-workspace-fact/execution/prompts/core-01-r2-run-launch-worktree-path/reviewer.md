# Reviewer Prompt: core-01-r2-run-launch-worktree-path

## Assigned Routing

- Source story id: `core-01-r2-run-launch-worktree-path`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from
  `docs/implementation/epics/epic-r2-run-launch-workspace-fact/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: the fold produces the trusted `RunLaunchProjection.worktreePath` feeding the
  fail-closed workspace→approval security seam; the reviewer must confirm the value is read from the
  recorded fact (never fabricated or agent-supplied), absence leaves the field unset, and the fold is
  replay-deterministic. At or above the DAG floor; no provider-specific runtime model id.

## Original Scope

- Story id: `core-01-r2-run-launch-worktree-path`.
- Epic slug: `epic-r2-run-launch-workspace-fact`.
- Source story contract path:
  `docs/implementation/epics/epic-r2-run-launch-workspace-fact/stories/core-01-r2-run-launch-worktree-path.md`.
- Allowed pathset: `packages/sdk/src/core/run-lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/**`.
  No new public symbol and no new barrel line — `RunLaunchProjection` is already exported by Epic 3, so
  `packages/sdk/src/index.ts` must **not** be edited.
- Direct dependencies: none intra-epic (single-story epic). Dependency inputs: `{{DEPENDENCY_COMMITS}}`
  (none).
- Shared shape consumed (frozen Epic 1): the recorded `workspace-ready` barrier fact's `worktreePath`
  (`WorktreeLease.worktreePath`), consumed via replay — not redeclared.

### Acceptance Criteria

- **AC-1** The launch-projection reducer folds `RunLaunchProjection.worktreePath` from the recorded
  `workspace-ready` launch fact's `worktreePath` — a `launch-worktree-path-fold.unit.test.ts` fixture that
  records a `workspace-ready` fact carrying a known `worktreePath` (e.g. `/srv/runs/run-7/worktree`)
  projects `launch` and asserts `launch.worktreePath === "/srv/runs/run-7/worktree"` exactly.
- **AC-2** `worktreePath` is **absent** (not `""`, not fabricated) when no `workspace-ready` fact is
  recorded — `launch-worktree-path-absent.unit.test.ts` asserts `launch.worktreePath === undefined`.
- **AC-3** The fold is a **pure function of the recorded event stream** (replay-deterministic) —
  `launch-worktree-path-replay.unit.test.ts` projects `launch` twice from the same committed log byte
  sequence and asserts identical `launch.worktreePath`, and a forbidden `Date.now|new Date` spy reports
  zero calls.
- **AC-4** Existing launch fields (`policyDigest`, `taskSnapshotDigest`, `linkage`, `currentSession`,
  `linkHistory`) are unchanged — `launch-fields-unchanged.unit.test.ts` asserts each equals its
  pre-existing expected value.

### Failure / degraded rows to verify

| token | trigger | required behavior | proven by |
|---|---|---|---|
| (absent field) | no `workspace-ready` fact recorded | `launch.worktreePath` is absent (`undefined`); consumers fail closed | AC-2 |

### Non-Goals

The approval consumer side (Epic 4 `core-03-s2`); minting any new run-lifecycle event type or lifecycle
state; changing the `workspace-ready` barrier fact payload; any other `RunLaunchProjection` field; design
or Epic 1 / Epic 3 / Epic 4 planning edits.

### STOP Conditions And Boundaries

Owned pathset only; forbidden production deps `testkit`/`provider-*`/`cli`/`mcp`; STOP if the fold needs a
design change, a new event type/lifecycle state, or an agent-supplied/default `worktreePath`.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

- **AC coverage:** each `AC-n` proven by the named fixture with a concrete assertion.
- **Recorded-source check (blocking):** the fold reads `worktreePath` **from the recorded `workspace-ready`
  launch fact** exactly as recorded — block any implementation that fabricates, transforms, defaults, or
  sources the value from an agent-supplied value or any path other than the recorded fact. The produced
  field must have a single declared source (the recorded fact).
- **Absent-when-no-fact check (blocking):** when no `workspace-ready` fact is recorded, `launch.worktreePath`
  is **absent** (`undefined`) — not `""`, not a placeholder, not a fabricated default — so consumers fail
  closed. Block any code that emits a non-`undefined` value in this case.
- **Replay-determinism check (blocking):** the fold is a pure function of the ordered committed event
  stream — identical output across two projections of the same log byte sequence, and zero
  `Date.now|new Date|Math.random` / process / network reads in the launch reducer. Block any ambient read.
- **Regression:** the five existing launch fields (`policyDigest`, `taskSnapshotDigest`, `linkage`,
  `currentSession`, `linkHistory`) are unchanged.
- **No new public symbol / barrel line:** `packages/sdk/src/index.ts` is not edited; no new export is added.
- **Evidence pack completeness:** per-AC fixture names, the `Date.now|new Date` spy result, the coverage
  number (≥95% statements/branches on the owned launch-reducer pathset), and the boundary-sweep output.
- **Stale names / sibling occurrences:** any launch-projection fixtures and assertions updated consistently;
  no test relies on the old (unpopulated) shape in a way that masks the fold.
- **Dependency boundaries:** production source imports no `testkit`/`provider-*`/`cli`/`mcp`.
- **Repo conventions / mutation limits:** no emojis; no commits/PRs/tracker edits; writes within pathset.

## Verdict Format

Return `APPROVE` only when no blocking findings remain. Otherwise list findings severity-ordered, each with
file/line, the required fix, and the violated `AC-n` or boundary.

## Mutation Limits

The reviewer is read-only. Do not stage, commit, push, open or update PRs, merge, close workers, edit
tracker state, edit package files, edit source-planning files, dispatch implementation work, or write
outside allowed paths. Inspect and return a verdict only.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R2 - Run-launch workspace fact](../../../README.md) · **← Prev:** [Implementer Prompt: core-01-r2-run-launch-worktree-path](./implementer.md) · **Next →:** [Epic R2 Execution Tracker](../../tracker.md)

<!-- /DOCS-NAV -->
