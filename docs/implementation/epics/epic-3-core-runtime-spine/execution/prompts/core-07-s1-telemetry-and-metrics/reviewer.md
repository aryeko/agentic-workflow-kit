# Reviewer Prompt: core-07-s1-telemetry-and-metrics

## Assigned Routing

- Source story id: `core-07-s1-telemetry-and-metrics`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.
- Model class: `frontier-reviewer`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-07-s1-telemetry-and-metrics covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 and carries public observability taxonomy and metric wrapper, but type-only and bounded by catalog tests. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-07-s1-telemetry-and-metrics`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-07-s1-telemetry-and-metrics.md`.
- Allowed pathset: `packages/sdk/src/core/observability/telemetry/**`, `packages/sdk/tests/core/observability/telemetry/**`.
- Direct dependencies: `core-01-s1-event-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

- **AC-1** `TelemetryTopic` is a TypeScript string-literal union of exactly the 10 topic labels
  (`"lifecycle"`, `"capability"`, `"approval"`, `"liveness"`, `"completion"`, `"recovery"`,
  `"provider-evidence"`, `"storage"`, `"privacy"`, `"analysis"`); a value not in that set fails
  TypeScript assignment.
  - evidence: `telemetry-topic-type.unit.test.ts` — a type-level fixture assigns each of the 10
    string literals to a `TelemetryTopic` variable (passes tsc); a separate `@ts-expect-error`
    fixture assigns `"unknown-topic"` to `TelemetryTopic` (tsc confirms the error); test asserts
    `TELEMETRY_TOPIC_CATALOG.map(e => e.topic)` contains exactly the 10 strings.

- **AC-2** `TELEMETRY_TOPIC_CATALOG` contains exactly 10 entries, one per `TelemetryTopic`, and
  the `lifecycle` entry's event-type names include `"RunLifecycleTransitioned"` and
  `"SessionLinked"`.
  - evidence: `telemetry-topic-catalog.unit.test.ts` asserts `TELEMETRY_TOPIC_CATALOG.length === 10`;
    finds the `lifecycle` entry and asserts its event-type names include `"RunLifecycleTransitioned"`
    and `"SessionLinked"`.

- **AC-3** Each of the 10 topics in `TELEMETRY_TOPIC_CATALOG` maps to the design-specified event-type
  names: `capability` → includes `"CapabilityAttestation"`, `"CapabilityGateRecord"`; `approval` →
  includes `"ApprovalRequested"`, `"ApprovalDecisionRecorded"`, `"ApprovalOutcomeRecorded"`;
  `liveness` → includes `"LivenessStateChanged"`, `"SupervisionLost"`, `"WorkerTerminated"`;
  `completion` → includes `"CompletionDecisionRecorded"`, `"MergeDecisionRecorded"`,
  `"PostMergeOutcomeRecorded"`; `recovery` → includes `"RecoveryClassified"`,
  `"RecoveryActionPlanned"`, `"ReconciliationBlocked"`; `analysis` → includes
  `"AnalysisRecorded"`, `"AnalysisFailed"`; `provider-evidence`, `storage`, and `privacy` entries
  are present with at least one event-type name each.
  - evidence: `telemetry-topic-catalog.unit.test.ts` (same file as AC-2) uses a table-driven loop
    over the design-specified per-topic sets; for each topic, `find` the entry and assert
    `entry.eventTypeNames` includes each expected name.

- **AC-4** A `MetricValue<number>` value can be constructed in the `"available"` arm with `state:
  "available"`, a numeric `value`, a non-empty `unit` string, and a non-empty `evidenceRefs` array
  of `EvidenceEventRef`; TypeScript accepts the assignment and the runtime object has the expected
  shape.
  - evidence: `metric-value-available.unit.test.ts` constructs `const m: MetricValue<number> = {
    state: "available", value: 42, unit: "ms", evidenceRefs: [<fixture EvidenceEventRef>] }`;
    asserts `m.state === "available"`, `m.value === 42`, `m.unit === "ms"`,
    `m.evidenceRefs.length === 1`.

- **AC-5** A `MetricValue<number>` value can be constructed in the `"partial"` arm with `state:
  "partial"`, `missing: ["tool-exit-counts"]`, and an `evidenceRefs` array; TypeScript accepts the
  assignment; the runtime object has `state === "partial"`, `missing` containing the declared
  string, and `evidenceRefs`.
  - evidence: `metric-value-partial.unit.test.ts` constructs `const m: MetricValue<number> = {
    state: "partial", value: undefined, unit: "count", missing: ["tool-exit-counts"],
    evidenceRefs: [] }`; asserts `m.state === "partial"`, `m.missing[0] === "tool-exit-counts"`.

- **AC-6** A `MetricValue<number>` with `state: "partial"` and `missing: []` (empty array) is
  constructable at the TypeScript level (the type is `string[]`, not a non-empty tuple at compile
  time); the type permits any `string[]` value for `missing`, including an empty array. The design
  semantic requirement that partial metrics must name the missing source or denominator (per
  `analysis-contract.md §Metric honesty`) is NOT type-enforceable here and is explicitly deferred:
  it is owned and enforced by the analyzer producer `core-07-s2-analyzer` (its metric-honesty AC).
  - evidence: `metric-value-partial.unit.test.ts` (same file as AC-5) includes a type-level fixture
    constructing `const m: MetricValue<number> = { state: "partial", missing: [], unit: "count",
    evidenceRefs: [] }` and asserting it passes tsc (the type accepts `missing: string[]` with an
    empty array); a separate fixture constructs `{ state: "partial", missing: ["tool-exit-counts"],
    unit: "count", evidenceRefs: [] }` and asserts `m.missing[0] === "tool-exit-counts"`,
    confirming the field is present and typed correctly. The non-empty-`missing` semantic invariant
    is not asserted here; it is deferred to `core-07-s2-analyzer`.

- **AC-7** A `MetricValue<number>` value can be constructed in the `"unavailable"` arm with `state:
  "unavailable"`, a non-empty `reason` string, and an `evidenceRefs` array; TypeScript accepts it;
  `reason` is a required field (omitting it fails tsc).
  - evidence: `metric-value-unavailable.unit.test.ts` constructs `const m: MetricValue<number> = {
    state: "unavailable", reason: "post-merge-outcome-absent", evidenceRefs: [] }`; asserts
    `m.state === "unavailable"`, `m.reason === "post-merge-outcome-absent"`. A
    `@ts-expect-error` fixture omits `reason` and confirms tsc reports a missing-property error.

- **AC-8** The `"unavailable"` arm does not contain a `value` field; constructing `{ state:
  "unavailable", value: 0, reason: "x", evidenceRefs: [] }` produces a TypeScript excess-property
  error (the arm has no `value` key), proving unavailable values cannot be coerced to `0` by
  accident.
  - evidence: `metric-value-unavailable.unit.test.ts` (same file as AC-7) adds a
    `@ts-expect-error` fixture assigning `{ state: "unavailable", value: 0, reason: "x",
    evidenceRefs: [] }` to `MetricValue<number>` and confirms tsc reports excess-property error.

- **AC-9** The `"available"` and `"partial"` arms both require `unit: string` (non-optional); omitting
  `unit` from either arm fails tsc.
  - evidence: `metric-value-available.unit.test.ts` (same file as AC-4) and
    `metric-value-partial.unit.test.ts` (same file as AC-5) each include a `@ts-expect-error`
    fixture omitting `unit` and confirm tsc reports missing-property error.

- **AC-10** `MetricValue<T>`, `TelemetryTopic`, and `TELEMETRY_TOPIC_CATALOG` are importable from
  the `sdk` package public entrypoint (not a private module path).
  - evidence: `telemetry-public-import.unit.test.ts` imports `MetricValue`, `TelemetryTopic`, and
    `TELEMETRY_TOPIC_CATALOG` from the `sdk` entrypoint (import path `sdk`, not a private subpath);
    asserts `typeof TELEMETRY_TOPIC_CATALOG === "object"` and `TELEMETRY_TOPIC_CATALOG.length ===
    10`.

### Dependencies And Frozen Inputs

- Covers signals: Telemetry topic taxonomy over committed run events; honest metric value wrapper
  (available/partial/unavailable) — as listed in the Epic 3 charter `core-07` per-domain
  expectations table.
- Depends on: `core-01-s1-event-contracts` (for `EvidenceEventRef`).
- Depended on by: `core-07-s2-analyzer`, `core-07-s3-analysis-records-and-reports`.
- Shared shapes consumed (verbatim, not redeclared):
  `core-01-s1-event-contracts/EvidenceEventRef`.

### Non-Goals

- Classifying a `RunEventEnvelope` into a topic at runtime (`classifyTopic` logic) — owned by
  `core-07-s2-analyzer`.
- Declaring analyzer input/output types (`AnalysisRequest`, `AnalysisSnapshot`, `AnalysisResult`,
  `AnalysisFailure`, `AnalysisTrigger`) — owned by `core-07-s2-analyzer`.
- Declaring `AnalysisRecorded`/`AnalysisFailed` event payloads and the terminal-analysis invariant —
  owned by `core-07-s3-analysis-records-and-reports`.
- Declaring `EvidenceEventRef` — produced by `core-01-s1-event-contracts`, consumed here only.
- Declaring the full issue taxonomy (`AnalysisIssue`, issue codes, severity) — owned by
  `core-07-s2-analyzer` or `core-07-s3-analysis-records-and-reports`.
- Appending any event to the run log — this story is a pure type/catalog declaration.

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/core/observability/telemetry/` only; test files
  under `packages/sdk/tests/core/observability/telemetry/`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly
  this): `packages/sdk/src/core/observability/telemetry/**`,
  `packages/sdk/tests/core/observability/telemetry/**`.
- Forbidden dependencies (production source): `testkit`, any `provider-*` package, `cli`, `mcp`,
  any sibling core domain's source modules (event type names enter the catalog as strings only).
- STOP when: a function classifying a `RunEventEnvelope` into a topic is needed (owned by
  `core-07-s2-analyzer`); analyzer input/output types (`AnalysisRequest`, `AnalysisSnapshot`,
  `AnalysisResult`, `AnalysisFailure`) are needed (owned by `core-07-s2-analyzer`);
  `AnalysisRecorded`/`AnalysisFailed` payload types are needed (owned by
  `core-07-s3-analysis-records-and-reports`); or `EvidenceEventRef` declaration needs to be
  authored (declared by `core-01-s1-event-contracts`).

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-07-s1-telemetry-and-metrics.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/observability/telemetry/**`, `packages/sdk/tests/core/observability/telemetry/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-07-s1-telemetry-and-metrics](./implementer.md) · **Next →:** [Implementer Prompt: core-07-s2-analyzer](../core-07-s2-analyzer/implementer.md)

<!-- /DOCS-NAV -->
