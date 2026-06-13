---
title: AWK06 implementation plan
owner: codex
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk06-runtime-event-and-artifact-model-design.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK06.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
---

# AWK06 implementation plan

## Scope

Add a compatibility-preserving V1 runtime artifact model for normalized summaries, rows, budget
evaluations, transcript indexes, and explicit unavailable telemetry reasons. Keep existing artifact
paths and analyzer behavior valid for old runs.

Out of scope: streaming API changes, user-facing reports, abort/control application, and human
report formatting.

## Steps

1. Add tests for the new artifact/availability contract.
   - Extend `packages/orchestrator/tests/live-metrics.test.ts` for missing token/session
     availability and aggregate compatibility.
   - Extend `packages/orchestrator/tests/metrics-collector.test.ts` for availability-preserving
     metric merges.
   - Extend `packages/orchestrator/tests/run-journal.test.ts` for `summary.json`, `rows.json`,
     `budgets.json`, and `transcripts.json`.
   - Extend `test/live-metrics.test.ts` for session-log enrichment preserving unavailable reasons.
   - Extend `test/run-analyzer.test.ts` for old-run compatibility plus new transcript/budget
     artifact evidence.
   - Extend `test/artifact-model.test.ts` to document the V1 artifact filenames.

2. Add runtime types and metric helpers.
   - Update `packages/orchestrator/src/types.ts` with availability, nullable metric, summary,
     rows, budget, and transcript index interfaces.
   - Add `packages/orchestrator/src/metrics/availability.ts` for default availability and legacy
     snapshot normalization.
   - Add `packages/orchestrator/src/metrics/budgets.ts` to evaluate resolved profile budgets
     against observed run/child metrics.

3. Populate availability in live metrics.
   - Update `packages/orchestrator/src/metrics/liveMetrics.ts` to normalize child snapshots and
     aggregate metrics without changing existing aggregate field names.
   - Update `packages/orchestrator/src/runner/MetricsCollector.ts` to preserve availability on
     progress updates and snapshot merges.

4. Write additive artifact files from the journal.
   - Update `packages/orchestrator/src/runner/RunJournal.ts` with a method that writes
     `summary.json`, `rows.json`, `budgets.json`, and `transcripts.json` from state, config, live
     metrics, and child records.
   - Do not require `analysis.json` during ordinary runtime execution; analyzer-owned writes remain
     separate.

5. Call artifact writers at runtime checkpoints.
   - Update `packages/orchestrator/src/runner/WorkflowRunner.ts` so state/live metrics writes also
     refresh summary, rows, budget, and transcript artifacts.
   - Emit budget warning/stop events when evaluations cross thresholds, but do not apply stop or
     abort actions in this story.

6. Keep analyzer compatibility.
   - Update `packages/orchestrator/src/analysis/runAnalyzer.ts` only where needed to expose new
     budget/transcript artifact evidence and tolerate old bundles.

## Verification

Focused first:

```bash
pnpm vitest run packages/orchestrator/tests/run-journal.test.ts packages/orchestrator/tests/metrics-collector.test.ts packages/orchestrator/tests/live-metrics.test.ts test/live-metrics.test.ts test/run-analyzer.test.ts test/artifact-model.test.ts
```

Full gate:

```bash
pnpm check
```
