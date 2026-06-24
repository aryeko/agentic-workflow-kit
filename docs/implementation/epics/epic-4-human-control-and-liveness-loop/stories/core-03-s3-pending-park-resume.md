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

# core-03-s3-pending-park-resume - Pending, Park, Resume

## Purpose

Persist pending approval before decision, compute live/final deadlines, record park/resume/expiry
facts, and fold approval projections from committed events.

## Normative design

- `README.md` requires `ApprovalPendingPersisted` at `barrier` before any decision.
- `park-resume-and-failures.md` defines `decisionDeadline`, live-window parking, states, resume
  requirements, and failure states.
- `interfaces-events-and-tests.md` defines approval event payloads, `ResumeDecision`, and projections.

## Spec surface

- Functions exposed: `recordApprovalPending`, `parkApproval`, `resumePendingApproval`,
  `expireApproval`, `foldApprovalProjection`.
- Shapes consumed: `core-03-s1` event payloads, `ApprovalRequest`, `Decision`, `ResumeDecision`,
  `ApprovalProjection`, `ApprovalFailureState`.
- Runtime objects consumed: Epic 3 `RunWriter`, `RunReplay`, `RunProjections`; Agent attestations as
  committed event values.
- Failure tokens raised: `approval-request-unrecordable`, `approval-answer-channel-lost`,
  `approval-session-ambiguous`, `approval-owner-missing`, `approval-expired`,
  `approval-event-log-unavailable`.

## Responsibilities

- Append `ApprovalRequested` and `ApprovalPendingPersisted` at `barrier` before decision behavior runs.
- Compute `decisionDeadline = request.expiresAt ?? request.requestedAt + policy.approval.decisionWindowMs`.
- Park on live-window elapsed or live-only channel without expiring the durable pending request.
- Resume only non-expired owned/owned-remote current sessions with committed decision grant evidence.
- Fold projection maps deterministically from approval events.

## Out of scope

- Risk/mode decisions (`core-03-s2`).
- Agent grant mapping or answer calls (`core-03-s4`).
- Recovery selection after expiry or failed answer (Epic 5).

## Dependencies and frozen inputs

- Covers signals: pending persistence; parked/resumed/expired facts; pending/session/expiry/log failure
  behavior.
- Depends on: `core-03-s1-approval-contracts`, `core-03-s2-risk-and-decision`;
  `core-04-s2-liveness-fold` for serialized `packages/sdk/src/index.ts` export wiring only.
- Decision inputs consumed: request `requestedAt`, `expiresAt`, `answerChannelPersistable`,
  `answerChannelRef`; policy `approval.decisionWindowMs`; sampled `evaluatedAt`; committed
  `Decision`; core-01 linkage resolver/raw linkage events; Agent `canResumeOwned`,
  `canRelayApproval`, and `canPersistApprovalAnswerChannel` attestations.

## Acceptance criteria

- **AC-1** `recordApprovalPending` appends `ApprovalRequestedPayload` and
  `ApprovalPendingPersistedPayload` in one `barrier` batch before any `ApprovalDecisionRecordedPayload`
  exists for the request - evidence: `pending-before-decision.unit.test.ts` asserts append order
  `[ApprovalRequested, ApprovalPendingPersisted]` and no decision event id in the batch.
- **AC-2** Final deadline uses explicit `request.expiresAt` when present, otherwise
  `request.requestedAt + policy.approval.decisionWindowMs`; built-in `900000` ms fixture yields exact
  ISO deadline `2026-06-23T10:15:00.000Z` from requestedAt `2026-06-23T10:00:00.000Z` - evidence:
  `approval-deadline.unit.test.ts` asserts the exact computed timestamp and explicit-expiresAt
  precedence.
- **AC-3** Live answer deadline expiry or live-only channel records `ApprovalParkedPayload.reason =
  "live-window-elapsed" | "live-only-channel"` without recording `ApprovalOutcomeRecorded(outcome =
  "expired")` before final decision deadline - evidence: `park-live-window.unit.test.ts` asserts parked
  event exists and no expired outcome before `decisionDeadline`.
- **AC-4** `resumePendingApproval` returns `ResumeDecision.outcome = "resume"` only when request is
  non-expired, linkage is current and non-ambiguous, ownership is `owned` or `owned-remote`, and the
  committed decision event carries a grant - evidence: `resume-decision.unit.test.ts` asserts
  `resume-owned-current.fixture.ts` returns `outcome === "resume"` and exposes the committed grant.
- **AC-5** Expired pending requests return `ResumeDecision.outcome = "expired"` and record
  `ApprovalOutcomeRecordedPayload.outcome.outcome = "expired"` with `failureState =
  "approval-expired"` - evidence: `expire-pending.unit.test.ts` asserts those exact values.
