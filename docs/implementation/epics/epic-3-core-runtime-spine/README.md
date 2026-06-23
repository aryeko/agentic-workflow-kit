---
title: Epic 3 - Core runtime spine
epic: 3
status: "epic: ready"
depends-on-epics: [1, 2]
last-reviewed: "2026-06-22"
---

# Epic 3 - Core Runtime Spine

## Purpose

Epic 3 makes the deterministic SDK runtime usable against foundation contracts, SDK provider ports,
and testkit mocks: runs can record and replay events, project state, evaluate capability gates, analyze
recorded evidence, and expose an early mock-backed operator command-envelope smoke path.

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|
| `core-01` Run Lifecycle & Event State | Provides the append-only event spine and pure projections. | Event envelopes, leased writer discipline, lifecycle records, replay health, projections, and cursor wait substrate. |
| `core-02` Capability & Safety | Provides fail-closed capability registry and gate records. | Capability posture, mode handling, guarantee predicates, attestation handling, `CapabilityGateRecord`, and degraded-denial behavior. |
| `core-07` Observability & Analysis | Provides telemetry taxonomy and deterministic analysis over recorded evidence. | Telemetry topics, metric wrappers, analyzer snapshots, analysis events, redacted report refs, and analysis failure signals. |
| `edge-01` Operator & Entry Surface | Provides the early mock-backed command-envelope smoke signal allowed by the dotted Epic 3 edge. | CLI/MCP command parity over the shared operator command envelope, using SDK/testkit surfaces only. |

## Why this epic exists

Later human-control, completion, recovery, and operator-production epics need a deterministic run
truth before they can make decisions. Epic 3 closes the runtime spine and gate/analysis foundations
without waiting for concrete provider drivers.

The hard dependency edge is owned by `epic-dag.md`: Epic 3 depends on Epic 1 and Epic 2, Epic 4 and
Epic 5 consume Epic 3, and the dotted edge permits a mock-backed executable smoke story without making
production Edge composition available.

## Frozen inputs

- Epic 1 foundation policy, storage, artifact, lease, workspace, and credential contracts.
- Epic 2 SDK provider ports, `CapabilityAttestation` payloads, testkit mocks, and conformance
  baseline.
- `docs/implementation/domains/core/core-01-run-lifecycle-and-state.md`.
- `docs/implementation/domains/core/core-02-capability-and-safety.md`.
- `docs/implementation/domains/core/core-07-observability-and-analysis.md`.
- `docs/implementation/domains/edge/edge-01-operator-surface.md` for the mock-backed command-envelope
  smoke signal only.
- `docs/implementation/epic-dag.md` hard and dotted Epic 3 edges.

## Outputs

- SDK run event log, event envelope, append receipt, lifecycle, replay, projection, and cursor-wait
  runtime surfaces.
- Capability registry, mode-aware gate evaluator, attestation freshness handling, and durable
  `CapabilityGateRecord` output surface.
- Telemetry topic taxonomy, honest metric value wrapper, deterministic analyzer input/output surface,
  analysis outcome records, and redacted analysis report artifacts.
- Mock-backed CLI/MCP executable smoke surface over the shared operator command envelope and SDK
  read models, with production composition deferred.
- Evidence that core behavior is proven against SDK ports and testkit mocks, not concrete provider
  drivers or worker prose.

## Scope boundaries

- In: event recording and replay, pure projections, capability gate records, analysis records,
  redacted analysis artifacts, and mock-backed command-envelope smoke.
- Out: approval adjudication, supervision timers, completion predicates, merge readiness, recovery
  classification, concrete provider behavior, real CLI/MCP provider wiring, and production operator
  composition.
- STOP when: a story needs a concrete provider, human approval workflow, completion decision,
  recovery action, external trigger, or production storage/provider composition.

## Per-domain expectations

For each included domain, the table lists the `Story Group Signals` this epic claims. Story ownership
is backfilled from the frozen Epic 3 [story DAG](./story-dag.md).

### `core-01` - Run Lifecycle & Event State

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Run event envelope and append receipt vocabulary. | `core-01-s1-event-contracts` | covered |
| Single leased writer, writer epoch fencing, monotonic sequence, and stale-writer rejection. | `core-01-s4-run-event-log-and-writer` | covered |
| Lifecycle transition records and terminal-state guardrails. | `core-01-s3-lifecycle-and-linkage` | covered |
| Session link and supersession records. | `core-01-s3-lifecycle-and-linkage` | covered |
| Replay health, tail/interior corruption classes, and partial-write handling. | `core-01-s2-replay-and-corruption` | covered |
| Pure `state`, `summary`, `metrics`, and `launch` projections. | `core-01-s5-projections` | covered |
| Low-level cursor wait primitive as the substrate later wrapped by supervision. | `core-01-s6-cursor-wait` | covered |

