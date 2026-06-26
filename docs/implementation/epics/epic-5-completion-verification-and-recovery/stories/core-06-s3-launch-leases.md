---
title: "core-06-s3-launch-leases implementation story"
id: "core-06-s3-launch-leases"
epic: 5
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md"
  - "docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md"
---

# core-06-s3-launch-leases

## Purpose

Coordinate repo-level story launches through fnd-02 leases, preventing duplicate launches and clearing
stale launches only through fenced lease epochs plus appended recovery events.

## Normative Design

- `docs/design/30-domain-reference/core/recovery-and-reconciliation/README.md`
- `docs/design/30-domain-reference/core/recovery-and-reconciliation/recovery-model.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `buildStoryLaunchKey`, `acquireStoryLaunchLease`,
  `recordDuplicateLaunchBlocked`, `requestStaleLaunchClearance`, `recordStoryLaunchLeaseCleared`.
- Events / append intents: `StoryLaunchLeaseAcquired`, `DuplicateLaunchBlocked`,
  `StaleLaunchClearanceRequested`, `StoryLaunchLeaseCleared`.
- Provider operations / commands: fnd-02 `LeaseStore` operations only; no provider drivers.
- Failure and degraded tokens: consumes `lease-unavailable`, `launch-duplicate-active`,
  `provider-evidence-gap`, and `manual-edits-forbidden` from `core-06-s1`.
- Evidence records / attestations: fnd-02 lease snapshots/epochs, core-01 writer, ownership/liveness/
  claim evidence refs.

## Responsibilities

- Build lease keys exactly as `story-launch:<workSourceId>:<trackId>:<taskId>`.
- Acquire story-launch after Run creation and before Work Source claim or worker launch.
- Append `StoryLaunchLeaseAcquired` with lease epoch and Task key after successful acquisition.
- Append `DuplicateLaunchBlocked` when a live same-Task lease exists and a writer is available; otherwise
  refuse start before launch side effects.
- Clear expired launches only after proof of no current writer, owner session, process tree, pending
  approval, or Work Source claim, then fenced acquisition of the next epoch and appended events.
- Never use process liveness or manual file deletion as safety input.

## Out of Scope

- Recovery state classification (`core-06-s2`), except consuming produced literals.
- Recovery action planning/apply (`core-06-s4`) and projection fold (`core-06-s5`).
- Scheduler/admission design and concrete remote lease implementation.

## Dependencies and Frozen Inputs

- Covers signals: `story-launch:<workSourceId>:<trackId>:<taskId>` lease acquisition, duplicate blocking,
  and stale launch clearing records.
- Depends on: `core-06-s1-recovery-contracts`, fnd-02 lease primitives, core-01 writer, prior frozen
  Work Source claim evidence shape.
- Depended on by: `core-06-s4`, `core-06-s5`, Epic 7.
- Shared shapes consumed: `core-06-s1` lease payload types and failure catalogs.
- Decision inputs consumed: `workSourceId`, `trackId`, `taskId`, `runId`, lease read/acquire result,
  lease epoch/expiry, current writer/owner/session/approval/claim evidence refs.

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
- **AC-4** Stale launch clearance requires expired lease evidence plus no current writer, owner session,
  process tree, pending approval, or Work Source claim, then next lease epoch acquisition before
  `StaleLaunchClearanceRequested` and `StoryLaunchLeaseCleared` - evidence: `coverage:baseline`
  `stale-clearance-proof-matrix`.
- **AC-5** Missing, stale, degraded, ambiguous, or manually edited lease/claim evidence never clears the
  lease and maps to the exact recovery failure state consumed from `core-06-s1` - evidence:
  `coverage:baseline` `lease-clearance-fail-closed-matrix`.
- **AC-6** Public SDK importability exposes lease helpers through this story's export lines - evidence:
  `typecheck` public-import test.

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Story-launch key construction | AC-1 | `coverage:baseline` |
| Acquisition record fields/order | AC-2 | `coverage:baseline` |
| Duplicate launch behavior | AC-3 | `coverage:baseline` |
| Stale clearance proof and events | AC-4 | `coverage:baseline` |
| Lease fail-closed states | AC-5 | `coverage:baseline` |
| Public exports | AC-6 | `typecheck` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1 | key parts and delimiter safety | request `workSourceId`, `trackId`, `taskId` | request input | decidable |
| AC-2 | lease acquired before launch side effects | lease acquire receipt, run creation event, no claim/launch refs yet | fnd-02 + core-01 replay | decidable |
| AC-3 | live duplicate lease | `LeaseSnapshot.expiresAt`, holder, epoch, story key | fnd-02 lease snapshot | decidable |
| AC-4 | stale clear proof | writer/owner/process/approval/claim evidence refs and next epoch receipt | fnd-02/core-01/core-03/provider/Work Source evidence | decidable |
| AC-5 | degraded/ambiguous/manual edit evidence | lease health and explicit evidence gap/manual edit markers | fnd-02 + snapshot fields | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Verdict |
|---|---|---|---|
| `StoryLaunchLeaseAcquired` | `runId`, `storyLaunchKey`, `leaseEpoch`, `acquiredAt`, `sourceEventIds` | request input, key builder, lease acquire receipt, injected clock, evidence refs | closed |
| `DuplicateLaunchBlocked` | `runId`, `storyLaunchKey`, `incumbentLeaseEpoch`, `blockedAt`, `sourceEventIds` | request input, lease snapshot, injected clock, evidence refs | closed |
| `StaleLaunchClearanceRequested` | `runId`, `storyLaunchKey`, `expiredLeaseEpoch`, `nextLeaseEpoch`, `requestedAt`, `evidenceRefs` | stale snapshot, next acquire receipt, injected clock, evidence refs | closed |
| `StoryLaunchLeaseCleared` | `runId`, `storyLaunchKey`, `clearedLeaseEpoch`, `clearedAt`, `sourceEventIds` | clear action result, injected clock, source refs | closed |
| Public symbols | export lines | owned source plus SDK barrel lines | closed |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `launch-duplicate-active` | live same-Task lease exists | block launch; append duplicate record when writer exists | AC-3 |
| `lease-unavailable` | lease read/acquire health missing/stale/degraded | no acquire/clear success | AC-5 |
| `provider-evidence-gap` | stale-clear proof lacks owner/process/claim evidence | no clear success | AC-4, AC-5 |
| `manual-edits-forbidden` | manual deletion/edit detected | no clear/restart success | AC-5 |

## Quality Bar

- Coverage scope and threshold: `packages/sdk/src/core/recovery/leases/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-6 and every failure row.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: injected clock; no process liveness reads as safety inputs.
- Dependency boundaries: fnd-02 `LeaseStore` contract only; no concrete storage driver or Work Source
  mutation.
