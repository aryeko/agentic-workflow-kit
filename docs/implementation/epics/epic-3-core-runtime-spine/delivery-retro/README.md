# Epic 3 Delivery Retro

Generated: 2026-06-24

Subject: Epic 3 core runtime spine implementation delivery in `workflow-kit`.

Primary run: orchestrator session `019ef561-420b-7391-ab8b-d87aef2ea3e9`.

Primary PR: <https://github.com/aryeko/agentic-workflow-kit/pull/144>.

Time basis: timestamps are UTC unless stated otherwise. The original Codex desktop environment used
Asia/Jerusalem local time, UTC+03:00 on these dates.

> **Revision note (2026-06-24).** This report was re-analyzed against the operating model's two-bucket
> framework and the [implementation lessons ledger](../../../../implementation-authoring/lessons-ledger.md).
> Findings are now bucket-classified; recommendations are re-leveled to the cheapest catch point; and the
> original headline recommendation (a downstream "pre-PR integration sweep") is superseded by two
> left-shifts. Observed facts and metrics are unchanged — only the interpretation and recommendations.

## How to Read This Report

This report is ordered high-to-low:

1. This index contains the durable answer, key metrics, and recommendations.
2. [Process and timeline](./01-process-and-timeline.md) reconstructs what happened.
3. [Spawned sessions](./02-spawned-sessions.md) covers implementer/reviewer outcomes.
4. [PR review rounds](./03-pr-review-rounds.md) captures the Codex review-loop counts and severity.
5. [Cause analysis and recommendations](./04-cause-analysis-and-recommendations.md) separates causes
   from proposed changes — and holds the bucket split, the re-leveled recommendations, and the ledger
   reconciliation.
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

**The headline correction (this revision):** the 91 findings are two populations, not one. Most hot-spot
findings were **already enumerated** in their story contracts — with failure rows and named negative
fixtures — yet shipped and were approved by story review (a **Bucket-2** review-depth miss). The two
genuinely-late P1s were **composed cross-domain invariants with no owner in the DAG** (a **Bucket-1**
characterization miss). The primary fix is therefore to move *both* left — a composed cross-story
invariant owner at `plan-epic`, and a required scenario matrix plus a sharper story reviewer — not to add
a pre-PR integration layer *downstream* (the original P0), which sits to the right of where the operating
model says these are cheapest to catch. Story-aware observability and a quieter watch mode are real but
secondary tooling wins, and several original recommendations are **already covered** by LSN-21/22/23. Full
reasoning in [Cause Analysis and Recommendations](./04-cause-analysis-and-recommendations.md).

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

Bucket-2 invariants escaped story review. Most PR findings were in invariants the contract had already
enumerated — with failure rows and named negative fixtures — yet they shipped, story review approved
them, and `pnpm check` passed. The escape was review depth and scenario coverage, not a missing *what*.

Bucket-1 composed invariants had no owner. The two genuinely-late P1s — gate denial after terminal
lifecycle, analysis-head preservation across cursor advance — were cross-domain invariants that lived in
the seam between stories with no owner in the DAG, so they reached the external PR reviewer.

PR review became the integration net. The PR reviewer effectively became the deepest integration
reviewer — a review altitude the operating model never staffs — which is too late for the observed
volume and severity.

Review severity did not monotonically decline. Finding volume declined over time, but the final two
finding-bearing Codex review rounds were both P1: the loop converged on fewer issues per round, not
lower-risk issues per round.

Story size concentrated the churn. `core-02-s2` carried 18 ACs against the DAG's 3–10 bar; its two files
were the top-two review hot spots (~22% of all 94 threads). Oversized nodes create internal seams that
per-AC review walks past.

Watch supervision was noisy. Watchers produced many non-actionable waits and sometimes exited without
useful terminal output. Direct live polling became the reliable path.

Story observability was under-structured. Retro analysis had to reconstruct story timelines from
aliases and tracker text; the analyzer could not directly report per-story duration, review rounds, or
usage, and aliases drifted from stable ids.

Thread-cap management was manual. The run repeatedly had to close completed or blocked
workers/reviewers to free capacity — which collided with routing PR findings back to the story pair.

## Recommendations

Re-leveled to the cheapest catch point; each names its altitude and ledger status. Detail and rationale
in [Cause Analysis and Recommendations](./04-cause-analysis-and-recommendations.md).

