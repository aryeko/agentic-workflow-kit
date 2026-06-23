---
title: "core-07-s3-analysis-records-and-reports - analysis records and reports implementation story"
id: "core-07-s3-analysis-records-and-reports"
epic: 3
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/observability-and-analysis/README.md"
  - "docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md"
---

# core-07-s3-analysis-records-and-reports - Analysis Records and Reports

## Purpose

Implement `recordAnalysisOutcome`: turn a finished analyzer outcome into a durable `AnalysisRecorded`
or `AnalysisFailed` fact appended at `barrier`, publish the redacted write-once report artifact ref,
enforce idempotent same-attempt retries, and surface the terminal-analysis invariant's explicit
unmet conditions as fail-closed record failures (FR-9, NFR-OBS, NFR-SAFE, NFR-DET, NFR-SEC).

## Normative design

- `docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md` — §Analyzer
  types (`AnalysisRecordedPayload`, `AnalysisFailedPayload`, `AnalysisRecordInput`,
  `AnalysisRecordCommit`, `AnalysisRecordFailure`, `RecordableAnalysisFailureReason`,
  `AnalysisFailureReason`); §Provenance, retention, and privacy (redacted write-once reports; scratch /
  raw / tombstoned / quarantined refs cannot appear in reports or satisfy evidence); §Idempotency and
  retry (`analysisKey` / `analysisPayloadDigest` / `analysisAttemptKey`, event id derivation, the
  replay-first retry ladder, `already-committed` vs `appended`, the `AnalysisRecordCommit`-not-receipt
  rationale); §Failure catalog (`analysis-artifact-unavailable`, `analysis-redaction-unavailable`,
  `analysis-record-unwritable`, `analysis-invariant-missing`).
- `docs/design/30-domain-reference/core/observability-and-analysis/README.md` — §6 (the terminal-analysis
  invariant: every terminal Run with usable replay health and a writable Run log has `AnalysisRecorded`
  or `AnalysisFailed` at/after the terminal lifecycle sequence; corrupt replay / unwritable log makes
  the invariant explicitly unmet, never silently waived; both events `barrier`; schemas
  `kit-vnext.analysis-recorded.v1` / `kit-vnext.analysis-failed.v1`); §8 (fail-closed: append
  `AnalysisFailed` when analysis/artifact/redaction/rule fails but the log is writable; never repair by
  editing logs, writing projections, calling providers, or changing lifecycle state).
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` — this story's row + band 4;
  value-type-vs-runtime-object seam (consumes `RunWriter` as a value); single-producer rules.
- `docs/design/20-sdk-and-packaging/dependency-rules.md`; `docs/engineering/test-lanes.md`;
  `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  (`PackageExportConvention`).

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and this story implements, consumes, or exposes, by the design's
exact names (runtime-types variant). Distinct unions are kept distinct.

- Interfaces / types declared and exposed by this story:
  - `AnalysisRecordedPayload` (`schema: "kit-vnext.analysis-recorded.v1"`; `request`, `inputHealth`,
    `issues`, `metrics: Record<string, MetricValue<unknown>>`, `evidenceRefs`,
    `reportArtifactRef?: ArtifactRef`, `supersedesEventId?`).
  - `AnalysisFailedPayload` (`schema: "kit-vnext.analysis-failed.v1"`; `request`, `inputHealth`,
    `reason: RecordableAnalysisFailureReason`, `evidenceRefs`, `artifactRefs`, `supersedesEventId?`).
  - `AnalysisRecordInput` (`request`, `inputHealth`, `outcome: AnalysisOutcome`, `supersedesEventId?`).
  - `AnalysisRecordCommit` — `{ status: "appended"; eventRef: EvidenceEventRef; appendReceipt:
    RunAppendReceipt }` | `{ status: "already-committed"; eventRef: EvidenceEventRef }` (distinct from
    `RunAppendReceipt`: the `already-committed` variant carries only a found event ref, no receipt).
  - `AnalysisRecordFailure` (`reason: "analysis-record-unwritable"`, `attemptedEventId`,
    `attemptedPayloadDigest`, `appendFailure?: RunAppendFailure`, `conflict?:
    "event-id-digest-mismatch" | "current-analysis-conflict"`, `retry: "replay-before-retry"`).
  - `RecordableAnalysisFailureReason` = `Exclude<AnalysisFailureReason, "analysis-record-unwritable">`.
  - `AnalysisFailureReason` (the full 6-member union, re-exported via `sdk` so consumers can name it).
