# Implementer Prompt: core-07-s1-telemetry-and-metrics

## Assigned Routing

- Source story id: `core-07-s1-telemetry-and-metrics`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.
- Model class: `general-coder`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-07-s1-telemetry-and-metrics covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 and carries public observability taxonomy and metric wrapper, but type-only and bounded by catalog tests. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-07-s1-telemetry-and-metrics` for epic `epic-3-core-runtime-spine`. Deliver exactly the outcome in the ready source contract and nothing outside it:

The `packages/sdk/src/core/observability/telemetry/` module providing `TelemetryTopic`,
`TELEMETRY_TOPIC_CATALOG`, and `MetricValue<T>`, plus the evidence pack.

## Why It Matters

- Covers signals: Telemetry topic taxonomy over committed run events; honest metric value wrapper
  (available/partial/unavailable) — as listed in the Epic 3 charter `core-07` per-domain
  expectations table.
- Depends on: `core-01-s1-event-contracts` (for `EvidenceEventRef`).
- Depended on by: `core-07-s2-analyzer`, `core-07-s3-analysis-records-and-reports`.
- Shared shapes consumed (verbatim, not redeclared):
  `core-01-s1-event-contracts/EvidenceEventRef`.

The DAG dependents for this story are: `core-07-s2-analyzer`. Preserve the producer/consumer shape boundaries named above so later stories can consume committed dependency inputs without re-declaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-07-s1-telemetry-and-metrics.md` — source story contract for `core-07-s1-telemetry-and-metrics`.
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` — frozen DAG row, dependencies, owned pathset, wave, and suggested-tier floor for `core-07-s1-telemetry-and-metrics`.
- `docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md` —
  §Telemetry topics (topic table), §Metric honesty (`MetricValue<T>` definition and coercion
  prohibitions).
- `docs/design/30-domain-reference/core/observability-and-analysis/README.md` — §1 Purpose &
  boundaries (dependency rule; out-of-scope items), §4 Design (observable inputs), §5 Contracts &
  interfaces.
- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md`
  (when ready) — single producer of `EvidenceEventRef`.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the `sdk` public entrypoint.
- `docs/engineering/test-lanes.md` — unit lane rules; no real FS/network/process.
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — sdk → pure libs only; testkit excluded
  from production source.
- `{{DEPENDENCY_COMMITS}}` — runtime slot for committed dependency story inputs when this story has dependencies.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-07-s1-telemetry-and-metrics.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.

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

