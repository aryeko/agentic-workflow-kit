# Cause Analysis and Recommendations

## PR Review Churn

Live and GraphQL PR evidence from the original implementation closeout:

| Metric | Value | Evidence class |
|---|---:|---|
| PR number | 144 | observed |
| PR state at implementation closeout | open | observed live |
| Base branch | `v-next` | observed live |
| Head branch | `codex/orchestrated-epic3` | observed live |
| Final implementation head | `2c0b260c68364a549d29a32af09d54b33d4ccc58` | observed live |
| Required `check` on implementation head | success at 2026-06-24T07:34:41Z | observed live |
| `smoke` on implementation head | skipped at 2026-06-24T07:33:25Z | observed live |
| Review threads | 94 total | observed |
| Resolved threads | 94 | observed |
| Unresolved threads | 0 | observed |
| Finding-bearing Codex review rounds | 46 | observed |
| Inline Codex findings | 91 | observed |
| P1 findings | 29 | observed by body parse |
| P2 findings | 59 | observed by body parse |
| P3 findings | 3 | observed by body parse |
| Final no-major-issues comment | 2026-06-24T07:45:09Z on `2c0b260c68` | observed live |

Top review hot spots by file:

| Threads | Path |
|---:|---|
| 13 | `packages/sdk/src/core/capability/evaluator/guarantee-predicates.ts` |
| 8 | `packages/sdk/src/core/capability/evaluator/attestation-consumption.ts` |
| 8 | `packages/sdk/src/core/run-lifecycle/log/append-validation.ts` |
| 6 | `packages/sdk/src/core/observability/records/terminal-invariant.ts` |
| 5 | `packages/sdk/src/core/observability/records/record-analysis-outcome.ts` |
| 4 | `packages/sdk/src/core/run-lifecycle/lifecycle/transition-validator.ts` |
| 4 | `packages/sdk/src/core/run-lifecycle/log/append-envelopes.ts` |
| 4 | `packages/sdk/src/core/run-lifecycle/lifecycle/linkage-resolver.ts` |
| 4 | `packages/sdk/src/core/run-lifecycle/log/create-run.ts` |
| 4 | `packages/sdk/src/core/run-lifecycle/log/append-writer.ts` |

The hot spots cluster around:

- capability gate denial and fail-closed logic;
- evidence and attestation chronology;
- run append validation and digest/order guarantees;
- lifecycle/linkage authority;
- terminal analysis and idempotency invariants;
- cursor-bounded analysis/report behavior.

These are not random implementation bugs. They are composed runtime invariants that span story
boundaries.

## Cause Analysis

### Package and Story Contract Quality

The package was good enough to execute: it had 14 ready stories, wave ordering, prompts, tracker rows,
pathsets, verification guidance, and reviewer prompts.

The package was not complete enough to avoid all execution-time planning repair. `core-02-s2` had a
real policy-shape gap. The implementer correctly stopped instead of inventing missing semantics. This
is a success for worker safety, but a readiness miss for the package.

Recommendation implication: package readiness review should include a "would an implementer need to
invent a policy shape, event payload, or authority rule?" pass for safety-critical stories.

### Worker Prompt Clarity

Worker prompts were strong on scope control, path ownership, mutation limits, and evidence report
shape. This helped prevent uncontrolled edits.

They were weaker on composed package invariants. Several failures were not local to one file; they
emerged when capability gates, replay, lifecycle, writer durability, and analysis records interacted.

Recommendation implication: prompts should include a package-surface and composition checklist, not
only local AC coverage.

### Coordinator Process

The coordinator was the strongest part of the run. It enforced dependency readiness, performed central
inspection, normalized formatting/typecheck issues, controlled commits, updated tracker rows, handled
rebases, and preserved the stop point.

The coordinator also absorbed too much manual supervision cost: closing workers to free slots, polling
watchers, manually interpreting PR review state, and repeating many review cycles.

Recommendation implication: retain coordinator authority, but automate or structure its bookkeeping
better.

### Review Depth

Story reviewers were useful. They found real issues before commit: frozen catalogs, missing failure
code, public imports, coverage shortfall, provider-domain matching, replayable evidence, writer epoch
order, rejection durability, and lost-ack re-fencing.

Story reviewers were not enough. PR review found many P1/P2 issues in cross-story runtime invariants.

Recommendation implication: add a pre-PR integration reviewer or deterministic invariant sweep.

### Verification and Gate Coverage

`pnpm check` was necessary and repeatedly protected the branch. It caught formatting, lint, dependency,
typecheck, test, and coverage failures.

