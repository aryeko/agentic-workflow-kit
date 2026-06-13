---
title: AWK07 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/02-runtime-flows.md
---

# AWK07 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| OBS-2 | Users can manually abort a run through CLI/MCP. |
| OBS-1 | Run status reflects control requests and application state. |
| OBS-3 | Inspect surfaces expose control artifacts and current outcome. |
| RUN-6 | Ambiguous or unsupported abort behavior produces a recoverable stopped state. |
| POL-5 | Abort is a supported budget/control action. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Runtime flows: Streaming and run control sequence | Defines abort request and application path. |
| Runtime state and controls | Defines `Aborting`, `Aborted`, and control action semantics. |
| Data contracts | Defines `controls.ndjson` and `AbortResult`. |
| API surface | Defines `workflow_run_control` and CLI equivalent. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK06 | Control requests must write into the normalized artifact/state model. |

## Scope boundary

**In scope**

- Add durable control requests through `controls.ndjson`.
- Implement abort request handling in shared handlers, CLI/MCP API, runner loop, and driver boundary where supported.
- Stop new launches immediately after abort request.
- Classify child abort outcomes as requested, applied, unsupported, or already-terminal.
- Pin assumption: the running 0.5.13 autopilot does not support this new abort path while implementing the track.

**Out of scope**

- Pause/resume.
- Force-killing arbitrary local processes without linked child/session evidence.
- Streaming subscriber implementation; AWK09 owns live event delivery.

## Candidate surfaces

- **Files/modules:** `packages/orchestrator/src/commands/handlers.ts`, `packages/orchestrator/src/runner/WorkflowRunner.ts`, `packages/orchestrator/src/drivers/StoryRunner.ts`, `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`, `packages/orchestrator/src/mcp/tools.ts`, `packages/orchestrator/src/cli/args.ts`, `packages/orchestrator/src/types.ts`
- **Queries/schema:** control artifact shape
- **Prompts/tools:** CLI/MCP control tools
- **Events/metrics:** `control-requested`, `control-applied`, `run-aborted`
- **Components/routes:** none

## Validation expectations

- Fake driver tests for applied/unsupported/already-terminal abort.
- Runner tests for stopping launches and preserving active child evidence.
- MCP/CLI tests for control schema.
- `pnpm vitest run packages/orchestrator/tests/runner.test.ts packages/orchestrator/tests/handlers.test.ts packages/orchestrator/tests/mcp-server.test.ts packages/orchestrator/tests/cli.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Can the Codex MCP child request be cancelled cleanly through current SDK paths? | yes | Probe or mock-supported behavior; record unsupported fallback explicitly. |
