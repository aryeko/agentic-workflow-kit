# Reviewer Prompt: core-01-s4-run-event-log-and-writer

## Assigned Routing

- Source story id: `core-01-s4-run-event-log-and-writer`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: core-01-s4-run-event-log-and-writer covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10 and carries assembled runtime write path, fencing, durability, lost-ack recovery, and facade delegation. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-01-s4-run-event-log-and-writer`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s4-run-event-log-and-writer.md`.
- Allowed pathset: `packages/sdk/src/core/run-lifecycle/log/**`, `packages/sdk/tests/core/run-lifecycle/log/**`.
- Direct dependencies: `core-01-s1-event-contracts`, `core-01-s2-replay-and-corruption`, `core-01-s3-lifecycle-and-linkage`, `core-01-s5-projections`, `core-01-s6-cursor-wait`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

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

### Dependencies And Frozen Inputs

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

### Non-Goals

- The lifecycle legal-transition table, terminal guardrails, and session-linkage rules — owned by
  `core-01-s3-lifecycle-and-linkage` (cited, never redeclared).
- `replay` internals, envelope validation, and tail/interior/unavailable health classification — owned
  by `core-01-s2-replay-and-corruption`.
- Projection math (`state` / `summary` / `metrics` / `launch`) — owned by `core-01-s5-projections`.
- Cursor poll/timeout semantics — owned by `core-01-s6-cursor-wait`.
- The contract type / interface declarations — owned by `core-01-s1-event-contracts`.
- fnd-02 frame codec, lease epoch monotonicity, byte-level repair, and storage-health classification —
  owned by Epic 1 `fnd-02`.

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/core/run-lifecycle/log`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/log/**`, `packages/sdk/tests/core/run-lifecycle/log/**`.
- Forbidden dependencies: no provider packages, no concrete storage backend, no `testkit` in production
  source, no other core domain for state authorship; do not redeclare any `core-01-s1` type or the
  `core-01-s3` transition table.
- STOP when: a shape the design does not name is required; replay internals, projection math, the
  lifecycle legal-transition table, session-linkage rules, or cursor poll/timeout semantics must be
  (re)defined here — those belong to s2/s5/s3/s6.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s4-run-event-log-and-writer.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/run-lifecycle/log/**`, `packages/sdk/tests/core/run-lifecycle/log/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-01-s4-run-event-log-and-writer](./implementer.md) · **Next →:** [Implementer Prompt: core-01-s5-projections](../core-01-s5-projections/implementer.md)

<!-- /DOCS-NAV -->
