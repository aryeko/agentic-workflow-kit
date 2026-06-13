---
title: AWK06 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/02-runtime-flows.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
---

# AWK06 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| OBS-1 | Runtime status has current parent/child/story/phase/progress/blocker data. |
| OBS-4 | Runs record wall time, turns, tool calls, failed calls, checkpoints, completion reason, and token fields when available. |
| OBS-5 | Runs emit machine-readable summary and row-level data for later dashboards/evals. |
| POL-4 | Budget policies can be evaluated against observed metrics. |
| POL-5 | Budget action decisions are represented in runtime state. |
| POL-6 | Budget config and observed usage are visible in artifacts. |
| FUT-2 | Artifact model supports later UI/eval consumers. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Runtime state and controls | Defines state transitions that artifacts must represent. |
| Data contracts | Defines run artifact shape, metrics fields, and `RunEvent`. |
| AI, observability, and operations | Defines event names and metric/report consumers. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK02 | Artifact snapshots should include resolved profiles and budget policy. |

## Scope boundary

**In scope**

- Formalize normalized run events, state snapshots, metrics snapshots, budget events, and artifact files while preserving existing artifact compatibility.
- Add or extend `summary.json`, `rows.json`, `budgets.json`, `analysis.json`, and transcript index outputs where appropriate.
- Add budget evaluation plumbing for warn/stop-new-launches/checkpoint-stop/abort decisions without necessarily applying every action yet.
- Ensure null/unavailable telemetry fields carry explicit unavailable reasons.
- Pin assumption: current track execution remains on installed 0.5.13 and cannot consume new event files until release.

**Out of scope**

- User-facing streaming API; AWK09 owns it.
- Human report formatting; AWK10 owns it.
- Abort control application; AWK07 owns it.

## Candidate surfaces

- **Files/modules:** `packages/orchestrator/src/runner/RunJournal.ts`, `packages/orchestrator/src/runner/MetricsCollector.ts`, `packages/orchestrator/src/metrics/*`, `packages/orchestrator/src/artifacts/FileArtifactStore.ts`, `packages/orchestrator/src/types.ts`, `packages/orchestrator/src/runner/WorkflowRunner.ts`
- **Queries/schema:** artifact JSON schemas/types
- **Prompts/tools:** none expected
- **Events/metrics:** normalized event and metric model
- **Components/routes:** none

## Validation expectations

- Focused artifact/journal/metrics tests and backward-compatible analyzer fixtures.
- `pnpm vitest run packages/orchestrator/tests/run-journal.test.ts packages/orchestrator/tests/metrics-collector.test.ts packages/orchestrator/tests/live-metrics.test.ts test/artifact-model.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Which summary/rows fields are guaranteed in V1 versus optional? | yes | Define stable minimal schema and compatibility behavior. |
| Where should unavailable telemetry reasons live? | yes | Decide field shape in metrics/artifact types. |
