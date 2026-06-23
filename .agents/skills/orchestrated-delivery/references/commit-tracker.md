# Commit And Tracker

Use this reference at each approved story boundary. Tracker updates for approved stories are part of
the same approved-story commit as the approved story changes. They must not be left as an uncommitted
follow-up edit.

## Commit Lock

Only the coordinator enters the commit lock.

Before staging in a story worktree:

- wait for active workers that could touch the same files;
- confirm the worktree has no unrelated or unapproved changes in the staged pathset;
- confirm the story branch is based on the current delivery `HEAD`, or stop/rebase before finalizing;
- stage only the approved story files and the selected story's `execution/tracker.md` row;
- run the repo-defined gate, or a narrower gate only when explicitly approved and recorded.

Do not commit worker self-reports, reviewer approval alone, gate output alone, unapproved diffs,
unrelated user edits, downstream experiments, another story's changes, or coordinator-authored
implementation patches.

## Blocked Story Tracker Evidence

When a story stops on a source-contract blocker before any approved-story commit, do not create an
approved-story commit. Update only the affected tracker row with:

- status `blocked`;
- reviewer verdict unchanged or `not-run` when review never started;
- gate evidence naming the worker report and coordinator inspection;
- commit hash field empty, `none`, or another package-approved blocked sentinel;
- blockers naming the source-contract defect, affected AC/failure row, missing fact, and route-back
  target;
- notes naming the worker alias and why dependents remain locked.

Commit only the tracker update when the repo workflow allows tracker evidence commits for blocked
stories. This blocked tracker commit is evidence of the stop; it is not a substitute for the missing
approved-story commit and must not unlock dependents. The blocked-story tracker evidence commit must
be present in the delivery worktree history before the blocked status is treated as durable.

## Approved Story Sequence

Use this default single-commit sequence for every approved story:

1. **Tracker update.** In the story worktree, edit only the selected story row in
   `execution/tracker.md` to record final status, reviewer verdict, gate evidence, blockers, notes,
   and downstream status. The tracker does not need to record the final git commit hash because the
   approved-story commit records the durable story-id-to-commit mapping in git history.
2. **Approved-story commit.** Commit the approved story pathset plus that selected tracker row update
   with the planned conventional subject. The commit message must include a durable story id trailer,
   `Story: <story-id>`, so a resumed coordinator can reconstruct dependency commit hashes from
   delivery git history without a tracker-row commit hash. Capture `APPROVED_STORY_COMMIT` from git
   after the commit succeeds.
3. **Merge back.** Fast-forward the delivery worktree to the story branch according to
   `story-worktrees.md`, preserving `APPROVED_STORY_COMMIT` as the dependency substrate.

The tracker update is durable when `APPROVED_STORY_COMMIT` exists and is present in the delivery
worktree. Do not create a separate tracker-only evidence commit for approved stories.

## Resume Mapping

The tracker does not need to record the final approved-story git hash. On resume, reconstruct approved
dependency commits from delivery git history by finding approved-story commits whose message includes
`Story: <story-id>` and whose diff includes that story's selected tracker row update. If the git
history and tracker row disagree, use `Evidence Precedence` below and stop before unlocking dependents.

## Downstream Readiness

A story unblocks dependents only after all of these are true:

- reviewer verdict is approved;
- required gate evidence is recorded;
- `APPROVED_STORY_COMMIT` exists;
- `APPROVED_STORY_COMMIT` includes the approved story pathset and selected tracker row update;
- `APPROVED_STORY_COMMIT` is present in the delivery worktree;
- `APPROVED_STORY_COMMIT` carries the matching `Story: <story-id>` trailer;
- the story's implementer/reviewer pair is closed or terminal.

Dependent worker prompts receive dependency approved-story commit hashes. Approved but uncommitted
work, gated but uncommitted work, tracker edits without an approved-story commit, or story commits not
merged back into the delivery worktree are not valid substrate.

## Evidence Precedence

When tracker state conflicts with git, gate output, reviewer evidence, or live PR/check state, trust
the external evidence first and correct the tracker at the next allowed tracker boundary. Record the
correction in the tracker notes; do not preserve stale status because it was already written.
