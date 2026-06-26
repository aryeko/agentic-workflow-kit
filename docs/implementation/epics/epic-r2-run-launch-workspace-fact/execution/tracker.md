# Epic R2 Execution Tracker

Initial state for a later `$orchestrated-delivery` run. The single row projects from
`docs/implementation/epics/epic-r2-run-launch-workspace-fact/story-dag.md` (`story-dag: frozen`) and its
`story: ready` source contract. The story starts `ready`; reviewer verdict, gate evidence, and commit hash
remain empty until execution records real evidence.

| story id | source AC ids | wave | dependencies | status | implementer routing | reviewer routing | prompt paths | reviewer verdict | gate evidence | commit hash | blockers | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `core-01-r2-run-launch-worktree-path` | AC-1, AC-2, AC-3, AC-4 | 1 | none intra-epic | ready | `strong-coder`; effort `high`; reasoning `elevated`; DAG floor `elevated`; rationale: a `core-01` run-lifecycle launch-reducer fold producing the trusted `worktreePath` that feeds the fail-closed workspace→approval security seam — fail-open weakens a downstream security boundary, so an `elevated` coder. | `frontier-reviewer`; effort `high`; reasoning `elevated`; DAG floor `elevated`; rationale: same security seam — confirm the fold reads the recorded `workspace-ready` fact's `worktreePath` (not fabricated, not agent-supplied), `worktreePath` absent when no such fact, and replay-determinism. | implementer: `execution/prompts/core-01-r2-run-launch-worktree-path/implementer.md`<br>reviewer: `execution/prompts/core-01-r2-run-launch-worktree-path/reviewer.md` |  |  |  |  | Projects source story `core-01-r2-run-launch-worktree-path` (AC-1..AC-4) from `story-dag: frozen`; owned pathset `packages/sdk/src/core/run-lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/**`. No new public symbol / no new barrel line (`RunLaunchProjection` already exported by Epic 3). Producer of the trusted `RunLaunchProjection.worktreePath` consumed cross-epic by Epic 4 `core-03-s2-normalize-risk-decision` (recorded in Epic 4's DAG/tracker, not here). |

Done semantics: a row is `done`/`merged` only after implementation is independently approved, the reviewer
verdict is `APPROVE`, the `gate` names green `pnpm check` evidence for that round, the implementer commits
exist in the story worktree, and the orchestrator merged those commits back to the track branch and
recorded the merge-back hash. Evidence conflicts resolve toward git state, `pnpm check` output, and live
review truth over worker prose or stale notes.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R2 - Run-launch workspace fact](../README.md) · **← Prev:** [Reviewer Prompt: core-01-r2-run-launch-worktree-path](./prompts/core-01-r2-run-launch-worktree-path/reviewer.md) · **Next →:** [Epic R2 - stories](../stories/README.md)

<!-- /DOCS-NAV -->
