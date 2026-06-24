# Reviewer Prompt: core-03-s3-pending-park-resume

## Assigned Routing

- Source story id: `core-03-s3-pending-park-resume`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-03-s3-pending-park-resume covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries durable approval pending/resume behavior and projection contract over RunWriter, replay/projection inputs, deadlines, and fail-closed session/channel states. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-03-s3-pending-park-resume`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract path: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`.
- Allowed pathset: `packages/sdk/src/core/approval/pending/**`, `packages/sdk/src/core/approval/projections/**`, `packages/sdk/src/index.ts`, `packages/sdk/tests/core/approval/pending/**`, `packages/sdk/tests/core/approval/projections/**`.
- Direct dependencies: `core-03-s1-approval-contracts`, `core-03-s2-risk-and-decision`, `core-04-s2-liveness-fold`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes, public import paths, event/projection inputs, and provider-port facts named in the source contract and DAG. The `core-04-s2-liveness-fold` dependency is only the committed baseline for serialized `packages/sdk/src/index.ts` export wiring; it is not approval pending/projection shape input.

### Acceptance Criteria

Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

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

### Dependencies And Frozen Inputs

- Covers signals: pending persistence; parked/resumed/expired facts; pending/session/expiry/log failure
  behavior.
- Depends on: `core-03-s1-approval-contracts`, `core-03-s2-risk-and-decision`.
- Decision inputs consumed: request `requestedAt`, `expiresAt`, `answerChannelPersistable`,
  `answerChannelRef`; policy `approval.decisionWindowMs`; sampled `evaluatedAt`; committed
  `Decision`; core-01 linkage resolver/raw linkage events; Agent `canResumeOwned`,
  `canRelayApproval`, and `canPersistApprovalAnswerChannel` attestations.

### Non-Goals

- Risk/mode decisions (`core-03-s2`).
- Agent grant mapping or answer calls (`core-03-s4`).
- Recovery selection after expiry or failed answer (Epic 5).

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/approval/pending/**`,
  `packages/sdk/src/core/approval/projections/**`, with SDK public-entrypoint export wiring in
  `packages/sdk/src/index.ts`.
- Owned pathset: `packages/sdk/src/core/approval/pending/**`,
  `packages/sdk/src/core/approval/projections/**`, `packages/sdk/src/index.ts`,
  `packages/sdk/tests/core/approval/pending/**`, `packages/sdk/tests/core/approval/projections/**`.
- Forbidden dependencies: concrete providers, real process/network, recovery action selection.
- STOP when resume requires a later Epic 5 recovery choice.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/approval/pending/**`, `packages/sdk/src/core/approval/projections/**`, `packages/sdk/src/index.ts`, `packages/sdk/tests/core/approval/pending/**`, `packages/sdk/tests/core/approval/projections/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-03-s3-pending-park-resume](./implementer.md) · **Next →:** [Implementer Prompt: core-03-s4-grant-mapping-and-outcome](../core-03-s4-grant-mapping-and-outcome/implementer.md)

<!-- /DOCS-NAV -->
