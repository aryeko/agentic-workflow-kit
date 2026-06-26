---
title: "Role — orchestrator"
status: draft
last-reviewed: "2026-06-22"
---

# Orchestrator

> **Audience** — whoever builds or verifies this role's engine: the `orchestrated-delivery` skill
> that implements it. This spec is **what that skill must implement**; the runtime "how" lives in
> the skill.

## Goal

Pure coordination. Move work; never judge it.

## Requirements

- **Sequence dependency waves** from the epic DAG; dispatch only `ready` stories.
- **Per-story worktree isolation** — each story is realized in its own worktree, where the
  [implementer](implementer.md) commits each round (see below).
- **Capacity planning** — reserve reviewer / re-address slots within the agent cap.
- **Honor the characterized ownership** — workers touch only their **owned pathset** (which now
  includes a public-symbol story's own `index.ts` export line).
- **Honor the characterized model tier** — the DAG's suggested tier is the **floor**, never below.
- **Do NOT commit story content** — the implementer owns per-round commits in the story worktree. The
  orchestrator's only git writes are the **track-branch merge-back** and the tracker.
- **Gate on the reviewer's verdict and run the incremental loop:** route **BLOCKING** findings back
  to the [implementer](implementer.md) and **re-dispatch [review](reviewer.md), iterating until
  APPROVE**.
- **Cap the loop at 5 rounds.** On exhaustion of the **5-round** cap without APPROVE, **block + escalate
  that story** to the [architect](architect.md); record the block in the tracker. Block only the minimal
  set — sibling stories keep running.
- **Merge approved stories back to the track branch.** On **APPROVE**, merge the story worktree's
  per-round commits onto the named **track branch** (story worktree → merge-back to track branch → later
  PR track → `v-next`). On a merge-back conflict, **message the persistent implementer to rebase onto the
  track `HEAD` and re-prove (gate green)**, then commit the track merge. A trivial replay rebases cleanly;
  a **real logic conflict** means the same-logic rule was violated upstream — **escalate**, do not
  silently resolve.
- **Write the tracker** per the canonical schema in
  [`delivery-pipeline/30-plan-delivery.md`](../delivery-pipeline/30-plan-delivery.md): status, round,
  per-round implementer commit + reviewer verdict, block reason, merge-back commit, gate evidence.
- **Report operator-visible run and story state as an actionable ledger.** Visible updates summarize the
  current state, why it matters, and the next action or awaited event. Raw worker/tool events are evidence
  behind the ledger, not the operator-facing state model.
- **Close the worker pair; clean the story tree only on merge.** Once a story is merged back, close its
  implementer/reviewer pair and remove the disposable story worktree. On a **block/escalation** (5-round
  cap or source-contract blocker), **preserve the story worktree and report its path** so the architect
  has the unmerged WIP and context to diagnose — clean it only after the block is resolved.
- **Honor the same-logic concurrency rule** — same-logic stories never run in the same wave (planning
  guarantees it; canonical rule in
  [`authoring-standard/40-story-dag.md`](../authoring-standard/40-story-dag.md)). Concurrent stories that
  share only an append-only aggregation point (e.g. the SDK barrel) rebase trivially on merge-back; a real
  logic conflict is an upstream planning defect to escalate, not to resolve.
- **Review against the latest committed round in the story worktree, never a stashed tree** — the
  reviewer is always pointed at the implementer's committed round, never a tree with sibling files stashed
  out.
- **HARD RULE — refuse to dispatch any story not flagged `ready`** — a boolean check, not a
  judgment.
- **Does NOT** review code, judge the "what", inspect diffs for quality, fix code, or improvise scope.

## Inputs

- The epic plan (DAG) — waves, owned pathsets, same-wave concurrency (the same-logic rule + any
  architect override), seams by import path, phase-boundary readiness gate, suggested model tier (from
  the [architect](architect.md)).
- The `ready` flag per story (from [characterization review](characterization-review.md)).
- The [reviewer](reviewer.md)'s verdict each round (APPROVE / BLOCKING with findings).
- The named **track branch** the delivery's stories merge back onto.

## Outputs

- Per-story worktrees and dispatched implementer / reviewer agents in dependency order.
- BLOCKING findings routed back to the implementer; re-dispatched review until APPROVE or the 5-round cap.
- Each approved story's per-round commits **merged back to the track branch**; the **tracker** written per
  the canonical schema; blocked stories escalated to the architect.
- An operator-visible ledger of run/story state transitions, with each visible update naming the state,
  its significance, and the next action or awaited event.

## Flow

1. Read the DAG; compute dependency waves and capacity (reserve reviewer / re-address slots).
2. For each `ready` story in the wave, cut an isolated worktree; **refuse any non-`ready` story**.
3. Dispatch the implementer at or above the DAG's suggested tier, scoped to the owned pathset; the
   implementer commits each round in that worktree.
4. Dispatch the reviewer against the implementer's latest committed round.
5. On **BLOCKING**, route findings to the implementer and re-dispatch review — loop until APPROVE or the
   **5-round** cap. On cap exhaustion, **block + escalate** the story (siblings continue) and record it in
   the tracker.
6. On **APPROVE**, merge the story's per-round commits back to the track branch. On a merge-back conflict,
   ask the implementer to rebase onto track `HEAD` + re-prove, then commit the track merge; escalate a real
   logic conflict instead of resolving it. Write the tracker; close the worker pair; clean the story tree.

## Validation

An engine implements this role correctly when:

- it **refuses to dispatch** a non-`ready` story (boolean check, not judgment);
- it **never commits story content** — the implementer commits each round; the orchestrator only merges
  back to the track branch and writes the tracker;
- it loops BLOCKING → implementer → re-review until APPROVE, and **blocks + escalates** at the 5-round cap
  while siblings continue;
- it triggers an implementer rebase on a merge-back conflict and **escalates a real logic conflict** rather
  than resolving it;
- it points reviewers at the latest committed round, never a stashed tree;
- its operator-visible updates are separable from raw worker/tool events and identify state, significance,
  and next action or awaited event;
- it never reviews code, fixes code, re-judges the "what", or expands scope.

## Acceptance

Correctly implemented when work advances by dependency waves, the implementer commits each round and the
orchestrator merges only approved stories back to the track branch, no non-`ready` story is ever
dispatched, the loop runs to APPROVE or blocks + escalates at the 5-round cap, and the tracker durably
records each story's status, rounds, verdicts, and merge-back. The operator can also reconstruct the live
run posture from sparse state updates without reading raw worker/tool event streams.

## References

- [Operating model](README.md) — the parent spec; the incremental loop; enforcement rules.
- [Architect](architect.md) — supplies the DAG and ownership/tier characterization.
- [Characterization review](characterization-review.md) — owns the binding `ready` flag.
- [Implementer](implementer.md) · [Reviewer](reviewer.md) — the dispatched workers in the loop.
- `orchestrated-delivery` skill — the runtime "how" this spec must be implemented by.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Operating model — delivery system spec](./README.md) · **← Prev:** [Role — characterization review](./characterization-review.md) · **Next →:** [Role — implementer](./implementer.md)

<!-- /DOCS-NAV -->
