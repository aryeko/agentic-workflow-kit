---
title: AWK1314 detailed technical story spec
owner: codex-2026-06-15T21-53-48-3NZ
last-reviewed: 2026-06-16
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK1314.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design-3.md
  - ../../../references/runtime-artifact-contract.md
---

# AWK1314 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK1314.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Wire `failedToolCalls` from session-log metrics, or retire the dimension? | Wire it. | Codex session JSONL records tool calls as `response_item` payloads and records tool outputs with matching `call_id`; failed shell calls include non-zero exit-code text such as `Process exited with code 1`. The existing session-log parser already correlates call/output records for review-loop extraction, so the same source can produce an enforceable failed-call count. |
| If retired, soft-deprecate or hard-remove from the schema? | Not applicable; the dimension remains in the schema. | Keeping the dimension is compatibility-preserving and satisfies POL-4/POL-5 once budget evaluation reads the observed count. |

## Exact types/contracts

- Extend `SessionLogMetrics` with `failedToolCalls: number`, counting failed function/custom tool outputs parsed from Codex session JSONL.
- Extend `ChildMetricsSnapshot` with optional `failedToolCalls?: number | null`.
- Extend `ChildMetricAvailability` with `failedToolCalls: MetricAvailability`.
- Extend `LiveMetricsSnapshot.aggregate` with `failedToolCalls: number | null`.
- Preserve `AgentBudgetPolicy.failedToolCalls` and its default action `warn`.
- Preserve runtime artifact compatibility: older child/run artifacts without `failedToolCalls` still normalize to `null` plus `failed tool-call telemetry is unavailable`.

## Exact files/modules

```text
packages/orchestrator/src/metrics/sessionLogMetrics.ts  Parse failed tool-call outputs from Codex session JSONL.
packages/orchestrator/src/metrics/liveMetrics.ts        Carry parsed failed-call counts into child metrics and availability.
packages/orchestrator/src/metrics/aggregate.ts          Aggregate failed-call counts across children.
packages/orchestrator/src/metrics/availability.ts       Normalize failed-call metric availability.
packages/orchestrator/src/metrics/budgets.ts            Evaluate `failedToolCalls` against observed metrics.
packages/orchestrator/src/runner/RunJournal.ts          Write row-level failed-call nullable metrics from child data.
packages/orchestrator/src/runner/MetricsCollector.ts    Preserve failed-call metrics while merging observations.
packages/orchestrator/src/types.ts                      Update metric and artifact TypeScript contracts.
references/runtime-artifact-contract.md                 Document enforceable failed-call telemetry semantics.
test/session-log-metrics.test.ts                        Cover failed-call parsing from session logs.
test/live-metrics.test.ts                               Cover live enrichment from session logs.
packages/orchestrator/tests/*                           Update package-level aggregate, budget, journal, and collector tests.
```

## Query/schema/prompt/event/component design

- Session-log parsing:
  - Record `response_item` payloads with `type: "function_call"` or `type: "custom_tool_call"` and a string `call_id`.
  - On matching `function_call_output` or `custom_tool_call_output`, increment `failedToolCalls` when the output indicates a tool execution failure.
  - Treat shell output containing `Process exited with code <non-zero>` or `Exit code: <non-zero>` as a failed tool call.
  - Treat structured tool output with `ok: false`, `status: "error"`, or a string `error` field as a failed tool call.
  - Keep the existing `failedSpawnAgentAttempts` review helper behavior, but make failed spawn-agent outputs also count as failed tool calls through the generic parser.
- Metrics:
  - `enrichLiveMetricsFromSessionLogs` sets `child.failedToolCalls` and marks `availability.failedToolCalls` as available whenever a linked session log is parsed successfully.
  - Children without a linked/parseable session log keep `failedToolCalls: null` and an unavailable reason.
  - Aggregate failed calls sums available child values and stays `null` when no child has available failed-call telemetry.
- Budgets:
  - `observedBudgetValue("failedToolCalls")` reads `metrics.aggregate.failedToolCalls`.
  - A configured failed-call budget can now produce `within-limit`, `warning`, or `limit-reached`; missing telemetry remains `unavailable`, never observed zero.

## Tests

- `pnpm vitest run test/session-log-metrics.test.ts test/live-metrics.test.ts packages/orchestrator/tests/live-metrics.test.ts packages/orchestrator/tests/aggregate.test.ts packages/orchestrator/tests/run-journal.test.ts packages/orchestrator/tests/metrics-collector.test.ts`
- `pnpm check`

Scenarios:

- failed shell output increments `failedToolCalls` while successful outputs do not.
- live-metrics enrichment copies `failedToolCalls` from a linked session log and aggregates it.
- row artifacts write `failedToolCalls.value`.
- budget evaluation trips a configured failed-call budget.
- legacy/no-session metrics keep the explicit unavailable reason.

## Migration/deploy concerns

No migrations or hosted deployment changes. This is a TypeScript/runtime artifact contract change only. Existing artifacts without `failedToolCalls` remain analyzable because the new child metric is optional and normalizes unavailable when absent.

## Blocking technical questions

None
