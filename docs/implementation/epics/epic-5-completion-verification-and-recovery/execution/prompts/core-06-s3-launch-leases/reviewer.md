# Reviewer Prompt - core-06-s3-launch-leases

## Assigned Routing

- Source story id: `core-06-s3-launch-leases`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- Model class: `frontier-reviewer`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: review must independently verify AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 for lease coordination safety boundary with epoch fencing and duplicate launch prevention; reviewer routing is fixed to `frontier-reviewer` by package rules.

## Original Scope

- Story id: `core-06-s3-launch-leases`
- Epic slug: `epic-5-completion-verification-and-recovery`
- Source story contract path: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s3-launch-leases.md`
- Acceptance criteria: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- Allowed pathset: `packages/sdk/src/core/recovery/leases/**`, `packages/sdk/tests/core/recovery/leases/**`, own `packages/sdk/src/index.ts` export lines
- Dependencies: `core-06-s1-recovery-contracts`
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus producer contracts listed in the source story.

### Acceptance Criteria

- **AC-1** `buildStoryLaunchKey` returns exactly
  `story-launch:<workSourceId>:<trackId>:<taskId>` and rejects missing or delimiter-unsafe fields -
  evidence: `coverage:baseline` fixtures `story-launch-key-valid` and
  `story-launch-key-unsafe-field`.
- **AC-2** Successful acquisition appends `StoryLaunchLeaseAcquired` with `runId`, `storyLaunchKey`,
  `leaseEpoch`, `acquiredAt`, and `sourceEventIds` after Run creation and before claim/launch effects -
  evidence: `coverage:baseline` `launch-lease-acquired-order-and-fields`.
- **AC-3** Live same-Task lease appends `DuplicateLaunchBlocked` with incumbent epoch when a writer is
  available, or returns a start refusal before side effects when a writer is unavailable - evidence:
  `coverage:baseline` fixtures `duplicate-live-with-writer` and `duplicate-live-no-writer`.
- **AC-4** Stale launch clearance request requires expired lease evidence plus no current writer, owner
  session, process tree, pending approval, or Work Source claim, then next lease epoch acquisition before
  `StaleLaunchClearanceRequested`; it never records `StoryLaunchLeaseCleared` - evidence:
  `coverage:baseline` `stale-clearance-request-proof-matrix`.
- **AC-5** Missing, stale, degraded, ambiguous, or manually edited lease/claim evidence never clears the
  lease and maps to the exact recovery failure state consumed from `core-06-s1` - evidence:
  `coverage:baseline` `lease-clearance-fail-closed-matrix`.
- **AC-6** Public SDK importability exposes lease helpers through this story's export lines - evidence:
  `typecheck` public-import test.

### Dependencies And Frozen Inputs

- Covers signals: `story-launch:<workSourceId>:<trackId>:<taskId>` lease acquisition, duplicate blocking,
  and stale launch clearance request records.
- Depends on: `core-06-s1-recovery-contracts`, fnd-02 lease primitives, core-01 writer, prior fro

### Non-Goals

- Recovery state classification (`core-06-s2`), except consuming produced literals.
- Recovery action planning/apply (`core-06-s4`) and projection fold (`core-06-s5`), including the gated
  `StoryLaunchLeaseCleared` apply record.
- Scheduler/admission design and concrete remote lease implementation.

### STOP Conditions And Boundaries

- Package/module boundary: `packages/sdk/src/core/recovery/leases/**`.
- Owned pathset: `packages/sdk/src/core/recovery/leases/**`,
  `packages/sdk/tests/core/recovery/leases/**`, and owned SDK export lines.
- Forbidden dependencies: manual file deletion, concrete storage drivers, process tree probing as a
  safety predicate, Work Source state mutation.
- STOP when stale clearance request proof lacks a declared source for any required safety operand.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check all of the following against the original source story and runtime evidence:

- AC coverage by source AC id: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6.
- Each AC names and is re-proven by its standing gate lane; treat proof that is only manual, one-off, or outside the standing gate as BLOCKING.
- Failure, degraded, and validation rows from the story contract.
- Evidence pack completeness.
- Public API and import paths.
- Dependency boundaries and committed dependency inputs.
- Stale names and sibling occurrences.
- Tests and sweeps.
- Scope control against allowed writes.
- Repo conventions and mutation limits.

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Story-launch key construction | AC-1 | `coverage:baseline` |
| Acquisition record fields/order | AC-2 | `coverage:baseline` |
| Duplicate launch behavior | AC-3 | `coverage:baseline` |
| Stale clearance request proof and event | AC-4 | `coverage:baseline` |
| Lease fail-closed states | AC-5 | `coverage:baseline` |
| Public exports | AC-6 | `typecheck` |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `launch-duplicate-active` | live same-Task lease exists | block launch; append duplicate record when writer exists | AC-3 |
| `lease-unavailable` | lease read/acquire health missing/stale/degraded | no acquire/clear success | AC-5 |
| `provider-evidence-gap` | stale-clear request proof lacks owner/process/claim evidence | no clearance request success | AC-4, AC-5 |
| `manual-edits-forbidden` | manual deletion/edit detected | no clearance request or restart success | AC-5 |



- Coverage scope and threshold: `packages/sdk/src/core/recovery/leases/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-6 and every failure row.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: injected clock; no process liveness reads as safety inputs.
- Dependency boundaries: fnd-02 `LeaseStore` contract only; no concrete storage driver or Work Source
  mutation.
- File-si

- Key, acquisition, duplicate, stale-clearance-request, fail-closed, and public-import tests.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|fs\\.|unlink|rmSync|process\\.kill|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/leases packages/sdk/tests/core/recovery/leases`
  returns

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source AC id or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Implementer Prompt - core-06-s3-launch-leases](./implementer.md) · **Next →:** [Implementer Prompt - core-06-s4-recovery-plan-apply](../core-06-s4-recovery-plan-apply/implementer.md)

<!-- /DOCS-NAV -->
