# Reviewer Prompt: core-07-s3-analysis-records-and-reports

## Assigned Routing

- Source story id: `core-07-s3-analysis-records-and-reports`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-07-s3-analysis-records-and-reports covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 and carries analysis record durability, redacted artifact references, and terminal-analysis invariant fail-closed behavior. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-07-s3-analysis-records-and-reports`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-07-s3-analysis-records-and-reports.md`.
- Allowed pathset: `packages/sdk/src/core/observability/records/**`, `packages/sdk/tests/core/observability/records/**`.
- Direct dependencies: `core-07-s2-analyzer`, `core-01-s1-event-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

Each AC is a single falsifiable assertion. Every negative AC names its own failing fixture
(fault-injected deterministic in-memory `RunWriter` / `ArtifactStore`). Happy-path ACs prove only
acceptance. `analyzedAt` and ids are supplied/derived from input — no ambient clock or id source.

- **AC-1** Given an `AnalysisRecordInput` with `outcome.kind === "recorded"`, `recordAnalysisOutcome`
  publishes the redacted report through the injected `ArtifactStore`, builds an `AnalysisRecordedPayload`
  with `schema === "kit-vnext.analysis-recorded.v1"` whose `request`, `inputHealth`, `issues`, `metrics`,
  `evidenceRefs`, and `reportArtifactRef` come from the input/result, appends exactly one envelope at
  `barrier` durability via `writer.append`, and returns `{ status: "appended"; eventRef; appendReceipt }`
  - evidence: `record-recorded-appended.unit.test.ts` asserts one `writer.append` call with one envelope
  at `durability === "barrier"`, payload `schema === "kit-vnext.analysis-recorded.v1"`,
  `reportArtifactRef` equal to the published ref, and the returned `status === "appended"` carrying the
  store's `appendReceipt`.
- **AC-2** Given an `AnalysisRecordInput` with `outcome.kind === "failed"` and a
  `RecordableAnalysisFailureReason`, `recordAnalysisOutcome` builds an `AnalysisFailedPayload` with
  `schema === "kit-vnext.analysis-failed.v1"` carrying that `reason`, `request`, `inputHealth`,
  `evidenceRefs`, and `artifactRefs`, and appends exactly one envelope at `barrier` - evidence:
  `record-failed-appended.unit.test.ts` feeds `outcome.kind === "failed"` with
  `reason === "analysis-redaction-unavailable"` and asserts one `barrier` append of a payload with
  `schema === "kit-vnext.analysis-failed.v1"` and `payload.reason === "analysis-redaction-unavailable"`.
- **AC-3** The analysis `eventId` is derived from `analysisAttemptKey` and the `analysisPayloadDigest`
  is the canonical-JSON digest over the full final payload (`request` incl. `analyzedAt` and
  `redactionPolicyDigest`, trigger content, `inputHealth`, issues, metrics, evidence refs, artifact refs,
  failure reason, `supersedesEventId`); two inputs differing in any of those fields yield different
  event ids and two byte-identical inputs yield the identical event id - evidence:
  `record-event-id-determinism.unit.test.ts` asserts identical inputs produce one stable event id and that
  changing `analyzedAt` (and separately the issue set) changes the event id.
- **AC-4** A candidate report ref that is a `ScratchArtifactRef`, or an `ArtifactRef` whose
  `redactionState` is `"raw"` or `"tombstoned"`, is rejected as the report ref because the ref is not a
  redacted write-once ref: the `recorded` path does not append an `AnalysisRecorded` carrying it and
  instead records `AnalysisFailed` with `payload.reason === "analysis-redaction-unavailable"` - evidence:
  `record-rejects-non-redacted-ref.unit.test.ts` injects (a) a scratch ref fixture and (b) a
  `redactionState: "raw"` ref fixture and asserts, for each, that zero `AnalysisRecorded` envelopes are
  appended and exactly one `barrier` `AnalysisFailed` envelope with
  `payload.reason === "analysis-redaction-unavailable"` is appended.
- **AC-5** When the injected `ArtifactStore` cannot produce any redacted write-once report ref at all
  (`put`/`resolve` returns `StorageError` — no usable ref can be obtained), `recordAnalysisOutcome`
  records `AnalysisFailed` with `payload.reason === "analysis-artifact-unavailable"` at `barrier` while
  the log is writable, and does not append an `AnalysisRecorded` - evidence:
  `record-artifact-unavailable.unit.test.ts` faults `ArtifactStore.put` to return `StorageError` and
  asserts a single `barrier` `AnalysisFailed` append with
  `payload.reason === "analysis-artifact-unavailable"` and zero `AnalysisRecorded` appends.
- **AC-6** When required redacted content or redaction evidence is unavailable,
  `recordAnalysisOutcome` records `AnalysisFailed` with
  `payload.reason === "analysis-redaction-unavailable"` at `barrier` while the log is writable - evidence:
  `record-redaction-unavailable.unit.test.ts` drives the redaction-unavailable input and asserts a single
  `barrier` `AnalysisFailed` append with `payload.reason === "analysis-redaction-unavailable"`.
- **AC-7** When `writer.append` fails (returns `RunAppendFailure`), `recordAnalysisOutcome` returns
  `Result.error` of `AnalysisRecordFailure` with `reason === "analysis-record-unwritable"`,
  `attemptedEventId`, `attemptedPayloadDigest`, the originating `appendFailure`, and
  `retry === "replay-before-retry"`, and never re-runs analysis or self-records the unwritable record
  (`analysis-record-unwritable` is excluded from `RecordableAnalysisFailureReason`) - evidence:
  `record-unwritable-append-fails.unit.test.ts` faults `writer.append` and asserts the returned error is
  `AnalysisRecordFailure` with the four fields set and that no `AnalysisFailed` carrying
  `analysis-record-unwritable` is ever appended.
- **AC-8** When the same analysis event id is already committed with a **different** payload digest, or a
  current analysis for the same `analysisKey` at the same evaluated cursor exists without
  `supersedesEventId`, `recordAnalysisOutcome` fails closed with `AnalysisRecordFailure` whose `conflict`
  is `"event-id-digest-mismatch"` or `"current-analysis-conflict"` respectively, and appends nothing -
  evidence: `record-conflict-fails-closed.unit.test.ts` seeds a same-id/different-digest committed event
  and (separately) a current-analysis-without-supersession state via the replay fake, asserting each
  returns `AnalysisRecordFailure` with the matching `conflict` value and zero appends.
- **AC-9** A same-attempt re-call (identical `AnalysisRecordInput`) after the event is already committed
  with the matching event id and payload digest returns `{ status: "already-committed"; eventRef }`,
  performs zero `writer.append` calls, and the returned commit carries no `appendReceipt` - evidence:
  `record-idempotent-already-committed.unit.test.ts` seeds the matching committed event in the replay fake,
  re-calls with identical input, and asserts `status === "already-committed"`, the append spy uncalled,
  and `"appendReceipt" not in commit`.
- **AC-10** The terminal-analysis invariant check reports a terminal Run with usable replay health and a
  writable log that has no `AnalysisRecorded`/`AnalysisFailed` at or after the terminal lifecycle
  sequence as `analysis-invariant-missing`, and is never reported as satisfied when replay health is
  `interior-corrupt`/`event-log-unavailable` or the log is unwritable - evidence:
  `terminal-invariant-missing.unit.test.ts` builds a terminal run replay with `RunDegradedHealth === "ok"`
  and no analysis event and asserts the invariant result is `analysis-invariant-missing`; a corrupt-replay
  fixture asserts the invariant is reported unmet (not satisfied).

### Dependencies And Frozen Inputs

- Covers signals: `AnalysisRecorded`/`AnalysisFailed` payloads and terminal-analysis invariant;
  redacted write-once analysis report artifact refs; failure signals for artifact unavailability,
  redaction gaps, unwritable records, and missing invariant evidence (the **records part** of the
  core-07 charter signal; degraded-input and rule-error failures are `core-07-s2-analyzer`'s).
- Depends on: `core-07-s2-analyzer`, `core-01-s1-event-contracts` (band 4).
- Depended on by: Epic 5 (completion/recovery) and Epic 7 (operator surfacing) cite recorded analysis
  facts and redacted report refs without raw artifacts.
- Shared shapes consumed (cited verbatim, never redeclared):
  - `core-07-s2-analyzer/AnalysisResult`, `core-07-s2-analyzer/AnalysisFailure`,
    `core-07-s2-analyzer/AnalysisRequest`, `core-07-s2-analyzer/AnalysisInputHealth`,
    `core-07-s2-analyzer/AnalysisIssue`, `core-07-s2-analyzer/AnalysisOutcome`.
  - `core-07-s1-telemetry-and-metrics/MetricValue` (the `metrics` value type).
  - `core-01-s1-event-contracts/RunWriter`, `core-01-s1-event-contracts/EvidenceEventRef`,
    `core-01-s1-event-contracts/RunAppendReceipt`, `core-01-s1-event-contracts/RunAppendFailure`,
    `core-01-s1-event-contracts/RunDurabilityClass`, `core-01-s1-event-contracts/Result`,
    `core-01-s1-event-contracts/RunReplay`, `core-01-s1-event-contracts/RunDegradedHealth`.
- Frozen Epic 1 inputs (named, not edges): `fnd-02-s4-artifact-evidence/ArtifactStore`,
  `fnd-02-s4-artifact-evidence/ArtifactRef`, `fnd-02-s4-artifact-evidence/ScratchArtifactRef`,
  `fnd-02-s4-artifact-evidence/ArtifactInput`. The `ArtifactStore` is injected as a port; this story
  uses the deterministic in-memory artifact fake in tests (no real filesystem).

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

### Non-Goals

- The pure analyzer (`analyze`, `classifyTrigger`), `AnalysisRequest`/`AnalysisSnapshot`/`AnalysisResult`/
  `AnalysisFailure` shapes, auto-fire trigger derivation, and `analysis-input-degraded` /
  `analysis-rule-error` — owned by `core-07-s2-analyzer` (consumed, never redeclared).
- The telemetry topic taxonomy and the `MetricValue<T>` wrapper — owned by
  `core-07-s1-telemetry-and-metrics` (consumed, never redeclared).
- The `RunWriter` / `RunEventEnvelope` / `RunAppendReceipt` / `RunAppendFailure` / `EvidenceEventRef` /
  `Result` declarations and the append protocol behavior — owned by `core-01-s1-event-contracts`
  (declarations) and `core-01-s4-run-event-log-and-writer` (the live writer); this story consumes a
  `RunWriter` as a value.
- Artifact content-addressing, write-once enforcement, scratch refs, tombstones, the redaction hook
  mechanism, and `ArtifactStore`/`ArtifactRef`/`ScratchArtifactRef` declarations — owned by
  `fnd-02-s4-artifact-evidence`; this story consumes the injected `ArtifactStore` and only checks ref
  shape (`redactionState`, scratch-vs-ref).
- The redaction policy and secret detection itself (`redactionPolicyDigest` is a supplied string) —
  owned by fnd-04; not a dependency of this story.

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/core/observability/records`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/observability/records/**`, `packages/sdk/tests/core/observability/records/**`.
- Forbidden dependencies: no provider packages, no concrete storage backend, no concrete `RunEventLog`,
  no `testkit` in production source (test files only); do not redeclare any `core-07-s2`, `core-07-s1`,
  `core-01-s1`, or `fnd-02-s4` type.
- STOP when: the analyzer rules / triggers (`core-07-s2`), the telemetry topic vocabulary or
  `MetricValue` wrapper (`core-07-s1`), concrete provider behavior, the live `RunWriter`/`RunEventLog`
  append protocol, or fnd-02 artifact write-once/redaction internals are reached — those belong to
  `core-07-s2`, `core-07-s1`, Epic 6, `core-01-s4`, and `fnd-02-s4` respectively.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-07-s3-analysis-records-and-reports.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/observability/records/**`, `packages/sdk/tests/core/observability/records/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-07-s3-analysis-records-and-reports](./implementer.md) · **Next →:** [Implementer Prompt: edge-01-s1-operator-command-contract](../edge-01-s1-operator-command-contract/implementer.md)

<!-- /DOCS-NAV -->
