# Implementer Prompt: core-01-s1-event-contracts

## Assigned Routing

- Source story id: `core-01-s1-event-contracts`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-01-s1-event-contracts covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13 and carries public shared run-log contract surface and single-producer type catalog consumed by the rest of Epic 3. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-01-s1-event-contracts` for epic `epic-3-core-runtime-spine`. Deliver exactly the outcome in the ready source contract and nothing outside it:

The `packages/sdk` host-neutral run-log contract surface — `Result`, the three core unions,
`RunEventEnvelope`/`EvidenceEventRef`, the input/intent/receipt types, the replay/cursor/wait types, the
`RunProjections` set, the failure tokens and types, the health/corruption records, the 8 payload types,
and the `RunEventLog`/`RunWriter` interfaces — declared type-only, split into focused files, exposed on the
`sdk` public entrypoint, referencing the frozen fnd-02 `DurabilityClass`/`StorageHealth`/`LeaseCapability`
without redeclaring them, plus the evidence pack.

## Why It Matters

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

The DAG dependents for this story are: `core-01-s2-replay-and-corruption`, `core-01-s3-lifecycle-and-linkage`, `core-01-s4-run-event-log-and-writer`, `core-01-s5-projections`, `core-01-s6-cursor-wait`, `core-02-s2-gate-evaluator`, `core-02-s3-gate-record-durability`, `core-07-s1-telemetry-and-metrics`, `core-07-s2-analyzer`, `core-07-s3-analysis-records-and-reports`, `edge-01-s1-operator-command-contract`, `edge-01-s2-cli-mcp-parity-smoke`. Preserve the producer/consumer shape boundaries named above so later stories can consume committed dependency inputs without re-declaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md` — source story contract for `core-01-s1-event-contracts`.
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` — frozen DAG row, dependencies, owned pathset, wave, and suggested-tier floor for `core-01-s1-event-contracts`.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` (the full type catalog).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` §5–§6, §8 (createRun/cursor/
  wait semantics, the durability/health mapping notes, the named fail-closed modes).
- `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md` (fnd-02 `DurabilityClass`,
  `StorageHealth`, `LeaseCapability` — the frozen inputs referenced).
- `docs/design/20-sdk-and-packaging/dependency-rules.md`, `sdk-boundary.md`.
- `epic0-s4-export-templates` story contract (the `PackageExportConvention` for the public `sdk`
  entrypoint).
- `docs/engineering/test-lanes.md` (the hermetic `*.unit.test.ts` lane).

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.
- `{{DEPENDENCY_COMMITS}}` — runtime slot for committed dependency story inputs when this story has dependencies.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`.

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

