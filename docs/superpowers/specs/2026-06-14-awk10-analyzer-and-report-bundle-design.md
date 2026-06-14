---
title: AWK10 detailed technical story spec
owner: codex-2026-06-14T01-45-49Z
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK10.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/05-api-surface.md
---

# AWK10 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK10.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Which transcript fields can be linked safely without copying sensitive transcript content? | Keep transcript artifacts and reports path-only by default: `storyId`, `sessionId`, `sessionLogPath`, `status`, and `unavailableReason`. Analyzer/report/export code must not read or copy transcript line content except for existing metrics extraction from linked local session logs. | This preserves OBS-3/OBS-5/FUT-2 inspectability while avoiding accidental disclosure of full host transcripts. Existing `transcripts.json` already follows this shape, so the story can formalize and test it. |
| Should report generation mutate the run directory or be read-only when report exists? | `analyze-run` remains read-only. New report/export APIs may write `analysis.json`, `report.md`, and bounded export bundles only through explicit report/export commands or tools. If `report.md` exists, report generation overwrites it deterministically from current artifacts. | Existing analyzer callers rely on read-only behavior. Explicit report/export operations satisfy OBS-6 without surprising inspect/status calls. Deterministic overwrite keeps artifacts reproducible. |

## Exact types/contracts

- Add exported report/export result contracts in `packages/orchestrator/src/commands/handlers.ts` or a small adjacent module:
  - `WorkflowRunReportInput extends CliOverrides`: `runId?: string`, `runPath?: string`, `format?: "json" | "markdown"`, `write?: boolean`, `sessionRoot?: string`.
  - `WorkflowRunReportResult`: `runId`, `artifactDir`, `format`, `analysis`, `markdown`, `artifacts` where `artifacts.analysis` is `analysis.json` and `artifacts.report` is `report.md`.
  - `WorkflowRunExportInput extends CliOverrides`: `runId?: string`, `runPath?: string`, `out?: string`, `include?: "summary" | "full-bounded"`.
  - `WorkflowRunExportResult`: `runId`, `artifactDir`, `bundleDir`, copied artifact refs, skipped refs with reasons, and byte counts.
- Extend `RunSummaryArtifact.artifactPaths` and run artifact reference helpers to include:
  - `analysis: "analysis.json"`
  - `report: "report.md"`
- Keep `WorkflowRunAnalysis` stable and serializable as the `analysis.json` schema. It must include:
  - run status and derived status
  - issues
  - child/session linkage and metrics availability
  - command/subagent/token totals when available
  - review, verification, merge summaries
  - timeline with `recordedAt`, `eventAt`, and file-order `index`
  - artifact evidence for `summary.json`, `rows.json`, `budgets.json`, and `transcripts.json`
- Add a markdown report builder contract:
  - input: `WorkflowRunAnalysis`
  - output: deterministic Markdown with sections for outcome, issues, children, verification, review, merge, metrics, artifact evidence, and transcript links.
  - transcript section may display paths and availability only; it must not inline transcript content.
- Add bounded export contract:
  - copy `run.json`, `config.resolved.json`, `state.json`, `metrics.live.json`, `events.ndjson`, `summary.json`, `rows.json`, `budgets.json`, `transcripts.json`, `analysis.json`, `report.md`, and child `*.json` artifacts when present.
  - omit child `*.raw.json` and any host transcript files by default.
  - for `full-bounded`, keep every copied text/JSON file under an explicit per-file byte ceiling and record truncation/skipped evidence instead of silently copying huge files.

## Exact files/modules

