---
title: AWK139 detailed technical story spec
owner: codex-2026-06-15T19-40-56Z
last-reviewed: 2026-06-15
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK139.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design-2.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
---

# AWK139 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK139.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Stale-lock detection via PID liveness, lock-age threshold, or both? | Use both. New claim locks store JSON metadata with `owner`, `pid`, and `createdAt`. A lock is reclaimable when the recorded PID is not live or when the lock age exceeds a conservative threshold. Legacy non-JSON lock files fall back to filesystem `mtime` age. | PID liveness handles crashed holders quickly when metadata is available; age fallback handles legacy/corrupt locks and long-lived abandoned locks. A recent live lock stays protected. |
| Read-back verify after rename, or trust the rename? | `FileArtifactStore.writeText` writes temp file, renames within the target directory, and does not read back. Tracker row claim/release keeps its existing read-back verification because those operations validate semantic row ownership/status. | Atomic rename gives readers old-complete or new-complete content. Read-back for every artifact write would add cost without stronger guarantees for JSON readers. |
| How is a crash simulated in the round-trip test? | Use two fresh `FileArtifactStore` instances over the same temporary run directory: one writes `state.json` and `children/<story>.launch.json`, then the second reads those files and feeds the parsed disk data into `evaluateRecoveryGuard`. | This is deterministic, fast, and exercises real file writes and restart-style reads without process control flake. |

## Exact types/contracts

- `FileArtifactStore.writeText(relativePath, value)` must be full-file atomic for all paths it owns:
  - create the target directory;
  - write `value` to a temp file in the same directory as the target;
  - rename the temp file over the destination;
  - clean up the temp file on write/rename failure when possible.
- `FileArtifactStore.writeJson` continues delegating to `writeText`, so `state.json`, `summary.json`,
  `rows.json`, `budgets.json`, `transcripts.json`, and child full-file artifacts inherit atomicity.
- Append APIs are unchanged and remain serialized by the existing append queue.
- Tracker claim locks use a durable lock file at the existing `*.claim-<tracker>.lock` path. New
  lock content is JSON:

```ts
interface ClaimLockMetadata {
  owner: string;
  pid: number;
  createdAt: string;
}
```

- Lock acquisition behavior:
  - acquire with exclusive create (`wx`);
  - on `EEXIST`, inspect metadata and lock file stats;
  - reclaim by unlinking only when the holder is dead or the lock is older than the stale threshold;
  - otherwise retry until the existing 5 second acquisition deadline, then return the existing
    timeout result.
- Default stale threshold: 5 minutes. Tests may inject a shorter threshold only through internal
  helpers if needed; public config does not change.

## Exact files/modules

```text
packages/orchestrator/src/artifacts/FileArtifactStore.ts  Add atomic write helper for writeText/writeJson full-file writes; keep append behavior unchanged.
packages/orchestrator/src/tracks/trackerClaimer.ts        Add claim-lock metadata, stale-lock inspection/reclaim, and keep tracker row temp+rename updates.
test/artifact-model.test.ts                              Cover atomic full-file writes and restart-style RecoveryGuard reads through real FileArtifactStore.
test/tracker-claimer.test.ts                             Cover stale lock reclaim and recent live lock protection.
```

No public API, config schema, tracker contract, plugin metadata, or command surface changes are
planned.

## Query/schema/prompt/event/component design

- No queries, prompts, UI components, routes, or migrations.
- Artifact design:
  - `writeText` temp files stay adjacent to their destination and include process/time/random
    uniqueness to avoid collisions across concurrent writers.
  - temp files are implementation detail only and are not included in artifact contracts.
  - readers continue using existing `readText` / direct file reads; atomicity is provided by writer
    replacement semantics.
- Lock design:
  - JSON metadata is best effort. If parsing fails or fields are missing, fallback uses file age.
  - PID liveness treats `ESRCH` as dead; `EPERM` as live; other unexpected errors are conservative
    and do not reclaim unless age is stale.
  - Reclaim attempts tolerate a race where another claimant removed/replaced the lock first.

## Tests

- `test/artifact-model.test.ts`
  - add a test that writes an old complete `state.json`, leaves an unrelated temp-like partial file
    beside it, writes a new complete `state.json` through `FileArtifactStore`, and asserts the
    destination parses as one complete JSON value with no temp-file content.
  - add a test that writes `state.json` and `children/AWK139.launch.json` through a real store,
    creates a new store instance, reads both files, and passes their parsed values to
    `evaluateRecoveryGuard`, asserting the expected `safe_to_take_over` or
    `manual_recovery_required` decision.
- `test/tracker-claimer.test.ts`
  - add a stale-lock test that pre-creates an old claim lock and verifies `claimTrackerRow` reclaims
    it and claims the row.
  - add a live-lock test that pre-creates a recent lock for `process.pid` and verifies
    `claimTrackerRow` times out without claiming the row.
- Focused verification: `pnpm vitest run test/artifact-model.test.ts test/tracker-claimer.test.ts`.
- Full configured verification: `pnpm check`.

## Migration/deploy concerns

- No migration is required. Existing run artifacts and lock file paths stay compatible.
- Existing non-JSON lock files remain recoverable through the lock-age fallback.
- Atomic temp files are written in the same directory as the destination, preserving filesystem
  atomic rename semantics and avoiding cross-device rename failures.
- If a process crashes after temp write but before rename, the old destination remains readable and
  the orphan temp file is harmless.

## Blocking technical questions

None
