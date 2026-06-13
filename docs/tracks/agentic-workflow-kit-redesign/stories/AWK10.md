---
title: AWK10 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md
---

# AWK10 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| OBS-4 | Runs record detailed behavioral and token/tool/checkpoint metrics where available. |
| OBS-5 | Machine-readable summary and row-level data are available for future reports/dashboards/evals. |
| OBS-6 | Human-readable run reports and behavioral analysis are available. |
| FUT-1 | V1 observability does not require a full benchmark harness. |
| FUT-2 | Artifacts are structured for later UI/eval consumers. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Data contracts | Defines summary, rows, analysis, transcript index, budget artifacts, and metrics fields. |
| AI, observability, and operations | Defines analyzer/report outputs and evaluation hooks. |
| API surface | Defines report/export APIs and result envelopes. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK06 | Analyzer/report builder consumes normalized artifact/event model. |
| AWK09 | Report/inspect APIs should align with status/stream artifacts and response bounds. |

## Scope boundary

**In scope**

- Extend analyzer to emit stable `summary.json`, `rows.json`, `analysis.json`, transcript indexes, budget outcomes, and `report.md`.
- Include wall time, turns, tool calls, failed calls, checkpoints, completion reason, token breakdowns when available, profile/prompt ids, and GitHub checkpoints.
- Add report/run export API behavior if not already covered by AWK09.
- Preserve backward compatibility for existing run artifacts.
- Pin assumption: installed 0.5.13 executes this track; report changes are for the released product, not current supervision.

**Out of scope**

- Full benchmark/evaluation harness.
- Hosted dashboard or MCP app.
- GitHub evidence extraction beyond available records; AWK11 owns source evidence hardening.

## Candidate surfaces

- **Files/modules:** `packages/orchestrator/src/analysis/runAnalyzer.ts`, `packages/orchestrator/src/metrics/*`, `packages/orchestrator/src/artifacts/FileArtifactStore.ts`, `packages/orchestrator/src/commands/handlers.ts`, `packages/orchestrator/src/mcp/tools.ts`, `test/run-analyzer.test.ts`, `packages/orchestrator/tests/analysis.test.ts`
- **Queries/schema:** report/summary/rows artifact shapes
- **Prompts/tools:** analyzer/report CLI/MCP tools
- **Events/metrics:** derived metrics, token and tool fields
- **Components/routes:** none

## Validation expectations

- Analyzer fixture tests for old and new artifacts.
- Report output snapshot/shape tests.
- `pnpm vitest run test/run-analyzer.test.ts packages/orchestrator/tests/analysis.test.ts packages/orchestrator/tests/aggregate.test.ts packages/orchestrator/tests/artifacts.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Which transcript fields can be linked safely without copying sensitive transcript content? | yes | Define redaction/linking contract. |
| Should report generation mutate the run directory or be read-only when report exists? | no | Align with API mutation policy. |
