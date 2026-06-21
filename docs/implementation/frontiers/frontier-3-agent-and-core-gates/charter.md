---
title: "Frontier 3 charter - agent and core gates"
frontier: 3
status: draft
last-reviewed: "2026-06-20"
included-domains:
  - prov-01-agent-execution
  - core-02-capability-and-safety
  - core-07-observability-and-analysis
---

# Frontier 3 charter - agent and core gates

## Purpose

Frontier 3 turns the approved Agent seam, capability gates, and observability contracts into an
implementation-ready delivery surface. The frontier exists to make later run-control work possible:
worker behavior must be normalized through the Agent contract, autonomous powers must be earned from
recorded attestations, and terminal or blocked outcomes must produce replayable analysis facts.

This charter defines what the frontier must deliver as an implementation contract. It does not define
execution workflow.

## Included domains

| Domain | Role in this frontier | Spec basis |
|---|---|---|
| `prov-01` Agent Execution | Worker/provider seam, capability attestations, Codex and mock driver obligations. | `docs/design/30-domain-reference/providers/agent-execution/` |
| `core-02` Capability & Safety | Pure capability gate evaluation over recorded evidence and attestations. | `docs/design/30-domain-reference/core/capability-and-safety/` |
| `core-07` Observability & Analysis | Telemetry topic view, analysis records, honest metrics, and terminal/blocked analysis invariant. | `docs/design/30-domain-reference/core/observability-and-analysis/` |

Package target: `docs/design/20-sdk-and-packaging/package-target.md`. The implementation should land
runtime contracts in `packages/sdk`, concrete Agent provider work in `packages/provider-codex`, and
test fixtures/conformance helpers in `packages/testkit` unless later package design says otherwise.

## Why this frontier exists

This frontier is the first frontier where provider evidence becomes load-bearing for core decisions.
It must establish three facts before later frontiers can safely progress:

- the system can represent worker progress, approvals, tool exits, degraded observations, and
  terminal Agent states without depending on a concrete driver;
- every autonomous power is denied unless a fresh, replayable, positive attestation and required
  evidence support it;
- analysis is a recorded, replayable outcome, not an after-the-fact prose summary.

Frontier 3 therefore creates the contract surface that later approval, liveness, completion, recovery,
and operator work consume.

## Dependencies and frozen inputs

Frozen inputs for Frontier 3:

- approved `prov-01`, `core-02`, and `core-07` domain designs and their sibling files;
- approved `core-01` event-log, replay, writer, cursor, projection, and degraded-health contracts;
- approved `fnd-02` artifact-store semantics for output refs and analysis report artifacts;
- approved `fnd-04` redaction and worker-safe credential boundaries where Agent output capture is
  involved;
- package target with eight packages and provider interfaces inside `packages/sdk`.

The frontier must not reinterpret the dependency rule, invent new autonomous modes, treat schema-only
provider evidence as live behavior, or couple core implementation to Codex driver details.

## Outputs

Frontier 3 is ready only when it produces implementation artifacts equivalent to:

- Agent contract types, event payloads, failure tokens, and output-sink integration.
- Agent capability attestation model for `canRelayApproval`, `canPersistApprovalAnswerChannel`,
  `canResumeOwned`, `emitsStructuredToolExit`, `emitsGuardianReview`, and
  `preservesHostProcessParentage`.
- Mock Agent driver scenarios and adversarial fixtures for positive, degraded, contradictory, and
  claim-without-evidence paths.
- Codex provider mapping that records what is schema-proven, what is live-proven, and what remains
  unavailable for the pinned version.
- Capability registry and `CapabilityGateRecord` evaluation as pure replay logic.
- Observability telemetry classifications, analysis result/failure payloads, honest metric wrappers,
  and redacted report artifact refs.
- Tests proving fail-closed behavior, replay determinism, metric honesty, and no concrete driver
  dependencies in core logic.

## Scope Boundaries

In scope:

- contract and schema surfaces for Agent events, capability gates, and analysis;
- mock-only core tests and provider conformance fixtures;
- honest degraded states for missing, stale, wrong-scope, contradictory, or non-replayable evidence;
- redacted output and analysis artifact references rather than raw output in the Run log.

Out of scope:

- approval adjudication, park/resume behavior, and human decision routing;
- liveness timers, termination, and wait semantics;
- completion, verification, merge, recovery, and operator command surfaces;
- actual process containment, runner-owned verify, Forge operations, Work Source writes, or
  provider credential issuance.

STOP if an implementation story requires a concrete driver import from `core-02` or `core-07`,
requires worker prose as a gate input, or needs unredacted secrets/prompts/output in a Run event.

