# Reviewer Prompt: core-07-s2-analyzer

## Assigned Routing

- Source story id: `core-07-s2-analyzer`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`, `AC-15`, `AC-16`, `AC-17`, `AC-18`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-07-s2-analyzer covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16, AC-17, AC-18 and carries shared analyzer rules and deterministic failure classification consumed by analysis records. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-07-s2-analyzer`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-07-s2-analyzer.md`.
- Allowed pathset: `packages/sdk/src/core/observability/analyzer/**`, `packages/sdk/tests/core/observability/analyzer/**`.
- Direct dependencies: `core-07-s1-telemetry-and-metrics`, `core-01-s1-event-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

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

### Dependencies And Frozen Inputs

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

### Non-Goals

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

### STOP Conditions And Boundaries

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

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-07-s2-analyzer.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, `AC-14`, `AC-15`, `AC-16`, `AC-17`, `AC-18`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/observability/analyzer/**`, `packages/sdk/tests/core/observability/analyzer/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-07-s2-analyzer](./implementer.md) · **Next →:** [Implementer Prompt: core-07-s3-analysis-records-and-reports](../core-07-s3-analysis-records-and-reports/implementer.md)

<!-- /DOCS-NAV -->
