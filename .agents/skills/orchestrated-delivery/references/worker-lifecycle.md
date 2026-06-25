# Worker Lifecycle

Use this reference after package preflight and runtime binding. Implementers build and **commit each
round** in their story worktree; reviewers review the latest committed round; the orchestrator
coordinates the loop, merges approved stories back to the track branch, and writes the tracker. The
orchestrator commits no story content.

## Dispatch

- Default to isolated subagents. Use visible threads only when the user explicitly requests them and
  the surface supports them.
- Name each worker before launch with a short role alias, and record the alias in the ledger.
- Launch implementers only for dependency-ready stories. A dependency is ready for dispatch only when
  its per-round commits are **merged back to the track branch**, its tracker row is `merged`, and its
  implementer/reviewer pair is closed or marked terminal.
- Same-wave concurrency is governed by the **same-logic rule** (canonical in
  `authoring-standard/40-story-dag.md`; see `story-worktrees.md`): non-dependent stories may run
  concurrently only when their owned pathsets share no logic-bearing file. Stories that share only an
  append-only aggregation point (the SDK barrel, registries, manifests, index/aggregator files) may
  run concurrently and rebase trivially on merge-back. Keep launches within `worker-cap` and active
  implementers at or below `implementer-cap`.
- Keep `review-reserve` available for reviewers, rereviews, and fix-loop progress. Do not spend
  reviewer reserve on speculative implementer launches, even when more dependency-ready stories exist.
- Send each worker the packaged prompt plus a narrow runtime envelope for that story worktree. Do not
  alter the packaged prompt body.

## Completion

Use the surface's native completion signal for subagents. Use wake files and filesystem watches only
for explicitly requested visible-thread workers with no native completion signal. Treat every wake as
a notification only; confirm real state from worker output, git diff, gates, or live PR/check state.

Do not run tight polling loops.

## Persistent Pair / Incremental Review Loop

- The implementer makes the gate green and **commits** the story round in its worktree (impl-done
  commit, then one commit per fix round, each with a `Story: <story-id>` / `Round: <n>` trailer).
- Start one independent reviewer for that story, created once for the story. The reviewer reviews the
  **latest committed round**, not a stash or draft. The story now has exactly one implementer context
  and one reviewer context.
- The reviewer returns APPROVE or BLOCKING (with finding refs) against that committed round.
- For every BLOCKING round, message the **existing** implementer context with the exact findings, the
  allowed pathset, and the required response packet. Do not spawn a replacement implementer with
  copied context. The implementer fixes, re-proves the gate, and commits the next round.
- After the implementer reports the next committed round, message the **existing** reviewer context
  for rereview against that round. Do not spawn a replacement reviewer or restart the original review
  prompt.
- Repeat until APPROVE, a source-contract blocker, or the **5-round cap**.
- The orchestrator does not perform the reviewer's code-quality or AC-satisfaction role, does not patch
  implementation findings, and does not re-grade an APPROVE. On APPROVE it proceeds to merge-back per
  `commit-tracker.md`.
- If a worker context is lost, corrupted, or technically impossible to message, stop that story, record
  the exception in the ledger/tracker notes, and ask for explicit orchestrator action before replacing
  the worker pair.

## Five-Round Cap

The review loop is capped at **5 rounds**. If round 5 returns BLOCKING (no APPROVE), **block and
escalate that story** to the architect:

- create no merge-back;
- write the tracker row `blocked` with the round reached, the per-round record, the blocking AC or
  finding, and the escalation target (architect), per `commit-tracker.md`;
- keep dependents locked; block only the minimal set.

Sibling stories that do not depend on the blocked story keep running. The package, repo instruction,
or user may set a stricter cap; never a looser one without an explicit recorded exception.

## Source-Contract Blockers

If an implementer or reviewer reports that a packaged story cannot be implemented or reviewed because
the frozen contract is missing a required source fact, contradicts itself, or names a STOP condition
that overlaps an AC or failure trigger, treat it as a planning blocker rather than a worker defect.
This is a different trigger from the 5-round cap but produces the same blocked handling.

Required orchestrator behavior:

- inspect the report against the packaged story contract and prompt;
- do not ask the worker to invent the missing source fact or continue with a guessed interpretation;
- create no merge-back and do not start or unlock dependents;
- write the tracker row `blocked` with the affected AC or failure row, missing fact, worker alias, and
  route-back target (`$plan-epic` for frozen story defects, `$plan-delivery` for package-only
  projection defects);
- record the blocked tracker evidence on the track branch per `commit-tracker.md`.

## Role Boundary

Implementers commit each round within their owned pathset in their own story worktree and rebase on
the orchestrator's request; they never push, open or update PRs, merge, archive, close, mark stories
complete, or edit the tracker. Reviewers only inspect the latest committed round and return a verdict.
Workers hold NO Forge credentials (per AGENTS.md AD-12 worker/runner isolation); only the
orchestrator/runner holds push/PR/merge authority.

The orchestrator's only git writes are the **track-branch merge-back** and the **tracker** (per
`commit-tracker.md`). It must not directly implement story code, patch reviewer findings, re-grade an
APPROVE, or make opportunistic tooling fixes inside a story branch. Repo tooling fixes outside story
pathsets require an explicit separate repair step.

## Closing Workers

Keep a story's implementer and reviewer open through every fix/rereview round and through the
orchestrator's merge-back and tracker write. Close or archive only that story's pair after its
merge-back is present on the track branch. Leave unrelated worker pairs untouched.

If the surface cannot close or archive contexts, mark only that story's pair terminal in the ledger.
