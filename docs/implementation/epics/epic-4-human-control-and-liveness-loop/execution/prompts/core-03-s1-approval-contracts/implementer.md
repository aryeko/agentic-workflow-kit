# Implementer Prompt: core-03-s1-approval-contracts

## Assigned Routing

- Source story id: `core-03-s1-approval-contracts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `core-03-s1-approval-contracts` covers `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7` and carries public approval contract producer and failure catalog consumed by later approval behavior stories and later epics.

## Exact Task

Implement `core-03-s1-approval-contracts` for epic `epic-4-human-control-and-liveness-loop`: Produce all approval value types, event payloads, projections, binding shapes, interfaces, and failure catalog. Keep the result limited to source story `core-03-s1-approval-contracts` and source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

## Why It Matters

This story is in wave 1. Its direct dependencies are none and its dependents are `core-03-s2-normalize-risk-decision`, `core-03-s3-pending-park-resume`, `core-03-s4-grants-outcomes`. The story provides the source-defined approval or supervision surface named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`; later stories and later epics must consume these facts and public `sdk` imports without redeclaring shapes, inventing provider behavior, or using worker prose as evidence.

## Required Reading

- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`
- `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md`
- `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md`
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for none.

## Acceptance Criteria

Source story: `core-03-s1-approval-contracts`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

- **AC-1** Primitive approval unions exactly match the design: ApprovalMode excludes auto, ApprovalRisk is low/medium/high, PolicyGrantScope has the four policy scopes, and ApprovalSubject includes protected-policy-change and network.
- **AC-2** ApprovalRequest requires promptRef and requestedAt; ApprovalContext requires requestedAt and promptRef and has optional subjectOverride.
- **AC-3** Decision, Outcome, ApprovalParkInput, ParkDecision, and ResumeDecision expose exact schema literals and required source fields, including ParkDecision.sourceEventIds and ResumeDecision outcome literals.
- **AC-4** ApprovalDecisionRecordedPayload carries ProtectedPolicyApprovalBinding required iff the request subject is protected-policy-change, with the required run/head/snapshot fields and only optional newPolicyDigest.
- **AC-5** All seven V1 approval event payloads expose exact schema literals and required event-source fields, including classifiedAt and parkedAt.
- **AC-6** ApprovalProjection and PendingApprovalProjection expose pending, latest decision/outcome, operator-attention, and failure-state maps, with decisionDeadline required on each pending row.
- **AC-7** Every manifest symbol imports from sdk through this story owned export lines in packages/sdk/src/index.ts, with no private path.

Failure and degraded outcomes from `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`:
- Declares the full ApprovalFailureState catalog; behavior stories own runtime triggers.

## Allowed Writes

Only these source-owned paths may be changed for `core-03-s1-approval-contracts`:
- `packages/sdk/src/core/approval/contracts/**`
- `packages/sdk/tests/core/approval/contracts/**`
- `packages/sdk/src/index.ts (own export lines)`

Every other write is forbidden, including package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits in another story pathset, and changes to another epic package.

## Dependency Inputs

- Producer story ids: none.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import path: `sdk` for every public symbol this story exposes or consumes.
- Shared shapes and events must be consumed from committed dependency sources named by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/story-dag.md` and `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md`; do not redeclare them.

## Non-Goals And STOP Conditions

Non-goals: do not implement concrete provider behavior, completion or recovery decisions, operator UI, PR/merge behavior, or another story's scope.

Source STOP condition for `core-03-s1-approval-contracts`: Stop if a required approval field is not declared in the design, if behavior is needed to construct a type, or if a concrete Agent driver enum is needed instead of provider-port ScopedGrant.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor the story contract exactly: public exports through this story owned `packages/sdk/src/index.ts` lines, deterministic explicit inputs for time/id/randomness, provider-port boundaries, append-only event-log authority, failure tokens named above, and the Dependency Rule from `AGENTS.md`. Do not introduce provider-specific runtime model ids, concrete driver imports, ambient clock reads, process/network calls, or shape redeclarations prohibited by the source story.

## Verification

Run the targeted checks and evidence required by `docs/implementation/epics/epic-4-human-control-and-liveness-loop/stories/core-03-s1-approval-contracts.md` for source AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`:
- approval-unions.unit.test.ts and approval-mode-auto.fixture.ts
- approval-request-context.unit.test.ts and missing-field fixtures
- approval-decision-results.unit.test.ts
- protected-policy-binding.unit.test.ts
- approval-payloads.unit.test.ts
- approval-projections.unit.test.ts
- approval-public-import.unit.test.ts
- 95% statements/branches for approval contracts
- boundary sweep for provider/testkit/process/time/network imports
- pnpm check

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: core-03-s1-approval-contracts` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 4 - Human control and liveness loop](../../../README.md) · **← Prev:** [Epic 4 Execution Package Plan](../../plan.md) · **Next →:** [Reviewer Prompt: core-03-s1-approval-contracts](./reviewer.md)

<!-- /DOCS-NAV -->
