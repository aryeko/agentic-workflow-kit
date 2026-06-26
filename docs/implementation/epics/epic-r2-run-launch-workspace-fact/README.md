---
title: Epic R2 - Run-launch workspace fact
epic: "r2"
status: "epic: ready"
depends-on-epics: [1, 3]
last-reviewed: "2026-06-26"
---

# Epic R2 - Run-launch workspace fact

## Purpose

Surface the run's **trusted workspace root** on the run-launch projection so that downstream consumers —
specifically approval risk classification (Epic 4, `core-03-s2`) — can test path containment against a
recorded, replayable run-launch fact instead of an agent-supplied value. Forward-extend the
**already-delivered** `core-01` run-lifecycle launch projection to fold `worktreePath` from the
`workspace-ready` launch fact onto `RunLaunchProjection.worktreePath`.

This is a small **inter-epic remediation between Epic 3 and Epic 4**. It claims **zero new Story Group
Signals**: `worktreePath` is an additive field on the existing `core-01` launch-projection signal (owned
by Epic 3), surfaced from a value the workspace-and-repository domain (Epic 1) already produces. The
global coverage rollup is unchanged. Unlike a pure forward-fix remediation, this epic **has a downstream
dependent**: Epic 4 `core-03-s2` consumes `RunLaunchProjection.worktreePath` and must not be planned
ready until this epic is frozen.

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|
| `core-01` Run Lifecycle & State (delivered Epic 3) | Forward-extend the launch projection to fold the run's `worktreePath` (from the `workspace-ready` launch fact) onto `RunLaunchProjection.worktreePath`. No new lifecycle states, no new run-lifecycle-owned event payloads. | `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` (`RunLaunchProjection`), `.../projections-lifecycle-and-tests.md` (launch fold) |

## Why this epic exists

The producer↔consumer closure work surfaced a **fail-open** in approval risk classification: the rules
gate on "cwd **inside** the workspace" / "file path **outside** the workspace", but no trusted workspace
boundary was routed into approval, so the delivered code approximated "the workspace" with the
**agent-supplied `cwd`** — spoofable to fail open. The workspace→approval **design seam** was authored and
frozen in PR #159 (`de3cd04`): it adds `RunLaunchProjection.worktreePath` (producer side, run-lifecycle)
and the approval consumer side (`ApprovalContext`/`ApprovalRequest.worktreePath`, fail-closed classifier).

The **producer** of `RunLaunchProjection.worktreePath` is run-lifecycle — the **`core-01` (Epic 3)**
domain. Epic 4 owns only `core-03` and `core-04`; it cannot own a run-lifecycle producer story without
violating its charter. This inter-epic is that producer's correct home: a `core-01` forward-extension
sequenced **after Epic 3** (whose run-lifecycle it extends) and **before Epic 4's consumer**
(`core-03-s2`). Without it, `RunLaunchProjection.worktreePath` is a permanently-absent field and approval
fails closed on every request (the low-risk auto-grant path is dead) — an LSN-24 producer-closure defect.

## Frozen inputs

- **Frozen design seam (PR #159, `de3cd04`):**
  - `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` — `RunLaunchProjection.worktreePath`
    (the field this epic populates) folded from the `workspace-ready` launch fact.
  - `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md` —
    the `launch` projection folds `worktreePath`; absent until the producer records it; consumers fail closed.
- **Frozen workspace source (Epic 1, foundation):**
  `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md` — `WorktreeLease.worktreePath`
  (the run's absolute worktree path) and its events (`.../events.md`, `worktreePath: AbsolutePath`).
- **Delivered code under forward-extension:** `packages/sdk/src/core/run-lifecycle/**` (Epic 3, PR #144) —
  the launch-projection reducer and the run event-log fold.

## Outputs

- `RunLaunchProjection.worktreePath` is **populated** for runs that have reached `workspace-ready`: the
  launch-projection reducer folds the run's `WorktreeLease.worktreePath` from the recorded `workspace-ready`
  launch fact. The fold is a pure function of the recorded event stream (replayable, deterministic).
- The field is **absent** (not fabricated) when no `workspace-ready` fact has been recorded; consumers
  fail closed on absence (per the frozen design).
- Existing launch-projection behavior (policy digest, task snapshot digest, session linkage) is unchanged.
- `pnpm check` green on the amended code.

## Scope boundaries

- **In:** forward-extend the `core-01` launch-projection reducer (and its tests) so `RunLaunchProjection`
  surfaces `worktreePath`, folded from the `workspace-ready` launch fact, matching the frozen seam.
- **Out:** the approval **consumer** side (Epic 4 `core-03-s2` — `ApprovalContext`/`ApprovalRequest`
  threading and the classifier); any `docs/design/**` edit; minting a new run-lifecycle-owned event type
  or lifecycle state; re-opening the Epic 1, Epic 3, or Epic 4 charters, DAGs, or contracts.
- **STOP when:** the fold cannot source `worktreePath` from the recorded `workspace-ready` fact without a
  design change (escalate — the seam is frozen), or the fix would require run-lifecycle to mint a new
  event payload rather than fold an existing recorded workspace fact.

## Per-domain expectations

This epic owns **zero** new Story Group Signals. The table records the **frozen design seam** the story
forward-extends and the existing signal owner, which is unchanged.

### `core-01` Run Lifecycle & State

| Forward-extended seam (frozen design) | Owning story (this epic) | Signal owner (unchanged) |
|---|---|---|
| `RunLaunchProjection.worktreePath` populated by folding the run's `WorktreeLease.worktreePath` from the recorded `workspace-ready` launch fact (PR #159 seam) | `core-01-r2-run-launch-worktree-path` | Epic 3 `core-01` launch projection (no transfer) |

- Evidence expectation: a launch-projection fixture that records a `workspace-ready` fact carrying a
  `worktreePath` yields `RunLaunchProjection.worktreePath` equal to that path; a fixture with no
  `workspace-ready` fact yields `worktreePath` **absent** (not empty-string, not fabricated); the fold is
  proven a pure function of the recorded stream (replay determinism); no ambient reads.

## Epic readiness

On completion `RunLaunchProjection.worktreePath` is populated from recorded launch facts, closing the
producer side of the PR #159 workspace→approval seam. **Epic 4 `core-03-s2` depends on this epic** (it
consumes `RunLaunchProjection.worktreePath`); `core-03-s2` may not be planned `ready` against the seam
until this epic is frozen and its producer story is `ready`.

## Deferred work

- The approval **consumer** (Epic 4 `core-03-s2` amendment) is planned in Epic 4 against this epic's
  frozen producer output — not here.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [epic charters](../README.md) · **← Prev:** [Epic R1 - story DAG](../epic-r1-closure-remediation/story-dag.md) · **Next →:** [Epic R2 Execution Package Plan](./execution/plan.md)

**Children:** [Epic R2 Execution Package Plan](./execution/plan.md) · [Implementer Prompt: core-01-r2-run-launch-worktree-path](./execution/prompts/core-01-r2-run-launch-worktree-path/implementer.md) · [Reviewer Prompt: core-01-r2-run-launch-worktree-path](./execution/prompts/core-01-r2-run-launch-worktree-path/reviewer.md) · [Epic R2 Execution Tracker](./execution/tracker.md) · [Epic R2 - stories](./stories/README.md) · [Epic R2 - story DAG](./story-dag.md)

<!-- /DOCS-NAV -->
