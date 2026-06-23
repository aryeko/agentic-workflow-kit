---
title: "core-07-s2-analyzer - pure analyzer implementation story"
id: "core-07-s2-analyzer"
epic: 3
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/observability-and-analysis/README.md"
  - "docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md"
---

# core-07-s2-analyzer - Pure Analyzer

## Purpose

Implement the pure analyzer — `classifyTrigger(event, projections)` first-match auto-fire trigger
classification and `analyze(request, snapshot)` deterministic analysis over a supplied snapshot —
satisfying FR-9 and NFR-OBS (pure/replayable analysis), NFR-DET (no clock/random; identical output for
identical inputs), and the analyzer part of NFR-SAFE/NFR-SEC (degraded input and rule errors fail
closed to `AnalysisFailure`, never raw dumps).

## Normative design

- `docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md` §Analyzer
  types — `AnalysisTriggerKind`, `AnalysisTrigger`, `AnalysisRequest`, `AnalysisSnapshot`,
  `AnalysisInputHealth`, `AnalysisIssue`, `AnalysisResult`, `AnalysisFailure`, the
  `AnalysisFailureReason` / `RecordableAnalysisFailureReason` catalog, the `analyzedAt`-is-explicit and
  determinism statements, and §Issue taxonomy (severity ordering + deterministic `issueId`).
- `docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md` §Failure
  catalog — the trigger conditions for `analysis-input-degraded` (replay health `interior-corrupt` /
  `event-log-unavailable`, or projections missing) and `analysis-rule-error` (a rule is malformed or
  non-total).
