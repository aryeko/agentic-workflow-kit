# PR And Merge

Use this reference after package stories have landed locally and the user or repo policy authorizes
publication.

## Publication

- Push only when the user asked for remote publication or repo policy clearly authorizes it.
- Open or update the PR against the repo's integration branch, not the GitHub default branch by
  assumption.
- Use a reviewer-oriented title and body: motivation, actual changes, compatibility or behavior
  notes, and verification evidence.
- Report the PR URL and stop unless the user also requested review waiting in the same workflow.

## Review Wait

If review waiting was requested or is an explicit repo-run step, use `pr-review-wait`. Preserve its
boundary: it detects review state only. It must not push, patch, comment, react, merge, or clean up.

On changes requested, use `pr-thread-followup`: inspect unresolved review threads first, patch only
actionable current-head findings, search sibling occurrences, verify, and push only when authorized.

On approval, report approval and CI state. Merge and cleanup still require explicit current user
instruction.

## Merge And Cleanup

Before merge, verify live PR head, base, draft state, check rollup, mergeability, approval state, and
unresolved threads. Use the repository's allowed merge strategy.

After merge, confirm remote PR state and merge commit, fast-forward the primary checkout's target
branch, remove only completed worktrees and merged local branches, and report what remains.
