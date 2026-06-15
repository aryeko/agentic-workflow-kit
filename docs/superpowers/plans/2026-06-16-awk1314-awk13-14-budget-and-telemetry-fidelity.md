# AWK1314 implementation plan

## Scope

Wire `failedToolCalls` from Codex session-log metrics into runtime artifacts and budget evaluation while preserving null-with-reason behavior for unavailable telemetry.

## Steps

1. Add failing tests first:
   - `test/session-log-metrics.test.ts`: failed shell output increments `failedToolCalls`; successful output does not.
   - `test/live-metrics.test.ts`: enrichment carries and aggregates `failedToolCalls`.
   - `packages/orchestrator/tests/run-journal.test.ts`: rows and budgets observe failed-call counts and can trip a configured budget.
   - `packages/orchestrator/tests/aggregate.test.ts` and `packages/orchestrator/tests/metrics-collector.test.ts`: aggregation and merge preservation.
2. Update metric contracts:
   - Add optional `failedToolCalls` to `ChildMetricsSnapshot`.
   - Add `failedToolCalls` availability to `ChildMetricAvailability`.
   - Add aggregate `failedToolCalls: number | null`.
3. Implement session-log parsing:
   - Track tool call IDs for `function_call` and `custom_tool_call`.
   - Inspect matching output payloads.
   - Count non-zero exit-code outputs and structured error outputs.
4. Thread metrics through:
   - Set child failed-call counts during session-log enrichment.
   - Aggregate available counts.
   - Preserve counts through `MetricsCollector`.
   - Write row-level `failedToolCalls` from child metrics.
5. Make budgets enforceable:
   - Change `observedBudgetValue("failedToolCalls")` to use aggregate failed-call telemetry.
   - Keep unavailable status when no child has failed-call telemetry.
6. Update canonical docs:
   - Revise `references/runtime-artifact-contract.md` so failed tool calls are no longer described as structurally unavailable when a session log is parseable.
7. Run focused verification:
   - `pnpm vitest run test/session-log-metrics.test.ts test/live-metrics.test.ts packages/orchestrator/tests/live-metrics.test.ts packages/orchestrator/tests/aggregate.test.ts packages/orchestrator/tests/run-journal.test.ts packages/orchestrator/tests/metrics-collector.test.ts`
8. Run full verification:
   - `pnpm check`
9. Before final tracker completion:
   - Run the configured pre-PR review.
   - Delete the transient AWK1314 spec and plan after durable behavior/docs are folded into canonical files.
   - Mark tracker status `done` only after verification and review pass.
