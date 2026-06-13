---
title: AWK07 detailed technical story spec
owner: codex
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK07.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
---

# AWK07 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK07.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Can the Codex MCP child request be cancelled cleanly through current SDK paths? | Treat parent-side abort as `requested`; the current driver already passes an `AbortSignal` into `Client.callTool`, and run-control also uses existing Codex interrupt tooling for linked child sessions. Confirmed child termination is not guaranteed, so outcomes distinguish `requested`, `applied`, `unsupported`, and `already-terminal`. | This preserves the current SDK-supported cancellation path without claiming process kill semantics the product does not have. |

## Exact types/contracts

- Add `RunStatus` values `aborting` and `aborted`.
- Add `RunControlAction = "abort"` and `RunControlOutcome = "requested" | "applied" | "unsupported" | "already-terminal"`.
- Add `RunControlRequest` with `id`, `runId`, `action`, optional `storyId`, `reason`, `requestedAt`, `requestedBy`.
- Add `RunControlResult` with `ok`, `runId`, `action`, `outcome`, `reason`, `requestedAt`, `appliedAt`, `runPath`, `activeStoryIds`, `childOutcomes`, `artifacts`.
- Add `controls.ndjson` as append-only run artifact. Every abort request appends one `RunControlRequest`.
- `state.json` remains the realtime status source. Abort handlers may update terminal or aborting state when safe.

## Exact files/modules

```text
packages/orchestrator/src/types.ts  Add run-control types and statuses.
packages/orchestrator/src/runner/RunJournal.ts  Add controls artifact writer and include controls in summary paths.
packages/orchestrator/src/runner/WorkflowRunner.ts  Poll controls before launching new work, between child settlements, and classify abort state.
packages/orchestrator/src/commands/handlers.ts  Add abortRunHandler shared by CLI and MCP.
packages/orchestrator/src/cli/args.ts  Parse abort-run <runPath> with optional --story and --reason.
packages/orchestrator/src/cli.ts  Execute abort-run and print JSON result.
packages/orchestrator/src/mcp/tools.ts  Register workflow_run_control and add abort capability.
packages/orchestrator/src/api/facade.ts  Report abort capability as true.
packages/orchestrator/src/index.ts  Export run-control types if needed.
packages/orchestrator/tests/runner.test.ts  Cover scheduler stop-new-launches from controls.ndjson.
packages/orchestrator/tests/mcp-server.test.ts  Cover workflow_run_control schema/result.
test/mcp-codex-control.test.ts  Cover durable control request and already-terminal/unsupported outcomes.
docs/prds/agentic-workflow-kit-redesign/technical-solution/02-runtime-flows.md  Fold durable abort behavior.
docs/prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md  Fold controls.ndjson and result contracts.
docs/prds/agentic-workflow-kit-redesign/technical-solution/05-api-surface.md  Fold CLI/MCP control surface.
```

## Query/schema/prompt/event/component design

- CLI: `agentic-workflow-kit abort-run <runPath> [--story <id>] [--reason <text>] [--json]`.
- MCP: `workflow_run_control` input `{ runPath, action: "abort", storyId?, reason?, responseFormat? }`.
- Shared handler behavior:
  - append a control request to `controls.ndjson`,
  - append `control-requested` to `events.ndjson`,
  - read `state.json` and active child launch records,
  - if state is terminal, return `already-terminal`,
  - if linked children exist, call Codex interrupt and return child outcome `requested` or `unsupported`,
  - if no linked children exist, mark state `aborted` when no active work exists, otherwise `aborting`,
  - append `control-applied` and `run-aborted` only when state is actually terminal.
- Runner behavior:
  - read `controls.ndjson` for abort requests before launching work and after child settlement,
  - stop new launches immediately after a pending abort request,
  - while active children remain, mark state `aborting`,
  - when no active children remain, finish as `aborted`.

## Tests

- `packages/orchestrator/tests/runner.test.ts`: run-eligible with a queued abort request launches no further stories and finishes `aborted`.
- `packages/orchestrator/tests/mcp-server.test.ts`: MCP tool list includes `workflow_run_control`; calling it appends durable request artifacts.
- `test/mcp-codex-control.test.ts`: abort handler returns `already-terminal` for terminal state and `unsupported` when active child lacks linked session.
- Focused command: `pnpm vitest run packages/orchestrator/tests/runner.test.ts packages/orchestrator/tests/mcp-server.test.ts test/mcp-codex-control.test.ts`
- Full gate: `pnpm check`

## Migration/deploy concerns

No database migration. Existing run artifacts without `controls.ndjson` remain valid. Existing CLI/MCP tools are preserved; `codex_interrupt` remains a low-level child-session control while `workflow_run_control` is the product-level run-control API.

## Blocking technical questions

None
