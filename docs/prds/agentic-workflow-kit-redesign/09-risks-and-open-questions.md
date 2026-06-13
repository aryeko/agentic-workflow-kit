← [Back to README](./README.md)

# Risks and open questions

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Autonomy creates unsafe merges or branch cleanup when state is ambiguous. | high | Conservative defaults, explicit presets, recoverable stopped states, and merge only after configured gates pass. |
| Runtime artifacts become too shallow for real recovery or analysis. | high | Treat observability fields as acceptance criteria, not optional logging. |
| Provider-neutral design stays theoretical while Codex-specific assumptions leak into product contracts. | high | Make the driver contract a ship blocker even though Codex is the V1 concrete host. |
| Tracker migration from arbitrary backlogs is underspecified and creates false confidence. | med | Runtime only executes valid tracker schema; migration must validate and report gaps. |
| Token and cost metrics vary by host and may not always be available. | med | Capture fields when available, mark unavailable fields explicitly, and separate configured budgets from observed telemetry. |
| CLI/MCP management becomes too fragmented for users to understand live run state. | med | Define a small set of canonical status, inspect, abort, analyze, and report surfaces. |
| Full track autopilot hides story-level failure modes. | med | Keep story-level runtime as the execution unit and require per-story evidence. |
| Users confuse workflow docs with technical design or implementation plans. | low | Maintain explicit artifact boundaries in docs and generated outputs. |

## Open questions

- **What exact built-in agent profile taxonomy should V1 expose?** Status: open; likely story
  implementer, pre-PR reviewer, PR-review fixer, planner, analyzer, recovery, and supervisor, each
  with prompt, model, reasoning, structured-output, permission, and budget defaults.
- **Which token fields can Codex reliably expose to the WorkflowKit runtime and which require
  transcript post-processing?** Status: open; technical solution must verify from real session logs.
- **Should streaming progress be a new subscribe/watch tool or an extension of existing watch
  behavior?** Status: open; technical solution should choose the least surprising CLI/MCP contract.
- **What minimum migration formats should V1 support?** Status: open; likely kit-like markdown
  tables first, with issue tracker imports deferred.
- **Which recovery actions are safe to automate versus only recommend?** Status: open; technical
  solution must define recovery state transitions and manual controls.

---
Previous: [08-acceptance-criteria](./08-acceptance-criteria.md) · Next: [10-glossary](./10-glossary.md) · Up: [README](./README.md)