## Per-domain responsibilities

### prov-01 Agent Execution

Deliver the host-neutral Agent contract and provider-driver obligations. The implementation contract
must cover start, observe, answer approval, resume owned session, stop observing, normalized events,
terminal reasons, failure reasons, and `AgentOutputSink` output refs.

The mock must be programmable and adversarial. It must independently force dropped approvals, lost
linkage, missing exit codes, duplicate terminal events, wrong freshness keys, claim-without-evidence,
and unavailable parentage.

The Codex driver must distinguish schema evidence from live evidence. Capabilities are unavailable
until their positive probes are recorded for the exact driver version, protocol surface, platform,
host attestation ids, freshness key, and scope.

### core-02 Capability & Safety

Deliver the capability registry, shared predicate inputs, attestation selection, stable failure
ordering, and `CapabilityGateRecord` payload. Gate evaluation must be a pure function of replay,
projections, policy refs, evidence refs, attestations, and explicit `evaluatedAt`.

The contract must prove manual mode denies autonomous powers, assisted mode allows only configured
capabilities whose guarantees hold, and `orchestrator-decide` always denies as deferred in v1.

### core-07 Observability & Analysis

Deliver the telemetry topic view, issue taxonomy, honest metric wrapper, analyzer request/result
types, `AnalysisRecorded`, `AnalysisFailed`, and failure catalog. The analyzer must be replayable,
redacted-by-default, and explicit about unavailable or partial metrics.

Every terminal Run with usable replay and writable Run log must have an analysis fact or an
`AnalysisFailed` fact at or after terminal lifecycle sequence. If replay or append is unusable, the
implementation must surface the invariant as unmet, not silently waive it.

## Failure and degraded outcome contract

| Condition | Required outcome |
|---|---|
| Missing, stale, negative, wrong-scope, contradictory, or schema-only behavioral attestation. | Capability is absent; dependent gate denies with a stable failure reason. |
| Agent tool output lacks exit code, output ref, current-session linkage, or redaction evidence. | Emit degraded Agent observation; do not emit usable `ToolObserved`. |
| Worker prose claims success without independent evidence. | Record as non-gating context only; completion and gates remain unverified. |
| Gate decision cannot be appended. | Caller must deny with `gate-record-unwritable` and perform no autonomous action. |
| Analysis artifact, redaction, rule, replay, or append fails. | Append `AnalysisFailed` when writable; otherwise surface `analysis-record-unwritable` or invariant missing. |
| Metric source is absent or incomplete. | Record `unavailable` or `partial`; never coerce to zero, false, empty, or success. |

## Evidence expectations

Stories in this frontier must require evidence that is falsifiable and replayable:

- spec-surface manifest listing every contract, event, failure token, fixture, and package touched;
- table tests for every capability and every named failure reason;
- replay tests proving identical inputs produce identical gate and analysis payloads;
- conformance fixtures for mock Agent scenarios and captured Codex evidence classification;
- dependency checks or tests proving core packages do not import concrete providers;
- redaction tests proving raw secrets, prompts, and unredacted command output do not enter normal
  events or analysis reports.

## Readiness criteria

Frontier 3 is implementation-ready for the next frontier when:

- Agent contract and mock fixtures can drive core tests with zero real processes and zero network;
- capability gate records are append-required before any caller may treat a gate as allowed;
- core gates reject self-report-only and schema-only behavioral evidence;
- analysis records or analysis-failed records are modeled for terminal, blocked, supervision-lost,
  stale-progress, and recovery-decision triggers;
- every delivered story has falsifiable acceptance criteria, required evidence, explicit boundaries,
  and STOP conditions;
- unresolved capability evidence is represented as degraded or unavailable, not as a TODO default
  allow.

## Expected story files to author next

- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/stories/prov-01-agent-contract.md`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/stories/prov-01-agent-mock-conformance.md`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/stories/prov-01-codex-evidence-classification.md`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/stories/core-02-capability-registry.md`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/stories/core-02-gate-records.md`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/stories/core-07-analysis-contract.md`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/stories/core-07-terminal-analysis-invariant.md`

## Deferred work

- Live approval persistence, resume, parentage, and Guardian load-bearing behavior remain unavailable
  until positive provider probes exist.
- Approval adjudication, liveness termination, completion, recovery, and operator UX belong to later
  frontiers.
- OTel export, external analysis publishing, and analysis retention policy defaults are deferred.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../../README.md) · **← Prev:** [Frontier 2 charter - provider seams](../frontier-2-provider-seams/charter.md) · **Next →:** [Frontier 4 charter - run control](../frontier-4-run-control/charter.md)

<!-- /DOCS-NAV -->
