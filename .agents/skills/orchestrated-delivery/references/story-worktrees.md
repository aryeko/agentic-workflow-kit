# Story Worktrees

Use this reference after package preflight and runtime binding, before launching workers for a story.
The **track branch** is the delivery's integration line; the orchestrator works in a **track worktree**
checked out on it. Story worktrees are disposable execution trees where implementers commit each round.

## Track Branch And Track Worktree

The track branch is a named collection branch that holds the delivery's stories; the model is: story
worktree → merge-back to the track branch → later PR from the track branch to `v-next`. The
orchestrator's track worktree owns orchestration state, dependency ordering, merge-back, the tracker,
and final PR work. It must not accumulate uncommitted story implementation work; story changes arrive
only as merged story-branch history.

Before creating, merging, or cleaning up a story worktree:

- confirm the shell path is the track worktree, not the primary checkout or a story tree;
- confirm the track worktree has no unrelated uncommitted changes;
- record the track branch and its `HEAD`;
- start only dependency-ready stories.

## Story Worktree Creation

Create one temporary local branch and worktree per story from the current track branch `HEAD`. Prefer
a stable, collision-resistant branch name such as:

```text
codex/orchestrated-delivery/<run-id>/<story-id>
```

Create the worktree under the repo's `.worktrees/` directory unless the user or repo instruction names
another location. Record the story id, worktree path, branch, base commit, and track branch `HEAD` in
the ledger before launching the implementer.

Use temporary branches, not detached story worktrees: they give the orchestrator a stable merge-back
target and preserve the per-round commit hashes when the track branch can fast-forward.

## Worker Binding

Send each story's implementer and reviewer to that story's worktree path. The worker runtime envelope
must name:

- the story worktree path and branch;
- the track worktree path for context only;
- the allowed story pathset (including the story's own `index.ts` export line when it exposes a public
  symbol);
- current dependency merge-back commit hashes present on the track branch;
- the commit rule (the implementer commits each round in its own pathset, gate-green, round trailer)
  and the limits (no push, PR, merge, tracker edit, or cleanup).

Reviewer findings route back to the existing implementer context in the same story worktree. The
orchestrator must not patch story implementation in response to review findings.

## Merge Back

After reviewer APPROVE on the latest committed round and the required gate, merge the story branch's
per-round commits onto the track branch with:

```sh
git merge --ff-only <story-branch>
```

Use `--ff-only` as the default because it preserves the per-round commit hashes and proves the story
branch is a direct descendant of the track branch.

If the track branch advanced while the story was active and the fast-forward fails, **message the
persistent implementer to rebase the story branch onto the current track `HEAD` and re-prove** (gate
green), then complete the merge-back. A trivial replay rebases cleanly. A **real logic conflict** means
the same-logic rule was violated upstream in planning — **escalate** it as a planning defect; do not
resolve story implementation conflicts directly in the track worktree.

## Cleanup

Remove the story worktree and delete its temporary branch only after:

- the merge-back is present on the track branch;
- downstream readiness has been recorded in the ledger and tracker;
- the story's implementer/reviewer pair is closed or terminal.

Leave blocked, conflicted, or under-review story worktrees in place and report their paths.

## Blocked Story Evidence

Blocked stories (5-round cap or source-contract blocker) produce no merge-back. The orchestrator writes
the `blocked` tracker row on the track branch per `commit-tracker.md`, recording only the affected
tracker row; it does not merge or cherry-pick story implementation WIP. The blocked evidence is durable
stop evidence, not dependency substrate, and it never unlocks dependents.

## Concurrency

Same-wave concurrency follows the **same-logic rule** (canonical in
`authoring-standard/40-story-dag.md`): two non-dependent stories may run concurrently only when their
owned pathsets share no logic-bearing file. Append-only aggregation points — the SDK barrel,
registries, manifests, index/aggregator files — are not logic-bearing: concurrent stories share them
and the orchestrator's merge-back rebases the line-level overlap, never serializing the stories.
Planning guarantees same-logic stories never share a wave, so merge-back rebases stay trivial; a real
logic conflict at merge-back is an upstream planning defect to escalate. Keep concurrent launches
within `worker-cap` and `implementer-cap`. Before finalizing any story whose base is no longer the
track branch `HEAD`, rebase via the implementer as above.
