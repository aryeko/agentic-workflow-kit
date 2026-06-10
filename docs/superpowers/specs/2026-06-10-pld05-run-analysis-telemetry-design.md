# PLD05 Run Analysis Telemetry Design

## Goal

Make `analyze-run` tell the truth about PLD05-style interactive `implement-next` runs: local pre-PR review ran, review findings were fixed, the review passed, the PR review thread was resolved, and the PR merged.

## Problem

The PLD05 run emitted useful evidence, but writer and analyzer vocabulary drifted:

- `pre_pr_review_blocked` sometimes meant review execution failed, and sometimes meant review returned blocking findings.
- `pre_pr_review_passed`, `pre_pr_review_fix_batch_applied`, `codex_pr_review_thread_resolved`, and `pr_merged` were emitted but not fully consumed.
- Event timestamps can be manually supplied and sort later phases ahead of earlier file-order evidence.
- `state.json` can omit `interactive.sessionId` and `interactive.sessionLogPath` even when the session log exists.
- Review-agent guidance can turn telemetry observability findings into visible UI requests outside the story/spec boundary.

## Intended Behavior

The analyzer must distinguish three local review states:

- execution blocked: the reviewer could not run, recorded as `pre_pr_review_blocked` without findings or with an explicit execution-failure reason.
- findings returned: the reviewer ran and returned `verdict: "BLOCK"` or a findings list, recorded canonically as `pre_pr_review_completed` or `pre_pr_review_findings`.
- passed: the reviewer ran and returned `verdict: "PASS"`, recorded canonically as `pre_pr_review_completed` or accepted from legacy `pre_pr_review_passed`.

The analyzer must support PLD05 aliases:

- `pre_pr_review_blocked` with findings is a findings result, not an execution blocker.
- `pre_pr_review_fix_batch_applied` counts as a local review fix batch.
- `pre_pr_review_passed` clears the local review gate.
- `codex_pr_review_thread_resolved` counts as PR review follow-up and a resolved thread.
- `pr_merged` counts as merged.

Event ordering must keep file order visible. The timeline should not hide the journal sequence when caller-supplied `eventAt` values are out of order.

Session linkage should be best effort. If `sessionId` is absent but a run has enough evidence to identify sessions later, the analyzer should say linkage is unavailable rather than implying no activity.

Review instructions must keep story/spec scope authoritative. For telemetry stories, observability can mean instrumentation on existing interactions or internal state transitions; reviewers must not require new visible UI controls unless the story or product docs require them.

## Non-Goals

- Do not parse arbitrary natural language review comments from session logs into structured findings.
- Do not change tracker completion rules.
- Do not require repeated Codex PR review after every fix when `pr.review.rerequestAfterFix` is false.