```text
packages/orchestrator/src/analysis/runAnalyzer.ts       Keep `analyzeWorkflowRun` read-only; export or share report-safe helpers only if needed.
packages/orchestrator/src/analysis/runReport.ts         New deterministic markdown report builder and optional report JSON writer helpers.
packages/orchestrator/src/analysis/runExport.ts         New bounded export bundle builder that copies only approved run artifacts.
packages/orchestrator/src/commands/handlers.ts          Add `runReportHandler`, `runExportHandler`, include analysis/report in inspect artifact refs.
packages/orchestrator/src/cli/args.ts                   Add `run report <runRef>` and `run export <runRef>` parsing or compatible top-level aliases if existing CLI shape requires it.
packages/orchestrator/src/cli.ts                        Route parsed report/export commands and honor `--format markdown|json`.
packages/orchestrator/src/mcp/tools.ts                  Register `workflow_run_report` and `workflow_run_export`; add `workflow://runs/{runId}/report` resource when practical.
packages/orchestrator/src/api/facade.ts                 Add facade envelopes for report/export if the command layer exposes product API wrappers.
packages/orchestrator/src/runner/RunJournal.ts          Add `analysis` and `report` to `artifactPaths`; do not generate them during normal runtime completion.
packages/orchestrator/src/types.ts                      Add report/export command/result/input types and artifact path keys as needed.
packages/orchestrator/tests/analysis.test.ts            Verify analysis remains compatible and serializable.
test/run-analyzer.test.ts                               Cover interactive journals plus new artifact/report evidence.
packages/orchestrator/tests/handlers.test.ts            Cover report/export handlers and artifact refs.
packages/orchestrator/tests/mcp-server.test.ts          Cover tool schemas and concise/detailed report/export output.
packages/orchestrator/tests/cli-args.test.ts            Cover CLI parsing.
packages/orchestrator/tests/run-journal.test.ts         Cover new artifact path refs without runtime writes.
test/artifact-model.test.ts                             Update contract expectations.
docs/architecture.md                                    Fold durable analyzer/report/export artifact behavior into canonical docs.
docs/prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md  Reflect final artifact set if behavior changes.
docs/prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md  Reflect report/export behavior.
docs/prds/agentic-workflow-kit-redesign/technical-solution/05-api-surface.md     Reflect shipped CLI/MCP report/export names.
```

## Query/schema/prompt/event/component design

- No database, prompt, route, or UI component changes.
- `analyze-run`:
  - remains read-only and returns `WorkflowRunAnalysis`.
  - continues to accept `--session-root` for local metrics extraction from host logs.
  - must not write `analysis.json` or `report.md`.
- `run report` / `workflow_run_report`:
  - resolves run directory through the same `runId`/`runPath` logic used by status/inspect.
  - calls `analyzeWorkflowRun`.
  - writes `analysis.json` and `report.md` only when invoked.
  - returns markdown when `format: "markdown"` or structured result when JSON/detailed response is requested.
  - appends no runtime event by default; it is a post-run analysis operation, not run execution evidence.
- `run export` / `workflow_run_export`:
  - builds a bundle directory. Default `out` is a sibling under the run directory, such as `exports/<timestamp>` or `export`.
  - includes only approved run artifacts and child JSON evidence.
  - never follows `transcripts.json.sessionLogPath` to copy host transcript contents unless a future explicit opt-in is designed.
  - records skipped/missing/truncated files in the result.
- Markdown report content:
  - title: `# WorkflowKit run report: <runId>`
  - outcome block: status, derived status, blocked reason, artifact directory
  - issues block: bullet list or `None`
  - child rows: story id, status, ok, session linkage, metrics availability, expected branch/worktree when available
  - verification/review/merge: compact summaries with command/status and review loop continuity
  - metrics: command counts, subagent counts, token totals or unavailable reason
  - artifacts: present/missing schema versions and paths
  - transcripts: linked/missing/unlinked counts and path-only entries

## Tests

- Focused first:
  - `pnpm vitest run test/run-analyzer.test.ts packages/orchestrator/tests/analysis.test.ts packages/orchestrator/tests/handlers.test.ts packages/orchestrator/tests/mcp-server.test.ts packages/orchestrator/tests/cli-args.test.ts packages/orchestrator/tests/run-journal.test.ts test/artifact-model.test.ts`
- Add/extend scenarios:
  - read-only `analyzeRunHandler` does not create `analysis.json` or `report.md`.
  - report handler creates deterministic `analysis.json` and `report.md`.
  - report markdown includes review, verification, merge, metrics, artifact evidence, and transcript path-only sections.
  - export handler copies bounded approved artifacts, skips `*.raw.json`, and never follows transcript paths.
  - inspect/status artifact refs include report/analysis without requiring them to exist.
  - MCP schemas expose `workflow_run_report` and `workflow_run_export`.
  - CLI parses report/export commands and `--format markdown|json`.
  - old run directories without report artifacts still analyze successfully.
- Full gate:
  - `pnpm check`

## Migration/deploy concerns

- No database migrations or hosted deploy changes.
- Existing run artifact directories remain readable; missing `analysis.json` and `report.md` are reported as absent, not invalid.
- `analyze-run` read-only behavior is preserved for compatibility.
- Report/export commands add new files only when explicitly invoked.
- Runtime completion still writes only existing execution artifacts; post-run report generation must not become completion authority.
- Canonical docs must be updated before final story completion, and this transient spec/plan must be deleted in the final commit.

## Blocking technical questions

None
