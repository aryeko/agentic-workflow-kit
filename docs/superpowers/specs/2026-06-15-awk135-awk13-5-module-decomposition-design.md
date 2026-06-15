---
title: AWK135 detailed technical story spec
owner: codex-2026-06-15T09-38-02Z
last-reviewed: 2026-06-15
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK135.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design.md
---

# AWK135 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK135.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Is a shared event-normalization module warranted, or does each consumer keep its own? | Create `commands/runEvents.ts` only for command-handler event normalization, filtering, and artifact helpers. Do not share it with `analysis/runAnalyzer.ts` in this story. | Handler stream/status event shaping and analyzer timeline synthesis have different output contracts. Sharing now would create cross-domain coupling in a refactor-only story. |
| Should `ChildSupervisor` own timeouts only, or also heartbeat/journal writes? | Extract `runner/ChildSupervisor.ts` to own startup, no-progress, max-runtime, heartbeat scheduling, active `AbortController`, and progress callback coordination. It receives callback functions for journal/progress/launch updates and never owns tracker completion or child result interpretation. | This removes the timeout/heartbeat state machine from `WorkflowRunner.executeChild` while preserving `WorkflowRunner` as the owner of child launch, state mutation, completion gates, and recovery decisions. |

## Exact types/contracts

- Preserve all exported public APIs from `commands/handlers.ts`, `analysis/runAnalyzer.ts`,
  `runner/WorkflowRunner.ts`, and `tracks/markdownTracker.ts`.
- New internal command modules export the same function/type implementations re-exported by
  `commands/handlers.ts`; callers continue importing from `../commands/handlers.js`.
- New analyzer modules keep `WorkflowRunAnalysis` and related exported interfaces available from
  `analysis/runAnalyzer.ts`.
- New tracker modules keep `DiscoverMarkdownTracksOptions`, `ParseTrackerStoriesContext`,
  `ValidateTrackerMarkdownContext`, diagnostics/report types, `MarkdownTrackStorySource`,
  `EmptyStorySource`, `discoverMarkdownTracks`, `parseTrackerStories`, `validateTrackerMarkdown`,
  `migrateMarkdownTracker`, and `updateTrackerStoryRow` available from `tracks/markdownTracker.ts`.
- `ChildSupervisor` is internal to `runner/` and accepts injected `ChildTimer`, `Clock`, callbacks,
  and child runner promise wiring; it must not expose a new public runtime API.

## Exact files/modules

```text
packages/orchestrator/src/commands/handlers.ts  becomes a barrel/orchestrator under 800 lines
packages/orchestrator/src/commands/config.ts  config/loading/track discovery helpers
packages/orchestrator/src/commands/runLifecycle.ts  run-story/run-eligible/list/validate/migrate handlers
packages/orchestrator/src/commands/runControl.ts  abort/control helpers and control runner lookup
packages/orchestrator/src/commands/runStatus.ts  status/stream/inspect/watch summary handlers
packages/orchestrator/src/commands/runEvents.ts  normalized event topic/level/filter/bounding helpers
packages/orchestrator/src/commands/runArtifacts.ts  artifact refs, child artifact inspection, JSON readers
packages/orchestrator/src/commands/runReports.ts  analyze/report/export handlers
packages/orchestrator/src/analysis/runAnalyzer.ts  remains public entry point under 800 lines
packages/orchestrator/src/analysis/runAnalyzerTypes.ts  exported analysis interfaces
packages/orchestrator/src/analysis/runAnalyzerArtifacts.ts  summary/rows/budgets/transcripts evidence readers
packages/orchestrator/src/analysis/runAnalyzerEvents.ts  event normalization, review, verification, timeline synthesis
packages/orchestrator/src/analysis/runAnalyzerChildren.ts  child artifact/session linkage and child evidence synthesis
packages/orchestrator/src/analysis/runAnalyzerUtils.ts  shared read/parse/count helpers
packages/orchestrator/src/runner/WorkflowRunner.ts  remains orchestration owner under 800 lines
packages/orchestrator/src/runner/ChildSupervisor.ts  extracted execute-child supervision state machine
packages/orchestrator/src/tracks/markdownTracker.ts  remains public entry point under 800 lines
packages/orchestrator/src/tracks/markdownParser.ts  markdown table/frontmatter parsing primitives
packages/orchestrator/src/tracks/trackerValidation.ts  validation diagnostics and report construction
packages/orchestrator/src/tracks/trackerMigration.ts  migration/import rendering
packages/orchestrator/src/tracks/trackerRender.ts  row update/render helpers
packages/orchestrator/tests/handlers.test.ts  characterization additions for split command behavior if needed
packages/orchestrator/tests/analysis.test.ts  characterization additions for analyzer split if needed
packages/orchestrator/tests/runner.test.ts  ChildSupervisor behavior remains covered through WorkflowRunner
packages/orchestrator/tests/markdown-tracker.test.ts  parser/validation/migration characterization remains covered
```

## Query/schema/prompt/event/component design

- No schema, prompt, CLI, MCP, tracker, PR, or artifact behavior changes.
- The refactor preserves normalized event fields (`id`, `recordedAt`, `eventAt`, `type`, `topic`,
  `level`, `message`, `storyId`, `childId`, optional bounded `data`) and analyzer review/verification
  interpretation.
- `ChildSupervisor` emits the same callback-driven events currently emitted during `executeChild`:
  startup acknowledgement/failure, child session link/progress, heartbeat/supervisor poll, timeout
  abort, and final cleanup. It does not decide completion status.
- File-size acceptance is measured with `wc -l` over source files after the split; every
  `packages/orchestrator/src/**/*.ts` file must be under 800 lines.

## Tests

- Before refactoring each surface, run or add characterization tests:
  - `pnpm --dir packages/orchestrator test -- runner.test.ts`
  - `pnpm --dir packages/orchestrator test -- handlers.test.ts`
  - `pnpm --dir packages/orchestrator test -- analysis.test.ts`
  - `pnpm --dir packages/orchestrator test -- markdown-tracker.test.ts`
- Add narrow tests only for uncovered extraction edges:
  - command event topic/level/bounding behavior if moved into `runEvents.ts` without direct coverage;
  - `ChildSupervisor` timeout/heartbeat behavior if existing `WorkflowRunner` tests do not fail on
    callback regressions;
  - tracker raw table/render behavior if moved out of `markdownTracker.ts`.
- Run `pnpm check` before marking the tracker complete.

## Migration/deploy concerns

No migrations, config changes, package exports, or plugin manifest changes. This is an internal
TypeScript refactor. Rollback is a normal git revert of the story branch.

## Blocking technical questions

None