- File-size budget: 260 lines per file; split key/acquire/stale-clear helpers before 400 lines; 800 hard cap.
- Domain non-negotiables: epoch fencing and evidence, not holder text or process absence, are safety.

## Required Reading

- Core-06 design files.
- `core-06-s1-recovery-contracts`.
- fnd-02 lease primitive contracts.

## Deliverable

The `packages/sdk/src/core/recovery/leases/**` module, tests, fixtures, and SDK export lines.

## Evidence Pack

- Key, acquisition, duplicate, stale-clear, fail-closed, and public-import tests.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|fs\\.|unlink|rmSync|process\\.kill|child_process|node:net|node:http|node:https|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/recovery/leases packages/sdk/tests/core/recovery/leases`
  returns zero matches except test-only fixtures.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/sdk/src/core/recovery/leases/**`.
- Owned pathset: `packages/sdk/src/core/recovery/leases/**`,
  `packages/sdk/tests/core/recovery/leases/**`, and owned SDK export lines.
- Forbidden dependencies: manual file deletion, concrete storage drivers, process tree probing as a
  safety predicate, Work Source state mutation.
- STOP when stale clearance proof lacks a declared source for any required safety operand.

## Characterization Review Evidence

- Design -> AC completeness: story-launch key, acquire, duplicate block, stale clear, manual-edit ban,
  and lease degraded modes map to AC-1..AC-5.
- Producer closure: all lease event payload fields have sources.
- Sweep vocabulary: forbidden tokens do not ban normative lease names.
- Failure-token/catalog closure: consumed recovery tokens are produced by `core-06-s1`.
- Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - stories](./README.md) · **← Prev:** [core-06-s2-recovery-classifier implementation story](./core-06-s2-recovery-classifier.md) · **Next →:** [core-06-s4-recovery-plan-apply implementation story](./core-06-s4-recovery-plan-apply.md)

<!-- /DOCS-NAV -->