## Allowed Writes

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-07-s1-telemetry-and-metrics.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/observability/telemetry/**`
- `packages/sdk/tests/core/observability/telemetry/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-01-s1-event-contracts`.

- Covers signals: Telemetry topic taxonomy over committed run events; honest metric value wrapper
  (available/partial/unavailable) — as listed in the Epic 3 charter `core-07` per-domain
  expectations table.
- Depends on: `core-01-s1-event-contracts` (for `EvidenceEventRef`).
- Depended on by: `core-07-s2-analyzer`, `core-07-s3-analysis-records-and-reports`.
- Shared shapes consumed (verbatim, not redeclared):
  `core-01-s1-event-contracts/EvidenceEventRef`.

Use `{{DEPENDENCY_COMMITS}}` for dependency commits that can only exist during execution. Import only producer-owned public shapes and paths named by the DAG or source contract.

## Non-Goals And STOP Conditions

### Source Out Of Scope

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

### Source Boundaries And STOP Conditions

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

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Declare `TelemetryTopic` as a string-literal union of exactly the 10 design topic labels, in the
  order listed in the design taxonomy table.
- Declare and export `TELEMETRY_TOPIC_CATALOG` as the canonical mapping from each `TelemetryTopic`
  to its design-specified example event-type names (string labels, not imported code types), covering
  all 10 topics with the event-type names specified in `analysis-contract.md §Telemetry topics`.
- Declare `MetricValue<T>` as a generic tri-state union with arms `"available"`, `"partial"`, and
  `"unavailable"` exactly matching the design definition; include `evidenceRefs: EvidenceEventRef[]`
  in every arm.
- Enforce by type structure that the `"partial"` arm requires `missing: string[]` (non-optional) and
  the `"unavailable"` arm requires `reason: string` (non-optional).
- Name event types in the taxonomy catalog as string literals (e.g. `"RunLifecycleTransitioned"`,
  `"CapabilityGateRecord"`, `"AnalysisRecorded"`) — do not import them as code types from sibling
  domains.
- Expose `MetricValue<T>` and `TelemetryTopic` and `TELEMETRY_TOPIC_CATALOG` from the `sdk` public
  entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export + barrel + `exports`
  field).
- Produce a deterministic, pure catalog — no runtime computation, no ambient clock or randomness.

### Source Spec Surface

What the normative design defines and the implementation must expose or consume, by name:

- Types declared (this story is the single producer):
  - `TelemetryTopic` — a string-literal union of the 10 topic labels: `"lifecycle"` |
    `"capability"` | `"approval"` | `"liveness"` | `"completion"` | `"recovery"` |
    `"provider-evidence"` | `"storage"` | `"privacy"` | `"analysis"`.
  - `TelemetryTopicEntry` — a record type pairing a `TelemetryTopic` with its example event-type
    names (as `string[]`); the canonical catalog is a `readonly TelemetryTopicEntry[]` or
    equivalent structure exported as `TELEMETRY_TOPIC_CATALOG`.
  - `MetricValue<T>` — the tri-state union:
    - `{ state: "available"; value: T; unit: string; evidenceRefs: EvidenceEventRef[] }`
    - `{ state: "partial"; value?: T; unit: string; missing: string[]; evidenceRefs: EvidenceEventRef[] }`
    - `{ state: "unavailable"; reason: string; evidenceRefs: EvidenceEventRef[] }`

- Types consumed (declared by `core-01-s1-event-contracts`; not redeclared here):
  - `core-01-s1-event-contracts/EvidenceEventRef` — used in all three arms of `MetricValue<T>`.

- Failure and degraded tokens (construction-time only; no runtime error paths at this tier):
  - `partial-missing-required` — constructing the `"partial"` arm without a non-empty `missing`
    array is a type-level constraint; the type definition enforces `missing: string[]` (non-optional
    and typed as a non-empty array or enforced by AC).
  - `unavailable-reason-required` — constructing the `"unavailable"` arm without a `reason` field
    is rejected by the type definition; `reason` is required and typed as `string`.

- Evidence records / attestations: none produced by this story (taxonomy and types are pure
  declarations; they do not append to the run log).

Done requires every item here present with the design's names, shapes, and semantics.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

### Source Quality Bar

- Coverage scope and threshold: the `TELEMETRY_TOPIC_CATALOG` data structure and any helper
  functions (e.g. topic lookup helpers if declared) in
  `packages/sdk/src/core/observability/telemetry/**` at ≥90%, aiming for 95%. Pure type
  declarations (`TelemetryTopic`, `MetricValue<T>`) generate no instrumented lines and are excluded
  from the coverage percentage; the catalog and any runtime helpers are the instrumented surface.
- Coverage command and instrumented lane(s): `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/core/observability/telemetry/**` — instruments the unit
  lane over the telemetry module scope; the full aggregate gate is `pnpm coverage:baseline`. For
  type-only stories, the expected instrumented line count is small; coverage target applies to any
  helper logic present.
- Required tests, catalogued by AC and failure row:
  - `telemetry-topic-type.unit.test.ts` (AC-1; type-level fixtures + tsc `@ts-expect-error`)
  - `telemetry-topic-catalog.unit.test.ts` (AC-2, AC-3; table-driven loop over all 10 topics)
  - `metric-value-available.unit.test.ts` (AC-4, AC-9 available-arm)
  - `metric-value-partial.unit.test.ts` (AC-5, AC-6, AC-9 partial-arm)
  - `metric-value-unavailable.unit.test.ts` (AC-7, AC-8)
  - `telemetry-public-import.unit.test.ts` (AC-10)
- Public exposure (import path + public-import test): `MetricValue`, `TelemetryTopic`, and
  `TELEMETRY_TOPIC_CATALOG` exported from the `sdk` public entrypoint per
  `epic0-s4-export-templates/PackageExportConvention` (export + barrel + `exports` field); proven by
  `telemetry-public-import.unit.test.ts` which imports all three from `sdk` (not a private subpath)
  and asserts runtime identity.
- Determinism constraints: the `TELEMETRY_TOPIC_CATALOG` is a static compile-time constant; no
  ambient `Date.now`, `new Date`, `Math.random`, or `crypto.randomUUID` anywhere in the telemetry
  module. `MetricValue<T>` is a pure type declaration.
- Dependency boundaries: `sdk` production source imports only pure runtime libraries and
  `core-01-s1-event-contracts` types (for `EvidenceEventRef`); must not import `testkit`, any
  `provider-*`, `cli`, or `mcp`. Test files are exempt from the production-testkit rule.
- File-size budget (lines per file; default soft cap ~200): `telemetry-topics.ts` (topic union +
  catalog) ≤ 100 lines; `metric-value.ts` (type declaration) ≤ 60 lines; `index.ts` barrel ≤ 30
  lines. Test files ≤ 150 lines each.
- Domain non-negotiables:
  - The taxonomy names sibling event types as string literals in the catalog; it never imports
    sibling-domain code types (dependency rule from `analysis-contract.md` §Telemetry topics and
    README.md §1).
  - Unavailable metric values must never be coercible to `0`, `false`, empty arrays, or success by
    construction — enforced by type structure (no `value` field on the `"unavailable"` arm).
  - All three arms of `MetricValue<T>` carry `evidenceRefs: EvidenceEventRef[]`; the field is
    non-optional in every arm.
  - `TELEMETRY_TOPIC_CATALOG` is runtime-frozen (exported as `readonly` or `as const` equivalent)
    so no consumer can mutate the catalog at runtime.

### Source Evidence Pack

- Test proving each AC:
  - `telemetry-topic-type.unit.test.ts` (AC-1)
  - `telemetry-topic-catalog.unit.test.ts` (AC-2, AC-3)
  - `metric-value-available.unit.test.ts` (AC-4)
  - `metric-value-partial.unit.test.ts` (AC-5, AC-6)
  - `metric-value-unavailable.unit.test.ts` (AC-7, AC-8)
  - `metric-value-available.unit.test.ts` and `metric-value-partial.unit.test.ts` (AC-9,
    two fixtures)
  - `telemetry-public-import.unit.test.ts` (AC-10)
- Negative / type-level fixtures:
  - `@ts-expect-error` fixture in `telemetry-topic-type.unit.test.ts` assigning `"unknown-topic"` to
    `TelemetryTopic` (AC-1).
  - `@ts-expect-error` fixture in `metric-value-available.unit.test.ts` omitting `unit` from
    `"available"` arm (AC-9).
  - `@ts-expect-error` fixture in `metric-value-partial.unit.test.ts` omitting `unit` from
    `"partial"` arm (AC-9).
  - `@ts-expect-error` fixture in `metric-value-unavailable.unit.test.ts` omitting `reason` from
    `"unavailable"` arm (AC-7).
  - `@ts-expect-error` fixture in `metric-value-unavailable.unit.test.ts` adding `value: 0` to
    `"unavailable"` arm (AC-8).
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the
  `packages/sdk/src/core/observability/telemetry/**` scope.
- Public-import test result for `MetricValue`, `TelemetryTopic`, and `TELEMETRY_TOPIC_CATALOG`
  imported from the `sdk` entrypoint.
- Boundary/forbidden-symbol sweep (runnable recipe):
  `grep -REn "testkit|provider-(codex|local|github|markdown)|/cli/|/mcp/" packages/sdk/src/core/observability/telemetry/`
  over path root `packages/sdk/src/core/observability/telemetry/`; forbidden-token set = `testkit`,
  `provider-codex|local|github|markdown`, `/cli/`, `/mcp/`; expected result zero matches (exit
  code 1), captured into the evidence pack.
- Catalog sibling-import sweep (runnable recipe):
  `grep -REn "from.*core/(capability|run-lifecycle|recovery|supervision|completion|approval)" packages/sdk/src/core/observability/telemetry/`
  over the same path; expected result zero matches — confirms event-type names are string literals,
  not code imports from sibling domains.

Run the targeted commands and `pnpm check`, then report exact command output or an explicit blocked reason. Do not treat prose-only claims as evidence.

## Delivery Report

Return a report with changed files, AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, tests and checks run, evidence pack, open questions, and blockers. The report is review evidence only; it is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Reviewer Prompt: core-02-s3-gate-record-durability](../core-02-s3-gate-record-durability/reviewer.md) · **Next →:** [Reviewer Prompt: core-07-s1-telemetry-and-metrics](./reviewer.md)

<!-- /DOCS-NAV -->
