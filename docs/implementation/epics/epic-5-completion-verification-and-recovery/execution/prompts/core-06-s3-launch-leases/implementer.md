# Implementer Prompt - core-06-s3-launch-leases

## Assigned Routing

- Source story id: `core-06-s3-launch-leases`
- Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6
- Model class: `strong-coder`
- Effort: `high`
- Suggested-tier floor: `elevated`
- Reasoning tier: `elevated`
- Routing rationale: minimal compliant route. The frozen DAG sets an elevated floor, and lease coordination safety boundary with epoch fencing and duplicate launch prevention; no critical/frontier escalation is authorized by the source contract.

## Exact Task

Implement `core-06-s3-launch-leases` for epic `epic-5-completion-verification-and-recovery`: Enforce story-launch lease acquisition, duplicate blocking, and stale launch clearance requests.

Source story: `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s3-launch-leases.md`. Source AC ids: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6.

## Why It Matters

Coordinate repo-level story launches through fnd-02 leases, preventing duplicate launches and requesting
stale-launch clearance only through fenced lease epochs plus appended recovery evidence.

Downstream dependents: `core-06-s4-recovery-plan-apply`, `core-06-s5-reconciliation-projection`. Dependency inputs and public contracts from this story must be stable before those dependents run.

## Required Reading

- `docs/implementation/epics/epic-5-completion-verification-and-recovery/stories/core-06-s3-launch-leases.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`
- Core-06 design files.
- `core-06-s1-recovery-contracts`.
- fnd-02 lease primitive contracts.
- Runtime dependency commits: `{{DEPENDENCY_COMMITS}}` for producer stories listed below.

## Acceptance Criteria

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

## Allowed Writes

- Package/module boundary: `packages/sdk/src/core/recovery/leases/**`.
- Owned pathset: `packages/sdk/src/core/recovery/leases/**`,
  `packages/sdk/tests/core/recovery/leases/**`, and owned SDK export lines.
- Forbidden dependencies: manual file deletion, concrete storage drivers, process tree probing as a
  safety predicate, Work Source state mutation.
- STOP when stale clearance request proof lacks a declared source for any required safety operand.

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, and unrelated SDK surfaces.

## Dependency Inputs

- Covers signals: `story-launch:<workSourceId>:<trackId>:<taskId>` lease acquisition, duplicate blocking,
  and stale launch clearance request records.
- Depends on: `core-06-s1-recovery-contracts`, fnd-02 lease primitives, core-01 writer, prior frozen
  Work Source claim evidence shape.
- Depended on by: `core-06-s4`, `core-06-s5`, Epic 7.
- Shared shapes consumed: `core-06-s1` lease payload types and failure catalogs.
- Decision inputs consumed: `workSourceId`, `trackId`, `taskId`, `runId`, lease read/acquire result,
  lease epoch/expiry, current writer/owner/session/approval/claim evidence refs.

Execution-time dependency commits: `core-06-s1-recovery-contracts`. Runtime execution must provide {{DEPENDENCY_COMMITS}} for producer stories that have reached tracker status merged.

## Non-Goals And STOP Conditions

- Recovery state classification (`core-06-s2`), except consuming produced literals.
- Recovery action planning/apply (`core-06-s4`) and projection fold (`core-06-s5`), including the gated
  `StoryLaunchLeaseCleared` apply record.
- Scheduler/admission design and concrete remote lease implementation.

- Package/module boundary: `packages/sdk/src/core/recovery/leases/**`.
- Owned pathset: `packages/sdk/src/core/recovery/leases/**`,
  `packages/sdk/tests/core/recovery/leases/**`, and owned SDK export lines.
- Forbidden dependencies: manual file deletion, concrete storage drivers, process tree probing as a
  safety predicate, Work Source state mutation.
- STOP when stale clearance request proof lacks a declared source for any required safety operand.

Also STOP and report if source gaps, missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an AC appears.

## Implementation Constraints

