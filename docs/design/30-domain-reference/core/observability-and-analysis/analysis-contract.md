---
title: "Observability & Analysis - analysis contract"
status: approved
last-reviewed: "2026-06-19"
---

# Analysis contract

This file holds the detailed telemetry taxonomy, analyzer types, issue taxonomy, metric honesty
model, provenance rules, and failure catalog for `core-07`.

## Telemetry topics

Topics are deterministic classifications over `RunEventEnvelope.domain` and `.type`:

| Topic | Examples |
|---|---|
| `lifecycle` | `RunLifecycleTransitioned`, `SessionLinked`, terminal lifecycle facts |
| `capability` | `CapabilityAttestation`, `CapabilityGateRecord` |
| `approval` | `ApprovalRequested`, `ApprovalDecisionRecorded`, `ApprovalOutcomeRecorded` |
| `liveness` | `LivenessStateChanged`, `SupervisionLost`, `WorkerTerminated` |
| `completion` | `CompletionDecisionRecorded`, `MergeDecisionRecorded`, `PostMergeOutcomeRecorded` |
| `recovery` | `RecoveryClassified`, `RecoveryActionPlanned`, `ReconciliationBlocked` |
| `provider-evidence` | Agent, Forge, Work Source, and Execution Host evidence events |
| `storage` | log health, lease evidence recorded by core-06, artifact write failures |
| `privacy` | credential, redaction, egress, and quarantine audit facts |
| `analysis` | `AnalysisRecorded`, `AnalysisFailed` |

The canonical authored event envelope remains core-01's `RunEventEnvelope`. Core-07 does not define a
second raw-event format; it defines a telemetry view and analysis output over committed events.

## Metric honesty

Every metric uses the tri-state wrapper:

```ts
type MetricValue<T> =
  | { state: "available"; value: T; unit: string; evidenceRefs: EvidenceEventRef[] }
  | { state: "partial"; value?: T; unit: string; missing: string[]; evidenceRefs: EvidenceEventRef[] }
  | { state: "unavailable"; reason: string; evidenceRefs: EvidenceEventRef[] };
```

Unavailable values are never coerced to `0`, empty arrays, success, or false. Partial metrics must
name the missing denominator or source class. Examples: failed tool-call counts are `partial` when any
known worker session lacks trustworthy structured tool exits; merge latency is `unavailable` when
post-merge outcome evidence is absent or ambiguous.

## Analyzer types

