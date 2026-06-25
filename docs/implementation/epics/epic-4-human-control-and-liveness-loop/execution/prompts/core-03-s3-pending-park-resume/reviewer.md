# Reviewer Prompt: core-03-s3-pending-park-resume

## Assigned Routing

- Source story id: `core-03-s3-pending-park-resume`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-03-s3-pending-park-resume` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries durable approval pending/resume behavior and projection contract over RunWriter, replay/projection inputs, deadlines, and fail-closed session/channel states.

## Original Scope

- Story id: `core-03-s3-pending-park-resume`.
- Epic slug: `epic-4-human-control-and-liveness-loop`.
- Source story contract: `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`.
- Allowed pathset:
- `packages/sdk/src/core/approval/pending/**`
- `packages/sdk/src/core/approval/projections/**`
- `packages/sdk/tests/core/approval/pending/**`
- `packages/sdk/tests/core/approval/projections/**`
- `packages/sdk/src/index.ts (own export lines)`
- Dependencies: `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` and committed producer shapes/events named by the source DAG and story contract.
- Non-goals: no concrete provider behavior, completion/recovery decisions, operator UI, tracker/package edits, source planning edits, or another story scope.
- STOP condition: Stop if resume needs an Epic 5 recovery action, current ownership cannot be resolved from frozen linkage/projection inputs, or a new approval timer beyond the design deadline is needed.

Acceptance criteria from the original source contract:

- **AC-1** recordApprovalPending appends ApprovalRequested then ApprovalPendingPersisted in one barrier batch before any decision event for the request.
- **AC-2** Deadline calculation uses request.expiresAt or policy.approval.decisionWindowMs, with default 900000 ms producing the exact named timestamp.
- **AC-3** parkApproval returns the exact park-decision schema and copies requestId, runId, sessionId, reason, deadline, parkedAt, and sourceEventIds.
- **AC-4** Parking for live-window elapsed or live-only channel records ApprovalParked without expired outcome before final decisionDeadline.
- **AC-5** resumePendingApproval returns resume only for non-expired, current, non-ambiguous, owned/owned-remote sessions with committed grant and fresh positive resume/relay/persistable-channel attestations as needed.
- **AC-6** Expired pending requests return expired and record ApprovalOutcomeRecordedPayload failureState approval-expired.
- **AC-7** Ambiguous linkage, observe-only ownership, missing/stale/negative attestations, lost channel, or replay/append unavailability fail closed with exact token and no ApprovalResumed.
- **AC-8** foldApprovalProjection deterministically rebuilds pending rows, latest decisions/outcomes, operator attention, and failure maps from committed approval events.
- **AC-9** Public SDK exports recordApprovalPending, parkApproval, resumePendingApproval, expireApproval, and foldApprovalProjection through this story owned index.ts lines.

Failure and degraded rows to verify:
- approval-request-unrecordable
- approval-answer-channel-lost
- approval-session-ambiguous
- approval-owner-missing
- approval-resume-capability-missing
- approval-expired
- approval-event-log-unavailable

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check source story `core-03-s3-pending-park-resume` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` against the runtime slots.

- AC coverage by original source `AC-n` id.
- Each AC is re-proven by a standing gate step such as `type:fixtures`, `coverage:baseline`, `deps`, `typecheck`, relevant unit tests, or `pnpm check`; treat manual-only proof or fixtures outside the build graph as blocking.
- Failure and degraded rows above.
- Evidence pack completeness and exact command output.
- Public API and `sdk` import paths.
- Dependency boundaries and committed dependency inputs from `{{DEPENDENCY_COMMITS}}`.
- Stale names and sibling occurrences of any issue found.
- Tests, sweeps, coverage, and source quality bar:
- pending-before-decision.unit.test.ts
- approval-deadline.unit.test.ts
- park-decision.unit.test.ts
- park-live-window.unit.test.ts
- resume-owned-current.unit.test.ts
- expire-pending.unit.test.ts
- resume-fail-closed.unit.test.ts
- approval-projection-fold.unit.test.ts
- approval-pending-public-import.unit.test.ts
- 95% branch coverage for approval pending/projection
- boundary sweep for provider/process/time/network imports
- pnpm check
- Scope control against allowed writes.
- Repo conventions, no emojis, no provider-specific runtime model ids, no concrete driver imports where forbidden, no hidden ambient time/random/process/network calls where forbidden.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

The reviewer is read-only. Do not stage, commit, push, open or update PRs, merge, close workers, edit tracker state, edit package files, edit source planning files, dispatch implementation work, or write outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Implementer Prompt: core-03-s3-pending-park-resume](./implementer.md) · **Next →:** [Implementer Prompt: core-03-s4-grants-outcomes](../core-03-s4-grants-outcomes/implementer.md)

<!-- /DOCS-NAV -->
