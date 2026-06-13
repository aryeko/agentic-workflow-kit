# AWK07 implementation plan

## Scope

Implement durable abort run control for CLI/MCP and runner scheduling without adding pause/resume,
force-kill behavior, or live streaming.

## Steps

1. Add run-control types and journal support.
   - Update `packages/orchestrator/src/types.ts`.
   - Update `packages/orchestrator/src/runner/RunJournal.ts`.
   - Add unit coverage for control artifacts where the closest tests already exercise journal output.

2. Add shared abort handler.
   - Implement `abortRunHandler` in `packages/orchestrator/src/commands/handlers.ts`.
   - Append `controls.ndjson`, `control-requested`, `control-applied`, and `run-aborted` where appropriate.
   - Reuse `sendCodexInterrupt` only when a linked child session exists; otherwise report `unsupported`.

3. Wire CLI and MCP.
   - Parse `abort-run <runPath>` with `--story` and `--reason`.
   - Register MCP `workflow_run_control` for action `abort`.
   - Set product facade abort capability to true.

4. Wire runner control checks.
   - Check `controls.ndjson` before launch batches and between settlements.
   - Stop new launches after abort and finish `aborted` when active work drains.
   - Preserve tracker completion authority rules.

5. Fold durable documentation into canonical docs.
   - Update runtime flow, data contract, and API surface docs.

6. Verify in layers.
   - Run `pnpm vitest run packages/orchestrator/tests/runner.test.ts packages/orchestrator/tests/mcp-server.test.ts test/mcp-codex-control.test.ts`.
   - Run `pnpm check`.
   - Delete this transient plan and its detailed spec in the final cleanup commit after durable docs are updated.
