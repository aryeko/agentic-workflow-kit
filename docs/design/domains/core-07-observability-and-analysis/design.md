---
title: "Observability & Analysis - design"
id: "core-07"
layer: "core"
status: approved
owner: "domain designer"
last-reviewed: "2026-06-19"
depends-on:
  - "core-01-run-lifecycle-and-state"
  - "core-02-capability-and-safety"
  - "core-03-approval-and-escalation"
  - "core-04-supervision-and-liveness"
  - "core-05-completion-and-merge"
  - "core-06-recovery-and-reconciliation"
  - "fnd-02-storage-and-artifacts"
  - "fnd-04-credentials-and-secrets"
  - "prov-01-agent-execution"
  - "prov-02-forge-collaboration"
  - "prov-03-work-source"
  - "prov-04-execution-host"
---

# Observability & Analysis - design

## 1. Purpose & boundaries

Observability & Analysis defines the Control plane contract for structured telemetry, metric honesty,
and deterministic run analysis. It reads committed Run events, core-01 projections, and redacted
artifact refs, then appends an `AnalysisRecorded` or `AnalysisFailed` fact for every auto-fire
trigger.

Out of scope: emitting raw domain events, authoring lifecycle state, deciding approvals, recovery,
completion, merge, or capability gates, surfacing reports to the Operator, exporting to OTel, and
calling provider clients or concrete Drivers. Provider-specific facts are observable only when a
provider seam recorded them as event payloads or artifact refs.

Dependency Rule statement: core-07 depends only on approved core contracts, provider seam event
contracts, Storage & Artifacts for write-once analysis artifacts, and Credentials & Secrets redaction
policy. It introduces no dependency on Codex, GitHub, Markdown, Local, mock, or live external state.

## 2. Required reading

Read: `AGENTS.md`, the standard kit-vnext docs, the domain template, this domain's
[charter](charter.md), approved core-01 through core-06 designs and relevant subfiles, approved
[fnd-02](../fnd-02-storage-and-artifacts/design.md), approved
[fnd-04](../fnd-04-credentials-and-secrets/design.md), and approved provider seam designs for Agent,
Forge, Work Source, and Execution Host. No concrete Driver behavior was used.

## 3. Context diagram

```mermaid
flowchart LR
  subgraph CORE["Control plane"]
    OBS["Observability & Analysis"]
    RL["Run Lifecycle & Event State"]
    CAP["Capability & Safety"]
    APR["Approval & Escalation"]
    SUP["Supervision & Liveness"]
    CMP["Completion / Verification / Merge"]
    REC["Recovery, Reconciliation & Coordination"]
  end
  subgraph SEAMS["Provider contracts"]
    AG["Agent"]; FG["Forge"]; WS["Work Source"]; EH["Execution Host"]
  end
  subgraph FND["Foundation"]
    STA["Storage & Artifacts"]; CRED["Credentials & Secrets"]
  end
  CAP -->|"gate records"| OBS
  APR -->|"approval records"| OBS
  SUP -->|"liveness records"| OBS
  CMP -->|"evidence and outcome records"| OBS
  REC -->|"recovery classifications"| OBS
  AG -->|"worker evidence events"| OBS
  FG -->|"Forge evidence events"| OBS
  WS -->|"Task evidence refs"| OBS
  EH -->|"host evidence events"| OBS
  OBS -->|"replay, projections, append analysis facts"| RL
  OBS -->|"put redacted reports"| STA
  OBS -->|"redaction policy"| CRED
```

## 4. Design

Core-07 classifies structured Run events into a stable telemetry taxonomy, computes honest metrics
and correlated issues as a pure analysis function, and ensures every auto-fire trigger has a durable
`AnalysisRecorded` or `AnalysisFailed` fact.

Observable inputs are limited to committed `RunEventEnvelope` metadata, approved payload contracts,
core-01 projections, fnd-02 replay health and artifact metadata, redacted artifact content explicitly
selected by refs, and caller-supplied clock values. Derived data includes telemetry topics, issue
correlations, metric values, report artifacts, and latest-analysis projections.

Live provider state, raw Driver output, raw prompts, raw secrets, unredacted artifacts, cached
projections, and worker prose without corroborating evidence are not observable inputs. Unknown or
ambiguous evidence becomes an issue or an unavailable metric; it never becomes a guessed value.

The detailed telemetry topic taxonomy, issue taxonomy, typed metric wrapper, analyzer input/output
types, retention/privacy boundaries, and failure reason catalog are in
[Analysis contract](design/analysis-contract.md). They are split because those types are cohesive
low-level detail used by tests and future implementations, while this file remains the domain entry
point.

Core decisions:

- The analyzer is pure over replay/projections, selected redacted artifacts, explicit `analyzedAt`,
  analyzer version, rule-set digest, and redaction policy digest.
- `AnalysisRecorded` and `AnalysisFailed` are post-terminal-safe non-lifecycle facts under core-01.
- Recording an analysis outcome carries the full `AnalysisRequest`, input health, and append result;
  an unwritable record is surfaced as `analysis-record-unwritable`, not hidden behind a bare receipt.
- Analysis reports are redacted-by-default write-once artifacts; scratch refs cannot satisfy
  analysis, gates, exports, or the terminal invariant.
- Metrics use `available`, `partial`, or `unavailable`; unavailable values are never coerced to `0`,
  false, empty arrays, or success.
- Analysis event ids are derived from the final canonical payload digest, and same-attempt retries
  reuse the original `AnalysisRecordInput` bytes exactly.

## 5. Contracts & interfaces

Core-07 exposes:

