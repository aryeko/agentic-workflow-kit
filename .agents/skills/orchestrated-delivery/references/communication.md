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

## Worker Transition Envelope

Coordinator-visible worker transitions must lead with ledger context, not raw worker ids or long
prompt previews. Use stable first-line headers for wait, launch, input/readdress, result/blocker, and
close transitions:

```text
Wait: 2 workers active
- core-03-s3-impl R1 | implementer | story=core-03-s3-pending-park-resume | id=019f...
- core-04-s3-impl R1 | implementer | story=core-04-s3-timers-wait | id=019f...

Launch: core-04-s3-review R1 | reviewer | story=core-04-s3-timers-wait | model=<actual> | id=019f...

Input: core-04-s3-impl R2 | rebase/reprove after track advanced | base=<track-head> | prior=8882a17

Result: core-03-s3-impl R1 BLOCKED | source-contract | commit=none | changes=none | route=$plan-epic
Reason: missing/contradictory token `approval-resume-capability-missing`.

Closed: core-04-s3 pair | impl=019f... | review=019f...
```

Required fields:

- wait: active count plus one line per active worker with alias, role, story id, round, and raw id;
- launch: alias, role, story id, round, purpose, actual model when known, and raw id if already known;
- input or readdress: alias, role, story id, round, purpose, base or prior commit when applicable;
- result or blocker: alias, story id, role, round, verdict, commit or `none`, changed-files count or
  `none`, blocker class, route-back target, and residual risk when known;
- close: collapse a story's implementer/reviewer pair into one line when both close together.

Raw worker ids remain available for traceability, but they are metadata. They must never be the only
first-line identifier and must not appear before the alias/story/role/round context in coordinator
summaries.

## Coordinator Context

Do not paste full worker transcripts, whole diffs, or raw gate logs into the coordinator context.
Reduce each worker result to ledger fields: story id, story worktree, worker alias, role, round,
changed files, verdict, gate evidence, per-round commits, merge-back commit, blockers, route-back
target, and residual risk.

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