`pnpm check` was not sufficient to assert semantic completeness. Many PR review findings required
adding new scenario tests that the original story tests did not include.

Recommendation implication: full gate stays mandatory, but safety-critical domains need scenario
matrices derived from invariants, not only story ACs.

### PR Review Loop Design

The loop was safe and disciplined: fix, test, rebase, gate, push, resolve, rerequest.

The loop was inefficient: 46 finding-bearing Codex review rounds, 91 inline findings, and 46 `fix:`
commits in the final implementation range. The watcher often failed to produce a clean terminal
summary, forcing direct polling.

Recommendation implication: change review handling from single-thread reactive mode to batched review
rounds where possible, with a quiet and authoritative watcher.

### Observability Gaps

Normalized observability is good enough for run-level metrics. It is not good enough for story-level
retros.

The missing fields are exactly the fields needed for operator improvement: story id, prompt path, wave,
dependency state, reviewer round number, commit hash, gate command/outcome, story-scoped token usage,
story-scoped duration, and reason for close/block/retry.

Recommendation implication: make story observability a first-class contract of orchestrated delivery.

## Recommendations

### P0: Add Pre-PR Integration Invariant Sweep

Before PR creation, run a dedicated integration review or script-assisted checklist over composed
runtime behavior.

Required checks for future Epic 3-like work:

- Capability gates fail closed on missing, stale, malformed, future, or self-report evidence.
- Attestation consumption respects provider domain, scope, chronology, and replayability.
- Run append validates creation, lifecycle, linkage, epoch, digest, retry, and terminal idempotency
  ordering.
- Analysis records preserve terminal invariants, cursor bounds, redaction, report refs, and
  idempotency.
- Public package exports and public testkit imports are verified from package entrypoints.

Expected effect: move many PR-review P1/P2 findings into local pre-publication review.

### P0: Make Observability Story-Aware

Add structured fields to orchestration events:

- `storyId`
- `wave`
- `role`
- `agentId`
- `alias`
- `promptPath`
- `round`
- `dependsOn`
- `unlockedByCommit`
- `status`
- `blockerCode`
- `storyCommit`
- `trackerCommit`
- `gateCommand`
- `gateResult`
- `tokenUsage`
- `startedAt`
- `completedAt`

Expected effect: future retros can compute story duration, review rounds, blocked time, worker cost,
and throughput without transcript reconstruction.

### P1: Add a Batched PR Review Strategy

When PR review produces repeated findings in the same invariant family, stop requesting review after
each tiny fix. Instead:

1. Collect all current unresolved threads.
2. Cluster by invariant class.
3. Search for sibling issues.
4. Patch the class.
5. Run focused tests plus `pnpm check`.
6. Resolve all affected threads.
7. Request one review.

Expected effect: fewer review requests and fewer single-fix commits.

### P1: Quiet and Harden Watch Mode

Watcher output should emit only:

- review requested;
- changes requested;
- approval/no-major-issues;
- timeout;
- CI failure;
- unresolved-thread count changed;
- direct user decision needed.

It should persist enough state to explain why it exited. If it exits without a verdict, the wrapper
should automatically run the authoritative poll and print the normalized result.

Expected effect: lower operator attention cost and less transcript noise.

### P1: Strengthen Package Readiness Review for Safety-Critical Stories

Add a pre-execution question for each high-risk story:

Can an implementer complete this without inventing a policy shape, event payload, authority rule,
ordering rule, or acceptance predicate?

If not, the story is not ready.

Expected effect: blockers like `core-02-s2` are fixed before orchestration starts.

### P1: Upgrade Story Reviewer Prompts

Story reviewers should inspect:

- local AC compliance;
- allowed pathset;
- public package surface;
- sibling pattern consistency;
- dependent-story assumptions;
- cross-story invariant candidates;
- tests that could falsely pass.

Expected effect: reviewers catch more defects before PR publication.

### P2: Add Worker-Pool Lifecycle Automation

The orchestrator should automatically close terminal workers/reviewers after summary capture, status
recording, fix-routing decision, and no remaining dependency on live context.

Expected effect: fewer thread-cap interruptions.

### P2: Preserve Stable Agent Identity

Use stable ids as primary identity and aliases only as display labels. If aliases change after
compaction or reload, the tracker and event stream should still join cleanly.

Expected effect: retro and audit tools do not misattribute work.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 Delivery Retro](./README.md) · **← Prev:** [PR Review Rounds](./03-pr-review-rounds.md) · **Next →:** [Evidence and Method](./05-evidence-and-method.md)

<!-- /DOCS-NAV -->