```ts
classifyTrigger(event: RunEventEnvelope, projections: RunProjections): AnalysisTrigger | null
analyze(request: AnalysisRequest, snapshot: AnalysisSnapshot): AnalysisResult | AnalysisFailure
recordAnalysisOutcome(input: AnalysisRecordInput, writer: RunWriter):
  Result<AnalysisRecordCommit, AnalysisRecordFailure>
```

Consumed: core-01 `RunEventLog`, `RunWriter`, `RunReplay`, `RunProjections`, `RunEventCursor`, and
event envelopes; approved sibling-domain payloads; provider seam evidence payloads; fnd-02
`ArtifactStore`; and fnd-04 redaction policy. Core-07 never opens provider clients, reads the
filesystem directly, imports Drivers, or writes projections. Detailed types are in
[Analysis contract](design/analysis-contract.md).

## 6. Events & data

Core-07 emits:

- `AnalysisRecorded` (`barrier`): trigger, evaluated cursor, analyzer version, rule-set digest,
  redaction policy digest, input health, issue summaries, honest metrics, evidence refs, and report
  artifact refs.
- `AnalysisFailed` (`barrier`): trigger, evaluated cursor, analyzer version, stable failure reason,
  input health, and evidence refs. It is the required fallback when analysis or artifact generation
  cannot complete but the Run log is writable.

Auto-fire triggers are derived from committed events:

- terminal `RunLifecycleTransitioned` to `completed`, `failed`, or `canceled`;
- `RunLifecycleTransitioned` to `blocked`, recorded only as `blocked-transition`;
- `SupervisionLost` or `LivenessStateChanged` to `supervision_lost`;
- `LivenessTimerExpired` or `LivenessStateChanged` to `stale`;
- `RecoveryClassified`, `RecoveryActionPlanned`, `RecoveryActionApplied`, or `ReconciliationBlocked`.

Trigger classification is first-match in the order above, so a single committed event produces at
most one trigger kind. For a trigger event id, analyzer version, and rule-set digest, exactly one
deterministic analysis event id is current, whether the outcome is `AnalysisRecorded` or
`AnalysisFailed`. A later analysis may supersede it only by citing the prior analysis event id and a
later replay cursor. The invariant is: every terminal Run with usable replay health has
`AnalysisRecorded` or `AnalysisFailed` at or after the terminal lifecycle sequence.

## 7. Behavior diagram

```mermaid
sequenceDiagram
  participant RL as Run Lifecycle & Event State
  participant OBS as Observability & Analysis
  participant STA as Storage & Artifacts
  participant CRED as Credentials & Secrets

  RL-->>OBS: committed trigger event + cursor
  OBS->>RL: replay + project through cursor
  OBS->>CRED: load redaction policy digest and redact selected inputs
  OBS->>OBS: classify topics, metrics, and issues from recorded evidence
  OBS->>STA: put redacted analysis report artifact
  alt analysis succeeds
    OBS->>RL: append AnalysisRecorded(barrier)
  else analysis or artifact generation fails
    OBS->>RL: append AnalysisFailed(barrier)
  end
```

## 8. Failure & degraded modes

Named modes are `analysis-input-degraded`, `analysis-artifact-unavailable`,
`analysis-redaction-unavailable`, `analysis-rule-error`, `analysis-record-unwritable`, and
`analysis-invariant-missing`.

When analysis, artifact storage, redaction, or a rule fails but the Run log remains writable, core-07
appends `AnalysisFailed`. If neither `AnalysisRecorded` nor `AnalysisFailed` can be appended,
autonomous capabilities depending on observability are absent, and recovery treats terminal analysis
as missing until a supported writer records it. Core-07 never repairs by editing logs, writing
projections, clearing leases, calling providers, or changing lifecycle state.

## 9. Testing strategy

Requirements satisfied: FR-9 and NFR-OBS. The design also supports NFR-DET, NFR-SAFE, NFR-SEC, and
NFR-TEST through pure replay analysis, fail-closed analysis failures, redaction, and mock-only tests.

NFR-TEST: tests use an in-memory core-01 Run log, deterministic fnd-02 artifact fake, fake fnd-04
redaction policy, and mock approved-domain event payloads. No real processes, filesystem, network, or
concrete Driver is used.

Required tests: generated trigger coverage; terminal analysis invariant tests; replay-determinism and
stable-ordering property tests; metric honesty tests for `partial` and `unavailable`; redaction tests
over generated secrets, prompts, URLs, headers, and command output refs; fallback tests for artifact,
redaction, rule, replay, and append failures; and adversarial mocks that omit, delay, or contradict
liveness, recovery, merge, capability, provider, or credential evidence.

## 10. Open questions

- OTel export remains deferred. This design records analysis facts and redacted artifacts only.
- Retention class names for analysis reports are policy-owned; until policy supplies defaults, the
  producer must name retention explicitly and align it with the Run event-log lifetime.
- Whether terminal analysis must reuse the terminal writer epoch or may use a fresh post-terminal
  writer epoch remains inherited from core-01's open question.

## 11. Definition of done

- [x] All sections complete; guidance notes removed.
- [x] Files are focused; low-level taxonomy and type detail is split into one cohesive subfile.
- [x] Complies with the Dependency Rule; dependencies listed and justified.
- [x] Uses glossary vocabulary.
- [x] States the FR/NFR ids satisfied; shows how NFR-TEST is met.
- [x] Failure/degraded modes defined (fail-closed).
- [x] Provider-domain validation is not applicable to this core domain.
- [x] Diagrams present and consistent with architecture.md naming.
- [x] Open questions captured, not silently resolved.
