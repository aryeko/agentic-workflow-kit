# Commit And Tracker

Use this reference at each approved story boundary. Tracker updates must be durable repo history, not
an uncommitted follow-up edit.

## Commit Lock

Only the coordinator enters the commit lock.

Before staging:

- wait for active workers that could touch the same files;
- confirm the worktree has no unrelated or unapproved changes in the staged pathset;
- stage only the approved story files;
- run the repo-defined gate, or a narrower gate only when explicitly approved and recorded.

Do not commit worker self-reports, reviewer approval alone, gate output alone, unapproved diffs,
unrelated user edits, downstream experiments, or another story's changes.

## Blocked Story Tracker Evidence

When a story stops on a source-contract blocker before any story commit, do not create a story commit.
Update only the affected tracker row with:

- status `blocked`;
- reviewer verdict unchanged or `not-run` when review never started;
- gate evidence naming the worker report and coordinator inspection;
- commit hash empty or `none`;
- blockers naming the source-contract defect, affected AC/failure row, missing fact, and route-back
  target;
- notes naming the worker alias and why dependents remain locked.

Commit only the tracker update when the repo workflow allows tracker evidence commits for blocked
stories. This blocked tracker commit is evidence of the stop; it is not a substitute for the missing
story commit and must not unlock dependents.

## Durable Sequence

Use this default two-commit sequence for every story:

1. **Story commit.** Commit only the approved story implementation changes with the planned
   conventional subject. Capture `STORY_COMMIT` from git after the commit succeeds.
2. **Tracker update.** Edit only the selected story row in `execution/tracker.md` to record final
   status, reviewer verdict, gate evidence, `STORY_COMMIT`, blockers, notes, and downstream status.
3. **Tracker evidence commit.** Stage only `execution/tracker.md`, run the lightweight verification
   appropriate for a docs-only tracker change, commit with a tracker-only subject, and capture
   `TRACKER_COMMIT`.

The tracker row must preserve the story commit hash. The tracker update is not durable until
`TRACKER_COMMIT` exists.

## Downstream Readiness

A story unblocks dependents only after all of these are true:

- reviewer verdict is approved;
- required gate evidence is recorded;
- `STORY_COMMIT` exists;
- `execution/tracker.md` records `STORY_COMMIT`;
- `TRACKER_COMMIT` exists and includes the tracker row update;
- the story's implementer/reviewer pair is closed or terminal.

Dependent worker prompts receive both the dependency story commit hash and tracker evidence commit
hash. Approved but uncommitted work, gated but uncommitted work, or tracker edits without a tracker
commit are not valid substrate.

## Evidence Precedence

When tracker state conflicts with git, gate output, reviewer evidence, or live PR/check state, trust
the external evidence first and correct the tracker at the next allowed tracker boundary. Record the
correction in the tracker notes; do not preserve stale status because it was already written.
