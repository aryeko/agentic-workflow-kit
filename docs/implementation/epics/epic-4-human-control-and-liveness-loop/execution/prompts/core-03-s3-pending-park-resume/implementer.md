# Implementer Prompt: core-03-s3-pending-park-resume

## Assigned Routing

- Source story id: `core-03-s3-pending-park-resume`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-03-s3-pending-park-resume` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` and carries durable approval pending/resume behavior and projection contract over RunWriter, replay/projection inputs, deadlines, and fail-closed session/channel states.

## Exact Task

Implement `core-03-s3-pending-park-resume` for epic `epic-4-human-control-and-liveness-loop`: Persist request and pending facts, produce park decisions, resume or expire pending approvals, and fold projections. Keep the result limited to source story `core-03-s3-pending-park-resume` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

## Why It Matters

This story is in wave 3. Its direct dependencies are `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision` and its dependents are `core-03-s4-grants-outcomes`. The story provides the source-defined approval or supervision surface named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`; later stories and later epics must consume these facts and public `sdk` imports without redeclaring shapes, inventing provider behavior, or using worker prose as evidence.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/README.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision`.

## Acceptance Criteria

Source story: `core-03-s3-pending-park-resume`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

- **AC-1** recordApprovalPending appends ApprovalRequested then ApprovalPendingPersisted in one barrier batch before any decision event for the request.
- **AC-2** Deadline calculation uses request.expiresAt or policy.approval.decisionWindowMs, with default 900000 ms producing the exact named timestamp.
- **AC-3** parkApproval returns the exact park-decision schema and copies requestId, runId, sessionId, reason, deadline, parkedAt, and sourceEventIds.
- **AC-4** Parking for live-window elapsed or live-only channel records ApprovalParked without expired outcome before final decisionDeadline.
- **AC-5** resumePendingApproval returns resume only for non-expired, current, non-ambiguous, owned/owned-remote sessions with committed grant and fresh positive resume/relay/persistable-channel attestations as needed.
- **AC-6** Expired pending requests return expired and record ApprovalOutcomeRecordedPayload failureState approval-expired.
- **AC-7** Ambiguous linkage, observe-only ownership, missing/stale/negative/wrong-scope canResumeOwned, missing/stale/negative/wrong-scope canRelayApproval, missing required persistable-channel attestation, lost channel, or replay/append unavailability fail closed with exact token and no ApprovalResumed.
- **AC-8** foldApprovalProjection deterministically rebuilds pending rows, latest decisions/outcomes, operator attention, and failure maps from committed approval events.
- **AC-9** Public SDK exports recordApprovalPending, parkApproval, resumePendingApproval, expireApproval, and foldApprovalProjection through this story owned index.ts lines.

Failure and degraded outcomes from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`:
- approval-request-unrecordable
- approval-answer-channel-lost
- approval-session-ambiguous
- approval-owner-missing
- approval-resume-capability-missing
- approval-relay-missing
- approval-expired
- approval-event-log-unavailable

## Allowed Writes

Only these source-owned paths may be changed for `core-03-s3-pending-park-resume`:
- `packages/sdk/src/core/approval/pending/**`
- `packages/sdk/src/core/approval/projections/**`
- `packages/sdk/tests/core/approval/pending/**`
- `packages/sdk/tests/core/approval/projections/**`
- `packages/sdk/src/index.ts (own export lines)`

Every other write is forbidden, including package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits in another story pathset, and changes to another epic package.

## Dependency Inputs

- Producer story ids: `core-03-s1-approval-contracts`, `core-03-s2-normalize-risk-decision`.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import path: `sdk` for every public symbol this story exposes or consumes.
- Shared shapes and events must be consumed from committed dependency sources named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` and `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md`; do not redeclare them.

## Non-Goals And STOP Conditions

Non-goals: do not implement concrete provider behavior, completion or recovery decisions, operator UI, PR/merge behavior, or another story's scope.

Source STOP condition for `core-03-s3-pending-park-resume`: Stop if resume needs an Epic 5 recovery action, current ownership cannot be resolved from frozen linkage/projection inputs, or a new approval timer beyond the design deadline is needed.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor the story contract exactly: public exports through this story owned `packages/sdk/src/index.ts` lines, deterministic explicit inputs for time/id/randomness, provider-port boundaries, append-only event-log authority, failure tokens named above, and the Dependency Rule from `AGENTS.md`. Map missing/stale/negative/wrong-scope `canResumeOwned` to `approval-resume-capability-missing`; map missing/stale/negative/wrong-scope `canRelayApproval` or required `canPersistApprovalAnswerChannel` to `approval-relay-missing`; reserve `approval-answer-channel-lost` for an actually unavailable captured answer channel after park/resume or answer attempt. Do not introduce provider-specific runtime model ids, concrete driver imports, ambient clock reads, process/network calls, or shape redeclarations prohibited by the source story.

## Verification

Run the targeted checks and evidence required by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s3-pending-park-resume.md` for source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`:
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

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: core-03-s3-pending-park-resume` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Reviewer Prompt: core-03-s2-normalize-risk-decision](../core-03-s2-normalize-risk-decision/reviewer.md) · **Next →:** [Reviewer Prompt: core-03-s3-pending-park-resume](./reviewer.md)

<!-- /DOCS-NAV -->