- **AC-6** Missing or ambiguous linkage, observe-only ownership, lost answer channel, or unavailable
  event log fails closed with the matching failure state and no resume event - evidence:
  `resume-fail-closed.unit.test.ts` asserts fixtures `ambiguous-linkage`, `observe-only-owner`,
  `lost-channel`, and `unavailable-log` produce the four exact failure tokens.
- **AC-7** `foldApprovalProjection` rebuilds `pendingByRequestId`, latest decision/outcome,
  operator attention, and failure maps deterministically from replayed approval events - evidence:
  `approval-projection-fold.unit.test.ts` replays a shuffled-independent ordered log twice and asserts
  deep equality plus `operatorAttention.reason === "parked"`.

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| Pending append barrier | AC-1 |
| Deadline computation | AC-2 |
| Park facts | AC-3 |
| Resume decision | AC-4, AC-6 |
| Expiry | AC-5 |
| Projection fold | AC-7 |
| Failure tokens | AC-5, AC-6 |

## Predicate-input matrix

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1 | append availability/order | `RunWriter` append result | Epic 3 `core-01-s4` | decidable |
| AC-2, AC-5 | expiry | `request.expiresAt`, `requestedAt`, policy window, sampled time | `core-03-s1`, Epic 1, caller clock | decidable |
| AC-3 | live-only/live-window | `answerChannelPersistable`, live deadline | `core-03-s1` | decidable |
| AC-4, AC-6 | session ownership/linkage/channel | linkage resolver/raw events, Agent attestations, pending projection | Epic 3, Epic 2, this story | decidable |
| AC-7 | projection state | committed approval events | `core-03-s1` payloads | decidable |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-request-unrecordable` | request or pending append fails | no decision; block | AC-1 negative fixture |
| `approval-answer-channel-lost` | channel unavailable after park/resume | no resume event; block or parked | AC-6 |
| `approval-session-ambiguous` | linkage cannot prove current session | block resume | AC-6 |
| `approval-owner-missing` | observe-only or missing ownership | block resume | AC-6 |
| `approval-expired` | sampled time beyond decision deadline | expired outcome | AC-5 |
| `approval-event-log-unavailable` | replay/projection/append unavailable | block | AC-6 |

## Quality bar

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/approval/pending/**`
  and `packages/sdk/src/core/approval/projections/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/approval/{pending,projections}/**'`.
- Required tests: AC-1..AC-7 and failure rows.
- Public exposure: `sdk` public import test for pending, resume, expire, and projection fold functions.
- Determinism constraints: sampled time passed as input; projection fold is pure over replay.
- Dependency boundaries: SDK only; no concrete driver, process, network.
- File-size budget: 280 lines per implementation file, 340 lines per test file.

## Evidence pack

- Tests and fixtures named by ACs.
- Negative fixtures for append failure, ambiguous linkage, observe-only owner, lost channel, expired
  request, unavailable event log.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|child_process|Date\\.now|new Date|fetch\\(" packages/sdk/src/core/approval/pending packages/sdk/src/core/approval/projections` returns zero matches.

## Boundaries and STOP conditions

- Package/module boundary: `packages/sdk/src/core/approval/pending/**`,
  `packages/sdk/src/core/approval/projections/**`, with SDK public-entrypoint export wiring in
  `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/approval/pending/**`,
  `packages/sdk/src/core/approval/projections/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/approval/pending/**`, `packages/sdk/tests/core/approval/projections/**`.
- Forbidden dependencies: concrete providers, real process/network, recovery action selection.
- STOP when resume requires a later Epic 5 recovery choice.

## Characterization review

- Scope decision: pending/park/resume owns durable facts and projection fold, not Agent answer. Rationale:
  design separates pending/resume from grant mapping. Falsification: this story calls Agent answer.
- Scope decision: SDK public entrypoint wiring is part of this public behavior story. Rationale: its
  public-import test cannot pass unless the story can add pending/projection exports to
  `packages/sdk/src/index.ts`; the cross-domain dependency is serialization only. Falsification: public
  import AC excludes the package entrypoint from the pathset or runs concurrently with another barrel
  writer.
- Gate verdict: ready. ACs are falsifiable and failure rows map to concrete negative fixtures.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - stories](./README.md) · **← Prev:** [core-03-s2-risk-and-decision - approval risk and decision implementation story](./core-03-s2-risk-and-decision.md) · **Next →:** [core-03-s4-grant-mapping-and-outcome - approval grant mapping and outcome implementation story](./core-03-s4-grant-mapping-and-outcome.md)

<!-- /DOCS-NAV -->
