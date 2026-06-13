# Autopilot Remaining Operations Hardening Spec

## Context

The first autopilot hardening pass fixed the highest-risk evidence and completion issues from session
`019ebde0-8907-7072-9d6f-a8a39cc4cb1e`, excluding git-author metadata by request. The pasted
session analysis still identifies non-git operational gaps that should be implemented in the same
branch.

## Requirements

- Release parent/root tracker claims after a child settles when the row is still the parent-owned
  claim. This keeps tracker claims as locks rather than stale completion state and avoids dirty root
  checkout conflicts after worktree + PR-auto-merge children complete or block on PR policy.
- Persist child session log paths and live child metrics earlier. Session-linked events should make
  `metrics.live.json` useful during supervision, not only after `analyze_run`.
- Reconstruct per-child review evidence in `analyze_run` from child session review loops when child
  artifacts do not contain structured review fields.
- Add sparse waiting support for `watch_run`, with interval and timeout controls, so supervisors can
  poll at a low cadence until a run leaves `running`.
- Keep existing evidence hardening behavior, changeset, and workflow-autopilot guidance.
- Continue excluding git-author metadata checks and Pathway app/deploy-smoke code changes.

## Acceptance Criteria

- A settled child with an `awk:<run>:<story>` parent claim records a tracker-claim release event and
  leaves the parent tracker row unowned at its previous eligible status when the row was unchanged
  except for the claim.
- `metrics.live.json` includes a child entry with `sessionLogPath` after session linkage, before the
  child settles.
- `analyze_run` fills a child `review.prePr` summary from session review loops when no structured
  child review object exists.
- CLI and MCP `watch_run` can wait with interval and timeout options and return when status is no
  longer `running` or timeout expires.
- `pnpm check` passes and a review agent re-checks correctness.