- `docs/design/30-domain-reference/core/observability-and-analysis/README.md` §5 Contracts &
  interfaces (the `classifyTrigger` / `analyze` signatures), §6 Events & data (the auto-fire trigger
  events and the first-match ordering "at most one trigger kind per event"), §8 Failure & degraded
  modes (fail-closed; never repair logs / write projections / call providers).
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` — band-3 row for this story and
  the value-type-vs-runtime-object seam rule (this story takes `RunReplay` / `RunProjections` values,
  not the `RunEventLog` object).
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `sdk` entrypoint (export + barrel + `exports`).
- `docs/engineering/test-lanes.md` — the hermetic `*.unit.test.ts` lane (zero process/network/filesystem).
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — `sdk` imports pure libraries only; no
  `testkit`, driver, process, or network; no ambient clock/randomness.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by the design's exact
names (runtime-types variant). This story PRODUCES the analyzer functions and the analyzer input/output
types; it consumes the run-log value types and the metric/topic shapes from their producers.

- Interfaces / types (produced and exposed by this story):
  - `AnalysisTriggerKind` — the closed union `"terminal-lifecycle" | "blocked-transition" |
    "supervision-lost" | "stale-progress" | "recovery-decision"`.
  - `AnalysisTrigger` — `{ kind: AnalysisTriggerKind; eventRef: EvidenceEventRef; reason: string }`.
  - `AnalysisRequest` — `{ runId: string; trigger: AnalysisTrigger; evaluatedThrough: RunEventCursor;
    analyzedAt: string; analyzerVersion: string; ruleSetDigest: string; redactionPolicyDigest: string }`.
  - `AnalysisSnapshot` — `{ replay: RunReplay; projections: RunProjections; redactedArtifacts:
    Record<string, ArtifactRef> }`.
  - `AnalysisInputHealth` — `{ replayHealth: RunDegradedHealth; projections: "available" | "missing";
    artifactInputs: "available" | "partial" | "unavailable"; redaction: "applied" | "not-required" |
    "unavailable" }`.
  - `AnalysisIssue` — `{ issueId: string; code: string; severity: "info" | "attention" | "blocked" |
    "failed"; summary: string; evidenceRefs: EvidenceEventRef[]; artifactRefs: ArtifactRef[];
    metricRefs: string[] }`.
  - `AnalysisResult` — `{ issues: AnalysisIssue[]; metrics: Record<string, MetricValue<unknown>>;
    evidenceRefs: EvidenceEventRef[]; reportArtifactRef?: ArtifactRef }`.
  - `AnalysisFailure` — `{ reason: RecordableAnalysisFailureReason; evidenceRefs: EvidenceEventRef[];
    artifactRefs: ArtifactRef[] }`.
  - `AnalysisOutcome` — `{ kind: "recorded"; result: AnalysisResult } | { kind: "failed"; failure:
    AnalysisFailure }` — the analyzer-output union consumed by `core-07-s3` as
    `AnalysisRecordInput.outcome`; design source:
    `docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md` §Analyzer
    types.
- Provider operations / commands (the functions this story implements):
  - `classifyTrigger(event: RunEventEnvelope, projections: RunProjections): AnalysisTrigger | null`.
  - `analyze(request: AnalysisRequest, snapshot: AnalysisSnapshot): AnalysisResult | AnalysisFailure`.
- Failure and degraded tokens this story OWNS (the analyzer subset of `RecordableAnalysisFailureReason`,
  returned as `AnalysisFailure.reason`):
  - `analysis-input-degraded`.
  - `analysis-rule-error`.
- Evidence records / attestations: none new. The analyzer produces value outputs (`AnalysisResult` /
  `AnalysisFailure`); appending `AnalysisRecorded` / `AnalysisFailed` events and report artifact
  publication are owned by `core-07-s3-analysis-records-and-reports`.

Distinct-design-shape note: `AnalysisResult` and `AnalysisFailure` are distinct types kept distinct
(the analyzer returns the union `AnalysisResult | AnalysisFailure`, not a wrapper). `AnalysisOutcome`
is the named union wrapper `{ kind: "recorded"; result: AnalysisResult } | { kind: "failed"; failure:
AnalysisFailure }` declared here as the single producer; `core-07-s3` consumes it as the type of
`AnalysisRecordInput.outcome` without redeclaring it. `AnalysisInputHealth` is a distinct shape this
story declares but the analyzer surfaces it through the records story's `AnalysisRecordInput` (not
redeclared there); this story owns its declaration because the failure ACs classify replay/projection
health. The remaining `AnalysisFailureReason` members (`analysis-artifact-unavailable`,
`analysis-redaction-unavailable`, `analysis-record-unwritable`, `analysis-invariant-missing`) and the
`AnalysisFailedPayload` / `AnalysisRecordedPayload` / record commit types are NOT this story's —
they are `core-07-s3-analysis-records-and-reports`.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Declare `AnalysisTriggerKind` as the closed five-member union and `AnalysisTrigger` with the design
  fields (`kind`, `eventRef: EvidenceEventRef`, `reason`).
- Declare `AnalysisRequest` with the design fields, including `analyzedAt: string` as an explicit
  caller-supplied input (never a clock read), `analyzerVersion`, `ruleSetDigest`,
  `redactionPolicyDigest`, and `evaluatedThrough: RunEventCursor`.
- Declare `AnalysisSnapshot` (`replay`, `projections`, `redactedArtifacts`), `AnalysisInputHealth`,
  `AnalysisIssue`, `AnalysisResult`, and `AnalysisFailure` with exactly the design fields and literals.
- Implement `classifyTrigger(event, projections)`: classify a committed `RunEventEnvelope` into at most
  one `AnalysisTrigger` using first-match precedence in the design order
  (`terminal-lifecycle` → `blocked-transition` → `supervision-lost` → `stale-progress` →
  `recovery-decision`), returning `null` for any event that matches none.
  - `terminal-lifecycle`: a `RunLifecycleTransitioned` whose `to` is `completed`, `failed`, or
    `canceled`.
  - `blocked-transition`: a `RunLifecycleTransitioned` whose `to` is `blocked`.
  - `supervision-lost`: a `SupervisionLost` event, or a `LivenessStateChanged` to a supervision-lost
    state.
  - `stale-progress`: a `LivenessTimerExpired` event, or a `LivenessStateChanged` to a stale state.
  - `recovery-decision`: a `RecoveryClassified`, `RecoveryActionPlanned`, `RecoveryActionApplied`, or
    `ReconciliationBlocked` event.
- Guarantee first-match ordering: an event that could satisfy two conditions yields only the
  higher-precedence kind (one trigger kind per event); the produced `AnalysisTrigger.eventRef` is the
  classified event's `EvidenceEventRef`.
- Implement `analyze(request, snapshot)`: run the rule set over `snapshot.replay`,
  `snapshot.projections`, `snapshot.redactedArtifacts`, and the request's `analyzedAt` /
  `analyzerVersion` / `ruleSetDigest`, producing an `AnalysisResult` with deterministically ordered
  `issues` (severity, then first-cited sequence, then issue code, then issue id) and honest `metrics`
  (`core-07-s1-telemetry-and-metrics/MetricValue` values, never coerced to zero).
- Compute each `AnalysisIssue.issueId` deterministically from `runId`, trigger event id, issue code,
  first cited sequence, and analyzer version (no random/clock).
- Guarantee determinism: identical `(request, snapshot)` — same replay, projections, redacted artifact
  bytes, `ruleSetDigest`, `analyzerVersion`, and `analyzedAt` — yields a deep-equal `AnalysisResult` on
  every call.
- Fail closed for degraded input: when `snapshot.replay.health` is `interior-corrupt` or
  `event-log-unavailable`, or `snapshot.projections` is missing/absent, return an `AnalysisFailure`
  with `reason: "analysis-input-degraded"` (never a partial/guessed `AnalysisResult`).
- Fail closed for rule errors: when any rule is malformed or non-total (throws / returns a malformed
  issue), capture it as an `AnalysisFailure` with `reason: "analysis-rule-error"` and stable evidence
  refs — never propagating the raw exception, provider text, prompts, or secret-bearing strings.
- Expose `classifyTrigger`, `analyze`, and the nine analyzer types (including `AnalysisOutcome`) on
  the `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention`.

## Out of scope

- The telemetry topic taxonomy and the `MetricValue<T>` wrapper — owned by
  `core-07-s1-telemetry-and-metrics` (consumed here, not redeclared).
- Appending `AnalysisRecorded` / `AnalysisFailed` events, the `AnalysisRecordedPayload` /
  `AnalysisFailedPayload` / `AnalysisRecordInput` / `AnalysisRecordCommit` / `AnalysisRecordFailure`
  shapes, the redacted write-once report artifact publication (`AnalysisResult.reportArtifactRef`
  *populated* via fnd-02), the terminal-analysis invariant, idempotency/retry keys, and
  `recordAnalysisOutcome` — all owned by `core-07-s3-analysis-records-and-reports`.
- The failure reasons `analysis-artifact-unavailable`, `analysis-redaction-unavailable`,
  `analysis-record-unwritable`, and `analysis-invariant-missing` — owned by
  `core-07-s3-analysis-records-and-reports` (the records/report/invariant part).
- The run-log value types (`RunReplay`, `RunProjections`, `RunEventEnvelope`, `RunEventCursor`,
  `RunDegradedHealth`, `EvidenceEventRef`) — owned by `core-01-s1-event-contracts`; consumed as values.
- The `ArtifactRef` shape — owned by Epic 1 `fnd-02-s4-artifact-evidence`; referenced, never redeclared.
- The concrete `replay()` / `project()` behaviors — owned by `core-01-s2` / `core-01-s5`; this story
  consumes their value outputs from fixtures, not their behaviors.

## Dependencies and frozen inputs

- Covers signals: Pure analyzer snapshot / rule-set-digest / version / `analyzedAt` inputs; auto-fire
  triggers for terminal / blocked / supervision-lost / recovery-decision / stale-progress evidence;
  failure signals for degraded input and rule errors (analyzer part of core-07 signal 7).
- Depends on: `core-07-s1-telemetry-and-metrics`, `core-01-s1-event-contracts` (band 3, value-type seam
  — built from fixtures, no `core-01` runtime behavior).
- Depended on by: `core-07-s3-analysis-records-and-reports` (consumes
  `core-07-s2-analyzer/AnalysisResult` and `AnalysisFailure` and re-uses `AnalysisRequest` /
  `AnalysisInputHealth` in its record input).
- Shared shapes consumed (cited verbatim, never redeclared):
  - `core-07-s1-telemetry-and-metrics/MetricValue` (the `available` / `partial` / `unavailable` wrapper
    used in `AnalysisResult.metrics`).
  - `core-07-s1-telemetry-and-metrics/telemetry topic taxonomy` (the committed-event classification the
    analyzer rules read).
  - `core-01-s1-event-contracts/RunReplay`.
  - `core-01-s1-event-contracts/RunProjections`.
  - `core-01-s1-event-contracts/RunEventEnvelope`.
  - `core-01-s1-event-contracts/RunEventCursor` (the `AnalysisRequest.evaluatedThrough` type).
  - `core-01-s1-event-contracts/RunDegradedHealth` (the `AnalysisInputHealth.replayHealth` type and the
    `snapshot.replay.health` value the degraded-input rule reads).
  - `core-01-s1-event-contracts/EvidenceEventRef`.
  - `fnd-02-s4-artifact-evidence/ArtifactRef` (cross-epic frozen input; the value type in
    `AnalysisSnapshot.redactedArtifacts`, `AnalysisIssue.artifactRefs`, `AnalysisResult.reportArtifactRef`,
    and `AnalysisFailure.artifactRefs`).

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a hermetic `*.unit.test.ts`. The analyzer
takes values; the tests build `RunReplay` / `RunProjections` / `AnalysisSnapshot` / `AnalysisRequest`
fixtures. Every degraded/failure AC names its own failing fixture; a green `pnpm check` proves only
acceptance.

- **AC-1** `classifyTrigger` returns an `AnalysisTrigger` with `kind = "terminal-lifecycle"` for a
  `RunLifecycleTransitioned` envelope whose payload `to` is `completed`, `failed`, or `canceled`, and
  the trigger's `eventRef` is that envelope's `EvidenceEventRef` (`eventId`/`sequence`/`payloadDigest`/
  `type`) — evidence: `classify-terminal.unit.test.ts` runs three fixtures (one per terminal `to`
  value) and asserts `kind === "terminal-lifecycle"` and `eventRef.eventId` equals the fixture
  envelope's `eventId` (pass on all three).
- **AC-2** `classifyTrigger` returns `kind = "blocked-transition"` for a `RunLifecycleTransitioned`
  envelope whose payload `to` is `blocked` — evidence: `classify-blocked.unit.test.ts` asserts
  `kind === "blocked-transition"` for a `to: "blocked"` fixture and the `eventRef` matches (pass).
- **AC-3** `classifyTrigger` returns `kind = "supervision-lost"` for a `SupervisionLost` envelope and
  for a `LivenessStateChanged` envelope whose payload reaches a supervision-lost state — evidence:
  `classify-supervision.unit.test.ts` runs both fixtures and asserts `kind === "supervision-lost"`
  (pass on both).
- **AC-4** `classifyTrigger` returns `kind = "stale-progress"` for a `LivenessTimerExpired` envelope
  and for a `LivenessStateChanged` envelope whose payload reaches a stale state — evidence:
  `classify-stale.unit.test.ts` runs both fixtures and asserts `kind === "stale-progress"` (pass on
  both).
- **AC-5** `classifyTrigger` returns `kind = "recovery-decision"` for each of `RecoveryClassified`,
  `RecoveryActionPlanned`, `RecoveryActionApplied`, and `ReconciliationBlocked` envelopes — evidence:
  `classify-recovery.unit.test.ts` runs the four fixtures and asserts `kind === "recovery-decision"`
  (pass on all four).
- **AC-6** `classifyTrigger` returns `null` for an event matching no trigger condition — e.g. a
  `RunLifecycleTransitioned` to a non-terminal/non-blocked state (`running`), a `RunCreated`, or an
  unknown sibling-domain event — evidence: `classify-null.unit.test.ts` runs three non-trigger
  fixtures and asserts `classifyTrigger(...) === null` (pass on all three).
- **AC-7** First-match precedence: an event satisfying two conditions yields only the higher-precedence
  kind, and `classifyTrigger` returns at most one `AnalysisTrigger` (never an array). The
  unambiguously-constructible case is a single `RunLifecycleTransitioned` envelope whose payload would
  match both the terminal and the blocked clause (the implementation evaluates the design order
  `terminal-lifecycle` before `blocked-transition` and stops at the first match) — evidence:
  `classify-first-match.unit.test.ts` constructs one `RunLifecycleTransitioned` fixture that exercises
  the terminal clause ahead of the blocked clause and asserts `kind === "terminal-lifecycle"` (the
  earlier-ordered kind), and asserts the return is a single `AnalysisTrigger` object, not an array
  (pass).
- **AC-8** `analyze(request, snapshot)` is deterministic: for an identical `(request, snapshot)` — same
  `RunReplay`, `RunProjections`, `redactedArtifacts` bytes, `ruleSetDigest`, `analyzerVersion`, and
  `analyzedAt` — two calls return deep-equal `AnalysisResult` values — evidence:
  `analyze-determinism.unit.test.ts` calls `analyze` twice on the same fixture request/snapshot and
  asserts `expect(first).toEqual(second)` (pass).
- **AC-9** `analyze` reads `analyzedAt` only from `request.analyzedAt` and never from an ambient clock:
  two `analyze` calls that differ only by a manipulated process clock (with `request.analyzedAt`
  unchanged) return deep-equal results, and the analyzer source contains no `Date.now` / `new Date` /
  `Math.random` / `crypto.randomUUID` — evidence: `analyze-no-clock.unit.test.ts` asserts deep-equal
  results across two fake `Date.now` values with the same `request.analyzedAt` (pass), and the
  forbidden-symbol sweep below over `packages/sdk/src/core/observability/analyzer/` reports zero
  ambient-clock matches.
- **AC-10** `analyze` produces `AnalysisResult.issues` in stable order — sorted by severity (`failed`,
  `blocked`, `attention`, `info`), then first-cited sequence, then issue code, then `issueId` — and
  each `issue.issueId` is deterministic from `runId`, trigger event id, issue code, first cited
  sequence, and `analyzerVersion` — evidence: `analyze-issue-ordering.unit.test.ts` builds a snapshot
  yielding issues of mixed severity and equal severity with differing sequences/codes, asserts the
  emitted `issues` array order matches the rule, and asserts each `issueId` is stable across two runs
  (pass).
- **AC-11** `analyze` emits `AnalysisResult.metrics` as `core-07-s1-telemetry-and-metrics/MetricValue`
  values, and a metric whose source evidence is absent is `{ state: "unavailable", … }` (never coerced
  to `0`, `false`, `[]`, or success) — evidence: `analyze-metric-honesty.unit.test.ts` builds a
  snapshot missing a metric's source evidence and asserts the corresponding `metrics[k].state ===
  "unavailable"` (pass).
- **AC-12** `analyze` returns `AnalysisFailure` with `reason: "analysis-input-degraded"` when
  `snapshot.replay.health` is `interior-corrupt` or `event-log-unavailable` — and does not return any
  `AnalysisResult` — evidence: `analyze-input-degraded.unit.test.ts` runs two fixtures (one
  `interior-corrupt` replay health, one `event-log-unavailable`) and asserts the return is an
  `AnalysisFailure` with `reason === "analysis-input-degraded"` (pass on both).
- **AC-13** `analyze` returns `AnalysisFailure` with `reason: "analysis-input-degraded"` when
  `snapshot.projections` is missing (the projections input is absent/empty per
  `AnalysisInputHealth.projections === "missing"`) — evidence:
  `analyze-projections-missing.unit.test.ts` runs a fixture with a missing-projections snapshot and
  asserts the return is an `AnalysisFailure` with `reason === "analysis-input-degraded"` (pass).
- **AC-14** `analyze` returns `AnalysisFailure` with `reason: "analysis-rule-error"` when a rule in the
  rule set is malformed or non-total (throws or returns a malformed issue), and the failure's
  `evidenceRefs` use stable refs while carrying no raw exception text, provider text, prompt, or
  secret-bearing string — evidence: `analyze-rule-error.unit.test.ts` injects a throwing rule fixture
  and a malformed-issue rule fixture and asserts (a) the return is an `AnalysisFailure` with
  `reason === "analysis-rule-error"`, (b) no field contains the thrown error message string (pass on
  both).
- **AC-15** Both failure paths return `AnalysisFailure` whose `reason` is a member of
  `RecordableAnalysisFailureReason` (excludes `analysis-record-unwritable`); the analyzer never returns
  `analysis-record-unwritable`, `analysis-artifact-unavailable`, `analysis-redaction-unavailable`, or
  `analysis-invariant-missing` (those are `core-07-s3`'s) — evidence:
  `analyze-failure-reason-domain.unit.test.ts` asserts the union of reasons reachable from `analyze`
  fixtures is exactly `{ "analysis-input-degraded", "analysis-rule-error" }` and a fixture asserting a
  non-recordable reason is unconstructible as an `analyze` return fails compilation
  (`analyze-bad-failure-reason.fixture.ts`).
- **AC-16** The nine analyzer types are present with the design fields and literals: `AnalysisTrigger`
  (`kind: AnalysisTriggerKind`, `eventRef: EvidenceEventRef`, `reason`), `AnalysisRequest` (with
  `analyzedAt: string`, `evaluatedThrough: RunEventCursor`, `analyzerVersion`, `ruleSetDigest`,
  `redactionPolicyDigest`), `AnalysisSnapshot` (`replay`, `projections`, `redactedArtifacts:
  Record<string, ArtifactRef>`), `AnalysisInputHealth` (`replayHealth: RunDegradedHealth`,
  `projections: "available" | "missing"`, `artifactInputs: "available" | "partial" | "unavailable"`,
  `redaction: "applied" | "not-required" | "unavailable"`), `AnalysisIssue` (with
  `severity: "info" | "attention" | "blocked" | "failed"`), `AnalysisResult`
  (`issues`/`metrics`/`evidenceRefs`/optional `reportArtifactRef`), `AnalysisFailure`
  (`reason: RecordableAnalysisFailureReason`/`evidenceRefs`/`artifactRefs`), and `AnalysisOutcome`
  (both arms constructable: `{ kind: "recorded"; result: AnalysisResult }` and
  `{ kind: "failed"; failure: AnalysisFailure }`) — evidence:
  `analyzer-types.unit.test.ts` constructs each from a valid fixture (including both `AnalysisOutcome`
  arms) and a negative fixture (`analysis-input-health-bad-projections.fixture.ts`) using a
  `projections` value outside `available | missing` fails compilation.
- **AC-17** `AnalysisTriggerKind` has exactly the five members `"terminal-lifecycle" |
  "blocked-transition" | "supervision-lost" | "stale-progress" | "recovery-decision"` and no others —
  evidence: `analysis-trigger-kind.unit.test.ts` runs an exhaustiveness `never` switch over the union
  and a negative fixture (`analysis-trigger-kind-unknown.fixture.ts`) using a sixth literal fails
  compilation.
- **AC-18** `classifyTrigger`, `analyze`, `AnalysisTriggerKind`, `AnalysisTrigger`, `AnalysisRequest`,
  `AnalysisSnapshot`, `AnalysisResult`, `AnalysisFailure`, `AnalysisIssue`, `AnalysisInputHealth`, and
  `AnalysisOutcome` are importable from the `sdk` public entrypoint (not a private module path), per
  `epic0-s4-export-templates/PackageExportConvention`, and the consumed shapes (`MetricValue`,
  `RunReplay`, `RunProjections`, `RunEventEnvelope`, `RunEventCursor`, `RunDegradedHealth`,
  `EvidenceEventRef`, `ArtifactRef`) are re-used from their producers, not redeclared here — evidence:
  `analyzer-public-import.unit.test.ts` imports all eleven names from the `sdk` entrypoint and
  constructs one `AnalysisRequest` and one `AnalysisSnapshot` fixture (pass).

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `classifyTrigger` → `terminal-lifecycle` | AC-1 |
| `classifyTrigger` → `blocked-transition` | AC-2 |
| `classifyTrigger` → `supervision-lost` | AC-3 |
| `classifyTrigger` → `stale-progress` | AC-4 |
| `classifyTrigger` → `recovery-decision` | AC-5 |
| `classifyTrigger` → `null` for non-trigger events | AC-6 |
| First-match precedence; at most one trigger kind per event | AC-7 |
| `analyze` determinism (identical inputs → deep-equal result) | AC-8 |
| `analyzedAt` is explicit input; no ambient clock/random | AC-9 |
| Stable issue ordering + deterministic `issueId` | AC-10 |
| Honest metrics (`MetricValue`; unavailable never coerced) | AC-11 |
| `analyze` → `analysis-input-degraded` (corrupt/unavailable replay) | AC-12 |
| `analyze` → `analysis-input-degraded` (projections missing) | AC-13 |
| `analyze` → `analysis-rule-error` (malformed/non-total rule; no raw leak) | AC-14 |
| Failure reasons restricted to the analyzer subset of `RecordableAnalysisFailureReason` | AC-15 |
| `AnalysisTrigger`/`AnalysisRequest`/`AnalysisSnapshot`/`AnalysisInputHealth`/`AnalysisIssue`/`AnalysisResult`/`AnalysisFailure` types | AC-16 |
| `AnalysisOutcome` type (both arms constructable; consumed by s3 as `AnalysisRecordInput.outcome`) | AC-16 |
| `AnalysisTriggerKind` closed five-member union | AC-7, AC-17 |
| `classifyTrigger` function (signature) | AC-1, AC-6, AC-18 |
| `analyze` function (signature; `AnalysisResult \| AnalysisFailure` return) | AC-8, AC-12, AC-18 |
| Public SDK exposure of functions + analyzer types | AC-18 |
| `MetricValue` (consumed, not redeclared) | AC-11, AC-18 |
| `RunReplay`/`RunProjections`/`RunEventEnvelope`/`RunEventCursor`/`RunDegradedHealth`/`EvidenceEventRef`/`ArtifactRef` (consumed) | AC-16, AC-18 |

## Failure and degraded outcomes

Each row's `proven by` AC asserts this row's trigger AND required behavior (the fail-closed
`AnalysisFailure` return), not the happy path.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `analysis-input-degraded` | `snapshot.replay.health` is `interior-corrupt` or `event-log-unavailable` | `analyze` returns `AnalysisFailure { reason: "analysis-input-degraded", … }`; no `AnalysisResult` is produced | AC-12 |
| `analysis-input-degraded` | `snapshot.projections` is missing (`AnalysisInputHealth.projections === "missing"`) | `analyze` returns `AnalysisFailure { reason: "analysis-input-degraded", … }`; no `AnalysisResult` is produced | AC-13 |
| `analysis-rule-error` | A rule in the rule set is malformed or non-total (throws or returns a malformed issue) | `analyze` returns `AnalysisFailure { reason: "analysis-rule-error", … }` with stable evidence refs; no raw exception/provider text/prompt/secret in any field; no partial `AnalysisResult` | AC-14 |

## Quality bar

- Coverage scope and threshold: `packages/sdk/src/core/observability/analyzer/**` at 90% minimum,
  aiming for 95%. The analyzer type declarations (`AnalysisTrigger`, `AnalysisRequest`,
  `AnalysisSnapshot`, `AnalysisInputHealth`, `AnalysisIssue`, `AnalysisResult`, `AnalysisFailure`,
  `AnalysisTriggerKind`) carry no runtime branching and are proven by the construction/exhaustiveness
  fixtures (AC-16, AC-17); the instrumented coverage scope is the `classifyTrigger` and `analyze`
  implementation lines (classification precedence, rule execution, degraded/rule-error branches, issue
  ordering, metric honesty).
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit lane for the
  aggregate gate; focused per-story report via `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/core/observability/analyzer/*.unit.test.ts`.
- Required tests, catalogued by AC and failure row:
  - `classify-terminal.unit.test.ts` (AC-1)
  - `classify-blocked.unit.test.ts` (AC-2)
  - `classify-supervision.unit.test.ts` (AC-3)
  - `classify-stale.unit.test.ts` (AC-4)
  - `classify-recovery.unit.test.ts` (AC-5)
  - `classify-null.unit.test.ts` (AC-6)
  - `classify-first-match.unit.test.ts` (AC-7)
  - `analyze-determinism.unit.test.ts` (AC-8)
  - `analyze-no-clock.unit.test.ts` (AC-9, plus the forbidden-symbol sweep)
  - `analyze-issue-ordering.unit.test.ts` (AC-10)
  - `analyze-metric-honesty.unit.test.ts` (AC-11)
  - `analyze-input-degraded.unit.test.ts` (AC-12, the `analysis-input-degraded` replay-health row, both
    corrupt and unavailable fixtures)
  - `analyze-projections-missing.unit.test.ts` (AC-13, the `analysis-input-degraded` missing-projections
    row)
  - `analyze-rule-error.unit.test.ts` (AC-14, the `analysis-rule-error` row, throwing-rule and
    malformed-issue fixtures)
  - `analyze-failure-reason-domain.unit.test.ts` (AC-15, with the
    `analyze-bad-failure-reason.fixture.ts` negative fixture)
  - `analyzer-types.unit.test.ts` (AC-16, with the `analysis-input-health-bad-projections.fixture.ts`
    negative fixture)
  - `analysis-trigger-kind.unit.test.ts` (AC-17, with the `analysis-trigger-kind-unknown.fixture.ts`
    negative fixture)
  - `analyzer-public-import.unit.test.ts` (AC-18)
  - Negative fixtures: `analyze-bad-failure-reason.fixture.ts`,
    `analysis-input-health-bad-projections.fixture.ts`, `analysis-trigger-kind-unknown.fixture.ts`
    (each asserted to fail compilation), plus the throwing-rule / malformed-issue / missing-projections
    / corrupt-replay runtime fixtures named in their tests.
- Public exposure (import path + public-import test): `classifyTrigger`, `analyze`,
  `AnalysisTriggerKind`, `AnalysisTrigger`, `AnalysisRequest`, `AnalysisSnapshot`, `AnalysisResult`,
  `AnalysisFailure`, `AnalysisIssue`, `AnalysisInputHealth`, `AnalysisOutcome` exported from the `sdk`
  public entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export + barrel +
  `exports`); proven by `analyzer-public-import.unit.test.ts` importing from `"sdk"` (not a private
  path) and constructing one `AnalysisRequest` and one `AnalysisSnapshot` value (AC-18).
- Determinism constraints: `analyze` and `classifyTrigger` are pure functions over their value
  arguments; `analyzedAt` is read only from `request.analyzedAt`. The module reads no
  `Date.now()`/`new Date()`/`Math.random()`/`crypto.randomUUID()`; all timestamps come from
  `request.analyzedAt` or `RunEventEnvelope` fields in the supplied `RunReplay`. The rule set is
  supplied as data/injected functions so tests can substitute a throwing or malformed rule without real
  I/O. `issueId` is computed deterministically from the named inputs (no random/clock).
- Dependency boundaries: `packages/sdk/src/core/observability/analyzer/**` may import only
  `core-07-s1-telemetry-and-metrics` (`MetricValue`, topic taxonomy) and `core-01-s1-event-contracts`
  types; no `testkit`, no `cli`, no `mcp`, no concrete provider package, no fnd-02 runtime module
  (`ArtifactStore`/`EventLogStore`/`LeaseStore`), no driver/network/process client, no ambient
  clock/randomness. `ArtifactRef` is referenced as a type only (never redeclared, never resolved via a
  store). Test files may import `testkit` fakes (test files are exempt from the production-testkit rule).
- File-size budget (lines per file; default soft cap ~200): split into focused files each ≤ 200 lines —
  e.g. `types.ts` (the nine analyzer types including `AnalysisOutcome`, plus `AnalysisTriggerKind`), `classify-trigger.ts`
  (`classifyTrigger` first-match precedence), `analyze.ts` (the `analyze` entry composing rules +
  degraded/rule-error guards), `issue-order.ts` (stable sort + `issueId` derivation), and a barrel
  re-export. Analyzer types this story declares live here; consumed types stay in their producers.
- Domain non-negotiables: the analyzer is a pure function over replay/projections/selected redacted
  artifacts/explicit `analyzedAt`/analyzer version/rule-set digest (identical inputs → identical
  output); metrics are honest (`unavailable` never coerced to `0`/`false`/`[]`/success); degraded input
  and rule errors fail closed to `AnalysisFailure` (never a partial/guessed result, never a raw
  exception/prompt/secret dump); `classifyTrigger` yields at most one trigger kind per event by
  first-match precedence; the analyzer never appends events, writes projections, edits logs, calls
  providers, or changes lifecycle state (those are out of scope / `core-07-s3`).

### Forbidden-symbol sweep (runnable recipe)

```sh
grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|execa|child_process|node:net|node:http|node:https|@octokit|spawn\\(|new WebSocket|ArtifactStore|EventLogStore|LeaseStore|recordAnalysisOutcome|AnalysisRecordedPayload|AnalysisFailedPayload|RunWriter|from \"testkit\"|from \"@kit/testkit\"" \
  packages/sdk/src/core/observability/analyzer/
```

- Path root: `packages/sdk/src/core/observability/analyzer/`.
- Forbidden-token set: `Date.now`, `new Date(`, `Math.random`, `crypto.randomUUID` (ambient
  clock/randomness — breaks determinism); `execa`, `child_process`, `node:net`, `node:http`,
  `node:https`, `@octokit`, `spawn(`, `new WebSocket` (process/network leaks); `ArtifactStore`,
  `EventLogStore`, `LeaseStore` (fnd-02 runtime module imports — `ArtifactRef` is type-only here);
  `recordAnalysisOutcome`, `AnalysisRecordedPayload`, `AnalysisFailedPayload`, `RunWriter`
  (core-07-s3 record/write surface reaching into this story); `testkit` import in production source.
- Expected result: zero matches (exit code 1, no lines), captured into the evidence pack. A non-empty
  match means the analyzer leaked ambient nondeterminism, a process/network/fnd-02 runtime dependency,
  the records-story write surface, or a production `testkit` import, and fails this story.

## Required reading

- `docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md` §Analyzer
  types, §Issue taxonomy, §Failure catalog.
- `docs/design/30-domain-reference/core/observability-and-analysis/README.md` §5, §6, §8.
- `core-07-s1-telemetry-and-metrics` story contract (`MetricValue` + topic taxonomy producer).
- `core-01-s1-event-contracts` story contract (`RunReplay`/`RunProjections`/`RunEventEnvelope`/
  `RunEventCursor`/`RunDegradedHealth`/`EvidenceEventRef` value-type producer).
- `fnd-02-s4-artifact-evidence` story contract (the `ArtifactRef` frozen input).
- `epic0-s4-export-templates` story contract (`PackageExportConvention` for the public `sdk` entrypoint).
- `docs/engineering/test-lanes.md` (the hermetic `*.unit.test.ts` lane).
- `docs/design/20-sdk-and-packaging/dependency-rules.md`.

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk/src/core/observability/analyzer` module providing `classifyTrigger` (first-match
auto-fire trigger classification) and `analyze` (the pure `AnalysisResult | AnalysisFailure` function
over a supplied snapshot), plus the nine analyzer types (including `AnalysisOutcome`), exposed on the `sdk` public entrypoint,
consuming `core-07-s1` `MetricValue`/topics and `core-01-s1` run-log value types and the
`fnd-02-s4-artifact-evidence` `ArtifactRef` without redeclaring them, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued in Required tests above).
- Test name or artifact proving each failure/degraded row: `analyze-input-degraded.unit.test.ts`
  (both `analysis-input-degraded` replay-health fixtures), `analyze-projections-missing.unit.test.ts`
  (the missing-projections `analysis-input-degraded` row), `analyze-rule-error.unit.test.ts` (the
  `analysis-rule-error` throwing-rule and malformed-issue fixtures).
- Negative fixture for every rejection: `analyze-bad-failure-reason.fixture.ts`,
  `analysis-input-health-bad-projections.fixture.ts`, `analysis-trigger-kind-unknown.fixture.ts`
  (each asserted to fail compilation), plus the throwing-rule / malformed-issue / corrupt-replay /
  missing-projections runtime fixtures.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for `packages/sdk/src/core/observability/analyzer/**`.
- Public-import test result: `analyzer-public-import.unit.test.ts` pass, importing from `"sdk"`.
- Boundary/forbidden-symbol sweep: the exact command above, path root, forbidden-token set, and
  zero-match output, captured.
- `pnpm deps` to prove the `sdk → pure libs only` dependency-rule edge.
- Conformance/runtime evidence: none — this story ships a pure function over values; no real process,
  network, filesystem, driver, or credential is used.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/core/observability/analyzer` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/observability/analyzer/**`,
  `packages/sdk/tests/core/observability/analyzer/**`.
- Forbidden dependencies: no `testkit` (production source), no `provider-*`, no `cli`/`mcp`, no fnd-02
  runtime module (`ArtifactStore`/`EventLogStore`/`LeaseStore`), no `RunWriter` or append/record
  surface, no driver/network/process client, no ambient clock or randomness; do not redeclare
  `MetricValue`, the run-log value types (`RunReplay`/`RunProjections`/`RunEventEnvelope`/
  `RunEventCursor`/`RunDegradedHealth`/`EvidenceEventRef`), or `ArtifactRef`.
- STOP when: appending `AnalysisRecorded`/`AnalysisFailed`, populating the redacted write-once report
  artifact ref via fnd-02, the terminal-analysis invariant, idempotency/retry keys, the failure reasons
  `analysis-artifact-unavailable`/`analysis-redaction-unavailable`/`analysis-record-unwritable`/
  `analysis-invariant-missing`, or `recordAnalysisOutcome` is reached — all owned by
  `core-07-s3-analysis-records-and-reports`. You analyze; you do not record.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - stories](./README.md) · **← Prev:** [core-07-s1-telemetry-and-metrics - telemetry topic taxonomy and honest metric value wrapper implementation story](./core-07-s1-telemetry-and-metrics.md) · **Next →:** [core-07-s3-analysis-records-and-reports - analysis records and reports implementation story](./core-07-s3-analysis-records-and-reports.md)

<!-- /DOCS-NAV -->
