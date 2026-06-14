---
title: AWK10 implementation plan
owner: codex-2026-06-14T01-45-49Z
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk10-analyzer-and-report-bundle-design.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK10.md
---

# AWK10 implementation plan

## Scope

Implement the analyzer/report bundle from the detailed spec:

- keep `analyze-run` read-only and backward compatible;
- add explicit report generation that writes `analysis.json` and `report.md`;
- add bounded export generation without copying host transcripts;
- expose report/export through CLI, MCP tools, and product facade helpers where the existing API pattern fits;
- update artifact refs, tests, and canonical docs;
- remove this transient spec and plan before marking `AWK10` done.

## Steps

1. Add failing/guard tests first.
   - Extend `packages/orchestrator/tests/handlers.test.ts` with fixtures for:
     - `analyzeRunHandler` does not write report artifacts.
     - `runReportHandler` writes `analysis.json` and `report.md`.
     - `runExportHandler` copies approved artifacts and skips child `*.raw.json` plus transcript paths.
   - Extend `packages/orchestrator/tests/cli-args.test.ts` for report/export parsing.
   - Extend `packages/orchestrator/tests/mcp-server.test.ts` for `workflow_run_report` and `workflow_run_export` tool registration.
   - Extend `packages/orchestrator/tests/run-journal.test.ts` and `test/artifact-model.test.ts` for new artifact refs.

2. Implement report and export helpers.
   - Add `packages/orchestrator/src/analysis/runReport.ts`.
   - Add `packages/orchestrator/src/analysis/runExport.ts`.
   - Keep transcript output path-only.
   - Use deterministic Markdown ordering and stable JSON writes.

3. Wire command handlers and types.
   - Add report/export input/result types to `packages/orchestrator/src/types.ts` or `commands/handlers.ts` following existing local style.
   - Add `runReportHandler` and `runExportHandler`.
   - Extend `runArtifactRefs()` and `RunJournal` `artifactPaths` to include `analysis.json` and `report.md`.
   - Keep `runStatusHandler` and `runInspectHandler` non-mutating.

4. Wire CLI and MCP surfaces.
   - Extend `WorkflowCommand` and `packages/orchestrator/src/cli/args.ts`.
   - Route commands in `packages/orchestrator/src/cli.ts`.
   - Register `workflow_run_report` and `workflow_run_export` in `packages/orchestrator/src/mcp/tools.ts`.
   - Add report resource only if it can reuse existing run resolution without broad refactor.

5. Wire product facade if small and consistent.
   - Add `runReportFacade` and `runExportFacade` in `packages/orchestrator/src/api/facade.ts` if the existing envelope pattern can be reused directly.
   - Skip facade additions only if they would require unrelated API refactoring; document the reason in the implementation summary.

6. Update canonical docs.
   - Update `docs/architecture.md` for explicit report/export artifacts and path-only transcripts.
   - Update PRD technical solution deep dives:
     - `03-data-contracts.md`
     - `04-ai-observability-operations.md`
     - `05-api-surface.md`
   - Update any reference/test-plan docs touched by tests.

7. Run focused verification.
   - `pnpm vitest run test/run-analyzer.test.ts packages/orchestrator/tests/analysis.test.ts packages/orchestrator/tests/handlers.test.ts packages/orchestrator/tests/mcp-server.test.ts packages/orchestrator/tests/cli-args.test.ts packages/orchestrator/tests/run-journal.test.ts test/artifact-model.test.ts`
   - Fix failures and rerun the same focused command.

8. Run configured changed verification.
   - `pnpm check`

9. Pre-PR review and fix loop.
   - Spawn the required read-only pre-PR review subagent with full context.
   - If findings block, apply at most two local fix batches per config, rerun verification, and re-review with incremental context.

10. Finalize tracker state and docs hygiene.
   - Delete this transient plan and the detailed spec.
   - Ensure durable content is folded into canonical docs.
   - Re-run `pnpm check`.
   - Re-read the tracker row and update `AWK10` to `done`.
   - Commit tracker completion, push, create PR, wait for CI and Codex bot review, fix at most one PR review batch, and auto-merge only if all configured gates pass.