- Interfaces / functions implemented:
  - `recordAnalysisOutcome(input: AnalysisRecordInput, writer: RunWriter): Result<AnalysisRecordCommit,
    AnalysisRecordFailure>`.
- Events / append intents authored: `AnalysisRecorded` (`barrier`) and `AnalysisFailed` (`barrier`),
  both appended through `RunWriter.append`.
- Evidence records: the published redacted `ArtifactRef` (`redactionState === "redacted"`) carried as
  `reportArtifactRef`; the `analysisPayloadDigest` (canonical-JSON digest of the final payload) and the
  derived analysis `eventId` (from `analysisAttemptKey`).
- Failure and degraded tokens **owned by this story** (records part of the core-07 catalog):
  `analysis-artifact-unavailable`, `analysis-redaction-unavailable`, `analysis-record-unwritable`,
  `analysis-invariant-missing`. Of these, only `analysis-record-unwritable` surfaces as
  `AnalysisRecordFailure`; `analysis-artifact-unavailable` and `analysis-redaction-unavailable` are
  recorded **as** `AnalysisFailed` (they are `RecordableAnalysisFailureReason` members) while the log is
  writable; `analysis-invariant-missing` is the explicit unmet-invariant signal.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Implement `recordAnalysisOutcome(input, writer)`: from an `AnalysisRecordInput` whose
  `outcome.kind === "recorded"`, build the canonical `AnalysisRecordedPayload` (carrying the analyzer
  `AnalysisResult`'s issues, metrics, evidence refs, and report artifact ref); from
  `outcome.kind === "failed"`, build the canonical `AnalysisFailedPayload` carrying the
  `AnalysisFailure.reason` (a `RecordableAnalysisFailureReason`), evidence refs, and artifact refs;
  append exactly one envelope at `barrier` via `writer.append`; return `AnalysisRecordCommit`.
- Publish the report artifact through the injected fnd-02 `ArtifactStore` for the `recorded` path: the
  resulting `reportArtifactRef` must be a write-once `ArtifactRef` with `redactionState === "redacted"`;
  reject any candidate that is a `ScratchArtifactRef`, or an `ArtifactRef` whose `redactionState` is
  `"raw"` or `"tombstoned"`, as the report ref (a non-redacted/scratch/raw ref cannot be recorded).
- Fail closed when the report artifact cannot be stored: when `ArtifactStore.put`/`resolve` cannot
  produce a usable redacted ref, record `AnalysisFailed` with reason `analysis-artifact-unavailable`
  while the log is writable.
- Fail closed when redaction is unavailable: when the selected redacted content or required redaction
  evidence is unavailable, record `AnalysisFailed` with reason `analysis-redaction-unavailable` while
  the log is writable.
- Fail closed `analysis-record-unwritable` when no analysis outcome can be appended: when
  `writer.append` fails, when the same analysis event id is already committed with a different payload
  digest, or when a current analysis for the same `analysisKey` at the same evaluated cursor exists
  without `supersedesEventId`, return `AnalysisRecordFailure` (NOT a recorded `AnalysisFailed` — the
  record itself cannot be written), carrying `attemptedEventId`, `attemptedPayloadDigest`, the optional
  `appendFailure`/`conflict`, and `retry: "replay-before-retry"`.
- Derive the analysis `eventId` from `analysisAttemptKey` and the `analysisPayloadDigest` from the
  canonical JSON of the final payload (including the full `AnalysisRequest`, `request.analyzedAt`,
  `redactionPolicyDigest`, trigger content, input health, issues, metrics, evidence refs, artifact
  refs, failure reason, and `supersedesEventId`), so the event id is a deterministic function of input.
- Make same-attempt retries idempotent: replay first; if the same event id and payload digest are
  already committed, return `{ status: "already-committed"; eventRef }` and perform zero appends; if
  absent, reuse the same report artifact ref (or re-publish identical redacted bytes to obtain the same
  content-addressed ref) and append the identical payload bytes, never re-running analysis with a new
  `analyzedAt`.
- Carry the terminal-analysis invariant: a terminal Run with usable replay health and a writable log
  must yield `AnalysisRecorded` or `AnalysisFailed`; when replay is corrupt or the log is unwritable,
  surface the invariant as explicitly unmet via `analysis-record-unwritable` (cannot append) or
  `analysis-invariant-missing` (terminal usable replay + writable log but no analysis fact at/after the
  terminal lifecycle sequence), never as satisfied.

## Out of scope

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

## Dependencies and frozen inputs

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

## Acceptance criteria

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

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `recordAnalysisOutcome` recorded path builds `AnalysisRecordedPayload` + appends at `barrier` | AC-1 |
| `AnalysisRecordedPayload` shape (schema, request, inputHealth, issues, metrics, evidenceRefs, reportArtifactRef, supersedesEventId) | AC-1 |
| Publish redacted write-once report ref via injected `ArtifactStore`; carry as `reportArtifactRef` | AC-1, AC-4, AC-5 |
| `recordAnalysisOutcome` failed path builds `AnalysisFailedPayload` + appends at `barrier` | AC-2 |
| `AnalysisFailedPayload` shape (schema, request, inputHealth, reason, evidenceRefs, artifactRefs, supersedesEventId) | AC-2 |
| `RecordableAnalysisFailureReason` carried on `AnalysisFailed` (excludes `analysis-record-unwritable`) | AC-2, AC-7 |
| `AnalysisFailureReason` full union exposed | AC-7 |
| Event id from `analysisAttemptKey`; `analysisPayloadDigest` from canonical JSON of final payload | AC-3 |
| Reject scratch/raw/tombstoned ref as report ref → records `analysis-redaction-unavailable` | AC-4 |
| Fail closed `analysis-artifact-unavailable` (artifact store cannot produce any redacted ref) | AC-5 |
| Fail closed `analysis-redaction-unavailable` (redacted content / evidence unavailable) | AC-4, AC-6 |
| Fail closed `analysis-record-unwritable` as `AnalysisRecordFailure` (never self-recorded) | AC-7 |
| `AnalysisRecordFailure` shape (reason, attemptedEventId, attemptedPayloadDigest, appendFailure?, conflict?, retry) | AC-7, AC-8 |
| Idempotent retry: same id+digest committed -> `already-committed`, zero appends | AC-9 |
| Conflict (same id/different digest; current analysis without supersession) fails closed | AC-8 |
| `AnalysisRecordCommit` `appended` vs `already-committed` variants (receipt only on `appended`) | AC-1, AC-9 |
| Terminal-analysis invariant: missing/explicitly-unmet, never silently satisfied | AC-10 |
| Tokens: `analysis-artifact-unavailable` / `analysis-redaction-unavailable` / `analysis-record-unwritable` / `analysis-invariant-missing` | AC-5 / AC-4, AC-6 / AC-7 / AC-10 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `analysis-artifact-unavailable` | fnd-02 `ArtifactStore` cannot produce any usable redacted report ref for the `recorded` outcome (`put`/`resolve` returns `StorageError`). | Do not append `AnalysisRecorded`; record `AnalysisFailed` with `reason: "analysis-artifact-unavailable"` at `barrier` while the log is writable. | AC-5 |
| `analysis-redaction-unavailable` | The candidate report ref is a `ScratchArtifactRef` or an `ArtifactRef` with `redactionState` `"raw"` or `"tombstoned"` (non-redacted/non-write-once ref). | Do not append a report-carrying `AnalysisRecorded`; record `AnalysisFailed` with `reason: "analysis-redaction-unavailable"` at `barrier` while the log is writable. | AC-4 |
| `analysis-redaction-unavailable` | Selected redacted content or required redaction evidence is unavailable (the ref shape is acceptable but the content itself is unavailable). | Do not append a report-carrying `AnalysisRecorded`; record `AnalysisFailed` with `reason: "analysis-redaction-unavailable"` at `barrier` while the log is writable. | AC-6 |
| `analysis-record-unwritable` | `writer.append` fails, the same event id is committed with a different digest, or a current analysis for the same `analysisKey` exists at the same cursor without `supersedesEventId`. | Return `AnalysisRecordFailure` (NOT a recorded `AnalysisFailed`); carry `attemptedEventId`, `attemptedPayloadDigest`, `appendFailure?`/`conflict?`, `retry: "replay-before-retry"`; append nothing on conflict. | AC-7, AC-8 |
| `analysis-invariant-missing` | A terminal Run with usable replay health and a writable log has no `AnalysisRecorded`/`AnalysisFailed` at/after the terminal lifecycle sequence (or replay is corrupt / log unwritable). | Report the terminal-analysis invariant as explicitly unmet; never report it satisfied. | AC-10 |

## Quality bar

- Coverage scope and threshold: the analysis-record modules under
  `packages/sdk/src/core/observability/records/**` at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit lane for the
  aggregate gate; for a focused per-story report use
  `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/sdk/tests/core/observability/records/*.unit.test.ts`.
- Required tests, catalogued by AC and failure row: `record-recorded-appended` (AC-1),
  `record-failed-appended` (AC-2), `record-event-id-determinism` (AC-3),
  `record-rejects-non-redacted-ref` (AC-4, `analysis-redaction-unavailable`, scratch/raw ref negative fixtures),
  `record-artifact-unavailable` (AC-5, `analysis-artifact-unavailable`),
  `record-redaction-unavailable` (AC-6, `analysis-redaction-unavailable`),
  `record-unwritable-append-fails` (AC-7, `analysis-record-unwritable`),
  `record-conflict-fails-closed` (AC-8, `analysis-record-unwritable` conflicts),
  `record-idempotent-already-committed` (AC-9), `terminal-invariant-missing` (AC-10,
  `analysis-invariant-missing`), plus the public-import test `records-public-import` and a property test
  `prop-record-idempotent` (replaying the same committed attempt is total over
  committed/absent/conflict). All `*.unit.test.ts`, hermetic; the `ArtifactStore` and `RunWriter` are
  deterministic in-memory fakes with fault injection (no real filesystem).
- Exact commands:
  `pnpm test:unit -- packages/sdk/tests/core/observability/records/*.unit.test.ts`; `pnpm check`;
  coverage via `pnpm coverage:baseline` or the focused command above.
- Public exposure (import path + public-import test): `recordAnalysisOutcome`, `AnalysisRecordedPayload`,
  `AnalysisFailedPayload`, `AnalysisRecordCommit`, `AnalysisRecordFailure`,
  `RecordableAnalysisFailureReason`, and `AnalysisFailureReason` are reachable through the `sdk` public
  entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export + barrel + `exports`).
  Proven by `records-public-import.unit.test.ts` importing each through `sdk` (not a private path) and
  constructing/calling `recordAnalysisOutcome` against in-memory fakes.
