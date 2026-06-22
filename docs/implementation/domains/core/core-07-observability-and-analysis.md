---
title: "core-07 - Observability & Analysis domain charter"
id: "core-07"
layer: "core"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/core/observability-and-analysis/README.md"
last-reviewed: "2026-06-22"
---

# core-07 - Observability & Analysis

## What

Core-07 is the SDK telemetry and deterministic analysis layer. It owns implementation planning for
the telemetry taxonomy, honest metric wrappers, pure analyzer inputs and outputs, issue taxonomy,
auto-fire trigger classification, analysis outcome records, and redacted analysis report artifacts.

It reads committed run events and selected redacted artifacts, then records `AnalysisRecorded` or
`AnalysisFailed` facts without calling providers or mutating lifecycle state.

## Why

Every terminal, blocked, supervision-lost, recovery, or stale-progress path needs correlated evidence
rather than prose summaries. Observability must also avoid fake metrics: unknown values remain
unavailable or partial rather than becoming zero or success.

This domain can be built early in the core spine because sibling event payloads are consumed as data
from the run log, not as implementation dependencies.

## Does Not Own

- Emitting raw domain events for other domains.
- Approval, capability, liveness, completion, merge, recovery, or lifecycle decisions.
- Operator surfacing of analysis reports.
- OTel export or external telemetry sinks.
- Provider clients, concrete drivers, raw unredacted artifacts, raw prompts, or raw secrets.

## Inputs And Dependencies

- `core-01` Run Lifecycle & Event State for run event envelopes, replay, projections, cursors, writer,
  and evidence refs.
- `fnd-02` Storage & Artifacts for write-once redacted analysis artifacts and replay health.
- Sibling core and provider event payloads only as committed data already present in the core-01 log.
- Supplied redaction policy digest and explicit clock values as request inputs.
- Implementation DAG band: Band 3 alongside capability gates.

## Downstream Epics

- `Epic 3` Core runtime spine consumes telemetry classification and analysis records.
- `Epic 5` Completion, verification, and recovery consumes analysis availability and degraded
  observability facts.
- `Epic 7` Operator surfaces consume analysis summaries and issue evidence through core read models.

## Story Group Signals

- Telemetry topic taxonomy over committed run events.
- Honest metric value wrapper: available, partial, or unavailable.
- Pure analyzer snapshot, rule-set digest, analyzer version, and explicit `analyzedAt` inputs.
- Auto-fire triggers for terminal, blocked, supervision-lost, recovery-decision, and stale-progress
  evidence.
- `AnalysisRecorded` and `AnalysisFailed` event payloads and terminal-analysis invariant.
- Redacted write-once analysis report artifact refs.
- Failure signals for degraded input, artifact unavailability, redaction gaps, rule errors,
  unwritable analysis records, or missing invariant evidence.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [core domain charters](./README.md) · **← Prev:** [core-06 - Recovery, Reconciliation & Coordination domain charter](./core-06-recovery-and-reconciliation.md) · **Next →:** [edge domain charters](../edge/README.md)

<!-- /DOCS-NAV -->
