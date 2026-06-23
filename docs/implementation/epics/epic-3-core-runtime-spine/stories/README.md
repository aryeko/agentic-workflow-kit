---
title: Epic 3 - stories
epic: 3
status: "stories: ready"
last-reviewed: "2026-06-23"
---

# Epic 3 Stories

Epic 3's 14 story contracts are ready for the `plan-delivery` handoff.

| story id | status | one-line job |
|---|---|---|
| `core-01-s1-event-contracts` | `story: ready` | Declare the host-neutral run-log contract surface: every type plus the `RunEventLog`/`RunWriter` interfaces, as the single shared producer. |
| `core-02-s1-capability-registry` | `story: ready` | Declare the capability registry: `CapabilityId`, `CapabilityMode`, the v1 posture/guarantee-requirement catalog, and explicit deferral. |
| `core-01-s2-replay-and-corruption` | `story: ready` | Implement `replay()`: assemble `RunReplay` from `fnd-02` `EventLogStore.replay`, validate envelopes, and classify tail/interior/unavailable health. |
| `core-01-s3-lifecycle-and-linkage` | `story: ready` | Own the legal lifecycle transition table + terminal guardrails and the append-only session linkage rules as a pure validate/fold module. |
| `core-02-s2-gate-evaluator` | `story: ready` | Implement `evaluateCapabilityGate(request, replay, projections)`: guarantee predicates, attestation consumption, and the `CapabilityGateRecordPayload` + denial-reason catalog. |
| `core-07-s1-telemetry-and-metrics` | `story: ready` | Declare the telemetry topic taxonomy over committed run events and the honest `MetricValue<T>` wrapper. |
| `edge-01-s1-operator-command-contract` | `story: ready` | Declare the shared operator command-envelope substrate (type-only) in the SDK: `OperatorCommandEnvelope`, `OperatorActionKind`, actor/target/error/event-ref types, the preview/start/inspect param + view types, the `OperatorActionRecorded` payload, and the `OperatorCommandResult` shape (fields resolving from `core-01`/`edge-01` only). Does NOT declare `OperatorControlPort` (Epic 7). |
| `core-01-s5-projections` | `story: ready` | Implement `project()`: the pure `state`/`summary`/`metrics`/`launch` projections with reducer totality and deterministic rebuild. |
| `core-01-s6-cursor-wait` | `story: ready` | Implement `waitRunEvents()`: the bounded poll-over-replay cursor primitive with no lease/projection/mutation side effects. |
| `core-02-s3-gate-record-durability` | `story: ready` | Append the `CapabilityGateRecord` event at `barrier` via `RunWriter` and fail closed when the record is unwritable. |
| `core-07-s2-analyzer` | `story: ready` | Implement the pure analyzer: `classifyTrigger` auto-fire triggers and `analyze(request, snapshot)` over a deterministic snapshot. |
| `edge-01-s2-cli-mcp-parity-smoke` | `story: ready` | Prove the mock-backed executable smoke: CLI and MCP build byte-identical envelopes for preview/start/inspect, each driving one injected structural fake control surface and one audit event. CLI/MCP production builders import `sdk` only and take the fake control surface/identity/clock by injection; only the test files import the testkit fake. |
| `core-01-s4-run-event-log-and-writer` | `story: ready` | Implement the concrete `RunEventLog` + `RunWriter`: leased writer, epoch fencing, monotonic sequence, atomic-batch durability, transition enforcement, lost-ack recovery; delegate read methods. |
| `core-07-s3-analysis-records-and-reports` | `story: ready` | Implement `recordAnalysisOutcome`: `AnalysisRecorded`/`AnalysisFailed` events, redacted write-once report refs, and the terminal-analysis invariant. |

Gate-1 handoff: 14 of 14 stories are `story: ready`; the DAG is `story-dag: frozen`. Next stage: `plan-delivery`.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../README.md) · **← Prev:** [Epic 3 Execution Tracker](../execution/tracker.md) · **Next →:** [core-01-s1-event-contracts - host-neutral run-log contract surface implementation story](./core-01-s1-event-contracts.md)

**Children:** [core-01-s1-event-contracts - host-neutral run-log contract surface implementation story](./core-01-s1-event-contracts.md) · [core-01-s2-replay-and-corruption - replay and corruption classification implementation story](./core-01-s2-replay-and-corruption.md) · [core-01-s3-lifecycle-and-linkage - lifecycle legal-transition table and session linkage rules implementation story](./core-01-s3-lifecycle-and-linkage.md) · [core-01-s4-run-event-log-and-writer - run event log and writer implementation story](./core-01-s4-run-event-log-and-writer.md) · [core-01-s5-projections - projections implementation story](./core-01-s5-projections.md) · [core-01-s6-cursor-wait - cursor wait implementation story](./core-01-s6-cursor-wait.md) · [core-02-s1-capability-registry - capability registry, modes, and v1 posture catalog implementation story](./core-02-s1-capability-registry.md) · [core-02-s2-gate-evaluator - capability gate evaluator and record payload implementation story](./core-02-s2-gate-evaluator.md) · [core-02-s3-gate-record-durability - gate record durability implementation story](./core-02-s3-gate-record-durability.md) · [core-07-s1-telemetry-and-metrics - telemetry topic taxonomy and honest metric value wrapper implementation story](./core-07-s1-telemetry-and-metrics.md) · [core-07-s2-analyzer - pure analyzer implementation story](./core-07-s2-analyzer.md) · [core-07-s3-analysis-records-and-reports - analysis records and reports implementation story](./core-07-s3-analysis-records-and-reports.md) · [edge-01-s1-operator-command-contract - shared operator command-envelope substrate implementation story](./edge-01-s1-operator-command-contract.md) · [edge-01-s2-cli-mcp-parity-smoke - CLI and MCP parity smoke implementation story](./edge-01-s2-cli-mcp-parity-smoke.md)

<!-- /DOCS-NAV -->