- **R1 — Replace the single "pre-PR sweep" with two left-shifts (supersedes the original P0).**
  - **R1a (authoring · `plan-epic` / Gate 3):** a **composed cross-story invariant owner** — name the
    owning story (or epic-level invariant AC set) and the integration test; no composed invariant left
    implicit. Fixes Bucket 1. Candidate **LSN-24**.
  - **R1b (authoring · story contract R3 + reviewer prompt):** a required **scenario matrix** for every
    invariant/failure AC, plus *tests that could falsely pass* / *cross-story invariant candidates* /
    *dependent-story assumptions* on the reviewer checklist. Fixes Bucket 2. Candidate **LSN-25**.
  - **R1c (execution · `orchestrated-delivery`, optional):** any pre-PR sweep must re-run *authored*
    invariant ACs, never invent checks at runtime (preserves invariant I2).
- **R2 — Make observability story-aware (tooling).** Structured event fields + stable ids as primary
  identity.
- **R3 — Batched PR review (with caveat).** Cluster by invariant family, patch the class, request one
  review; reuse `thread-aware-pr-followup` / `watch-pr`. Reduces rounds, not findings — secondary to R1.
- **R4 — Quiet and harden watch mode (low-leverage ergonomics).**
- **R5 — Safety-critical predicate-input readiness — ALREADY COVERED by LSN-21.** Confirm the gate runs;
  do not re-add.
- **R6 — Enforce the Gate-3 sizing bar (authoring).** Decompose nodes materially over the AC budget.
- **R7 — Govern mid-run package repair and the close-workers/PR-follow-up tension (execution).**
- **R8 — Strengthen the delivery-retro contract itself (meta):** require ledger reconciliation, bucket
  classification, and recommendation pressure-testing against the operating-model invariants.
- **R9 — Worker-pool lifecycle automation — maps to LSN-20 (conditional).**

## Candidate Durable Lessons

Reconciled against the [lessons ledger](../../../../implementation-authoring/lessons-ledger.md) — the
method R8 asks every retro to apply.

New (no cover yet):

- A **composed cross-story/cross-domain runtime invariant with no owner** falls into the seam between
  stories and escapes characterization review → candidate **LSN-24** (Gate 3 composed-invariant-owner box).
- An **enumerated invariant AC can still ship wrong** when the contract requires no scenario matrix and
  the reviewer does not hunt falsely-passing tests → candidate **LSN-25** (R3 scenario matrix +
  story-reviewer checklist).
- An **oversized story (≫10 ACs)** concentrates review churn and hides internal seams → tighten Gate-3
  sizing enforcement (no new rule).
- **Mid-run package repair** requires explicit user approval and a planning route-back, never orchestrator
  self-repair (process).
- **Story-level observability** must be structured at capture time, not reconstructed from transcript text
  (tooling).
- For long PR watch loops, the **source of truth is live PR review-thread state plus checks**, not watcher
  output alone (operational).

Already covered (confirm, do not re-derive):

- "Would an implementer need to invent a policy shape / authority rule?" → **LSN-21** (R6 predicate-input
  + `plan-delivery` self-blocking preflight).
- AC proof not re-run by the standing gate → **LSN-22** (`type:fixtures` lane, PR #146).
- Tautological cross-surface parity test → **LSN-23** (`edge-01-s2`).
- A dependency is ready only with implementation, review, coordinator inspection, gate evidence, story
  commit, tracker evidence, and current commit hash all present → OD-3 / OD-6.
- Worker self-report is not evidence; treat it as a pointer to evidence → implementer/reviewer evidence
  model + invariant I5.
- Capacity / slot reservation + auto-close terminal workers → **LSN-20** (conditional; skill enforcement
  deferred).

Do not promote one-off implementation bugs against a clear spec as lessons; those remain Bucket-2 review
findings. No candidate was `recurring-despite-cover` this epic.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../README.md) · **← Prev:** [Epic 3 Delivery Retro Report](../delivery-retro-report.md) · **Next →:** [Process and Timeline](./01-process-and-timeline.md)

**Children:** [Process and Timeline](./01-process-and-timeline.md) · [Spawned Sessions](./02-spawned-sessions.md) · [PR Review Rounds](./03-pr-review-rounds.md) · [Cause Analysis and Recommendations](./04-cause-analysis-and-recommendations.md) · [Evidence and Method](./05-evidence-and-method.md)

<!-- /DOCS-NAV -->
