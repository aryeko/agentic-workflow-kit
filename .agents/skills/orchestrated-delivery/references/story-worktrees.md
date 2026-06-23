# Story Worktrees

Use this reference after package preflight and runtime binding, before launching workers for a story.
The delivery worktree is the coordinator and integration tree. Story worktrees are disposable
execution trees.

## Delivery Worktree

The delivery worktree owns orchestration state, dependency ordering, branch publication, and final PR
work. It must not accumulate uncommitted story implementation work.

Before creating, merging, or cleaning up a story worktree:

- confirm the shell path is the delivery worktree, not the primary checkout or another story tree;
- confirm the delivery worktree has no unrelated uncommitted changes;
- record the delivery branch and `HEAD`;
- start only dependency-ready stories.

The delivery worktree receives story changes only as committed story branch history.

## Story Worktree Creation

Create one temporary local branch and worktree per story from the current delivery `HEAD`. Prefer a
stable, collision-resistant branch name such as:

```text
codex/orchestrated-delivery/<run-id>/<story-id>
```

Create the worktree under the repo's `.worktrees/` directory unless the user or repo instruction names
another location. Record the story id, worktree path, branch, base commit, and delivery `HEAD` in the
ledger before launching the implementer.

Do not use detached story worktrees for normal execution. Temporary branches give the coordinator a
stable merge-back target and preserve the same commit hash when the delivery worktree can fast-forward.

## Worker Binding

Send each story's implementer and reviewer to that story's worktree path. The worker runtime envelope
must name:

- the story worktree path and branch;
- the delivery worktree path for context only;
- the allowed story pathset and tracker row;
- current dependency approved-story commit hashes;
- mutation limits and the rule that workers never stage, commit, push, PR, merge, or clean up.

Reviewer findings route back to the existing implementer context in the same story worktree. The
coordinator must not patch story implementation in response to review findings.

## Merge Back

After reviewer approval, required gates, and the approved-story commit succeeds in the story worktree,
merge the story branch back into the delivery worktree with:

```sh
git merge --ff-only <story-branch>
```

Use `--ff-only` as the default because it preserves the approved-story commit hash and proves the story
branch is a direct descendant of the delivery branch.

If the delivery branch advanced while the story was active, rebase the story branch onto the current
delivery `HEAD` before the approved-story commit whenever possible. If rebase or merge-back conflicts,
stop story finalization, keep the story worktree, and route conflicts that touch story implementation
to the existing implementer context in that story worktree. Do not resolve story implementation
conflicts directly in the delivery worktree.

## Cleanup

Remove the story worktree and delete its temporary branch only after:

- the approved-story commit is present in the delivery worktree;
- downstream readiness has been recorded in the ledger;
- the story's implementer/reviewer pair is closed or terminal.

Leave blocked, conflicted, or under-review story worktrees in place and report their paths.

## Blocked Story Evidence

Blocked stories do not produce approved-story commits. When `commit-tracker.md` allows blocked-story
tracker evidence, land that tracker-only commit in the delivery worktree history under the coordinator
commit lock, staging only the affected tracker row. If the blocker was first recorded in a story
worktree, copy only the tracker row update into the delivery worktree; do not merge or cherry-pick
story implementation WIP. The blocked evidence commit is durable stop evidence, not dependency
substrate, and it never unlocks dependents.

## Concurrency

Independent stories may run concurrently only in separate story worktrees with non-overlapping
pathsets, within `worker-cap` and `implementer-cap`. Final merge-back uses a single coordinator commit
lock. Before finalizing any story whose base is no longer the delivery `HEAD`, rebase or stop as above.
