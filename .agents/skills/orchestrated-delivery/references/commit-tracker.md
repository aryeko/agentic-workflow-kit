# Commit And Tracker

Use this reference at each story boundary. In this model the **implementer commits each round in its
story worktree**; the orchestrator's only git writes are the **track-branch merge-back** and the
**tracker**. The orchestrator commits no story content and does not re-grade the approved diff.

## Who Commits What

- **Implementer (story worktree).** Makes the gate green (`pnpm check`) before every commit, then
  commits: an impl-done commit when the story first proves out, and one commit per fix round. Each
  commit carries a review-round trailer (`Story: <story-id>` and `Round: <n>`) so the per-round
  history is visible. The implementer never pushes, opens PRs, merges, closes contexts, or edits the
  tracker.
- **Orchestrator (track branch).** Performs only two git writes: the track-branch merge-back of an
  approved story's per-round commits, and the tracker update. It never stages or commits story
  implementation, never patches reviewer findings, and never re-grades or overrides the reviewer's
  APPROVE.

## Approved Story Sequence

When the reviewer returns APPROVE on the latest committed round:

1. **Merge back.** Merge the story branch's per-round commits onto the track branch per
   `story-worktrees.md` (prefer `--ff-only`). On a merge-back conflict, message the persistent
   implementer to rebase onto the track `HEAD` and re-prove (gate green), then complete the merge; a
   trivial replay rebases cleanly, a **real logic conflict** means the same-logic rule was violated
   upstream — **escalate**, do not silently resolve. Capture the merge-back commit hash.
2. **Tracker update.** Write the story's tracker row per the canonical schema in
   `docs/implementation-authoring/delivery-pipeline/30-plan-delivery.md`: status `merged`, the final
   `round`, each round's implementer commit hash + reviewer verdict, the `gate` evidence pointer, and
   the `merge` commit hash. The tracker update is the orchestrator's, on the track branch.

Do not bundle story content into a tracker commit, and do not commit reviewer approval alone, gate
output alone, unapproved diffs, unrelated user edits, another story's changes, or
orchestrator-authored implementation patches.

## Blocked Story Tracker Evidence

A story is blocked on either trigger:

- a **source-contract blocker** reported by a worker before the story proves out (see
  `worker-lifecycle.md`);
- **5-round cap exhaustion** without APPROVE (see `worker-lifecycle.md`).

For either, create **no merge-back**. Update only the affected tracker row with:

- status `blocked`;
- `round` reached;
- per-round record for the rounds that ran (implementer commit hash + reviewer verdict each);
- the `blocked` reason — which AC or finding blocked, and the escalation target (architect);
- `merge` empty;
- notes naming the worker alias and why dependents remain locked.

The blocked tracker write is the orchestrator's record of the stop; it is not a substitute for a
merge-back and must not unlock dependents. It must be present on the track branch before the blocked
status is treated as durable.

## Resume Mapping

On resume, reconstruct each story's state from the tracker row and the track branch: the per-round
record names the implementer commit hashes, and the `merge` field names the merge-back commit. Confirm
the merge-back commit is present on the track branch and carries the story's per-round commits. If the
tracker row and git history disagree, use `Evidence Precedence` below and stop before unlocking
dependents.

## Downstream Readiness

A story unblocks dependents only after all of these are true:

- the reviewer's latest-round verdict is `APPROVE`;
- the required gate evidence is recorded;
- the story's per-round commits are **merged back to the track branch** (the `merge` commit exists and
  is present on the track branch);
- the tracker row is updated to `merged`;
- the story's implementer/reviewer pair is closed or terminal.

Approved-but-unmerged work, gated-but-unmerged work, or a tracker edit without a merge-back are not
valid substrate. Dependent worker prompts receive the producer's merge-back commit hashes from the
track branch.

## Evidence Precedence

When tracker state conflicts with git, gate output, reviewer evidence, or live PR/check state, trust
the external evidence first and correct the tracker at the next allowed tracker write. Record the
correction in the tracker notes; do not preserve stale status because it was already written.