The implementation constraints are the source-owned spec surface and responsibilities below. Do not introduce implementation choices outside this contract. Preserve deterministic, fail-closed, event-log, dependency-boundary, and public-import constraints exactly as written.

### Spec Surface

- Interfaces / types: `buildStoryLaunchKey`, `acquireStoryLaunchLease`,
  `recordDuplicateLaunchBlocked`, `requestStaleLaunchClearance`.
- Events / append intents: `StoryLaunchLeaseAcquired`, `DuplicateLaunchBlocked`,
  `StaleLaunchClearanceRequested`.
- Provider operations / commands: fnd-02 `LeaseStore` operations only; no provider drivers.
- Failure and degraded tokens: consumes `lease-unavailable`, `launch-duplicate-active`,
  `provider-evidence-gap`, and `manual-edits-forbidden` from `core-06-s1`.
- Evidence records / attestations: fnd-02 lease snapshots/epochs, core-01 writer, ownership/liveness/
  claim evidence refs.

### Responsibilities

- Build lease keys exactly as `story-launch:<workSourceId>:<trackId>:<taskId>`.
- Acquire story-launch after Run creation and before Work Source claim or worker launch.
- Append `StoryLaunchLeaseAcquired` with lease epoch and Task key after successful acquisition.
- Append `DuplicateLaunchBlocked` when a live same-Task lease exists and a writer is available; otherwise
  refuse start before launch side effects.
- Request stale-launch clearance only after proof of no current writer, owner session, process tree,
  pending approval, or Work Source claim, then fenced acquisition of the next epoch.
- Never emit `StoryLaunchLeaseCleared`; `core-06-s4` records that event only after
  `stale-launch-clearable` classification and a committed `auto-recover` gate.
- Never use process liveness or manual file deletion as safety input.

## Verification

The verification contract is the source-owned coverage matrix, quality bar, and evidence pack below. The repo gate is `pnpm check`; report exact command output or an explicit blocked reason.

### Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Story-launch key construction | AC-1 | `coverage:baseline` |
| Acquisition record fields/order | AC-2 | `coverage:baseline` |
| Duplicate launch behavior | AC-3 | `coverage:baseline` |
| Stale clearance request proof and event | AC-4 | `coverage:baseline` |
| Lease fail-closed states | AC-5 | `coverage:baseline` |
| Public exports | AC-6 | `typecheck` |

- Coverage scope and threshold: `packages/sdk/src/core/recovery/leases/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-6 and every failure row.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: injected clock; no process liveness reads as safety inputs.
- Dependency boundaries: fnd-02 `LeaseStore` contract only; no concrete storage driver or Work Source
  mutation.
- File-size budget: 260 lines per file; split key/acquire/stale-clear helpers before 400 lines; 800 hard cap.
- Domain non-negotiables: epoch fencing and evidence, not holder text or process absence, are safety.

- Key, acquisition, duplicate, stale-clearance-request, fail-closed, and public-import tests.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|fs\\.|unlink|rmSync|process\\.kill|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/leases packages/sdk/tests/core/recovery/leases`
  returns zero matches except test-only fixtures.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with trailers `Story: core-06-s3-launch-leases` and `Round: <n>`;
- on an orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove with a green gate, and re-commit;
- report a real logic conflict instead of forcing a resolution.

The implementer commits only within the owned pathset in its own story worktree. It never pushes, opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

## Delivery Report

Report changed files, AC coverage by AC id, per-round commit hashes, tests/checks run, evidence pack, open questions, and blockers. The report and per-round commits are evidence for review and merge-back.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree and rebases only on orchestrator request. It performs no pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - Completion, verification, and recovery](../../../README.md) · **← Prev:** [Reviewer Prompt - core-06-s2-recovery-classifier](../core-06-s2-recovery-classifier/reviewer.md) · **Next →:** [Reviewer Prompt - core-06-s3-launch-leases](./reviewer.md)

<!-- /DOCS-NAV -->