- Determinism constraints: `request.analyzedAt`, the analysis ids/digests, and any randomness are
  derived from the supplied `AnalysisRecordInput` and the keying rule; the `RunWriter` and `ArtifactStore`
  are injected ports. No ambient `Date.now`/`new Date`/`Math.random`/`crypto.randomUUID`
  (per `dependency-rules.md`). Same-attempt retries reuse the original `AnalysisRecordInput` bytes; a
  retry never re-runs analysis with a new `analyzedAt`.
- Dependency boundaries: `sdk → pure libs only`; this module imports `core-07-s2`, `core-07-s1`, and
  `core-01-s1` types plus the injected fnd-02 `ArtifactStore`; it imports no provider package, no
  concrete storage backend, no concrete `RunEventLog`, and no `testkit` in production source (test files
  only). It never opens provider clients, reads the filesystem directly, writes projections, or changes
  lifecycle state.
- File-size budget: soft cap ~200 lines/file; split the payload builders, the keying/digest helper, the
  artifact-ref guard, the retry/idempotency resolver, and the terminal-invariant check into separate
  files to stay under the cap.
- Domain non-negotiables: every recorded/failed outcome is appended at `barrier`; reports are redacted
  write-once `ArtifactRef`s only (scratch/raw/tombstoned never substitute); `analysis-record-unwritable`
  is fail-closed-by-construction as `AnalysisRecordFailure` and is excluded from
  `RecordableAnalysisFailureReason` so the unwritable record can never be self-recorded; the
  terminal-analysis invariant is reported explicitly unmet on corrupt replay / unwritable log, never
  silently waived; the module never repairs by editing logs, calling providers, or changing lifecycle
  state; payloads carry stable reason codes and refs, never raw exceptions, provider text, prompts, or
  secret-bearing strings.

