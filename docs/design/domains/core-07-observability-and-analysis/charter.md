---
title: "Observability & Analysis — charter"
id: "core-07"
layer: "core"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Observability & Analysis — charter

**Purpose.** Structured telemetry at the source, and analysis that **auto-fires** on every terminal /
blocked / supervision-lost transition and correlates the event log.

## Responsibilities (in scope)
- The telemetry event envelope and topic taxonomy; honest metrics (`available` / `unavailable` /
  `partial`, **never coerced to zero**).
- The analyzer: a **pure function** over the event log + projections that emits correlated issues with
  evidence refs; the issue taxonomy.
- Auto-fire triggers (terminal, blocked, supervision-lost, recovery-decision, stale-progress) and the
  `analysis-failed` fallback — invariant: every terminal run has an analysis **or** an
  `analysis-failed` record.
- Redaction (no raw secrets/tokens/prompts in normal reports).

## Out of scope
- Emitting the raw domain events (each domain emits its own).
- Operator surfacing of analysis (edge-01).

## Requirements owned
FR-9 (observability & analysis), NFR-OBS.

## Dependencies (Dependency Rule)
- Depends on: core-01 (the event log).
- Must NOT: depend on a concrete driver.

## Required reading
Standard set + [core-01](../core-01-run-lifecycle-and-state/charter.md).

## Deliverable
`design.md` defining: the telemetry envelope; the issue taxonomy; auto-fire triggers + the invariant;
the metric-honesty model; the redaction policy.

## Definition of done (domain-specific)
- Every terminal run has an analysis or `analysis-failed`; the analyzer is pure/replayable.
- Metrics are never faked; unavailable is recorded as unavailable, not zero.

## Open questions
- Analysis artifact: write-once terminal vs re-projection. OTel export later.
