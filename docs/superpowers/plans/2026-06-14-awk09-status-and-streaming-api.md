---
title: AWK09 implementation plan
owner: codex-2026-06-13T23-54-50Z
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk09-status-and-streaming-api-design.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK09.md
---

# AWK09 implementation plan

## Scope

Implement additive CLI/MCP product surfaces for run status, run stream, run inspect, and bounded
read-only resources over existing run artifacts. Preserve legacy `watch_run`, `watch-run`,
`analyze_run`, and analyzer behavior.

## Steps

1. Add typed command/facade contracts.
   - Update `packages/orchestrator/src/types.ts` with `WorkflowCommand` variants for `run-status`,
     `run-stream`, and `run-inspect`.
   - Update `packages/orchestrator/src/api/facade.ts` operation unions, input/result interfaces,
     failure code mapping, and `capabilities.streaming`.

2. Implement artifact readers and event normalization.
   - Add helpers in `packages/orchestrator/src/commands/handlers.ts` for run id/path resolution,
     bounded NDJSON reading, controls reading, event topic/level/message normalization, filtering,
     and artifact/child/PR indexing.
   - Add `runStatusHandler`, `runStreamHandler`, and `runInspectHandler`.
   - Keep missing optional artifact files nonfatal.

3. Wire product facades.
   - Add `runStatusFacade`, `runStreamFacade`, and `runInspectFacade` in
     `packages/orchestrator/src/api/facade.ts`.
   - Return shared envelopes with artifact refs and `next` actions.

4. Wire CLI.
   - Extend `packages/orchestrator/src/cli/args.ts` for:
     - `run status <runIdOrPath>`
     - `run stream <runIdOrPath>`
     - `run inspect <runIdOrPath>`
   - Add flags needed by this story: `--limit <n>` and `--format json|ndjson`.
   - Update `packages/orchestrator/src/cli.ts` to print envelopes for status/inspect and NDJSON
     rows for stream when requested.

5. Wire MCP tools and resources.
   - Update `packages/orchestrator/src/mcp/tools.ts` tool list and schemas.
   - Register `workflow_run_status`, `workflow_run_stream`, and `workflow_run_inspect`.
   - In the stream tool callback, use `extra.sendNotification` for standard progress notifications
     when `extra._meta.progressToken` is present.
   - Add read-only resources for project context, resolved config, tracks, run state, and run
     events. Keep output bounded.

6. Update tests first for each behavior group.
   - Extend `packages/orchestrator/tests/mcp-server.test.ts` with tool/resource registration,
     status, stream replay/progress, and inspect cases.
   - Extend `packages/orchestrator/tests/cli.test.ts` with CLI status/stream/inspect cases.
   - Add handler-level tests if CLI/MCP coverage cannot exercise filtering and bounds directly.

7. Update canonical docs.
   - Update `docs/architecture.md` to mark status/stream/inspect as implemented product surfaces.
   - Update `docs/getting-started.md` with concise operator examples.
   - Before final completion, remove this plan and the AWK09 spec after durable content is folded
     into canonical docs.

8. Verify.
   - Focused:

     ```bash
     pnpm vitest run packages/orchestrator/tests/mcp-server.test.ts packages/orchestrator/tests/cli.test.ts
     ```

   - Configured changed/full gate:

     ```bash
     pnpm check
     ```

## Risks

- MCP custom notifications are typed narrowly by the SDK. The implementation must require only
  standard progress notifications and treat structured event notifications as optional.
- Stream calls must have a timeout and bounded replay so a nonterminal run cannot block forever.
- Existing run artifacts vary by age; readers must tolerate absent metrics, controls, child launch
  records, and summary files.
