# AWK1310 implementation plan

## Scope

Implement typed public API error classification for the workflow facade without changing the public
envelope shape or existing code string values.

## Steps

1. Add `packages/orchestrator/src/internal/errors.ts`.
   - Define `WorkflowApiErrorCode`.
   - Define `WorkflowKitError` plus concrete classes for config, tracker, story-not-eligible,
     run-not-found, and internal errors.
   - Define helpers for type checking and conversion from unknown throwables.

2. Refactor `packages/orchestrator/src/api/facade.ts`.
   - Import and re-export `WorkflowApiErrorCode`.
   - Replace `errorCodeForMessage` with typed-error conversion.
   - Throw `WorkflowTrackerError` for facade-owned tracker/story target failures.
   - Wrap operation catch blocks so config, tracker, run-read, and internal failures map through
     explicit boundary helpers instead of message substring matching.
   - Read `code` and `retryable` from the typed error.

3. Update tests first around the public contract.
   - Extend `packages/orchestrator/tests/api-facade.test.ts` to assert:
     - missing/duplicate/multi-track preview failures still emit `TRACKER_INVALID`;
     - claimed/not-eligible story previews emit `STORY_NOT_ELIGIBLE`;
     - message text can avoid legacy classifier substrings while code remains stable;
     - retryable comes from the class and is `false` for current public classes.
   - Keep `packages/orchestrator/tests/mcp-server.test.ts` expectations for `CONFIG_INVALID` and
     `RUN_NOT_FOUND` green.

4. Run focused verification.

```bash
pnpm --filter @agentic-workflow-kit/orchestrator test -- api-facade mcp-server
```

5. Run the configured changed/full gate.

```bash
pnpm check
```

6. Run pre-PR review, then mark AWK1310 done only after verification and review pass.
