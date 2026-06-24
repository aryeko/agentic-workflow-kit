# Epic 3 Delivery Retro

Generated: 2026-06-24

Subject: Epic 3 core runtime spine implementation delivery in `workflow-kit`.

Primary run: orchestrator session `019ef561-420b-7391-ab8b-d87aef2ea3e9`.

Primary PR: <https://github.com/aryeko/agentic-workflow-kit/pull/144>.

Time basis: timestamps are UTC unless stated otherwise. The original Codex desktop environment used
Asia/Jerusalem local time, UTC+03:00 on these dates.

## How to Read This Report

This report is ordered high-to-low:

1. This index contains the durable answer, key metrics, and recommendations.
2. [Process and timeline](./01-process-and-timeline.md) reconstructs what happened.
3. [Spawned sessions](./02-spawned-sessions.md) covers implementer/reviewer outcomes.
4. [PR review rounds](./03-pr-review-rounds.md) captures the Codex review-loop counts and severity.
5. [Cause analysis and recommendations](./04-cause-analysis-and-recommendations.md) separates causes
   from proposed changes.
6. [Evidence and method](./05-evidence-and-method.md) records handles, commands, sources, and limits.

## Executive Summary

Epic 3 delivery succeeded in the operational sense: the orchestrated branch reached a green required
check on implementation head `2c0b260c68`, all live PR review threads were resolved, Codex's final PR
comment reported no major issues on that head, and the run respected the requested stop point by not
merging.

The orchestration model worked best where it enforced evidence-first coordination: dependency waves,
worker isolation, independent review, coordinator inspection, tracker evidence, full-gate verification,
and explicit stop boundaries. The orchestrator repeatedly avoided trusting worker prose alone and used
local gates, tracker updates, commits, rebases, live PR state, and review-thread state as the source of
truth.

The delivery became expensive after PR publication. Story execution from preflight to PR creation took
about 3h 36m. PR review and fix cycling then ran about 11h 22m. The live Codex review history contains
46 finding-bearing Codex review rounds and 91 inline findings: 29 P1, 59 P2, and 3 P3. The final two
finding-bearing rounds were both single P1 findings, followed by a final no-major-issues Codex issue
comment on `2c0b260c68`.

The spawned implementer/reviewer sessions were useful but incomplete. They kept pathsets mostly scoped,
caught real blockers, and produced reviewed story slices. They did not reliably prove shared package
exports, cross-story invariants, full-gate state, or PR-level runtime behavior. The coordinator had to
integrate, normalize, patch, gate, and later respond to many external review findings.

The main recommendation is to strengthen the pre-PR integration layer: add a cross-story invariant
sweep, make normalized observability story-aware, reduce watcher noise, and teach story reviewers to
inspect composed package behavior rather than only their local story surface.

## Key Observed Metrics

| Area | Metric | Value |
|---|---:|---:|
| Story delivery | Tracker stories completed | 14 |
| Story delivery | Spawned workers/reviewers | 30 |
| Story delivery | Story review completions in normalized events | 18 |
| Orchestrator | Normalized events inspected | 4,473 |
| Orchestrator | Observed turns | 2,078 |
| Git | Commits in implementation range | 76 |
| Git | `fix:` commits in implementation range | 46 |
| PR review | Finding-bearing Codex review rounds | 46 |
| PR review | Inline Codex findings | 91 |
| PR review | P1 findings | 29 |
| PR review | P2 findings | 59 |
| PR review | P3 findings | 3 |
| PR review | Final Codex no-major-issues comment | 1 |

Evidence classes:

- `observed`: directly present in a source artifact, normalized event, git output, or live PR query.
- `reconstructed`: derived by joining sources, usually tracker aliases to normalized event timestamps.
- `partial`: source exists but lacks enough structure to make the metric exact.
- `unavailable`: not exposed by inspected sources.

## What Worked

Evidence-first orchestration worked. The run repeatedly used external evidence over worker self-report:
`pnpm check`, focused tests, tracker evidence, git commits, live PR threads, and final PR state.

Dependency-ready semantics worked. Downstream stories were not unlocked until upstream work was
implemented, reviewed, approved, checked, committed, and recorded.

Worker/runner separation worked. Workers wrote code but did not commit, push, update tracker, create
PRs, or merge. The orchestrator retained runner authority.

Blocker honesty worked. `core-02-s2` stopped on a real source-contract gap. The run did not paper over
missing semantics.

Mid-run adaptation worked. The orchestrator reloaded updated guidance and incorporated the new
readiness rule without restarting the run.

Final stop discipline worked. The branch reached a review-clean and check-green implementation state,
then stopped without merge as requested.