### Forbidden-symbol sweep (runnable recipe)

```sh
grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|child_process|node:child_process|execa|node:net|node:http|node:https|@octokit|spawn\\(|EventLogStore|LeaseStore|from \"testkit\"|from \"@kit/testkit\"" \
  packages/sdk/src/core/observability/records/
```

- Path root: `packages/sdk/src/core/observability/records/`.
- Forbidden-token set: `Date.now`, `new Date(`, `Math.random`, `crypto.randomUUID` (ambient
  clock/randomness — breaks determinism); `child_process`, `node:child_process`, `execa`, `node:net`,
  `node:http`, `node:https`, `@octokit`, `spawn(` (process/network leaks); `EventLogStore`, `LeaseStore`
  (concrete fnd-02 runtime backends — this story consumes the injected `ArtifactStore` port only, never
  concrete storage backends); `testkit` import in production source. Note: `RunWriter` and
  `fnd-02 ArtifactStore` are legitimate injected dependencies of this story and are NOT forbidden here.
- Expected result: zero matches (exit code 1, no lines), captured into the evidence pack. A non-empty
  match means the records module leaked ambient nondeterminism, a process/network dependency, a concrete
  storage backend, or a production `testkit` import, and fails this story.

## Required reading

- `docs/design/30-domain-reference/core/observability-and-analysis/README.md` (§6, §8)
- `docs/design/30-domain-reference/core/observability-and-analysis/analysis-contract.md`
  (§Analyzer types, §Provenance/retention/privacy, §Idempotency and retry, §Failure catalog)