## Allowed Writes

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/run-lifecycle/contracts/**`
- `packages/sdk/tests/core/run-lifecycle/contracts/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: none.

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

Use `{{DEPENDENCY_COMMITS}}` for dependency commits that can only exist during execution. Import only producer-owned public shapes and paths named by the DAG or source contract.

## Non-Goals And STOP Conditions

### Source Out Of Scope

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

### Source Boundaries And STOP Conditions

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

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Declare `Result<TValue, TFailure>` as the `{ ok: true; value: TValue } | { ok: false; error: TFailure }`
  discriminated union used by every `RunEventLog` / `RunWriter` operation.
- Declare `RunDurabilityClass`, `RunLifecycleState` (all 15 states), and `RunDegradedHealth` as unions
  with exactly the design's members and no others, kept distinct from each other and from fnd-02 types.
- Declare `RunEventEnvelope<TPayload>` with the design fields and the frozen `schema` literal
  `"kit-vnext.run-event.v1"`, and `EvidenceEventRef` as the stable sibling reference into the envelope.
- Declare `CreateRunInput`, `AppendIntent<TPayload>`, and `RunAppendReceipt` with the design fields,
  preserving the `AppendIntent.durability` (requested) vs `RunAppendReceipt.durability` (effective batch)
  distinction.
- Declare `RunReplay`, `RunEventCursor`, `WaitRunEventsRequest`, and `WaitRunEventsResult` with the design
  fields, including the sequence-based `RunEventCursor`.
- Declare `RunProjections` and the four projection types (`RunStateProjection`, `RunSummaryProjection`,
  `RunMetricsProjection`, `RunLaunchProjection`) with the design fields.
- Declare `RunAppendFailureCode` (7 members), `RunAppendFailure`, and `RunReplayFailure` (4 `code`
  members) — the failure-token catalog this story owns.
- Declare `RunLogHealthRecord` and `RunLogCorruptionRecord` with the design fields and storage-health
  literals.
- Declare the 8 payload types with the design fields and member literals.
- Declare the `RunEventLog` (5 operations) and `RunWriter` (2 operations) interfaces with exactly the
  design signatures, consuming the frozen `fnd-02-s3-lease-store/LeaseCapability` without redeclaring it.
- Export the full type catalog from the `sdk` public entrypoint with no private-module imports, per
  `epic0-s4-export-templates/PackageExportConvention`.

### Source Spec Surface

What the normative design defines and the implementation must expose, by the design's exact names
(runtime-types variant). This story DECLARES all of these as host-neutral type-only contracts; it
implements none of the behaviors (those are `core-01-s2`/`s3`/`s4`/`s5`/`s6`).

- Interfaces:
  - `RunEventLog` — `createRun(input: CreateRunInput): Result<RunWriter, RunAppendFailure>`,
    `openWriter(runId: string, lease: LeaseCapability): Result<RunWriter, RunAppendFailure>`,
    `replay(runId: string): Result<RunReplay, RunReplayFailure>`,
    `waitRunEvents(request: WaitRunEventsRequest): Result<WaitRunEventsResult, RunReplayFailure>`,
    `project(runId: string): Result<RunProjections, RunReplayFailure>`.
  - `RunWriter` — `append(batch: AppendIntent[]): Result<RunAppendReceipt, RunAppendFailure>`,
    `renew(lease: LeaseCapability): Result<RunWriter, RunAppendFailure>`.
- Generic / result types: `Result<TValue, TFailure>` (the `{ ok: true; value } | { ok: false; error }`
  discriminated union).
- Unions: `RunDurabilityClass` (`"durable" | "barrier"`); `RunLifecycleState` (the 15 members `"created" |
  "configured" | "task-snapshotted" | "workspace-ready" | "worker-starting" | "running" | "parked" |
  "runner-verifying" | "forge-waiting" | "merge-waiting" | "settling" | "completed" | "blocked" |
  "failed" | "canceled"`); `RunDegradedHealth` (`"ok" | "tail-repaired" | "interior-corrupt" |
  "event-log-unavailable"`).
- Envelope / reference types: `RunEventEnvelope<TPayload = unknown>` (with the `schema` literal
  `"kit-vnext.run-event.v1"`); `EvidenceEventRef`.
- Input / intent / receipt types: `CreateRunInput`, `AppendIntent<TPayload = unknown>`,
  `RunAppendReceipt`.
- Replay / cursor / wait types: `RunReplay`, `RunEventCursor`, `WaitRunEventsRequest`,
  `WaitRunEventsResult`.
- Projection types: `RunProjections`, `RunStateProjection`, `RunSummaryProjection`,
  `RunMetricsProjection`, `RunLaunchProjection`.
- Failure types: `RunAppendFailureCode` (union), `RunAppendFailure`, `RunReplayFailure`.
- Health / corruption records: `RunLogHealthRecord`, `RunLogCorruptionRecord`.
- Payload types (8): `RunCreatedPayload`, `RunPolicyBoundPayload`, `TaskSnapshotRecordedPayload`,
  `RunLifecycleTransitionPayload`, `SessionLinkedPayload`, `SessionLinkSupersededPayload`,
  `RunAppendRejectedPayload`, `RunLogTailRepairedPayload`.
- Failure / degraded tokens this catalog OWNS (declares; behavior stories raise them):
  - `RunAppendFailureCode` members (7): `stale-writer-fenced`, `sequence-conflict`,
    `illegal-lifecycle-transition`, `durability-insufficient`, `partial-ack-unknown`, `interior-corrupt`,
    `event-log-unavailable`.
  - `RunReplayFailure.code` members (4): `malformed-envelope`, `interior-corrupt`,
    `event-log-unavailable`, `malformed-declared-payload`.
- Frozen-input relationships (referenced, NOT redeclared):
  - `RunDurabilityClass` is the no-`buffered` subset of `fnd-02-s2-event-log/DurabilityClass`.
  - `RunDegradedHealth` maps over `fnd-02-s1-storage-health/StorageHealth`: `log-tail-repaired ->
    tail-repaired`, `log-interior-corrupt -> interior-corrupt`, and `network-fs-degraded | read-only |
    unusable -> event-log-unavailable`.
  - `RunEventLog.createRun`/`openWriter` and `RunWriter.renew` consume
    `fnd-02-s3-lease-store/LeaseCapability`.

Done requires every item here present with the design's names, shapes, and semantics. Coverage is
type-level only: this story ships no runtime behavior, so there is no instrumented runtime helper lane;
each shape is proven by a type-level construction fixture (a value missing a field or with a wrong type
fails compilation) plus a public-import test (per the standard's substrate note on type-only stories).

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

### Source Quality Bar

- Coverage scope and threshold: this story is type-only — the manifest shapes are interfaces, type
  aliases, and unions with no runtime behavior, so there is **no instrumented runtime helper lane** for
  this story (per the standard's substrate/type-only note). Each shape is proven by the type-level
  construction fixtures in AC-1…AC-11 (a value missing a field or using a wrong literal fails `tsc`) and
  the public-import test in AC-12. Any incidental const fixture builders used by the tests carry no
  branching logic, so a line-coverage number would be vacuous; the gradable artifact is the compile-pass
  /compile-fail fixture pair per shape.
- Coverage command and instrumented lane(s): the type-level lane is enforced by `tsc -b` within
  `pnpm check`; focused per-story run via `pnpm exec vitest run --project unit --passWithNoTests --
  packages/sdk/tests/core/run-lifecycle/contracts/*.unit.test.ts`. The negative fixtures are excluded from
  the build target and asserted to fail compilation by their own type-error tests (no runtime coverage
  number is claimed for this story).
- Required tests, catalogued by AC and failure row: `run-log-interfaces.unit.test.ts` (AC-1);
  `result-type.unit.test.ts` (AC-2); `run-unions.unit.test.ts` (AC-3); `run-envelope.unit.test.ts`
  (AC-4); `run-append-io.unit.test.ts` (AC-5); `run-replay-cursor.unit.test.ts` (AC-6);
  `run-projections.unit.test.ts` (AC-7); `run-payloads.unit.test.ts` (AC-8);
  `run-append-failure-codes.unit.test.ts` with one fixture per `RunAppendFailureCode` token (AC-9, all 7
  rows); `run-replay-failure-codes.unit.test.ts` with one fixture per `RunReplayFailure.code` token
  (AC-10, all 4 rows); `run-health-records.unit.test.ts` (AC-11); `run-log-public-import.unit.test.ts`
  (AC-12); the forbidden-symbol sweep (AC-13). Negative fixtures: `run-log-interface-missing-op.fixture.ts`,
  `result-mixed-arms.fixture.ts`, `run-envelope-bad-schema.fixture.ts`,
  `run-append-receipt-missing-frame-digest.fixture.ts`, `wait-result-missing-timed-out.fixture.ts`,
  `launch-projection-bad-linkage.fixture.ts`, `lifecycle-transition-bad-authority.fixture.ts`,
  `run-append-failure-unknown-code.fixture.ts`, `run-replay-failure-unknown-code.fixture.ts`,
  `health-record-bad-storage-health.fixture.ts`.
- Public exposure (import path + public-import test): every manifest shape (`Result`,
  `RunDurabilityClass`, `RunLifecycleState`, `RunDegradedHealth`, `RunEventEnvelope`, `EvidenceEventRef`,
  `CreateRunInput`, `AppendIntent`, `RunAppendReceipt`, `RunReplay`, `RunEventCursor`,
  `WaitRunEventsRequest`, `WaitRunEventsResult`, `RunProjections`, `RunStateProjection`,
  `RunSummaryProjection`, `RunMetricsProjection`, `RunLaunchProjection`, `RunAppendFailureCode`,
  `RunAppendFailure`, `RunReplayFailure`, `RunLogHealthRecord`, `RunLogCorruptionRecord`,
  `RunCreatedPayload`, `RunPolicyBoundPayload`, `TaskSnapshotRecordedPayload`,
  `RunLifecycleTransitionPayload`, `SessionLinkedPayload`, `SessionLinkSupersededPayload`,
  `RunAppendRejectedPayload`, `RunLogTailRepairedPayload`, `RunEventLog`, `RunWriter`) is exported from the
  `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export + barrel +
  `exports`); proven by `run-log-public-import.unit.test.ts` (AC-12).
- Determinism constraints: all shapes are pure type declarations; no clock, randomness, process, or I/O.
  All time fields (`occurredAt`, `recordedAt`, `createdAt`, `startedAt`, `detectedAt`, `repairedAt`,
  `firstRecordedAt`, `lastRecordedAt`) are caller-supplied ISO strings on the types; the contract never
  reads `Date.now`/`new Date`/`Math.random`/`crypto.randomUUID` (those belong to the injected ports used
  by behavior stories).
- Dependency boundaries: `sdk` may import only pure runtime libraries; the contract source must not import
  `testkit`, any `provider-*`, `cli`, `mcp`, any fnd-02 runtime module, driver, network client, `execa`,
  or `child_process` (`dependency-rules.md`). It references the frozen fnd-02 `LeaseCapability` /
  `DurabilityClass` / `StorageHealth` types only (type position), never redeclaring them.
- File-size budget (lines per file; default soft cap ~200): split into focused files, each ≤ 200 lines —
  e.g. `result.ts` (the `Result` type + the three core unions), `envelope.ts`
  (`RunEventEnvelope`/`EvidenceEventRef`/`CreateRunInput`/`AppendIntent`/`RunAppendReceipt`),
  `projections.ts` (`RunProjections` + 4 projection types), `payloads.ts` (the 8 payload types),
  `failures.ts` (`RunAppendFailureCode`/`RunAppendFailure`/`RunReplayFailure` +
  `RunLogHealthRecord`/`RunLogCorruptionRecord`), `replay.ts`
  (`RunReplay`/`RunEventCursor`/`WaitRunEventsRequest`/`WaitRunEventsResult`), and `interfaces.ts`
  (`RunEventLog`/`RunWriter`), with a barrel re-export.
- Domain non-negotiables: the event log is the only authored run state and projections are read-only
  outputs (the projection types are declared, never authored directly); canonical run events use only
  `durable`/`barrier` (`RunDurabilityClass` excludes `buffered`); every authored event uses the
  `RunEventEnvelope` schema literal `"kit-vnext.run-event.v1"` and a contiguous per-run sequence;
  `RunEventCursor` is sequence-based and host-neutral; the failure tokens are fail-closed (declared as a
  closed union so an unknown code is unrepresentable). This story declares the contract type-only and
  implements no behavior — append/replay/projection/wait belong to `s2`/`s3`/`s4`/`s5`/`s6`.

### Forbidden-symbol sweep (runnable recipe)

```sh
grep -REn "execa|child_process|node:net|node:http|node:https|@octokit|net\\.connect|spawn\\(|new WebSocket|EventLogStore|LeaseStore|class RunEventLog|class RunWriter|interface DurabilityClass|interface StorageHealth|interface LeaseCapability|type DurabilityClass|type StorageHealth|type LeaseCapability" \
  packages/sdk/src/core/run-lifecycle/contracts/
```

- Path root: `packages/sdk/src/core/run-lifecycle/contracts/`.
- Forbidden-token set: `execa`, `child_process`, `node:net`, `node:http`, `node:https`, `@octokit`,
  `net.connect`, `spawn(`, `new WebSocket` (process/network leaks); `EventLogStore`, `LeaseStore`
  (fnd-02 runtime module imports); `class RunEventLog`, `class RunWriter` (a behavioral implementation in
  the type-only surface); `type DurabilityClass`/`type StorageHealth`/`type LeaseCapability` and the
  `interface` variants (redeclaring a frozen fnd-02 type).
- Expected result: zero matches (exit code 1, no lines), captured into the evidence pack. A non-empty
  match means the type-only contract leaked a runtime implementation, an fnd-02 runtime import, a
  process/network dependency, or a redeclared frozen type, and fails this story.

### Source Evidence Pack

- Test name or artifact proving each AC (catalogued in the quality bar).
- Test name or artifact proving each failure/degraded row: `run-append-failure-codes.unit.test.ts` (one
  fixture per `RunAppendFailureCode` token, all 7 rows) and `run-replay-failure-codes.unit.test.ts` (one
  fixture per `RunReplayFailure.code` token, all 4 rows).
- Negative fixture for every rejection: the 10 `*.fixture.ts` files listed in the quality bar (each
  asserted to fail compilation), plus the per-token membership fixtures in AC-9/AC-10.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Type-level lane evidence: `tsc -b` passes for the conforming shapes; each negative fixture fails
  compilation (no runtime coverage number is claimed — this is a type-only story).
- Public-import test result for every exposed shape, imported through the `sdk` entrypoint
  (`run-log-public-import.unit.test.ts`).
- Forbidden-symbol sweep: the exact command above, path root, forbidden-token set, and zero-match output,
  captured.
- Conformance/runtime evidence: none — this story ships no runtime behavior; no real process, network,
  filesystem, driver, or credential is used. Behavior conformance is owned by `s2`/`s3`/`s4`/`s5`/`s6`.

Run the targeted commands and `pnpm check`, then report exact command output or an explicit blocked reason. Do not treat prose-only claims as evidence.

## Delivery Report

Return a report with changed files, AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`, `AC-12`, `AC-13`, tests and checks run, evidence pack, open questions, and blockers. The report is review evidence only; it is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Epic 3 Execution Package Plan](../../plan.md) · **Next →:** [Reviewer Prompt: core-01-s1-event-contracts](./reviewer.md)

<!-- /DOCS-NAV -->
