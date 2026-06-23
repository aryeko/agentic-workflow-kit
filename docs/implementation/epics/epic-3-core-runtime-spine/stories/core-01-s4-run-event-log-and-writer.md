---
title: "core-01-s4-run-event-log-and-writer - run event log and writer implementation story"
id: "core-01-s4-run-event-log-and-writer"
epic: 3
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md"
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md"
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md"
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md"
---

# core-01-s4-run-event-log-and-writer - Run Event Log and Writer

## Purpose

Implement the concrete `RunEventLog` and `RunWriter`: the single-leased-writer write path
(`createRun` / `openWriter` / `append` / `renew`) with epoch fencing, monotonic contiguous sequence,
atomic single-batch durability, lifecycle-transition enforcement, `RunAppendRejected` authoring, and
lost-ack/partial-write recovery; and assemble the `RunEventLog` facade by delegating `replay` /
`project` / `waitRunEvents` to the s2 / s5 / s6 modules (FR-11, NFR-SAFE, NFR-DET).

## Normative design

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md` (§Core decisions; §5 — `createRun`
  commits `RunCreated` + lifecycle(`created`) in one barrier batch; §5 `waitRunEvents` is delegated, not derived here)
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` (`RunEventLog`, `RunWriter`,
  `RunAppendReceipt`, `RunAppendFailure`(`Code`), `RunAppendRejectedPayload`, `AppendIntent`, `CreateRunInput`,
  `RunEventEnvelope`, `RunDurabilityClass`)
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  (§Append protocol; §Writer-epoch fencing and partial-write recovery; §Durability classes incl. the minimum-durability table)
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  (§Failure and degraded modes — append-side tokens)
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` (scope decision 2: `RunEventLog`
  assembled here; write-path proven directly, read methods proven by a single delegation-equivalence AC)
- `docs/engineering/test-lanes.md`; `docs/design/20-sdk-and-packaging/dependency-rules.md`

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and this story implements or consumes, by name. All listed types and
the `RunEventLog` / `RunWriter` interfaces are **declared once** by `core-01-s1-event-contracts`; this
story implements them and never redeclares their fields.

- Interfaces / types implemented: `RunEventLog` (concrete factory exposing `createRun` / `openWriter`
  directly and delegating `replay` / `project` / `waitRunEvents`), `RunWriter` (`append` / `renew`).
- Types consumed (verbatim from `core-01-s1-event-contracts`): `CreateRunInput`, `AppendIntent`,
  `RunAppendReceipt`, `RunAppendFailure`, `RunAppendFailureCode`, `RunAppendRejectedPayload`,
  `RunEventEnvelope`, `RunDurabilityClass`, `RunLifecycleTransitionPayload`, `RunCreatedPayload`,
  `RunDegradedHealth`, `Result`.
- Events / append intents authored on the write path: `RunCreated` and
  `RunLifecycleTransitioned { from: null, to: "created" }` (committed together by `createRun` in one
  `barrier` batch); `RunAppendRejected` (authored by the fenced writer for in-writable rejections).
- Provider operations / commands: none (consumes the fnd-02 ports below).
- Failure and degraded tokens **raised by this story** (catalog owned by `core-01-s1`):
  `stale-writer-fenced`, `sequence-conflict`, `illegal-lifecycle-transition`, `durability-insufficient`,
  `partial-ack-unknown`. `interior-corrupt` and `event-log-unavailable` surface through `s2` replay /
  fnd-02 health and are returned as `RunAppendFailure`, not authored by this writer.
- Evidence records / attestations: the committed `RunAppendReceipt` (sequence range, writer epoch,
  effective durability, payload digests, fnd-02 frame digest, log health); a `RunAppendRejected`
  envelope for in-writable semantic rejections.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Implement `createRun(input)`: acquire the first `run-writer:<runId>` lease via fnd-02 `LeaseStore`,
  then commit one `barrier` batch containing `RunCreated` plus
  `RunLifecycleTransitioned { from: null, to: "created" }` referencing the `RunCreated` event id;
  return the active `RunWriter`.
- Implement `openWriter(runId, lease)`: bind an active `RunWriter` to the supplied `LeaseCapability`
  whose epoch fences appends.
- Implement `RunWriter.append(batch)` validating, before any fnd-02 append: envelope `writerEpoch`
  equals the lease epoch; sequences are contiguous and begin at `lastCommittedSequence + 1`; every
  `RunLifecycleTransitioned` is legal per the `core-01-s3` table; `created` / `configured` /
  `task-snapshotted` transitions reference the factual `RunCreated` / `RunPolicyBound` /
  `TaskSnapshotRecorded` event ids in the same committed history; terminal lifecycle events are
  idempotent only by exact `eventId` and digest; session-linkage ordinals are monotonic; requested
  durability is sufficient per the minimum-durability table.
- Normalize each `append` to one atomic fnd-02 `AppendBatch` at the **strongest** requested durability
  (`barrier` stronger than `durable`); serialize that effective durability onto every envelope and onto
  the `RunAppendReceipt`; never split one `append` into multiple fnd-02 appends; never return fnd-02
  `NonDurableAck`; reject any `buffered` request before storage append.
- Implement `RunWriter.renew(lease)`: return a fresh active `RunWriter` bound to the renewed
  `LeaseCapability`.
- Enforce writer-epoch fencing: a stale writer (lease no longer fences current, including after
  terminal or superseded epochs) cannot append.
- Recover lost acks / partial writes via `core-01-s2` `replay`: replay → reacquire/renew → report
  committed when the lost batch appears with identical ids and digests; append fresh at the next
  sequence when absent; fail `sequence-conflict` when a conflicting id or digest appears.
- Author `RunAppendRejected` by the currently fenced writer for `illegal-lifecycle-transition` and
  `durability-insufficient` while the log remains writable; return `stale-writer-fenced`,
  `interior-corrupt`, and `event-log-unavailable` as `RunAppendFailure` only (never self-recorded).
- Assemble the `RunEventLog` facade: delegate `replay` to `core-01-s2`, `project` to `core-01-s5`, and
  `waitRunEvents` to `core-01-s6`, returning their results unchanged.

## Out of scope

- The lifecycle legal-transition table, terminal guardrails, and session-linkage rules — owned by
  `core-01-s3-lifecycle-and-linkage` (cited, never redeclared).
- `replay` internals, envelope validation, and tail/interior/unavailable health classification — owned
  by `core-01-s2-replay-and-corruption`.
- Projection math (`state` / `summary` / `metrics` / `launch`) — owned by `core-01-s5-projections`.
- Cursor poll/timeout semantics — owned by `core-01-s6-cursor-wait`.
- The contract type / interface declarations — owned by `core-01-s1-event-contracts`.
- fnd-02 frame codec, lease epoch monotonicity, byte-level repair, and storage-health classification —
  owned by Epic 1 `fnd-02`.

## Dependencies and frozen inputs

- Covers signals: Single leased writer, writer epoch fencing, monotonic sequence, and stale-writer
  rejection (from the `core-01` charter).
- Depends on: `core-01-s1-event-contracts`, `core-01-s2-replay-and-corruption`,
  `core-01-s3-lifecycle-and-linkage`, `core-01-s5-projections`, `core-01-s6-cursor-wait` (band 4).
- Depended on by: Epic 4 (approval/liveness) and Epic 5 (completion/recovery) consume the assembled
  `RunEventLog` and its writer behaviors.
- Shared shapes consumed (cited verbatim, never redeclared):
  - `core-01-s1-event-contracts/RunEventLog`, `core-01-s1-event-contracts/RunWriter`,
    `core-01-s1-event-contracts/CreateRunInput`, `core-01-s1-event-contracts/AppendIntent`,
    `core-01-s1-event-contracts/RunAppendReceipt`, `core-01-s1-event-contracts/RunAppendFailure`,
    `core-01-s1-event-contracts/RunAppendFailureCode`,
    `core-01-s1-event-contracts/RunAppendRejectedPayload`,
    `core-01-s1-event-contracts/RunEventEnvelope`, `core-01-s1-event-contracts/RunDurabilityClass`,
    `core-01-s1-event-contracts/RunLifecycleTransitionPayload`,
    `core-01-s1-event-contracts/RunCreatedPayload`, `core-01-s1-event-contracts/RunDegradedHealth`,
    `core-01-s1-event-contracts/Result`.
  - `core-01-s2-replay-and-corruption/replay()` (for lost-ack recovery and `RunEventLog.replay`
    delegation).
  - `core-01-s3-lifecycle-and-linkage/{legal-transition table, session-ordinal rule}` (transition
    legality and session-ordinal monotonicity enforcement at append).
  - `core-01-s5-projections/project()` (for `RunEventLog.project` delegation).
  - `core-01-s6-cursor-wait/waitRunEvents()` (for `RunEventLog.waitRunEvents` delegation).
- Frozen Epic 1 inputs (named, not edges): `fnd-02` `LeaseStore`, `LeaseCapability`, `EventLogStore`,
  `AppendBatch`, `AppendReceipt`, `NonDurableAck`, `DurabilityClass`. Injected as ports; the writer
  never returns `NonDurableAck` and never requests `buffered`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single falsifiable assertion. Every negative AC names its own failing fixture
(fault-injected deterministic in-memory fnd-02). Happy-path ACs prove only acceptance.

- **AC-1** `createRun(input)` acquires the first `run-writer:<input.runId>` lease, then commits exactly
  one fnd-02 `AppendBatch` at `barrier` durability containing two envelopes — `RunCreated` followed by
  `RunLifecycleTransitioned { from: null, to: "created" }` whose `sourceEventIds` includes the
  `RunCreated` `eventId` — at sequences 1 and 2, and returns an active `RunWriter` - evidence:
  `create-run-barrier-batch.unit.test.ts` asserts one injected-store append call, `durability === "barrier"`,
  two envelopes in that order, `sequence` 1 then 2, and the transition's `sourceEventIds` containing the
  `RunCreated` `eventId`.
- **AC-2** `RunWriter.append(batch)` rejects an envelope whose `writerEpoch` differs from the bound
  lease epoch (and any append by a writer whose lease no longer fences current, including post-terminal
  and post-superseded epochs) with `RunAppendFailure.code === "stale-writer-fenced"` and performs zero
  fnd-02 append calls - evidence: `fencing-stale-writer.unit.test.ts` injects a superseded lease epoch and
  asserts `code === "stale-writer-fenced"` with the store append spy uncalled.
- **AC-3** `RunWriter.append(batch)` whose first envelope sequence is not `lastCommittedSequence + 1`,
  or whose batch sequences are not contiguous, returns `RunAppendFailure.code === "sequence-conflict"`
  before any fnd-02 append - evidence: `append-sequence-contiguous.unit.test.ts` asserts a gap and a
  wrong-start batch each yield `code === "sequence-conflict"` with the store append spy uncalled.
- **AC-4** A successful `append` of mixed-durability intents constructs exactly one fnd-02 `AppendBatch`
  whose `durability` is the strongest requested value (`barrier` when any intent is `barrier`, else
  `durable`), serializes that same effective value onto every committed `RunEventEnvelope.durability` and
  onto `RunAppendReceipt.durability`, and never issues a second fnd-02 append for the call - evidence:
  `append-atomic-strongest-durability.unit.test.ts` feeds one `durable` + one `barrier` intent and asserts
  a single store append with `durability === "barrier"`, both envelopes' `durability === "barrier"`, and
  `receipt.durability === "barrier"`.
- **AC-5** A `RunLifecycleTransitioned` intent illegal from the current replayed state per the
  `core-01-s3` table returns `RunAppendFailure.code === "illegal-lifecycle-transition"`, and while the
  log remains writable the fenced writer authors a `RunAppendRejected` envelope at `durable` durability
  whose `RunAppendRejectedPayload.failureCode === "illegal-lifecycle-transition"` - evidence:
  `append-illegal-transition.unit.test.ts` attempts `created -> running` and asserts the failure code plus a
  committed `RunAppendRejected` envelope with `payload.failureCode === "illegal-lifecycle-transition"` and
  `durability === "durable"`.
- **AC-6** An `append` requesting weaker-than-required durability for an event type returns
  `RunAppendFailure.code === "durability-insufficient"`, evaluated **per intent** so a terminal
  `RunLifecycleTransitioned` requested as `durable` is rejected even when another intent in the same batch
  requests `barrier` - evidence: `append-min-durability-table.unit.test.ts` submits a batch with a
  `barrier` non-terminal intent and a terminal `settling -> completed` intent requested as `durable` and
  asserts `code === "durability-insufficient"` with the store append spy uncalled.
- **AC-7** An `append` of a canonical run event requesting fnd-02 `buffered` durability is rejected
  before any storage append and `RunWriter.append` never returns a result derived from fnd-02
  `NonDurableAck` - evidence: `append-rejects-buffered.unit.test.ts` asserts a `buffered` request yields a
  `RunAppendFailure` with the store append spy uncalled, and that no code path maps `NonDurableAck` to a
  `RunAppendReceipt`.
- **AC-8** After a lost acknowledgement, recovery via `core-01-s2` `replay` is exact: when the lost batch
  is present with identical event ids and payload digests the writer reports it committed (no new append);
  when absent it appends a fresh batch at the next sequence; when a conflicting id or digest is present it
  returns `RunAppendFailure.code === "sequence-conflict"` (and `partial-ack-unknown` is the code surfaced
  for the unresolved lost-ack state before replay decides) - evidence:
  `recovery-lost-ack.unit.test.ts` drives all three replay states and asserts committed-reported,
  fresh-append-at-next-sequence, and `code === "sequence-conflict"` respectively, plus a
  `partial-ack-unknown` case for the pre-replay unresolved state.
- **AC-8b** When `core-01-s2` replay (or fnd-02 health) surfaces `interior-corrupt` or
  `event-log-unavailable` during an append or recovery attempt, the writer RETURNS
  `RunAppendFailure.code === "interior-corrupt"` (or `"event-log-unavailable"`) to the caller and
  performs zero fnd-02 append calls and zero `RunAppendRejected` authorships — these codes are returned,
  not self-recorded - evidence: `recovery-returned-not-self-recorded.unit.test.ts` injects a
  fault-injected in-memory fnd-02 that reports `"interior-corrupt"` for one fixture and
  `"event-log-unavailable"` for another; asserts `code === "interior-corrupt"` (respectively
  `"event-log-unavailable"`), the store append spy is uncalled for the `RunAppendRejected` path, and
  no `RunAppendRejected` envelope appears in the committed log.
- **AC-9** A terminal `RunLifecycleTransitioned` is idempotent only by exact `eventId` and
  `payloadDigest`: re-appending the identical terminal envelope reports committed without a second fnd-02
  append, while a differing `eventId` or digest for the same terminal target fails
  `illegal-lifecycle-transition` and the terminal state is never represented as mutable - evidence:
  `append-terminal-idempotent.unit.test.ts` asserts an identical re-append makes zero new store appends and
  a digest-mismatched terminal re-append returns `code === "illegal-lifecycle-transition"`.
- **AC-10** `RunEventLog.replay(runId)`, `.project(runId)`, and `.waitRunEvents(request)` return results
  identical to calling `core-01-s2/replay()`, `core-01-s5/project()`, and `core-01-s6/waitRunEvents()`
  directly on the same log and inputs (delegation equivalence; the underlying behaviors are proven in
  s2/s5/s6) - evidence: `runeventlog-delegation-equivalence.unit.test.ts` asserts deep-equality of each
  facade method against a direct call to the corresponding module over a shared fixture log.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `createRun` acquires first lease + commits `RunCreated` + lifecycle(`created`) in one barrier batch | AC-1 |
| `RunCreated` + `RunLifecycleTransitioned{null->created}` authored events | AC-1 |
| `openWriter`/`createRun` bind an active `RunWriter` to a `LeaseCapability` | AC-1, AC-2 |
| Writer-epoch fencing; stale writer (incl. terminal/superseded) cannot append | AC-2 |
| Monotonic contiguous sequence from `lastCommittedSequence + 1` | AC-3 |
| Atomic one-batch normalization at strongest requested durability; serialize onto envelopes + receipt | AC-4 |
| Lifecycle-transition legality enforced per `core-01-s3` table | AC-5 |
| `RunAppendRejected` authored by fenced writer for in-writable rejections | AC-5 |
| Per-intent minimum-durability enforcement (terminal `durable` rejected even with sibling `barrier`) | AC-6 |
| Reject `buffered`; never return `NonDurableAck` | AC-7 |
| Lost-ack / partial-write recovery via `s2` replay (committed / absent / conflict) | AC-8 |
| Terminal idempotency by exact `eventId`+digest; terminal closure unrepresentable-as-mutable | AC-9 |
| `RunWriter.renew(lease)` rebinds the active writer to a renewed capability | AC-8 |
| `RunEventLog` facade delegates `replay`/`project`/`waitRunEvents` to s2/s5/s6 | AC-10 |
| `RunAppendReceipt` evidence (seq range, epoch, durability, digests, frame digest, health) | AC-1, AC-4 |
| `RunAppendRejectedPayload` shape (`failureCode`, attempted refs) | AC-5 |
| Tokens: `stale-writer-fenced` / `sequence-conflict` / `illegal-lifecycle-transition` / `durability-insufficient` / `partial-ack-unknown` | AC-2 / AC-3 / AC-5 / AC-6 / AC-8 |
| `interior-corrupt` / `event-log-unavailable` returned (not self-recorded) | AC-8b |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `stale-writer-fenced` | The writer's lease no longer fences current (different epoch/token, or terminal/superseded epoch). | Reject the append before any fnd-02 append; return `RunAppendFailure`; do **not** self-record a rejection. | AC-2 |
| `sequence-conflict` | First/contiguous batch sequence != `lastCommittedSequence + 1`, or recovery replay finds a conflicting id/digest. | Reject before write (or fail closed on recovery); caller must replay. | AC-3, AC-8 |
| `illegal-lifecycle-transition` | A `RunLifecycleTransitioned` intent is illegal from the replayed state per the `core-01-s3` table (incl. terminal-target digest mismatch). | Reject the append; while writable, author a `RunAppendRejected` at `durable`. | AC-5, AC-9 |
| `durability-insufficient` | Any intent requests weaker durability than its event type requires (per the minimum-durability table; evaluated per intent). | Reject the append before write; while writable, author a `RunAppendRejected` at `durable`. | AC-6 |
| `partial-ack-unknown` | The caller lost acknowledgement and the committed-vs-absent state is not yet resolved. | Surface `partial-ack-unknown`; resolve by replay (committed / fresh-append / `sequence-conflict`). | AC-8 |
| `interior-corrupt` | `core-01-s2` replay / fnd-02 health reports incoherent committed history. | Refuse authoritative append; return `RunAppendFailure` with `code === "interior-corrupt"` to the caller; never author a `RunAppendRejected` for this code; never self-record. | AC-8b |
| `event-log-unavailable` | fnd-02 storage health prevents durable append or replay. | Refuse authoritative append; return `RunAppendFailure` with `code === "event-log-unavailable"` to the caller; never author a `RunAppendRejected` for this code; never self-record. | AC-8b |

## Quality bar

- Coverage scope and threshold: the run-event-log write-path + facade modules under
  `packages/sdk/src/core/run-lifecycle/log/**` at 90% minimum, aiming for 95%.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit lane for
  the aggregate gate; for a focused per-story report use
  `pnpm exec vitest run --project unit --coverage --passWithNoTests -- packages/sdk/tests/core/run-lifecycle/log/*.unit.test.ts`.
- Required tests, catalogued by AC and failure row: `create-run-barrier-batch` (AC-1),
  `fencing-stale-writer` (AC-2, `stale-writer-fenced`), `append-sequence-contiguous` (AC-3,
  `sequence-conflict`), `append-atomic-strongest-durability` (AC-4), `append-illegal-transition`
  (AC-5, `illegal-lifecycle-transition`), `append-min-durability-table` (AC-6,
  `durability-insufficient`), `append-rejects-buffered` (AC-7), `recovery-lost-ack` (AC-8,
  `partial-ack-unknown` / `sequence-conflict`), `recovery-returned-not-self-recorded` (AC-8b,
  `interior-corrupt` / `event-log-unavailable`),
  `append-terminal-idempotent` (AC-9), `runeventlog-delegation-equivalence` (AC-10); plus property
  tests: `prop-monotonic-sequence` (contiguous monotonic sequence across generated valid batches),
  `prop-fencing` (no stale-epoch writer ever appends), `prop-lost-ack` (replay-decides recovery is
  total over committed/absent/conflict). All `*.unit.test.ts`, hermetic.
- Exact commands:
  `pnpm test:unit -- packages/sdk/tests/core/run-lifecycle/log/*.unit.test.ts`; `pnpm check`; coverage
  via `pnpm coverage:baseline` or the focused command above.
- Public exposure (import path + public-import test): the concrete `RunEventLog` factory and `RunWriter`
  are reachable through the `sdk` public entrypoint per
  `epic0-s4-export-templates/PackageExportConvention` (export + barrel + `exports`). Proven by
  `log-public-import.unit.test.ts` importing the factory through `sdk` (not a private path) and
  constructing a writer.
- Determinism constraints: clock, id generation, randomness, the fnd-02 `LeaseStore`/`EventLogStore`
  ports, and the s2/s3/s5/s6 modules are injected; no ambient `Date.now`/`new Date`/`Math.random`/
  `crypto.randomUUID` (per `dependency-rules.md`).
- Dependency boundaries: `sdk → pure libs only`; this module imports `core-01-s1` types and the
  s2/s3/s5/s6 modules plus the injected fnd-02 ports; it imports no provider package, no concrete
  storage backend, and no `testkit` in production source (test files only).
- File-size budget (lines per named file):
  - `append-writer.ts` (append validation, fencing, sequence, and durability normalization) <= 220.
  - `create-run.ts` (`createRun` composer and first-lease bootstrap) <= 160.
  - `lost-ack-recovery.ts` (replay-driven committed/absent/conflict recovery) <= 180.
  - `run-event-log.ts` (`RunEventLog` facade, `openWriter`, and read-method delegation) <= 180.
  - `append-rejected.ts` (`RunAppendRejected` payload builder for in-writable semantic rejections)
    <= 120.
- Domain non-negotiables: one `append` == one atomic fnd-02 `AppendBatch` (never split); canonical run
  events are only `durable` or `barrier` (`buffered` rejected, `NonDurableAck` never returned); a stale
  writer can never append (epoch fencing is the safety mechanism); terminal closure is
  unrepresentable-as-mutable; `RunAppendRejected` is authored only by the fenced writer for in-writable
  rejections.

### Forbidden-symbol sweep (runnable recipe)

```sh
grep -REn \
  "provider-(codex|local|github|markdown)|/cli/|/mcp/|testkit|child_process|node:child_process|execa|Date\.now\(|new Date\(|Math\.random\(|crypto\.randomUUID\(|interface RunWriter|interface RunEventLog|legal.*transition.*table|type RunLifecycleState\b" \
  packages/sdk/src/core/run-lifecycle/log/
```

- Path root: `packages/sdk/src/core/run-lifecycle/log/`.
- Forbidden-token set:
  - Provider leakage: `provider-(codex|local|github|markdown)`, `/cli/`, `/mcp/`, `testkit`,
    `child_process`, `node:child_process`, `execa`.
  - Ambient nondeterminism: `Date.now(`, `new Date(`, `Math.random(`, `crypto.randomUUID(`.
  - Redeclaration guards (s4 must not re-declare the s1 contract or the s3 table):
    `interface RunWriter`, `interface RunEventLog`, `legal.*transition.*table`,
    `type RunLifecycleState\b`.
- Expected result: zero matches (exit code 1, no lines), output captured into the evidence pack. Any
  match means a forbidden dependency, ambient side-effect, or s1/s3 contract redeclaration has leaked
  into the log module and this story fails its dependency-boundary gate.

## Required reading

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/README.md`
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md`
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
- `core-01-s1-event-contracts` story contract (shared type producer)
- `core-01-s2-replay-and-corruption`, `core-01-s3-lifecycle-and-linkage`, `core-01-s5-projections`,
  `core-01-s6-cursor-wait` story contracts (delegated/cited behaviors)
- `docs/design/20-sdk-and-packaging/storage-port-types.md` (`LeaseStore`, `EventLogStore`,
  `LeaseCapability`, `AppendBatch`, `AppendReceipt`, `NonDurableAck`, `DurabilityClass`)
- `docs/design/20-sdk-and-packaging/dependency-rules.md`; `docs/engineering/test-lanes.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk/src/core/run-lifecycle/log` modules providing the concrete `RunEventLog` factory and
`RunWriter` (write path + delegating facade) reachable through the `sdk` entrypoint, plus the evidence
pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued above).
- Test name or artifact proving each failure/degraded row, each with its own fault-injected fixture.
- Negative fixture for every rejection claim (`stale-writer-fenced`, `sequence-conflict`,
  `illegal-lifecycle-transition`, `durability-insufficient`, `partial-ack-unknown`, `buffered`); no
  green tool exit cited for a rejection.
- Returned-not-self-recorded fixtures: `recovery-returned-not-self-recorded.unit.test.ts` with two
  fault variants — one injecting `"interior-corrupt"` and one injecting `"event-log-unavailable"` —
  each asserting `RunAppendFailure` is returned to the caller, zero `RunAppendRejected` envelopes are
  authored, and zero fnd-02 append calls for the `RunAppendRejected` path (AC-8b).
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented unit lane, and number for the stated `log/**` scope.
- Public-import test result (`log-public-import.unit.test.ts`) importing the `RunEventLog` factory and
  `RunWriter` through `sdk`.
- Forbidden-symbol sweep: the exact command from the Quality bar `### Forbidden-symbol sweep` block,
  path root `packages/sdk/src/core/run-lifecycle/log/`, forbidden-token set as listed, and zero-match
  output captured.
- Conformance evidence is via the deterministic in-memory fnd-02 mock with fault injection; no real
  process, network, or filesystem (write-path stories are hermetic unit tests).

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/core/run-lifecycle/log`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/log/**`, `packages/sdk/tests/core/run-lifecycle/log/**`.
- Forbidden dependencies: no provider packages, no concrete storage backend, no `testkit` in production
  source, no other core domain for state authorship; do not redeclare any `core-01-s1` type or the
  `core-01-s3` transition table.
- STOP when: a shape the design does not name is required; replay internals, projection math, the
  lifecycle legal-transition table, session-linkage rules, or cursor poll/timeout semantics must be
  (re)defined here — those belong to s2/s5/s3/s6.

## Characterization Review

Architect-recorded review of this contract's load-bearing scope decisions. Each entry records
rationale, the design line it traces to, the falsification criterion, and the escalation path.

### Decision: run-event-log-assembled-here

- Rationale: `core-01-s4` owns the concrete writer and facade composition while `core-01-s1` owns the
  interfaces; this keeps the runtime object behind the already-stable type surface.
- Design trace: `story-dag.md` scope decision `run-event-log-assembled-in-s4`;
  `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` (`RunEventLog` /
  `RunWriter` declarations).
- Falsification: any other story constructs the concrete `RunEventLog` facade, or this story declares
  new `RunEventLog` / `RunWriter` fields.
- Escalation: if assembly requires changing the interface, return to `core-01-s1` and the DAG scope
  decision before implementing.

### Decision: read-methods-delegated-to-s5-s6-and-s2

- Rationale: `s4` proves write-path behavior and delegation equivalence only; replay, projections, and
  cursor wait retain their own acceptance criteria and failure semantics.
- Design trace: `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  (writer and `createRun` behavior); `story-dag.md` dependency table for `s4` delegation edges.
- Falsification: `s4` re-implements replay, projection, or cursor polling internals instead of calling
  the owning modules.
- Escalation: if a delegated method fails to meet facade needs, raise a dependency or contract defect
  against the owning behavior story; do not absorb it into `s4`.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - stories](./README.md) · **← Prev:** [core-01-s3-lifecycle-and-linkage - lifecycle legal-transition table and session linkage rules implementation story](./core-01-s3-lifecycle-and-linkage.md) · **Next →:** [core-01-s5-projections - projections implementation story](./core-01-s5-projections.md)

<!-- /DOCS-NAV -->
