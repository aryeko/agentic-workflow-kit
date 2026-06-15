---
title: AWK139 implementation plan
owner: codex-2026-06-15T19-40-56Z
last-reviewed: 2026-06-15
related:
  - ../specs/2026-06-15-awk139-run-state-write-atomicity-design.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK139.md
---

# AWK139 implementation plan

## Scope

Implement atomic full-file artifact writes in `FileArtifactStore`, add stale tracker claim-lock
recovery in `trackerClaimer`, and add disk-backed tests for artifact durability, lock recovery, and
restart-style `RecoveryGuard` reads.

## Steps

1. Add failing tests in `test/artifact-model.test.ts`.
   - Cover full-file overwrite through `FileArtifactStore.writeJson` where the destination remains
     complete JSON and unrelated partial temp-like files do not affect the destination.
   - Cover restart simulation: write `state.json` and `children/AWK139.launch.json` with one real
     store, read with a fresh store, feed parsed disk data into `evaluateRecoveryGuard`, and assert
     the expected decision.

2. Add failing tests in `test/tracker-claimer.test.ts`.
   - Pre-create an old claim lock and assert `claimTrackerRow` reclaims it and claims the row.
   - Pre-create a recent live lock for `process.pid` and assert `claimTrackerRow` returns the
     existing timeout result without changing the row.

3. Implement atomic full-file writes in `packages/orchestrator/src/artifacts/FileArtifactStore.ts`.
   - Generate a same-directory temp path with process id, timestamp, and random suffix.
   - Write the temp file, rename it over the destination, and best-effort unlink the temp path on
     failure.
   - Leave `appendText` and `appendEvent` behavior unchanged.

4. Implement stale-lock recovery in `packages/orchestrator/src/tracks/trackerClaimer.ts`.
   - Write JSON lock metadata with owner, pid, and createdAt.
   - On lock conflict, inspect metadata/stat age, reclaim dead or stale locks, and retry.
   - Treat malformed/legacy lock files conservatively except for stale age.
   - Keep row update temp+rename and post-claim read-back verification unchanged.

5. Run focused verification.
   - `pnpm vitest run test/artifact-model.test.ts test/tracker-claimer.test.ts`
   - Fix failures within story scope.

6. Run full configured verification.
   - `pnpm check`
   - Fix failures within story scope.

7. Pre-PR review and closeout.
   - Run the configured read-only subagent pre-PR review.
   - Apply any required fixes and rerun verification.
   - Remove transient story-specific spec/plan files before final tracker completion, folding any
     durable notes into canonical docs only if implementation creates durable user-facing behavior
     that is not already covered.
