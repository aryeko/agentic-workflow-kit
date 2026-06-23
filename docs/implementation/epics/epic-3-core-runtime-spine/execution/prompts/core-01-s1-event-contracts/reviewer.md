# Reviewer Prompt: core-01-s1-event-contracts

## Assigned Routing

- Source story id: `core-01-s1-event-contracts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-01-s1-event-contracts covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13 and carries public shared run-log contract surface and single-producer type catalog consumed by the rest of Epic 3. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-01-s1-event-contracts`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md`.
- Allowed pathset: `packages/sdk/src/core/run-lifecycle/contracts/**`, `packages/sdk/tests/core/run-lifecycle/contracts/**`.
- Direct dependencies: none.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

Each AC is a single assertion that is true or false against a type-level construction fixture or a
public-import test. As a type-only contract story, each "rejection" is a compilation failure proven by
its own negative fixture (a value omitting a required field or using a wrong literal/return type fails
`tsc`); a green `tsc -b` proves only acceptance. The `evidence` names the exact test id and the result.

- **AC-1** `RunEventLog` declares exactly the five operations `createRun`, `openWriter`, `replay`,
  `waitRunEvents`, `project` with the manifest signatures (e.g.
  `createRun(input: CreateRunInput): Result<RunWriter, RunAppendFailure>`,
  `openWriter(runId: string, lease: LeaseCapability): Result<RunWriter, RunAppendFailure>`,
  `replay(runId: string): Result<RunReplay, RunReplayFailure>`); and `RunWriter` declares exactly the two
  operations `append(batch: AppendIntent[]): Result<RunAppendReceipt, RunAppendFailure>` and
  `renew(lease: LeaseCapability): Result<RunWriter, RunAppendFailure>` - evidence:
  `run-log-interfaces.unit.test.ts` constructs a conforming `RunEventLog` and `RunWriter` fixture and a
  negative fixture (`run-log-interface-missing-op.fixture.ts`) omitting one operation, or returning a
  bare value instead of `Result<...>`, fails compilation.
- **AC-2** `Result<TValue, TFailure>` is the discriminated union
  `{ ok: true; value: TValue } | { ok: false; error: TFailure }`, narrowable by `ok` - evidence:
  `result-type.unit.test.ts` narrows both arms in a `switch`/`if` on `ok` and a negative fixture
  (`result-mixed-arms.fixture.ts`) carrying both `value` and `error` on one arm fails compilation.
- **AC-3** `RunDurabilityClass` has exactly the two members `"durable" | "barrier"` (no `"buffered"`),
  `RunLifecycleState` has exactly the 15 members `"created" | "configured" | "task-snapshotted" |
  "workspace-ready" | "worker-starting" | "running" | "parked" | "runner-verifying" | "forge-waiting" |
  "merge-waiting" | "settling" | "completed" | "blocked" | "failed" | "canceled"`, and
  `RunDegradedHealth` has exactly the four members `"ok" | "tail-repaired" | "interior-corrupt" |
  "event-log-unavailable"` - evidence: `run-unions.unit.test.ts` runs an exhaustiveness `switch` (a
  `never` check) over each union and asserts a fixture adding a 16th `RunLifecycleState`, a `"buffered"`
  `RunDurabilityClass`, or a fifth `RunDegradedHealth` fails the `never` check.
- **AC-4** `RunEventEnvelope<TPayload = unknown>` is present with the design fields (`schema`, `runId`,
  `eventId`, `sequence`, `writerEpoch`, `domain`, `type`, `durability`, `occurredAt`, `recordedAt`,
  `payloadDigest`, `payload`, optional `causationId`/`correlationId`/`artifactRefs`) and `schema` is the
  literal `"kit-vnext.run-event.v1"`; `EvidenceEventRef` is present with `eventId`, `sequence`,
  `payloadDigest`, `type` - evidence: `run-envelope.unit.test.ts` constructs both from a valid fixture and
  a negative fixture (`run-envelope-bad-schema.fixture.ts`) using a `schema` other than
  `"kit-vnext.run-event.v1"` or omitting `payloadDigest` fails compilation.
- **AC-5** `CreateRunInput`, `AppendIntent<TPayload = unknown>`, and `RunAppendReceipt` are present with
  the design fields, where `AppendIntent.durability` and `RunAppendReceipt.durability` are both
  `RunDurabilityClass`, `CreateRunInput.payload` is `RunCreatedPayload`, and `RunAppendReceipt` carries
  `firstSequence`/`lastSequence`/`writerEpoch`/`eventIds`/`payloadDigests`/`frameDigest`/`health` -
  evidence: `run-append-io.unit.test.ts` constructs each from a valid fixture and a negative fixture
  (`run-append-receipt-missing-frame-digest.fixture.ts`) omitting `frameDigest` fails compilation.
- **AC-6** `RunReplay`, `RunEventCursor`, `WaitRunEventsRequest`, and `WaitRunEventsResult` are present
  with the design fields, where `RunEventCursor` is sequence-based (`runId`, `afterSequence`),
  `WaitRunEventsRequest` carries `cursor: RunEventCursor`/`timeoutMs`/optional `maxEvents`, and
  `WaitRunEventsResult` carries `timedOut`/`lastSequence`/`health`/`healthRecords`/`events`/`cursor` -
  evidence: `run-replay-cursor.unit.test.ts` constructs each from a valid fixture and a negative fixture
  (`wait-result-missing-timed-out.fixture.ts`) omitting `timedOut` fails compilation.
- **AC-7** `RunProjections` aggregates exactly `state`/`summary`/`metrics`/`launch`, and the four
  projection types are present with the design fields: `RunStateProjection`
  (`lifecycle: RunLifecycleState`, `currentSequence`, optional `writerEpoch`/`terminalReason`,
  `degradedHealth: RunDegradedHealth`), `RunSummaryProjection`
  (`runId`, optional `taskId`, `status: RunLifecycleState`, optional `ownerSessionId`, `artifactRefs`,
  `unknownEvents: RunEventEnvelope[]`), `RunMetricsProjection`
  (`eventCount`, `retryCount`, `parkedMs`, optional `firstRecordedAt`/`lastRecordedAt`),
  `RunLaunchProjection` (optional `policyDigest`/`taskSnapshotDigest`,
  `linkage: "known" | "unknown" | "ambiguous"`, optional `currentSession`,
  `linkHistory: SessionLinkedPayload[]`) - evidence: `run-projections.unit.test.ts` constructs
  `RunProjections` and each projection from a valid fixture and a negative fixture
  (`launch-projection-bad-linkage.fixture.ts`) using a `linkage` outside `known|unknown|ambiguous` fails
  compilation.
- **AC-8** The 8 payload types are present with the design fields and literals: `RunCreatedPayload`,
  `RunPolicyBoundPayload`, `TaskSnapshotRecordedPayload`, `RunLifecycleTransitionPayload`
  (`from: RunLifecycleState | null`, `to: RunLifecycleState`, `reason`,
  `authority: "operator" | "policy" | "system" | "recovery"`, `sourceEventIds`, optional `terminal`),
  `SessionLinkedPayload` (`linkOrdinal`, `sessionId`, `linkRole: "primary" | "recovery" | "observer"`,
  `startedAt`, `sourceEventId`, optional `supersedesOrdinal`), `SessionLinkSupersededPayload`,
  `RunAppendRejectedPayload` (carrying `failureCode: RunAppendFailureCode`), `RunLogTailRepairedPayload`
  (`storageHealth: "log-tail-repaired"`) - evidence: `run-payloads.unit.test.ts` constructs each from a
  valid fixture and a negative fixture (`lifecycle-transition-bad-authority.fixture.ts`) using an
  `authority` outside `operator|policy|system|recovery` fails compilation.
- **AC-9** Each of the 7 `RunAppendFailureCode` tokens (`stale-writer-fenced`, `sequence-conflict`,
  `illegal-lifecycle-transition`, `durability-insufficient`, `partial-ack-unknown`, `interior-corrupt`,
  `event-log-unavailable`) is a member of the union and constructible as a `RunAppendFailure.code`, and
  `RunAppendFailure` carries `code`/`message`/`retryable`/optional `rejection: RunAppendRejectedPayload` -
  evidence: `run-append-failure-codes.unit.test.ts` runs an exhaustiveness `never` switch over
  `RunAppendFailureCode` (one fixture per token asserting it is the produced `RunAppendFailure.code`) and a
  negative fixture (`run-append-failure-unknown-code.fixture.ts`) using a non-member literal fails
  compilation.
- **AC-10** Each of the 4 `RunReplayFailure.code` tokens (`malformed-envelope`, `interior-corrupt`,
  `event-log-unavailable`, `malformed-declared-payload`) is a member of the `code` union, and
  `RunReplayFailure` carries `code`/`message`/`healthRecords: RunLogHealthRecord[]` - evidence:
  `run-replay-failure-codes.unit.test.ts` runs an exhaustiveness `never` switch over the four `code`
  members (one fixture per token) and a negative fixture (`run-replay-failure-unknown-code.fixture.ts`)
  using a fifth `code` literal fails compilation.
- **AC-11** `RunLogHealthRecord` is the union of `RunLogCorruptionRecord`
  (`kind: "tail-repaired" | "interior-corrupt"`, `detectedAt`, optional
  `firstAffectedSequence`/`lastValidSequence`,
  `storageHealth: "log-tail-repaired" | "log-interior-corrupt"`, `detail`) and the unavailable arm
  (`kind: "event-log-unavailable"`, `detectedAt`,
  `storageHealth: "network-fs-degraded" | "read-only" | "unusable"`, `detail`) - evidence:
  `run-health-records.unit.test.ts` narrows both arms by `kind` and a negative fixture
  (`health-record-bad-storage-health.fixture.ts`) pairing `kind: "tail-repaired"` with an unavailable
  `storageHealth` literal fails compilation.
- **AC-12** Every manifest shape — `Result`, the three unions, `RunEventEnvelope`, `EvidenceEventRef`,
  `CreateRunInput`, `AppendIntent`, `RunAppendReceipt`, `RunReplay`, `RunEventCursor`,
  `WaitRunEventsRequest`, `WaitRunEventsResult`, `RunProjections` and the 4 projection types,
  `RunAppendFailureCode`, `RunAppendFailure`, `RunReplayFailure`, `RunLogHealthRecord`,
  `RunLogCorruptionRecord`, the 8 payload types, and the `RunEventLog`/`RunWriter` interfaces — is
  importable from the `sdk` package public entrypoint (not a private module path), per
  `epic0-s4-export-templates/PackageExportConvention` - evidence: `run-log-public-import.unit.test.ts`
  imports every shape from the `sdk` entrypoint and constructs one conforming `RunEventEnvelope` and one
  `RunAppendReceipt` fixture.
- **AC-13** The contract source is type-only — it declares no `RunEventLog`/`RunWriter` runtime
  implementation, imports no fnd-02 runtime module, driver, process, or network client, and does not
  redeclare `DurabilityClass`, `StorageHealth`, or `LeaseCapability` - evidence: the forbidden-symbol
  sweep below over `packages/sdk/src/core/run-lifecycle/contracts/` reports zero matches (exit code 1, no
  lines), captured into the evidence pack.

### Dependencies And Frozen Inputs

- Covers signals: "Run event envelope and append receipt vocabulary" (and, per the story-DAG row, this
  story is the catalog owner of the cursor, projection, payload, lifecycle-state, and failure-token
  types every other core-01/core-02/core-07/edge-01 story cites).
- Depends on: none (no intra-epic producer edge — this is the band-1 root contract).
- Depended on by: `core-01-s2`, `core-01-s3`, `core-01-s4`, `core-01-s5`, `core-01-s6`, `core-02-s2`,
  `core-02-s3`, `core-07-s1`, `core-07-s2`, `core-07-s3`, `edge-01-s1`, `edge-01-s2`.
- Shared shapes consumed (cross-epic frozen inputs, referenced not redeclared):
  `fnd-02-s2-event-log/DurabilityClass` (`RunDurabilityClass` is its no-`buffered` subset),
  `fnd-02-s1-storage-health/StorageHealth` (`RunDegradedHealth` maps over it),
  `fnd-02-s3-lease-store/LeaseCapability` (consumed in `RunEventLog.createRun`/`openWriter` and
  `RunWriter.renew`).

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

### Non-Goals

- The `replay()` behavior — `RunReplay` assembly, envelope validation, tail/interior/unavailable health
  classification — owned by `core-01-s2-replay-and-corruption`.
- The lifecycle legal-transition table, terminal guardrails, and session-linkage rules (the invariant
  catalog over the lifecycle/linkage payloads) — owned by `core-01-s3-lifecycle-and-linkage`.
- The concrete `RunEventLog` / `RunWriter` implementation: leased writer, epoch fencing, monotonic
  sequence, atomic-batch durability, transition enforcement, lost-ack recovery — owned by
  `core-01-s4-run-event-log-and-writer`.
- The pure `state`/`summary`/`metrics`/`launch` `project()` reducers — owned by `core-01-s5-projections`.
- The `waitRunEvents()` bounded poll-over-replay behavior — owned by `core-01-s6-cursor-wait`.
- The fnd-02 `DurabilityClass`, `StorageHealth`, and `LeaseCapability` shapes — owned by Epic 1
  (`fnd-02-s2`/`s1`/`s3`); referenced as frozen inputs, never redeclared.

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/core/run-lifecycle/contracts` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/contracts/**`, `packages/sdk/tests/core/run-lifecycle/contracts/**`.
- Forbidden dependencies: no `testkit`, no `provider-*`, no `cli`/`mcp`, no fnd-02 runtime module, no
  driver / network client / `execa` / `child_process`; do not redeclare `DurabilityClass`,
  `StorageHealth`, or `LeaseCapability` (owned by Epic 1 `fnd-02-s2`/`fnd-02-s1`/`fnd-02-s3`); do not
  declare any concrete `RunEventLog`/`RunWriter` implementation.
- STOP when: a requirement needs the `replay()` behavior or corruption classification
  (`core-01-s2-replay-and-corruption`); the lifecycle legal-transition table or session-linkage rules
  (`core-01-s3-lifecycle-and-linkage`); the concrete leased-writer/fencing/sequence/durability/lost-ack
  implementation (`core-01-s4-run-event-log-and-writer`); the pure projection reducers
  (`core-01-s5-projections`); the bounded cursor-wait behavior (`core-01-s6-cursor-wait`); or a run-log
  shape the `contracts.md` design does not name.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/run-lifecycle/contracts/**`, `packages/sdk/tests/core/run-lifecycle/contracts/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-01-s1-event-contracts](./implementer.md) · **Next →:** [Implementer Prompt: core-01-s2-replay-and-corruption](../core-01-s2-replay-and-corruption/implementer.md)

<!-- /DOCS-NAV -->
