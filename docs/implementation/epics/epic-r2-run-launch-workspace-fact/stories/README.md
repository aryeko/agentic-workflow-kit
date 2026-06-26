---
title: Epic R2 - stories
epic: "r2"
status: "stories: ready"
last-reviewed: "2026-06-26"
---

# Epic R2 Stories

Epic R2's single forward-extension story contract is ready for the `plan-delivery` handoff.

| story id | status | one-line job |
|---|---|---|
| `core-01-r2-run-launch-worktree-path` | `story: ready` | Forward-extend the `core-01` launch-projection reducer so `RunLaunchProjection.worktreePath` is folded from the recorded `workspace-ready` launch fact's `worktreePath`; absent (not fabricated) when no such fact is recorded; a pure, replayable function of the recorded stream. |

Gate-1 handoff: 1 of 1 story is `story: ready`; the DAG is `story-dag: frozen`. This epic claims zero
new Story Group Signals (forward-extension of delivered code; signal owner stays Epic 3 `core-01`;
coverage rollup unchanged). It closes the **producer** side of the frozen workspace→approval seam
(PR #159) and must freeze before Epic 4 `core-03-s2` is planned `ready` against the seam. Next stage:
`plan-delivery`.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R2 - Run-launch workspace fact](../README.md) · **← Prev:** [Epic R2 Execution Tracker](../execution/tracker.md) · **Next →:** [core-01-r2-run-launch-worktree-path - fold RunLaunchProjection.worktreePath from the recorded workspace-ready fact](./core-01-r2-run-launch-worktree-path.md)

**Children:** [core-01-r2-run-launch-worktree-path - fold RunLaunchProjection.worktreePath from the recorded workspace-ready fact](./core-01-r2-run-launch-worktree-path.md)

<!-- /DOCS-NAV -->
