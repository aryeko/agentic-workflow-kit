← [Back to README](./README.md)

# Success metrics

## North-star

The percentage of autonomous story runs that end in either a verified GitHub PR/merge or a clear,
recoverable stopped state with complete artifacts.

## Supporting metrics

| Metric | Target |
| --- | --- |
| Time from repo init to first dry-run eligible story | under 10 minutes for a prepared repo |
| Story-level run evidence completeness | 100% of runs have state, events, child metadata, metrics, and final outcome |
| Track-level autopilot evidence completeness | 100% of launched children are linked to story IDs and run artifacts |
| Ambiguous-state handling | 0 silent duplicate relaunches when active child evidence exists |
| Runtime status freshness | CLI/MCP status can report latest known state within configured watch interval |
| Budget visibility | 100% of runs expose configured budgets and actual usage when host telemetry is available |
| Token breakdown coverage | input, output, reasoning, cache read/write, total, and active token fields are captured when available |
| GitHub gate correctness | PR merge happens only after configured CI/review gates pass |
| Workflow independence | PRD, HLD, track planning, and runtime commands can be invoked from external context when required inputs exist |
| Migration usefulness | existing backlog migration produces a valid tracker or an actionable error report |

## Anti-metrics

The product does not optimize for maximum autonomy at all costs. It should not hide uncertainty,
skip verification to improve throughput, treat agent prose as completion, or encourage users to run
unbounded automation without explicit repo policy.

---
Previous: [06-quality-bars](./06-quality-bars.md) · Next: [08-acceptance-criteria](./08-acceptance-criteria.md) · Up: [README](./README.md)