- Evidence expectation: Epic 3 stories leave replayable run-state evidence that sibling core domains
  can consume without writing projections or depending on drivers.

### `core-02` - Capability & Safety

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Capability registry and v1 capability posture. | `core-02-s1-capability-registry` | covered |
| Mode handling for `manual` and `assisted`, with deferred capabilities represented explicitly. | `core-02-s1-capability-registry` | covered |
| Guarantee predicates over committed evidence and attestations. | `core-02-s2-gate-evaluator` | covered |
| Freshness, expiry, scope, negative, contradictory, and absent attestation handling. | `core-02-s2-gate-evaluator` | covered |
| `CapabilityGateRecord` payloads, denial reasons, and barrier durability. | `core-02-s2-gate-evaluator` (payloads + denial reasons) + `core-02-s3-gate-record-durability` (barrier durability) | split |
| Fail-closed behavior for degraded run logs, missing projections, self-report-only evidence, or unwritable gate records. | `core-02-s2-gate-evaluator` (degraded logs, missing projections, self-report-only) + `core-02-s3-gate-record-durability` (unwritable gate records) | split |

- Evidence expectation: Epic 3 stories prove capability decisions are deterministic over recorded
  evidence, resolved policy, and provider attestations, with absent or degraded evidence denied.

### `core-07` - Observability & Analysis

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Telemetry topic taxonomy over committed run events. | `core-07-s1-telemetry-and-metrics` | covered |
| Honest metric value wrapper: available, partial, or unavailable. | `core-07-s1-telemetry-and-metrics` | covered |
| Pure analyzer snapshot, rule-set digest, analyzer version, and explicit `analyzedAt` inputs. | `core-07-s2-analyzer` | covered |
| Auto-fire triggers for terminal, blocked, supervision-lost, recovery-decision, and stale-progress evidence. | `core-07-s2-analyzer` | covered |
| `AnalysisRecorded` and `AnalysisFailed` event payloads and terminal-analysis invariant. | `core-07-s3-analysis-records-and-reports` | covered |
| Redacted write-once analysis report artifact refs. | `core-07-s3-analysis-records-and-reports` | covered |
| Failure signals for degraded input, artifact unavailability, redaction gaps, rule errors, unwritable analysis records, or missing invariant evidence. | `core-07-s2-analyzer` (degraded input, rule errors) + `core-07-s3-analysis-records-and-reports` (artifact unavailability, redaction gaps, unwritable records, missing invariant) | split |

- Evidence expectation: Epic 3 stories leave analysis records and redacted report refs that later
  completion, recovery, and operator surfaces can cite without raw unredacted artifacts.

### `edge-01` - Operator & Entry Surface

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| CLI and MCP command parity over the shared operator command envelope. | `edge-01-s1-operator-command-contract` (contract surface) + `edge-01-s2-cli-mcp-parity-smoke` (executable smoke) | split |

- Evidence expectation: Epic 3 stories may prove only the mock-backed executable smoke path allowed
  by `epic-dag.md`; production provider/storage composition and full operator behavior remain Epic 7.

## Epic readiness

- Epic 4 can author approval and liveness stories against durable run events, cursors, capability
  gates, Agent/Host ports, and testkit mocks.
- Epic 5 can author completion and recovery stories against replayable state, gate records, analysis
  outcomes, and recorded provider evidence.
- Epic 7 can later compose production CLI/MCP surfaces over the SDK without placing run logic in Edge.
- Concrete providers remain unnecessary for core runtime stories; Epic 6 proves them separately.

## Deferred work

- Approval, escalation, supervision, liveness timers, and termination handoff are deferred to Epic 4.
- Completion, verification, merge readiness, recovery, and reconciliation are deferred to Epic 5.
- Concrete provider drivers are deferred to Epic 6.
- Operator identity, approval entry, inspect/wait/explain views, attention rendering, default
  composition, and external trigger handling are deferred to Epic 7.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [epic charters](../README.md) · **← Prev:** [Epic 2 - story DAG](../epic-2-provider-contract-layer-and-test-harness/story-dag.md) · **Next →:** [Epic 3 - story DAG](./story-dag.md)

