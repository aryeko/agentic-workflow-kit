# Implementer Prompt: core-03-s3-pending-park-resume

## Assigned Routing

- Source story id: `core-03-s3-pending-park-resume`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-03-s3-pending-park-resume covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries durable approval pending/resume behavior and projection contract over RunWriter, replay/projection inputs, deadlines, and fail-closed session/channel states. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-03-s3-pending-park-resume` for epic `epic-4-human-control-and-liveness-loop`. Deliver exactly the outcome in the ready source contract and nothing outside it:

Persist pending approval before decision, compute live/final deadlines, record park/resume/expiry
facts, and fold approval projections from committed events.

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

## Why It Matters

- Covers signals: pending persistence; parked/resumed/expired facts; pending/session/expiry/log failure
  behavior.
- Depends on: `core-03-s1-approval-contracts`, `core-03-s2-risk-and-decision`.
- Decision inputs consumed: request `requestedAt`, `expiresAt`, `answerChannelPersistable`,
  `answerChannelRef`; policy `approval.decisionWindowMs`; sampled `evaluatedAt`; committed
  `Decision`; core-01 linkage resolver/raw linkage events; Agent `canResumeOwned`,
  `canRelayApproval`, and `canPersistApprovalAnswerChannel` attestations.

DAG dependents for this story: `core-03-s4-grant-mapping-and-outcome`. Preserve the producer/consumer shape boundaries named in the source DAG and story contract so later stories can consume committed dependency inputs without redeclaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md` - ready source story contract for `core-03-s3-pending-park-resume`.
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` - frozen DAG row, dependencies, owned pathset, wave, shared shapes, and suggested-tier floor for `core-03-s3-pending-park-resume`.
- `docs/design/30-domain-reference/core/approval-and-escalation/README.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md` - normative design named by the source contract.
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md` - normative design named by the source contract.
- `{{DEPENDENCY_COMMITS}}` - runtime slot for committed dependency story inputs before implementation starts.
- `AGENTS.md` and `CLAUDE.md` - repo branch, worktree, mutation, and verification rules.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

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

### Failure And Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-request-unrecordable` | request or pending append fails | no decision; block | AC-1 negative fixture |
| `approval-answer-channel-lost` | channel unavailable after park/resume | no resume event; block or parked | AC-6 |
| `approval-session-ambiguous` | linkage cannot prove current session | block resume | AC-6 |
| `approval-owner-missing` | observe-only or missing ownership | block resume | AC-6 |
| `approval-expired` | sampled time beyond decision deadline | expired outcome | AC-5 |
| `approval-event-log-unavailable` | replay/projection/append unavailable | block | AC-6 |

## Allowed Writes

Source story: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/approval/pending/**`
- `packages/sdk/src/core/approval/projections/**`
- `packages/sdk/tests/core/approval/pending/**`
- `packages/sdk/tests/core/approval/projections/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-03-s1-approval-contracts`, `core-03-s2-risk-and-decision`.

Dependency commit inputs are supplied at execution time through `{{DEPENDENCY_COMMITS}}`. Use only producer-owned shared shapes, public import paths, committed events/projections, provider-port inputs, and frozen cross-epic facts named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` or `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`. Do not redeclare producer shapes or consume a dependency before its tracker row is `done`.

## Non-Goals And STOP Conditions

### Source Out Of Scope

- Risk/mode decisions (`core-03-s2`).
- Agent grant mapping or answer calls (`core-03-s4`).
- Recovery selection after expiry or failed answer (Epic 5).

### Source Boundaries And STOP Conditions

- Package/module boundary: `packages/sdk/src/core/approval/pending/**`,
  `packages/sdk/src/core/approval/projections/**`.
- Owned pathset: those source/test folders.
- Forbidden dependencies: concrete providers, real process/network, recovery action selection.
- STOP when resume requires a later Epic 5 recovery choice.

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Append `ApprovalRequested` and `ApprovalPendingPersisted` at `barrier` before decision behavior runs.
- Compute `decisionDeadline = request.expiresAt ?? request.requestedAt + policy.approval.decisionWindowMs`.
- Park on live-window elapsed or live-only channel without expiring the durable pending request.
- Resume only non-expired owned/owned-remote current sessions with committed decision grant evidence.
- Fold projection maps deterministically from approval events.

### Source Spec Surface

- Functions exposed: `recordApprovalPending`, `parkApproval`, `resumePendingApproval`,
  `expireApproval`, `foldApprovalProjection`.
- Shapes consumed: `core-03-s1` event payloads, `ApprovalRequest`, `Decision`, `ResumeDecision`,
  `ApprovalProjection`, `ApprovalFailureState`.
- Runtime objects consumed: Epic 3 `RunWriter`, `RunReplay`, `RunProjections`; Agent attestations as
  committed event values.
- Failure tokens raised: `approval-request-unrecordable`, `approval-answer-channel-lost`,
  `approval-session-ambiguous`, `approval-owner-missing`, `approval-expired`,
  `approval-event-log-unavailable`.

### Normative Design Constraints

- `README.md` requires `ApprovalPendingPersisted` at `barrier` before any decision.
- `park-resume-and-failures.md` defines `decisionDeadline`, live-window parking, states, resume
  requirements, and failure states.
- `interfaces-events-and-tests.md` defines approval event payloads, `ResumeDecision`, and projections.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

- Coverage scope and threshold: 95% branch coverage for `packages/sdk/src/core/approval/pending/**`
  and `packages/sdk/src/core/approval/projections/**`.
- Coverage command and lanes: `pnpm test:unit -- --coverage --coverage.include='packages/sdk/src/core/approval/{pending,projections}/**'`.
- Required tests: AC-1..AC-7 and failure rows.
- Public exposure: `sdk` public import test for pending, resume, expire, and projection fold functions.
- Determinism constraints: sampled time passed as input; projection fold is pure over replay.
- Dependency boundaries: SDK only; no concrete driver, process, network.
- File-size budget: 280 lines per implementation file, 340 lines per test file.

- Tests and fixtures named by ACs.
- Negative fixtures for append failure, ambiguous linkage, observe-only owner, lost channel, expired
  request, unavailable event log.
- `pnpm check` after implementation.
- Boundary sweep: `rg -n "provider-codex|provider-local|child_process|Date\\.now|new Date|fetch\\(" packages/sdk/src/core/approval/pending packages/sdk/src/core/approval/projections` returns zero matches.

Require exact command output or an explicit blocked reason for every targeted command, required sweep, evidence-pack item, and `pnpm check`.

## Delivery Report

Report:

- changed files;
- AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`;
- tests and checks run;
- evidence pack;
- open questions;
- blockers.

The report is evidence for later review. It is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-03-s2-risk-and-decision](../core-03-s2-risk-and-decision/reviewer.md) · **Next →:** [Reviewer Prompt: core-03-s3-pending-park-resume](./reviewer.md)

<!-- /DOCS-NAV -->
