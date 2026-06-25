# Communication

Keep coordinator communication sparse and evidence-based.

## Status

Report meaningful transitions:

- package preflight passed or refused;
- runtime binding completed;
- story worktree created or merged back;
- a worker launched, returned, or hit a blocker;
- review approved or reached the 5-round cap;
- story merged back to the track branch, or blocked and escalated;
- dependency became ready;
- PR published, review state changed, or merge completed.

During waits, stay quiet unless there is new evidence, a timeout threshold, a blocker, or the user
asks for status. Avoid filler wait narration and fixed sub-minute polling.

## Coordinator Context

Do not paste full worker transcripts, whole diffs, or raw gate logs into the coordinator context.
Reduce each worker result to ledger fields: story id, story worktree, worker alias, changed files,
verdict, gate evidence, per-round commits, merge-back commit, blockers, and residual risk.

Reinspect live state with targeted commands rather than rereading unchanged transcripts.

## Final Closeout

Report:

- selected package and readiness verdict;
- stories completed, blocked, or skipped;
- track-branch merge-back commits and any blocked-story tracker evidence;
- verification run;
- PR URL or explicit reason no PR was opened;
- worker pairs closed or left terminal;
- remaining blockers or required planning repairs.