**Children:** [Epic 3 - story DAG](./story-dag.md) · [Epic 3 Execution Package Plan](./execution/plan.md) · [Implementer Prompt: core-01-s1-event-contracts](./execution/prompts/core-01-s1-event-contracts/implementer.md) · [Reviewer Prompt: core-01-s1-event-contracts](./execution/prompts/core-01-s1-event-contracts/reviewer.md) · [Implementer Prompt: core-01-s2-replay-and-corruption](./execution/prompts/core-01-s2-replay-and-corruption/implementer.md) · [Reviewer Prompt: core-01-s2-replay-and-corruption](./execution/prompts/core-01-s2-replay-and-corruption/reviewer.md) · [Implementer Prompt: core-01-s3-lifecycle-and-linkage](./execution/prompts/core-01-s3-lifecycle-and-linkage/implementer.md) · [Reviewer Prompt: core-01-s3-lifecycle-and-linkage](./execution/prompts/core-01-s3-lifecycle-and-linkage/reviewer.md) · [Implementer Prompt: core-01-s4-run-event-log-and-writer](./execution/prompts/core-01-s4-run-event-log-and-writer/implementer.md) · [Reviewer Prompt: core-01-s4-run-event-log-and-writer](./execution/prompts/core-01-s4-run-event-log-and-writer/reviewer.md) · [Implementer Prompt: core-01-s5-projections](./execution/prompts/core-01-s5-projections/implementer.md) · [Reviewer Prompt: core-01-s5-projections](./execution/prompts/core-01-s5-projections/reviewer.md) · [Implementer Prompt: core-01-s6-cursor-wait](./execution/prompts/core-01-s6-cursor-wait/implementer.md) · [Reviewer Prompt: core-01-s6-cursor-wait](./execution/prompts/core-01-s6-cursor-wait/reviewer.md) · [Implementer Prompt: core-02-s1-capability-registry](./execution/prompts/core-02-s1-capability-registry/implementer.md) · [Reviewer Prompt: core-02-s1-capability-registry](./execution/prompts/core-02-s1-capability-registry/reviewer.md) · [Implementer Prompt: core-02-s2-gate-evaluator](./execution/prompts/core-02-s2-gate-evaluator/implementer.md) · [Reviewer Prompt: core-02-s2-gate-evaluator](./execution/prompts/core-02-s2-gate-evaluator/reviewer.md) · [Implementer Prompt: core-02-s3-gate-record-durability](./execution/prompts/core-02-s3-gate-record-durability/implementer.md) · [Reviewer Prompt: core-02-s3-gate-record-durability](./execution/prompts/core-02-s3-gate-record-durability/reviewer.md) · [Implementer Prompt: core-07-s1-telemetry-and-metrics](./execution/prompts/core-07-s1-telemetry-and-metrics/implementer.md) · [Reviewer Prompt: core-07-s1-telemetry-and-metrics](./execution/prompts/core-07-s1-telemetry-and-metrics/reviewer.md) · [Implementer Prompt: core-07-s2-analyzer](./execution/prompts/core-07-s2-analyzer/implementer.md) · [Reviewer Prompt: core-07-s2-analyzer](./execution/prompts/core-07-s2-analyzer/reviewer.md) · [Implementer Prompt: core-07-s3-analysis-records-and-reports](./execution/prompts/core-07-s3-analysis-records-and-reports/implementer.md) · [Reviewer Prompt: core-07-s3-analysis-records-and-reports](./execution/prompts/core-07-s3-analysis-records-and-reports/reviewer.md) · [Implementer Prompt: edge-01-s1-operator-command-contract](./execution/prompts/edge-01-s1-operator-command-contract/implementer.md) · [Reviewer Prompt: edge-01-s1-operator-command-contract](./execution/prompts/edge-01-s1-operator-command-contract/reviewer.md) · [Implementer Prompt: edge-01-s2-cli-mcp-parity-smoke](./execution/prompts/edge-01-s2-cli-mcp-parity-smoke/implementer.md) · [Reviewer Prompt: edge-01-s2-cli-mcp-parity-smoke](./execution/prompts/edge-01-s2-cli-mcp-parity-smoke/reviewer.md) · [Epic 3 Execution Tracker](./execution/tracker.md) · [Epic 3 - stories](./stories/README.md)

<!-- /DOCS-NAV -->
