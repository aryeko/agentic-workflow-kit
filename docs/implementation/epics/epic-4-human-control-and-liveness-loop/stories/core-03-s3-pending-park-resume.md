---
title: "core-03-s3-pending-park-resume - approval pending park resume implementation story"
id: "core-03-s3-pending-park-resume"
epic: 4
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/approval-and-escalation/README.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md"
  - "docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md"
---

# core-03-s3-pending-park-resume - Pending, Park, and Resume

## Purpose

Persist request and pending approval facts before decision, produce park/resume/expiry decisions, and
fold approval projections from committed events.

## Spec Surface

- Functions: `recordApprovalPending`, `parkApproval`, `resumePendingApproval`, `expireApproval`,
  `foldApprovalProjection`.
- Consumed approval shapes: `ApprovalRequest`, `ApprovalPendingPersistedPayload`,
  `ApprovalParkInput`, `ParkDecision`, `ApprovalParkedPayload`, `Decision`, `ResumeDecision`,
  `ApprovalProjection`, `ApprovalFailureState`.
- Runtime objects: Epic 3 `RunWriter`, `RunReplay`, `RunProjections`; Agent attestations as committed
  event values.

## Responsibilities

- Append `ApprovalRequested` and `ApprovalPendingPersisted` at `barrier` before decision recording.
- Compute `decisionDeadline = request.expiresAt ?? request.requestedAt + policy.approval.decisionWindowMs`.
- Produce `ParkDecision` from `ApprovalParkInput` for live-window elapsed, live-only channel, or
  operator attention.
- Resume only current non-ambiguous owned or owned-remote sessions with a non-expired committed grant.
- Fold pending/latest/outcome/attention/failure projections deterministically.

## Dependencies and Inputs

- Covers signals: pending persistence; parked/resumed/expired facts; pending/session/expiry/event-log
  failure behavior.
- Depends on: `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision`.
- Frozen inputs: fnd-01 approval window, Epic 3 writer/replay/projections/session linkage, Epic 2 Agent
  resume/relay/persistable-channel attestations.

## Acceptance Criteria

- **AC-1** `recordApprovalPending` appends exactly `ApprovalRequested` then
  `ApprovalPendingPersisted` in one barrier batch before any decision event for the request - evidence:
  `pending-before-decision.unit.test.ts` asserts event order, durability, and absence of decision id.
- **AC-2** Deadline calculation uses explicit `request.expiresAt` when present; otherwise it adds
  `policy.approval.decisionWindowMs`, with default `900000` ms yielding
  `2026-06-23T10:15:00.000Z` from `2026-06-23T10:00:00.000Z` - evidence:
  `approval-deadline.unit.test.ts` asserts both exact timestamps.
- **AC-3** `parkApproval(input)` returns `ParkDecision.schema =
  "kit-vnext.approval-park-decision.v1"` with `requestId`, `runId`, `sessionId`, `reason`,
  `decisionDeadline`, `parkedAt`, and `sourceEventIds` copied from `ApprovalParkInput` - evidence:
  `park-decision.unit.test.ts` asserts all copied fields.
- **AC-4** Parking for live-window elapsed or live-only channel records `ApprovalParked` without
  recording an expired outcome before final `decisionDeadline` - evidence:
  `park-live-window.unit.test.ts` asserts parked event exists and no expired outcome before deadline.
- **AC-5** `resumePendingApproval` returns `outcome = "resume"` only for non-expired, current,
  non-ambiguous, owned/owned-remote sessions whose committed decision event carries a grant - evidence:
  `resume-owned-current.unit.test.ts` asserts `outcome`, `grant`, and source event ids.
- **AC-6** Expired pending requests return `ResumeDecision.outcome = "expired"` and record
  `ApprovalOutcomeRecordedPayload.outcome.failureState = "approval-expired"` - evidence:
  `expire-pending.unit.test.ts` asserts exact outcome and failure token.
