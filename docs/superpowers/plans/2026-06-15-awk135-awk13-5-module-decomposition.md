# AWK135 implementation plan

## Scope

Pure refactor for AWK13.5 module decomposition. Preserve public imports and behavior while bringing
all source files under the 800-line hard cap.

## Steps

1. Run characterization gates before edits:
   - `pnpm --dir packages/orchestrator test -- runner.test.ts`
   - `pnpm --dir packages/orchestrator test -- handlers.test.ts`
   - `pnpm --dir packages/orchestrator test -- analysis.test.ts`
   - `pnpm --dir packages/orchestrator test -- markdown-tracker.test.ts`
2. Split tracker parsing first:
   - Move table/frontmatter parsing helpers to `tracks/markdownParser.ts`.
   - Move validation to `tracks/trackerValidation.ts`.
   - Move migration to `tracks/trackerMigration.ts`.
   - Move row render/update helpers to `tracks/trackerRender.ts`.
   - Keep `tracks/markdownTracker.ts` as the public entry point.
   - Run `pnpm --dir packages/orchestrator test -- markdown-tracker.test.ts`.
3. Split analyzer:
   - Move interfaces to `analysis/runAnalyzerTypes.ts`.
   - Move artifact evidence readers to `analysis/runAnalyzerArtifacts.ts`.
   - Move event/review/verification synthesis to `analysis/runAnalyzerEvents.ts`.
   - Move child/session linkage synthesis to `analysis/runAnalyzerChildren.ts`.
   - Move generic parsing/counting helpers to `analysis/runAnalyzerUtils.ts`.
   - Keep `analysis/runAnalyzer.ts` exporting `analyzeWorkflowRun` and public types.
   - Run `pnpm --dir packages/orchestrator test -- analysis.test.ts`.
4. Split command handlers:
   - Move config/discovery helpers to `commands/config.ts`.
   - Move list/validate/migrate/run dispatch to `commands/runLifecycle.ts`.
   - Move report/analyze/export handlers to `commands/runReports.ts`.
   - Move status/stream/inspect/watch summary behavior to `commands/runStatus.ts`.
   - Move control/abort behavior to `commands/runControl.ts`.
   - Move normalized event topic/level/filter/bounding helpers to `commands/runEvents.ts`.
   - Move artifact refs/readers/child artifact inspection to `commands/runArtifacts.ts`.
   - Keep `commands/handlers.ts` re-exporting the same public handler API.
   - Run `pnpm --dir packages/orchestrator test -- handlers.test.ts`.
5. Extract child supervision:
   - Add `runner/ChildSupervisor.ts` for startup/no-progress/max-runtime timers, heartbeat polling,
     abort controller lifecycle, and callback-driven progress/launch updates.
   - Keep `WorkflowRunner` responsible for launch preparation, state transitions, completion gates,
     recovery, tracker claims, and settled child interpretation.
   - Run `pnpm --dir packages/orchestrator test -- runner.test.ts`.
6. Run line-count acceptance:
   - `find packages/orchestrator/src -name '*.ts' -print0 | xargs -0 wc -l | sort -nr | head -20`
   - Confirm every source file is below 800 lines.
7. Run configured verification:
   - `pnpm check`
8. Run configured pre-PR review. Because `.workflow/config.yaml` requires `implement.review.prePr.mode:
   subagent`, stop before PR creation unless a real read-only review subagent is explicitly
   authorized and returns `PASS`.

## Notes

- Do not change CLI/MCP tool names, result envelopes, artifact paths, tracker syntax, or config
  schema.
- Do not remove the transient spec/plan in this story; final canonical-doc folding is governed by
  repo release conventions and later closeout.