- `core-07-s2-analyzer` story contract (analyzer result/failure/request/issue/outcome producer)
- `core-07-s1-telemetry-and-metrics` story contract (`MetricValue` producer)
- `core-01-s1-event-contracts` story contract (`RunWriter`, `EvidenceEventRef`, `RunAppendReceipt`,
  `RunAppendFailure`, `Result`, `RunReplay`, `RunDegradedHealth` producer)
- `fnd-02-s4-artifact-evidence` story contract + `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`
  (`ArtifactStore`, `ArtifactRef`, `ScratchArtifactRef`, write-once + redacted-by-default semantics)
- `docs/design/20-sdk-and-packaging/dependency-rules.md`; `docs/engineering/test-lanes.md`;
  `epic0-s4-export-templates` (`PackageExportConvention`)

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk/src/core/observability/records` modules providing `recordAnalysisOutcome`, the
`AnalysisRecorded`/`AnalysisFailed` payloads, the `AnalysisRecordCommit`/`AnalysisRecordFailure` shapes,
and the redacted write-once report-ref handling — reachable through the `sdk` entrypoint — plus the
evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued above).
- Test name or artifact proving each failure/degraded row, each with its own fault-injected fixture
  (faulted `ArtifactStore.put`, faulted `writer.append`, scratch ref, `redactionState: "raw"` ref,
  same-id/different-digest committed event, current-analysis-without-supersession,
  terminal-no-analysis replay, corrupt replay).
- Negative fixture for every rejection claim: `analysis-redaction-unavailable` (scratch-ref fixture,
  raw-ref fixture — AC-4); `analysis-artifact-unavailable` (faulted `ArtifactStore.put` — AC-5);
  `analysis-redaction-unavailable` content-unavailable (AC-6); `analysis-record-unwritable` (AC-7, AC-8);
  `analysis-invariant-missing` (AC-10); no green tool exit cited for any rejection.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented unit lane, and number for the stated `records/**` scope.
- Public-import test result (`records-public-import.unit.test.ts`) importing `recordAnalysisOutcome`,
  `AnalysisRecordedPayload`, `AnalysisFailedPayload`, `AnalysisRecordCommit`, `AnalysisRecordFailure`,
  `RecordableAnalysisFailureReason`, and `AnalysisFailureReason` through `sdk`.
- Boundary/forbidden-symbol sweep: the exact command from the Quality bar above, path root
  `packages/sdk/src/core/observability/records/`, forbidden-token set, and zero-match output, captured.
- `pnpm deps` to prove the `sdk → pure libs only` dependency-rule edge.
- Conformance evidence is via the deterministic in-memory fnd-02 `ArtifactStore` fake and the in-memory
  `RunWriter`/replay fake with fault injection; no real process, network, or filesystem (this story is
  hermetic unit tests).

## Boundaries and STOP conditions

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

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - stories](./README.md) · **← Prev:** [core-07-s2-analyzer - pure analyzer implementation story](./core-07-s2-analyzer.md) · **Next →:** [edge-01-s1-operator-command-contract - shared operator command-envelope substrate implementation story](./edge-01-s1-operator-command-contract.md)

<!-- /DOCS-NAV -->
