---
title: AWK03 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/05-api-surface.md
---

# AWK03 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| TRK-1 | Runtime execution accepts only kit-contract trackers. |
| TRK-2 | Existing backlogs/custom markdown can be migrated or guided into the kit schema. |
| TRK-3 | Invalid trackers produce actionable diagnostics. |
| TRK-4 | Tracker status remains the source of truth. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Architecture and domains | Tracker validation belongs in the contract domain. |
| Data contracts | Tracker graph and artifact/report outputs are file-backed. |
| API surface | Defines tracker validate/migrate commands and tools. |
| AI, observability, and operations | Migration writes draft artifacts and validation reports, not arbitrary in-place edits. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK01 | Validation/migration APIs should use the shared product result/error envelope. |

## Scope boundary

**In scope**

- Add first-class tracker validation diagnostics that identify missing columns, invalid statuses, owner conflicts, invalid dependency refs, prefix/id issues, and story-brief link gaps.
- Add tracker migration/import workflow for markdown tables and kit-like tracker docs into draft kit trackers plus a migration report.
- Expose validation/migration through CLI/MCP product API while preserving current list/eligible behavior.
- Add fixtures for valid/invalid tracker and migration cases.
- Pin assumption: execution uses installed 0.5.13; new validation/migration APIs are implemented code, not required by the running autopilot until release.

**Out of scope**

- Importing GitHub/Jira/Linear issue trackers.
- Running migrated trackers automatically without a successful validation gate.
- Changing the status matrix columns.

## Candidate surfaces

- **Files/modules:** `packages/orchestrator/src/tracks/markdownTracker.ts`, `packages/orchestrator/src/commands/handlers.ts`, `packages/orchestrator/src/mcp/tools.ts`, `packages/orchestrator/src/cli/args.ts`, `references/tracker-contract.md`, `references/templates`, `test/tracker-contract.test.ts`, `packages/orchestrator/tests/markdown-tracker.test.ts`
- **Queries/schema:** none
- **Prompts/tools:** possible migration skill/tool prompt context
- **Events/metrics:** validation/migration report artifacts
- **Components/routes:** CLI/MCP tracker commands

## Validation expectations

- Focused tracker parser/diagnostic/migration tests with fixtures.
- `pnpm vitest run test/tracker-contract.test.ts packages/orchestrator/tests/markdown-tracker.test.ts packages/orchestrator/tests/handlers.test.ts packages/orchestrator/tests/mcp-server.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Should migration live in a deterministic parser helper, a skill-only flow, or both? | yes | Choose V1 split and artifact shape. |
| Where should migration reports be stored? | yes | Define path convention and retention before implementation. |
