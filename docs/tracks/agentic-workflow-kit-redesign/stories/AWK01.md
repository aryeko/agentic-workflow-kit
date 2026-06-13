---
title: AWK01 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/05-api-surface.md
---

# AWK01 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| WF-5 | Public docs and APIs distinguish PRD, HLD, track, story brief, detailed story spec, plan, runtime artifacts, and release artifacts. |
| RUN-1 | Story-run APIs share one request/result model for preview and launch. |
| RUN-2 | Track-run APIs share one request/result model for autopilot preview and launch. |
| OBS-1 | Status API shape can report parent run, child sessions, story, phase, latest progress, and blockers. |
| OBS-2 | Control API has a durable place in the public contract. |
| OBS-3 | Inspect API can expose artifact and transcript references. |
| HC-1 | Codex remains a V1 host through the API facade. |
| HC-2 | API vocabulary does not hardcode Codex-only concepts into product resources. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Technical requirements | Defines API consistency as a first-class requirement. |
| MCP/CLI API surface | Source of truth for resource model, result envelope, MCP tools, CLI commands, errors, and capability discovery. |
| Data contracts | Provides interfaces and artifact refs the API returns. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| PRD and technical solution | API foundation must implement the agreed product vocabulary, not current tool names. |

## Scope boundary

**In scope**

- Define shared TypeScript types/schemas for product API resources, result/error envelopes, artifact refs, warnings, next actions, and response bounds.
- Introduce a shared command facade that both current MCP tools and future CLI commands can call.
- Add tests that lock the public API vocabulary and error envelope.
- Preserve existing 0.5.13-compatible MCP tools while adding or preparing the new facade.
- Record that implementation is executed with pinned plugin version 0.5.13 and cannot depend on newly edited runtime code during the track.

**Out of scope**

- Implement every new CLI/MCP command.
- Change release/version behavior.
- Remove current MCP tools or break existing tests.

## Candidate surfaces

- **Files/modules:** `packages/orchestrator/src/types.ts`, `packages/orchestrator/src/commands/handlers.ts`, `packages/orchestrator/src/mcp/tools.ts`, `packages/orchestrator/src/cli/args.ts`, `packages/orchestrator/src/index.ts`
- **Queries/schema:** no database changes
- **Prompts/tools:** MCP tool schemas and response contracts
- **Events/metrics:** API result envelope may reference events but does not implement new event production
- **Components/routes:** CLI and MCP public surface only

## Validation expectations

- Focused API/handler/MCP/CLI tests for the new envelope and compatibility behavior.
- `pnpm vitest run packages/orchestrator/tests/mcp-server.test.ts packages/orchestrator/tests/cli.test.ts packages/orchestrator/tests/handlers.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Should the new product API coexist under new names while old MCP tools remain? | yes | Define compatibility plan and exact tool/command exposure before code. |
| How much of the API envelope should be implemented in AWK01 vs later stories? | yes | Scope minimal foundation to avoid bundling downstream runtime behavior. |
