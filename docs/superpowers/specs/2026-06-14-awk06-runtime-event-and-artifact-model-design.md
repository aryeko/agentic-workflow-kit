---
title: AWK06 detailed technical story spec
owner: codex
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK06.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/02-runtime-flows.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
---

# AWK06 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK06.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Which summary/rows fields are guaranteed in V1 versus optional? | Guarantee additive `schemaVersion: 1` artifacts with stable top-level run status, timing, child/session rows, metric availability, budget policy/evaluation, transcript indexes, and artifact paths. Keep existing `run.json`, `state.json`, `metrics.live.json`, `events.ndjson`, `stories.initial.json`, `stories/`, and `children/` semantics unchanged. | This satisfies OBS-1, OBS-4, OBS-5, POL-4, POL-5, POL-6, and FUT-2 without breaking existing analyzer fixtures or installed 0.5.13 expectations. |
| Where should unavailable telemetry reasons live? | Pair nullable telemetry values with `availability` objects keyed by metric family and dimension. Use `{ value: null, unavailableReason: string }` in normalized metric rows where a scalar is expected, and aggregate `unavailable` reason maps in summary/budget artifacts. | The PRD requires explicit unavailable reasons rather than omitted fields. A paired shape is easy for CLI/MCP/status/report consumers to render and avoids pretending missing telemetry is zero. |

## Exact types/contracts

Add exported types in `packages/orchestrator/src/types.ts`:

```ts
export type MetricAvailabilityStatus = "available" | "unavailable";

export interface MetricAvailability {
  status: MetricAvailabilityStatus;
  unavailableReason: string | null;
}

export interface NullableMetric<T> {
  value: T | null;
  unavailableReason: string | null;
}

export interface ChildMetricsSnapshot {
  storyId: string;
  toolCounts: Record<string, number>;
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
  latestProgress: string | null;
  sessionLogPath: string | null;
  availability: {
    toolCounts: MetricAvailability;
    subagentCounts: MetricAvailability;
    tokenTotals: MetricAvailability;
    sessionLog: MetricAvailability;
  };
}

export interface RunSummaryArtifact {
  schemaVersion: 1;
  runId: string;
  command: string;
  status: RunStatus;
  derivedStatus: string;
  startedAt: string;
  completedAt: string | null;
  elapsedMs: number | null;
  blockedStoryId: string | null;
  blockedReason: string | null;
  activeStoryIds: string[];
  completedStoryIds: string[];
  artifactPaths: Record<string, string>;
  aggregate: LiveMetricsSnapshot["aggregate"];
  unavailable: Record<string, string>;
}

export interface RunRowsArtifact {
  schemaVersion: 1;
  rows: RunRowArtifact[];
}

export interface RunRowArtifact {
  runId: string;
  storyId: string;
  status: string;
  ok: boolean | null;
  sessionId: string | null;
  sessionLogPath: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  latestProgress: string | null;
  toolCalls: NullableMetric<number>;
  failedToolCalls: NullableMetric<number>;
  subagents: NullableMetric<number>;
  tokens: NullableMetric<TokenTotals>;
}

export interface BudgetArtifact {
  schemaVersion: 1;
  runId: string;
  profiles: Record<string, BudgetProfileSnapshot>;
  evaluations: BudgetEvaluation[];
}

export interface BudgetEvaluation {
  profileName: string;
  taskType: AgentTaskType;
  dimension: keyof AgentBudgetPolicy;
  limit: number | null;
  observed: number | null;
  warnAtPercent: number | null;
  action: AgentBudgetAction;
  status: "not-configured" | "within-limit" | "warning" | "limit-reached" | "unavailable";
  unavailableReason: string | null;
  eventType: "budget-warning" | "budget-stop" | null;
}

export interface TranscriptIndexArtifact {
  schemaVersion: 1;
  runId: string;
  transcripts: Array<{
    storyId: string;
    sessionId: string | null;
    sessionLogPath: string | null;
    status: "linked" | "unlinked" | "missing";
    unavailableReason: string | null;
  }>;
}
```

Compatibility rule: readers must tolerate old `ChildMetricsSnapshot` objects without `availability`.
Writers must populate availability for newly written snapshots and artifacts.

`RunEvent` remains structurally open but all new runtime-written event rows must include
`recordedAt`, `eventAt`, `type`, `topic`, `level`, `message`, and bounded `data` when useful.
Legacy rows without topic/level/message remain analyzable.

## Exact files/modules

