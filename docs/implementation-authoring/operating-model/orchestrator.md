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
- **Per-story worktree isolation** — each story is realized in its own worktree draft.
- **Capacity planning** — reserve reviewer / re-address slots within the agent cap.
- **Honor the characterized ownership** — workers touch only their **owned pathset**.
- **Honor the characterized model tier** — the DAG's suggested tier is the **floor**, never below.
- **Commit ONLY the approved pathset**; open / update the PR.
- **Gate on the reviewer's verdict and run the incremental loop:** route **BLOCKING** findings back
  to the [implementer](implementer.md) and **re-dispatch [review](reviewer.md), iterating until
  APPROVE**; only then commit the pathset.
- **Own shared-file non-collision** — isolate each story in its own worktree, merge approved
  pathsets at commit, and **serialize only a file whose parallel edits cannot be safely merged**.
  Planning supplies accurate pathsets and public-exposure ACs; there is no shared-file owner role.
- **Review against the isolated worktree DRAFT, never a stashed tree** — a reviewer is always
  pointed at the story's own worktree draft, never a tree with sibling files stashed out.
- **HARD RULE — refuse to dispatch any story not flagged `ready`** — a boolean check, not a
  judgment.
- **Does NOT** review code, judge the "what", inspect diffs for quality, or improvise scope.

## Inputs

- The epic plan (DAG) — waves, owned pathsets, shared-file ownership, seams by import path,
  phase-boundary readiness gate, suggested model tier (from the [architect](architect.md)).
- The `ready` flag per story (from [characterization review](characterization-review.md)).
- The [reviewer](reviewer.md)'s verdict each round (APPROVE / BLOCKING with findings).

## Outputs

- Per-story worktree drafts and dispatched implementer / reviewer agents in dependency order.
- BLOCKING findings routed back to the implementer; re-dispatched review until APPROVE.
- The committed **approved pathset** and the opened / updated PR.

## Flow

1. Read the DAG; compute dependency waves and capacity (reserve reviewer / re-address slots).
2. For each `ready` story in the wave, cut an isolated worktree draft; **refuse any non-`ready`
   story**.
3. Dispatch the implementer at or above the DAG's suggested tier, scoped to the owned pathset.
4. Dispatch the reviewer against that worktree draft.
5. On **BLOCKING**, route findings to the implementer and re-dispatch review — loop until APPROVE.
6. On **APPROVE**, merge and commit only the approved pathset; serialize any unmergeable shared
   file; open / update the PR.

## Validation

An engine implements this role correctly when:

- it **refuses to dispatch** a non-`ready` story (boolean check, not judgment);
- it commits **exactly one approved pathset** per story — never a worker's out-of-pathset edit;
- it loops BLOCKING → implementer → re-review until APPROVE, committing nothing before APPROVE;
- it points reviewers at the isolated worktree draft, never a stashed tree;
- it never reviews code, re-judges the "what", or expands scope.

## Acceptance

Correctly implemented when work advances by dependency waves, every committed change is exactly one
approved pathset, no non-`ready` story is ever dispatched, and the implement→review loop runs to
APPROVE before any commit.

## References

- [Operating model](README.md) — the parent spec; the incremental loop; enforcement rules.
- [Architect](architect.md) — supplies the DAG and ownership/tier characterization.
- [Characterization review](characterization-review.md) — owns the binding `ready` flag.
- [Implementer](implementer.md) · [Reviewer](reviewer.md) — the dispatched workers in the loop.
- `orchestrated-delivery` skill — the runtime "how" this spec must be implemented by.