## What Did Not Work

PR review found too much too late. The PR reviewer effectively became the deepest integration reviewer.
That is too late for the observed volume and severity of findings.

Review severity did not monotonically decline. Finding volume declined over time, but the final two
finding-bearing Codex review rounds were both P1. This means the loop converged on fewer issues per
round, not necessarily lower-risk issues per round.

Watch supervision was noisy. Watchers produced many non-actionable waits and sometimes exited without
useful terminal output. Direct live polling became the reliable path.

Story observability was under-structured. Retro analysis had to reconstruct story timelines from
aliases and tracker text. The analyzer could not directly report per-story duration, review rounds, or
usage.

Thread-cap management was manual. The run repeatedly had to close completed or blocked
workers/reviewers to free capacity.

Local gates lacked invariant breadth. The gate verified existing tests. It did not know enough about
missing runtime invariant cases until PR review described them.

## Recommendations

### P0: Add a Pre-PR Integration Invariant Sweep

Before PR creation, run a dedicated integration review or script-assisted checklist over composed
runtime behavior:

- capability gates fail closed on missing, stale, malformed, future, or self-report evidence;
- attestation consumption respects provider domain, scope, chronology, and replayability;
- run append validates creation, lifecycle, linkage, epoch, digest, retry, and terminal idempotency
  ordering;
- analysis records preserve terminal invariants, cursor bounds, redaction, report refs, and
  idempotency;
- public package exports and public testkit imports are verified from package entrypoints.

Expected effect: move many PR-review P1/P2 findings into local pre-publication review.

### P0: Make Observability Story-Aware

Add structured fields to orchestration events: `storyId`, `wave`, `role`, `agentId`, `alias`,
`promptPath`, `round`, `dependsOn`, `unlockedByCommit`, `status`, `blockerCode`, `storyCommit`,
`trackerCommit`, `gateCommand`, `gateResult`, `tokenUsage`, `startedAt`, and `completedAt`.

Expected effect: future retros can compute story duration, review rounds, blocked time, worker cost,
and throughput without transcript reconstruction.

### P1: Add a Batched PR Review Strategy

When PR review produces repeated findings in the same invariant family, stop requesting review after
each tiny fix. Collect unresolved threads, cluster by invariant class, search sibling issues, patch the
class, run focused tests plus `pnpm check`, resolve affected threads, then request one review.

Expected effect: fewer review requests and fewer single-fix commits.

### P1: Quiet and Harden Watch Mode

Watcher output should emit only review requested, changes requested, approval/no-major-issues,
timeout, CI failure, unresolved-thread count changes, or direct user-decision points. If a watcher
exits without a verdict, the wrapper should automatically run the authoritative poll and print the
normalized result.

Expected effect: lower operator attention cost and less transcript noise.

### P1: Strengthen Package Readiness Review for Safety-Critical Stories

For each high-risk story, ask: can an implementer complete this without inventing a policy shape, event
payload, authority rule, ordering rule, or acceptance predicate?

If not, the story is not ready.

Expected effect: blockers like `core-02-s2` are fixed before orchestration starts.

### P1: Upgrade Story Reviewer Prompts

Story reviewers should inspect local AC compliance, allowed pathset, public package surface, sibling
pattern consistency, dependent-story assumptions, cross-story invariant candidates, and tests that
could falsely pass.

Expected effect: reviewers catch more defects before PR publication.

## Candidate Durable Lessons

Promote these because they recur or represent process-level behavior:

- A dependency is not ready until implementation, review, coordinator inspection, gate evidence, story
  commit, tracker evidence, and current commit hash are all present.
- Worker self-report is not evidence. Treat it as a pointer to evidence.
- For long PR watch loops, the source of truth is live PR review-thread state plus checks, not watcher
  output alone.
- Explicit user approval is required before repairing planning/package artifacts during execution.
- PR publication is not a substitute for integration review; a pre-PR invariant sweep is needed for
  safety-critical runtime stories.
- Story-level observability must be structured at capture time, not reconstructed from transcript text.

Do not promote one-off implementation bugs as general lessons unless they expose a broader invariant
class.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../README.md) · **← Prev:** [Epic 3 Delivery Retro Report](../delivery-retro-report.md) · **Next →:** [Process and Timeline](./01-process-and-timeline.md)

**Children:** [Process and Timeline](./01-process-and-timeline.md) · [Spawned Sessions](./02-spawned-sessions.md) · [PR Review Rounds](./03-pr-review-rounds.md) · [Cause Analysis and Recommendations](./04-cause-analysis-and-recommendations.md) · [Evidence and Method](./05-evidence-and-method.md)

<!-- /DOCS-NAV -->
