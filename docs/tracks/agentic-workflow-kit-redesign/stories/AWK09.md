---
title: AWK09 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/05-api-surface.md
---

# AWK09 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| OBS-1 | CLI/MCP expose realtime run status across run, child, story, phase, progress, blockers. |
| OBS-2 | Control surface is available to users/orchestrators. |
| OBS-3 | Inspect surfaces expose transcript/artifact/current outcome/tool activity refs. |
| OBS-7 | Runtime progress can be streamed/subscribed to without manual polling. |
| FUT-2 | Status/stream data can feed future UI/eval consumers. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| API surface | Defines status, stream, inspect, resources, notification payloads, topics, response bounds. |
| Runtime flows: Streaming and run control sequence | Defines live subscription and abort interaction. |
| AI, observability, and operations: Notification model | Defines progress vs structured notifications and filters. |
| Data contracts | Defines `RunEvent` and artifact refs consumed by status/stream/inspect. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK06 | Stream/status must read normalized events and state. |
| AWK07 | Status and stream should include control state. |
| AWK08 | Runtime terminal states and budget outcomes must be stable. |

## Scope boundary

**In scope**

- Implement product API status, stream, inspect, and read-only MCP resources using bounded response controls.
- Emit standard MCP progress notifications and optional structured WorkflowKit event notifications from normalized run events.
- Add CLI stream/status/inspect equivalents with JSON/NDJSON where appropriate.
- Preserve `watch_run` polling fallback and current MCP tools.
- Pin assumption: track execution uses installed 0.5.13, so new streaming is not required to supervise this track.

**Out of scope**

- Dashboard/TUI/MCP app UI.
- Analyzer report generation; AWK10 owns reports.
- Full export bundle; include only if detailed spec proves it belongs with inspect.

## Candidate surfaces

- **Files/modules:** `packages/orchestrator/src/mcp/tools.ts`, `packages/orchestrator/src/mcp/server.ts`, `packages/orchestrator/src/cli/args.ts`, `packages/orchestrator/src/commands/handlers.ts`, `packages/orchestrator/src/runner/RunJournal.ts`, `packages/orchestrator/src/types.ts`
- **Queries/schema:** none
- **Prompts/tools:** MCP resources/tools and CLI flags
- **Events/metrics:** stream filters, event topics, notification throttling
- **Components/routes:** CLI/MCP read/control surface

## Validation expectations

- MCP server tests for stream/status/inspect schemas and bounded payloads.
- CLI tests for JSON/NDJSON behavior.
- `pnpm vitest run packages/orchestrator/tests/mcp-server.test.ts packages/orchestrator/tests/cli.test.ts packages/orchestrator/tests/handlers.test.ts packages/orchestrator/tests/run-journal.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Does the MCP SDK surface support custom notifications in this server path? | yes | Verify or implement safe fallback to progress notifications plus final response. |
| What default stream replay/tail limit should V1 use? | no | Pick bounded defaults and make them configurable. |
