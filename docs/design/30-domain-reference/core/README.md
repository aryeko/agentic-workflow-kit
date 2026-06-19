# Core domain reference

Core is the deterministic control plane.

## Domains

| Domain | Original ID | Owns |
|---|---|---|
| [Run lifecycle and state](run-lifecycle-and-state/README.md) | core-01 | Event log, writer, projections, lifecycle. |
| [Capability and safety](capability-and-safety/README.md) | core-02 | Capability registry and gates. |
| [Approval and escalation](approval-and-escalation/README.md) | core-03 | Approval relay, scoped grants, park/resume. |
| [Supervision and liveness](supervision-and-liveness/README.md) | core-04 | Worker progress and termination handoff. |
| [Completion and merge](completion-and-merge/README.md) | core-05 | Evidence predicates, completion, merge readiness. |
| [Recovery and reconciliation](recovery-and-reconciliation/README.md) | core-06 | Recovery classifier and launch coordination. |
| [Observability and analysis](observability-and-analysis/README.md) | core-07 | Telemetry, analyzer, terminal analysis invariant. |