```ts
type AnalysisTriggerKind =
  | "terminal-lifecycle" | "blocked-transition" | "supervision-lost"
  | "stale-progress" | "recovery-decision";
// EvidenceEventRef is imported from core-01's Run Lifecycle & Event State contracts.
type AnalysisTrigger = { kind: AnalysisTriggerKind; eventRef: EvidenceEventRef; reason: string };
type AnalysisFailureReason =
  | "analysis-input-degraded" | "analysis-artifact-unavailable"
  | "analysis-redaction-unavailable" | "analysis-rule-error"
  | "analysis-record-unwritable" | "analysis-invariant-missing";
type RecordableAnalysisFailureReason = Exclude<AnalysisFailureReason, "analysis-record-unwritable">;

interface AnalysisRequest {
  runId: string;
  trigger: AnalysisTrigger;
  evaluatedThrough: RunEventCursor;
  analyzedAt: string;
  analyzerVersion: string;
  ruleSetDigest: string;
  redactionPolicyDigest: string;
}
interface AnalysisSnapshot {
  replay: RunReplay;
  projections: RunProjections;
  redactedArtifacts: Record<string, ArtifactRef>;
}
interface AnalysisInputHealth {
  replayHealth: RunDegradedHealth;
  projections: "available" | "missing";
  artifactInputs: "available" | "partial" | "unavailable";
  redaction: "applied" | "not-required" | "unavailable";
}
interface AnalysisIssue {
  issueId: string;
  code: string;
  severity: "info" | "attention" | "blocked" | "failed";
  summary: string;
  evidenceRefs: EvidenceEventRef[];
  artifactRefs: ArtifactRef[];
  metricRefs: string[];
}
interface AnalysisResult {
  issues: AnalysisIssue[];
  metrics: Record<string, MetricValue<unknown>>;
  evidenceRefs: EvidenceEventRef[];
  reportArtifactRef?: ArtifactRef;
}
interface AnalysisFailure {
  reason: RecordableAnalysisFailureReason;
  evidenceRefs: EvidenceEventRef[];
  artifactRefs: ArtifactRef[];
}
type AnalysisOutcome =
  | { kind: "recorded"; result: AnalysisResult }
  | { kind: "failed"; failure: AnalysisFailure };
interface AnalysisRecordInput {
  request: AnalysisRequest;
  inputHealth: AnalysisInputHealth;
  outcome: AnalysisOutcome;
  supersedesEventId?: string;
}
type AnalysisRecordCommit =
  | { status: "appended"; eventRef: EvidenceEventRef; appendReceipt: RunAppendReceipt }
  | { status: "already-committed"; eventRef: EvidenceEventRef };
interface AnalysisRecordFailure {
  reason: "analysis-record-unwritable";
  attemptedEventId: string;
  attemptedPayloadDigest: string;
  appendFailure?: RunAppendFailure;
  conflict?: "event-id-digest-mismatch" | "current-analysis-conflict";
  retry: "replay-before-retry";
}
interface AnalysisRecordedPayload {
  schema: "kit-vnext.analysis-recorded.v1";
  request: AnalysisRequest;
  inputHealth: AnalysisInputHealth;
  issues: AnalysisIssue[];
  metrics: Record<string, MetricValue<unknown>>;
  evidenceRefs: EvidenceEventRef[];
  reportArtifactRef?: ArtifactRef;
  supersedesEventId?: string;
}
interface AnalysisFailedPayload {
  schema: "kit-vnext.analysis-failed.v1";
  request: AnalysisRequest;
  inputHealth: AnalysisInputHealth;
  reason: RecordableAnalysisFailureReason;
  evidenceRefs: EvidenceEventRef[];
  artifactRefs: ArtifactRef[];
  supersedesEventId?: string;
}
```

`analyzedAt` is an explicit input, not a clock read inside the analyzer. Rules return the same result
for the same request, replay, projections, redacted artifact bytes, and analyzer version.

## Issue taxonomy

| Code prefix | Meaning |
|---|---|
| `lifecycle-*` | Illegal, missing, ambiguous, or terminal lifecycle facts |
| `evidence-*` | Missing, stale, contradictory, or self-report-only evidence |
| `capability-*` | Denied, stale, wrong-scope, or unwritable capability gates |
| `approval-*` | Parked, expired, lost answer channel, or high-risk approval attention |
| `liveness-*` | Stale progress, supervision lost, unproven termination, or timer expiry |
| `completion-*` | Verification, merge, changed-file, or exact-head blockers |
| `recovery-*` | Recovery classification, duplicate launch, or reconciliation blocker |
| `provider-*` | Seam-degraded, redaction-unavailable, or provider evidence gap |
| `storage-*` | Tail repair, interior corruption, unavailable log, lease, or artifact store |
| `privacy-*` | Redaction failure, credential destroy uncertainty, or quarantine |
| `metric-*` | Metric unavailable or partial due to missing recorded source data |

Severity ordering is `failed`, `blocked`, `attention`, then `info` for operator triage, but stable
sorts use severity, first cited sequence, issue code, then issue id. `issueId` is deterministic from
`runId`, trigger event id, issue code, first cited sequence, and analyzer version.

## Provenance, retention, and privacy

Every analysis event records the trigger event id, evaluated cursor, analyzer version, rule-set
digest, redaction policy digest, replay health, issue evidence refs, artifact refs, and metric states.
Report artifacts are fnd-02 write-once artifacts stored redacted by default. They must name an
explicit retention class until policy supplies a default; intended retention is the Run event-log
lifetime unless policy narrows it.

