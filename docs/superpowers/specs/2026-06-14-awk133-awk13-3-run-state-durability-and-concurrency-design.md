---
title: AWK133 detailed technical story spec
owner: codex-2026-06-14T10-04-18Z
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK133.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
---

# AWK133 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK133.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Per-store promise chain vs a single long-lived append handle for serialization? | Use an in-process per-file promise chain inside `FileArtifactStore`, keyed by resolved artifact path. `appendText` and `appendEvent` enqueue a complete line write and remove the chain entry after the write settles. | It is crash-safe because each append still uses the OS append flag through `appendFile`; it is deterministic in tests; it avoids long-lived file handles and does not change the artifact-store contract. |
| Should out-of-process abort ever mutate `state.json`, or always go through `controls.ndjson`? | Out-of-process abort commands append a control request and journal control events only. `WorkflowRunner.applyPendingAbortControl` remains the single writer that changes run status in `state.json`. Detached/dead-run state mutation is not added in this story because no ownership protocol exists yet. | This removes the existing unsynchronized second writer while preserving the control surface. Dead-run recovery can be designed later with explicit ownership and atomic temp+rename rules. |
| How should branch-strategy parallel tracker claims avoid TOCTOU? | Add an exclusive per-story lock file next to the tracker, re-read and update the tracker while the lock is held, rename the temp file, then re-read and verify the row has `owner == self` and `status == inProgress`. Remove the lock in `finally`. | `O_EXCL` is simple, local-first, and precise for the package runtime. Post-write verification catches unexpected overwrite or parse drift before launch. |

## Exact types/contracts

- `FileArtifactStore` keeps the public `ArtifactStore` contract unchanged.
- `FileArtifactStore.appendText(relativePath, value)` and `appendEvent(event)` must serialize writes per resolved artifact path. They must not serialize unrelated files behind one global queue.
- Add a private helper equivalent to:

```ts
private readonly appendQueues = new Map<string, Promise<void>>();
private enqueueAppend(filePath: string, write: () => Promise<void>): Promise<void>;
```

- `RunJournal.readControls(): Promise<RunControlRequest[]>` returns only well-formed JSON object control rows whose `action` is `abort`. Malformed lines are ignored.
- `readControlsIfExists` in command handlers follows the same malformed-line tolerance.
- `DuplicateLaunchGuard.readLaunchRecord` returns `null` for missing, malformed, non-object, or corrupt `*.launch.json` files instead of throwing.
- `resolveChildControlTarget` treats malformed launch JSON the same as a launch record without a usable `sessionId` and raises the existing user-facing "does not have a linked Codex session" error.
- `abortRunHandler` must not mutate `state.json`; terminal and inactive-run outcomes are returned from the state snapshot and control request evidence only.
- `claimTrackerRow` acquires an exclusive lock before reading the tracker for a branch-strategy claim and verifies the owned row after rename. A lock conflict returns `{ ok: false, reason: "story <id> is already being claimed" }`.
- In-run tracker parsing during launch/supervision must be tolerant. Runtime discovery/list calls catch tracker parse errors, block the affected run/story with a structured reason, and keep the parent loop from crashing. Explicit tracker validation keeps throwing/reporting validation failures as today.

## Exact files/modules

```text
packages/orchestrator/src/artifacts/FileArtifactStore.ts
  Add per-file append serialization for appendText and appendEvent.

packages/orchestrator/src/runner/RunJournal.ts
  Make readControls malformed-line tolerant.

packages/orchestrator/src/runner/DuplicateLaunchGuard.ts
  Make launch artifact reads tolerant of malformed JSON.

packages/orchestrator/src/mcp/codexControl.ts
  Make child-control launch target reads tolerant of malformed JSON while preserving the existing missing-session error.

packages/orchestrator/src/commands/handlers.ts
  Remove out-of-process abort state mutation and make control reads tolerant.

packages/orchestrator/src/tracks/trackerClaimer.ts
  Add per-story exclusive claim locking, read/update inside the lock, and post-rename owner/status verification.

packages/orchestrator/src/runner/WorkflowRunner.ts
  Catch in-run tracker source parse failures around refresh/list paths and block the active story/run instead of letting supervision throw.

test/artifact-model.test.ts
  Add concurrent append fault-injection coverage.

test/run-journal.test.ts
  Add malformed controls tolerance coverage.

test/duplicate-launch-guard.test.ts
  Add corrupt launch record tolerance coverage.

test/mcp-codex-control.test.ts
  Add corrupt child launch target coverage and adjust abort-state expectations.

test/tracker-claimer.test.ts
  Add concurrent claim winner/loser coverage.

test/workflow-runner.test.ts
  Add malformed in-run tracker source coverage.
```

## Query/schema/prompt/event/component design

- No query, schema, prompt, UI component, or public command schema changes.
- Artifact event shape remains unchanged.
- `controls.ndjson` remains append-only control intent. `state.json` status transitions for abort are reconciled only by `WorkflowRunner`.
- Malformed controls are ignored for control application. They are not re-emitted as `{ raw }` because `RunControlRequest[]` is the existing typed contract; analyzer/watch surfaces already own raw malformed-event reporting.
- Malformed duplicate-launch metadata is treated as non-authoritative and ignored for duplicate blocking, matching the brief's "skip or raw" tolerance.

## Tests

- Red/green focused tests before production edits:
  - `pnpm vitest --run test/artifact-model.test.ts`
  - `pnpm vitest --run test/run-journal.test.ts`
  - `pnpm vitest --run test/duplicate-launch-guard.test.ts`
  - `pnpm vitest --run test/mcp-codex-control.test.ts`
  - `pnpm vitest --run test/tracker-claimer.test.ts`
  - `pnpm vitest --run test/workflow-runner.test.ts`
- Final configured gates:
  - `pnpm check`

## Migration/deploy concerns

- No data migrations, config migrations, or hosted deployment changes.
- Existing artifacts remain readable. Corrupt control/launch rows become non-fatal instead of process-fatal.
- Lock files are transient and live next to the tracker as `.claim-<safe-story-id>.lock`; stale lock cleanup is not automatic in this story because parallel local claims should fail closed rather than guess ownership.
- No plugin metadata or package manifest changes are required.

## Blocking technical questions

None
