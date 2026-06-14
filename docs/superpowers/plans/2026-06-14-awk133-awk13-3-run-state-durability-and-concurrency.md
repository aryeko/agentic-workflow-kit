---
title: AWK133 implementation plan
owner: codex-2026-06-14T10-04-18Z
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk133-awk13-3-run-state-durability-and-concurrency-design.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK133.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
---

# AWK133 implementation plan

## Scope

Implement the durability and concurrency hardening described in the detailed spec. Keep public
schemas and command names unchanged. Do not touch adjacent release-hardening stories.

## Steps

1. Add failing tests for artifact append serialization.
   - File: `test/artifact-model.test.ts`
   - Scenario: many concurrent `appendText`/`appendEvent` calls produce complete one-line NDJSON
     records with no malformed line.
   - RED command: `pnpm vitest --run test/artifact-model.test.ts`
   - Implement per-file append queues in `packages/orchestrator/src/artifacts/FileArtifactStore.ts`.

2. Add failing tests for malformed control and launch readers.
   - Files: `test/run-journal.test.ts`, `test/duplicate-launch-guard.test.ts`,
     `test/mcp-codex-control.test.ts`
   - Scenarios:
     - corrupt `controls.ndjson` rows are skipped by `RunJournal.readControls`;
     - corrupt `children/*.launch.json` does not throw from duplicate-launch detection;
     - corrupt child launch target yields the existing missing-session error.
   - RED commands:
     - `pnpm vitest --run test/run-journal.test.ts`
     - `pnpm vitest --run test/duplicate-launch-guard.test.ts`
     - `pnpm vitest --run test/mcp-codex-control.test.ts`
   - Implement tolerant parsing in `RunJournal`, `DuplicateLaunchGuard`, and `codexControl`.

3. Add failing tests for single-writer abort state.
   - File: `test/mcp-codex-control.test.ts`
   - Scenario: `abortRunHandler` appends `controls.ndjson` and events but does not rewrite
     `state.json`; terminal/inactive outcomes are returned from the state snapshot.
   - Implement by removing out-of-process `state.json` mutation in `commands/handlers.ts` and
     making `readControlsIfExists` tolerant.

4. Add failing tests for branch-strategy tracker claim concurrency.
   - File: `test/tracker-claimer.test.ts`
   - Scenario: two simultaneous `claimTrackerRow` calls for the same row produce exactly one
     success, and the final row owner/status matches the winner.
   - Implement exclusive per-story lock files plus post-rename owner/status verification in
     `packages/orchestrator/src/tracks/trackerClaimer.ts`.

5. Add failing tests for in-run tracker parse degradation.
   - File: `test/workflow-runner.test.ts`
   - Scenario: a story source that throws during the supervision refresh blocks the affected story
     or run and returns a blocked state instead of rejecting the whole run promise.
   - Implement guarded story-source refresh in `packages/orchestrator/src/runner/WorkflowRunner.ts`.

6. Run focused verification after green:
   - `pnpm vitest --run test/artifact-model.test.ts test/run-journal.test.ts test/duplicate-launch-guard.test.ts test/mcp-codex-control.test.ts test/tracker-claimer.test.ts test/workflow-runner.test.ts`

7. Run configured verification:
   - `pnpm check`

8. Run mandatory pre-PR review in configured subagent mode with product docs, architecture docs,
   tracker row, story brief, detailed spec, plan, diff, and verification output.

9. If review passes, update tracker status to `done`, commit, push, open PR, fill PR column, wait for
   configured CI and Codex review, update on latest `main`, rerun `pnpm check`, then squash merge and
   delete the branch when gates pass.