Core-07 reads artifact content only through selected refs in redacted mode. Raw prompts, raw secrets,
raw provider responses, unredacted command output, scratch refs, tombstoned originals, and quarantined
artifacts cannot appear in normal reports or satisfy analysis evidence. Redaction failures produce
`AnalysisFailed` or `privacy-*` issues, never raw diagnostic dumps.

## Idempotency and retry

Core-07 uses three deterministic keys:

- `analysisKey`: `runId`, trigger event id, analyzer version, and rule-set digest.
- `analysisPayloadDigest`: the canonical JSON digest of the final `AnalysisRecordedPayload` or
  `AnalysisFailedPayload`, including the full `AnalysisRequest`, `analyzedAt`,
  `redactionPolicyDigest`, trigger content, input health, issues, metrics, evidence refs, artifact
  refs, failure reason, and `supersedesEventId`.
- `analysisAttemptKey`: `analysisKey`, evaluated cursor, outcome kind, and `analysisPayloadDigest`.

The event id is derived from `analysisAttemptKey`. Same-attempt retries must reuse the original
`AnalysisRecordInput` and payload bytes exactly; a retry must not re-run analysis with a new
`analyzedAt`. A later analysis with a different request or payload is a new attempt and must cite the
current event in `supersedesEventId` when one exists for the same `analysisKey`.

`recordAnalysisOutcome` returns `AnalysisRecordCommit`, not `RunAppendReceipt`, because replayed
`RunEventEnvelope`s do not contain core-01 frame receipt fields such as `frameDigest`. The
`appended` variant carries the real core-01 `RunAppendReceipt` from the successful append; the
`already-committed` variant carries only the committed analysis event ref found by replay.

Retries first replay the log:

1. If the same event id and payload digest are already committed, the retry treats the outcome as
   recorded, returns `already-committed`, and does not append.
2. If no matching event exists, the retry reuses the same report artifact ref when available, or
   re-publishes identical redacted bytes to obtain the same content-addressed ref, then appends the
   identical payload.
3. If the same event id exists with a different digest, or another current analysis for the same
   `analysisKey` exists at the same evaluated cursor without `supersedesEventId`, recording fails
   closed as `analysis-record-unwritable`.

If fnd-02 stores the report artifact but `RunWriter.append` fails, the artifact is an unreferenced
redacted artifact until retry records the event. Scratch refs, raw refs, and non-redacted artifacts
cannot be substituted. If append returns core-01 `partial-ack-unknown`, retry follows core-01
replay-only recovery with the same event id and payload digest.

## Failure catalog

- `analysis-input-degraded`: replay health is `interior-corrupt` or `event-log-unavailable`, or
  projections are missing.
- `analysis-artifact-unavailable`: fnd-02 cannot store a redacted report artifact.
- `analysis-redaction-unavailable`: selected redacted content or required redaction evidence is
  unavailable.
- `analysis-rule-error`: a rule is malformed or non-total.
- `analysis-record-unwritable`: no analysis outcome can be appended.
- `analysis-invariant-missing`: a terminal usable replay with a writable Run log has no analysis fact
  after terminal lifecycle sequence.

When the log is writable, every failure except `analysis-record-unwritable` is recorded as
`AnalysisFailed` with barrier durability. Error payloads use stable reason codes and evidence refs;
they do not store raw exceptions, provider text, prompts, or secret-bearing strings.
If replay is corrupt or the log is unwritable, the terminal-analysis invariant is reported as unmet
instead of satisfied: recovery and observability-dependent gates treat the missing analysis as a
blocking degraded state until a supported writer records `AnalysisFailed` or `AnalysisRecorded`.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Observability & Analysis](./README.md) · **← Prev:** [Observability & Analysis](./README.md) · **Next →:** [foundation domain reference](../../foundation/README.md)

<!-- /DOCS-NAV -->
