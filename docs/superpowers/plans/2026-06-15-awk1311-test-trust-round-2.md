---
title: AWK1311 implementation plan
owner: codex-2026-06-15T20-32-00Z
last-reviewed: 2026-06-15
related:
  - ../specs/2026-06-15-awk1311-test-trust-round-2-design.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK1311.md
---

# AWK1311 implementation plan

## Scope

Implement AWK13.11 test-trust round 2 only: one combined coverage gate, one on-disk story-run
integration test, and direct child-control execution coverage. Do not add real Codex/GitHub network
calls, changesets, public API changes, or docs hygiene owned by AWK13.12.

## Steps

1. Update coverage ownership.
   - Edit `vitest.config.ts` to include `test/**/*.test.ts` and `packages/orchestrator/tests/**/*.test.ts`.
   - Move the V8 coverage block from `packages/orchestrator/vitest.config.ts` to the root config.
   - Keep `packages/orchestrator/vitest.config.ts` package-local with `include: ['tests/**/*.test.ts']` and no coverage thresholds.

2. Add child-control execution tests.
   - Create `packages/orchestrator/tests/codex-control-execution.test.ts`.
   - Mock `@modelcontextprotocol/sdk/client/index.js` and `@modelcontextprotocol/sdk/client/stdio.js`.
   - Import `sendChildReply`, `sendChildInterrupt`, and `controlChild` after mocks are registered.
   - Assert reply chooses an available reply candidate, passes `sessionId`, `threadId`, and `message`, writes `child-reply-sent`, and does not persist the raw message.
   - Assert interrupt chooses an available interrupt candidate, passes `sessionId`, `threadId`, and `reason`, and writes `child-interrupt-sent`.
   - Assert `controlChild` dispatches reply and interrupt through those same execution paths.

3. Add the story-run e2e test.
   - Create `packages/orchestrator/tests/story-run-e2e.test.ts`.
   - Use a temporary workspace and a real `FileArtifactStore`.
   - Instantiate `WorkflowRunner` with fake `StorySource`, fake `StoryRunner`, fake `GitInspector`, and no real collaboration inspector.
   - Configure `pr.create: false` and `merge.auto: false` so the test stays local.
   - Run `runStory('WK001')`.
   - Assert returned state is terminal and inspect on-disk `state.json`, `summary.json`, `rows.json`, `children/WK001.launch.json`, and `children/WK001.json`.

4. Re-baseline coverage.
   - Run `pnpm exec vitest run --coverage`.
   - Set root thresholds just below the measured combined values.
   - Do not reduce thresholds below the existing AWK136 ratchet unless the combined run proves a denominator change requires it.

5. Run focused verification.
   - Run `pnpm exec vitest run --coverage`.
   - Run `pnpm --filter @agentic-workflow-kit/orchestrator test`.
   - Fix failures.

6. Run configured verification.
   - Run `pnpm check`.
   - Fix failures before review.

7. Final hygiene before marking done.
   - Keep transient spec/plan while review is active.
   - Before final tracker completion, delete this transient spec and plan if their durable content is fully represented by code/tests and tracker/PR evidence, then reset the tracker Spec/Plan cells according to repo convention.
   - Re-run `pnpm check` after cleanup.

## Review checklist

- Combined coverage gate reports one number covering both suites.
- Package-local test command remains valid.
- No network dependency was introduced.
- E2E test asserts real disk artifacts, not only in-memory state.
- Child-control tests cover production execution code and redaction.
- `pnpm check` passes.