- **AC-7** Ambiguous linkage, observe-only ownership, lost answer channel, or unavailable replay/append
  fails closed with the exact token and no `ApprovalResumed` event - evidence:
  `resume-fail-closed.unit.test.ts` table-tests all four fixtures.
- **AC-8** `foldApprovalProjection` rebuilds pending rows, latest decisions/outcomes, operator
  attention, and failure maps deterministically from committed approval events - evidence:
  `approval-projection-fold.unit.test.ts` replays the same log twice and asserts deep equality plus
  `operatorAttention.reason === "parked"`.
- **AC-9** The public SDK entrypoint exports `recordApprovalPending`, `parkApproval`,
  `resumePendingApproval`, `expireApproval`, and `foldApprovalProjection` - evidence:
  `approval-pending-public-import.unit.test.ts` imports the functions from `sdk` and constructs one
  pending/park/resume fixture without private paths.

## Predicate and Producer Closure

| AC / output | Decision value or produced field | Source |
|---|---|---|
| AC-1 | append order and durability | `RunWriter.append` result from Epic 3 |
| AC-2 | `decisionDeadline` | `request.expiresAt`, `request.requestedAt`, fnd-01 policy window |
| AC-3 | `ParkDecision` fields | `ApprovalParkInput` fields |
| AC-4 | park vs expiry | live deadline, channel persistability, final deadline |
| AC-5, AC-7 | resume eligibility | pending projection, linkage resolver/raw events, ownership, attestations |
| AC-6 | expiry | sampled `evaluatedAt` and decision deadline |
| AC-8 | projection rows | committed approval event payloads from `core-03-s1` |
| AC-9 | public symbols | owned source files and `packages/sdk/src/index.ts` export wiring |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-request-unrecordable` | request or pending append fails | no decision; block | AC-1 negative fixture |
| `approval-answer-channel-lost` | channel unavailable after park/resume | no resume event | AC-7 |
| `approval-session-ambiguous` | current session cannot be proven | block resume | AC-7 |
| `approval-owner-missing` | ownership absent or observe-only | block resume | AC-7 |
| `approval-expired` | sampled time exceeds final deadline | expired outcome | AC-6 |
| `approval-event-log-unavailable` | replay/projection/append unavailable | block | AC-7 |

## Quality Bar

- Coverage: 95% branch coverage for approval pending/projection modules.
- Gate lane: `pnpm check`.
- Public exposure: AC-9.
- Boundary sweep:
  `rg -n "provider-codex|provider-local|child_process|Date\\.now|new Date|fetch\\(" packages/sdk/src/core/approval/pending packages/sdk/src/core/approval/projections`
  returns zero matches.
- File-size budget: 300 lines per implementation file, 380 lines per test file.

## STOP Conditions

Stop if resume needs an Epic 5 recovery action, if current ownership cannot be resolved from frozen
linkage/projection inputs, or if a new approval timer beyond the design deadline is needed.

## Characterization Review

### Decision: pending-before-decision

- Rationale: recovery must see a durable pending fact before any classification or decision path can
  lose the request.
- Design trace: approval README core decision that `ApprovalPendingPersisted` is the durable checkpoint.
- Falsification: a decision event can exist for a request with no prior pending event.
- Escalation: return to story authoring; do not defer durability to downstream implementation.

### Decision: park-is-explicit

- Rationale: parking is a produced `ParkDecision`/`ApprovalParked` fact, not absence of an outcome.
- Design trace: `interfaces-events-and-tests.md` `ApprovalParkInput` and `ParkDecision`.
- Falsification: parked state is inferred from no answer or no outcome event.
- Escalation: block as a story defect and add the missing producer source.

- Verdict: ready; ACs name exact values and all failure rows map to owning ACs.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-03-s2-normalize-risk-decision - approval normalize risk and decision implementation story](./core-03-s2-normalize-risk-decision.md) · **Next →:** [core-03-s4-grants-outcomes - approval grants outcomes implementation story](./core-03-s4-grants-outcomes.md)

<!-- /DOCS-NAV -->