```text
packages/orchestrator/src/types.ts                         Add artifact, availability, nullable metric, and budget evaluation contracts.
packages/orchestrator/src/metrics/availability.ts          Normalize missing metric reasons and default old snapshots.
packages/orchestrator/src/metrics/budgets.ts               Evaluate resolved agent budgets against observed run/child metrics.
packages/orchestrator/src/metrics/liveMetrics.ts           Populate child and aggregate metric availability in live snapshots.
packages/orchestrator/src/runner/MetricsCollector.ts       Preserve metric availability when merging observations and progress.
packages/orchestrator/src/runner/RunJournal.ts             Write summary.json, rows.json, budgets.json, analysis.json, and transcripts.json.
packages/orchestrator/src/runner/WorkflowRunner.ts         Call new artifact writers at startup, launch, settlement, and finish checkpoints.
packages/orchestrator/src/analysis/runAnalyzer.ts          Read new artifacts when present and continue deriving old-run analysis otherwise.
packages/orchestrator/tests/run-journal.test.ts            Cover new artifact writers and legacy event timestamp behavior.
packages/orchestrator/tests/metrics-collector.test.ts      Cover availability-preserving metric merges.
packages/orchestrator/tests/live-metrics.test.ts           Cover explicit unavailable token/session reasons and aggregates.
test/live-metrics.test.ts                                  Cover session-log enrichment preserving availability.
test/run-analyzer.test.ts                                  Cover new artifact compatibility and transcript/budget evidence.
test/artifact-model.test.ts                                Assert the V1 artifact filenames and compatibility contract are documented.
```

## Query/schema/prompt/event/component design

No database queries, prompts, UI components, or migrations are required.

Artifact design:

- `summary.json` is the stable machine-readable run summary. It is written after run metadata and
  refreshed whenever state or metrics are written.
- `rows.json` contains one row per story/child/session at the current known grain. For interactive
  `implement-next`, the row may come from `state.interactive` when no child file exists.
- `budgets.json` records configured budget policies for resolved agent profiles plus evaluations
  against observed metrics. Wall time, tool calls, and failed tool calls are evaluated when values
  are observable. Token and cost dimensions report `unavailable` until host telemetry or analyzer
  evidence supplies values.
- `analysis.json` stores the structured analyzer result when analysis is explicitly run by the
  analyzer path. Runtime writers may initialize it with a minimal `{ schemaVersion: 1, status:
  "not-run" }` placeholder only if needed for artifact discoverability.
- `transcripts.json` indexes session ids and log paths; it never copies transcript contents.

Budget event design:

- `budget-warning` is emitted when a configured `warnAtPercent` threshold is crossed and the limit
  is not yet reached.
- `budget-stop` is emitted when the configured action is `stop-new-launches`, `checkpoint-stop`, or
  `abort` and the observed value reaches the limit.
- AWK06 writes events and artifact decisions only. Full stop/abort application remains AWK07/AWK08.

Unavailable reason defaults:

- Token telemetry: `session log token telemetry is unavailable`.
- Cost telemetry: `cost telemetry is not exposed by the current host`.
- Session log: `child session log path is unavailable`.
- Tool/subagent counts: `session log metrics are unavailable`.

## Tests

- `pnpm vitest run packages/orchestrator/tests/run-journal.test.ts packages/orchestrator/tests/metrics-collector.test.ts packages/orchestrator/tests/live-metrics.test.ts test/live-metrics.test.ts test/run-analyzer.test.ts test/artifact-model.test.ts`
- `pnpm check`

Test scenarios:

- New live metrics snapshots include explicit availability for tokens/session logs when missing.
- Session-log enrichment fills available tool, subagent, and token metrics while preserving explicit
  unavailable reasons for dimensions still missing.
- Budget evaluation emits warning/stop classifications without applying stop policies.
- RunJournal writes `summary.json`, `rows.json`, `budgets.json`, and `transcripts.json` while keeping
  existing artifact files and event timestamp behavior.
- Analyzer accepts both old run directories and new artifact bundles.

## Migration/deploy concerns

No migrations or hosted deploy changes.

Compatibility requirements:

- Existing run artifacts without `summary.json`, `rows.json`, `budgets.json`, `analysis.json`,
  `transcripts.json`, or metric availability fields must still analyze.
- Existing `metrics.live.json` consumers must still find `aggregate.toolCounts`,
  `aggregate.subagentCounts`, and `aggregate.tokenTotals`.
- New files are additive and remain under the existing ignored run artifact directory.
- No changes are required to `.codex-plugin/`, `.claude-plugin/`, or marketplace fixtures in this
  story because the public skill/plugin surface is unchanged.

## Blocking technical questions

None
