---
title: "core-01-s2-replay-and-corruption - replay and corruption classification implementation story"
id: "core-01-s2-replay-and-corruption"
epic: 3
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md"
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md"
  - "docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md"
---

# core-01-s2-replay-and-corruption - Replay and Corruption Classification

## Purpose

Implement the `replay(runId)` function that assembles a `core-01-s1-event-contracts/RunReplay` from
`fnd-02 EventLogStore.replay`, validates each event envelope against the `RunEventEnvelope` contract,
classifies fnd-02 storage health into the three degraded health categories, and produces the
corresponding `RunLogHealthRecord`s and `RunReplayFailure` tokens.

## Normative design

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  — §Event envelope (required envelope fields and schema), §Corruption handling (the three
  fnd-02-health-to-RunDegradedHealth mappings and their required behaviors), §Writer-epoch fencing and
  partial-write recovery (replay observes last committed sequence, epoch, ids, and digests — the
  writer's recovery calling this is core-01-s4).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  — §Failure and degraded modes (the replay-path failure tokens: `malformed-envelope`,
  `interior-corrupt`, `event-log-unavailable`, `malformed-declared-payload`; and the definition of
  `tail-repaired` as a usable-but-degraded health, not a failure); §Testing strategy (hermetic
  deterministic in-memory fnd-02 with fault injection, no real FS/network/process).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` — the type definitions
  for `RunReplay`, `RunEventEnvelope`, `RunReplayFailure`, `RunLogHealthRecord`, `RunLogCorruptionRecord`,
  `RunDegradedHealth`, and `RunLogTailRepairedPayload` consumed here.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types consumed (declared by `core-01-s1-event-contracts`; not redeclared here):
  `RunReplay`, `RunEventEnvelope`, `RunReplayFailure`, `RunLogHealthRecord`, `RunLogCorruptionRecord`,
  `RunDegradedHealth`, `RunLogTailRepairedPayload`, `RunEventCursor`.
- Provider operations consumed: `fnd-02 EventLogStore.replay(runId)` returning
  `Result<{ events: frame[], storageHealth: StorageHealth }, StorageError>` (Epic 1 frozen input).
- Failure and degraded tokens (catalog owned by `core-01-s1-event-contracts`; behavior proven here):
  - `malformed-envelope` — a committed frame decodes but the resulting object fails the
    `RunEventEnvelope` contract (missing required field, wrong schema string, non-contiguous sequence,
    or other shape violation).
  - `interior-corrupt` — fnd-02 reports `log-interior-corrupt`; replay fails closed, returning
    `RunReplayFailure { code: "interior-corrupt", healthRecords: [RunLogCorruptionRecord { kind:
    "interior-corrupt" }] }` (committed history is incoherent, so no trustworthy ordered stream can be
    served). The §Corruption-handling degraded recovery-read over read-only evidence is a separate
    core-06 path (Epic 5), not this canonical `replay()`.
  - `event-log-unavailable` — fnd-02 reports `network-fs-degraded`, `read-only`, or `unusable`;
    returns `RunReplayFailure { code: "event-log-unavailable", ... }`.
  - `malformed-declared-payload` — a frame for a core-01 declared-relevant event type (`RunLifecycleTransitioned`,
    `SessionLinked`, `SessionLinkSuperseded`, `RunLogTailRepaired`, `RunAppendRejected`) has a payload
    that fails its declared schema.
- Health classification (non-failure, degraded-but-usable):
  - `tail-repaired` — fnd-02 reports `log-tail-repaired`; appends a `RunLogCorruptionRecord` to
    `healthRecords`, sets `health = "tail-repaired"`, assembles the `RunLogTailRepairedPayload` from the
    `RunLogTailRepaired` event already committed in the log.
- Evidence records / attestations produced: `core-01-s1-event-contracts/RunLogHealthRecord` entries
  (specifically `RunLogCorruptionRecord` for `tail-repaired` and `interior-corrupt`, and the
  `event-log-unavailable` variant for unavailable storage) assembled into `RunReplay.healthRecords`.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Accept a `runId` and a `fnd-02 EventLogStore` injected as a port; call `EventLogStore.replay(runId)`.
- Deserialize each fnd-02 frame into a `RunEventEnvelope`; return `RunReplayFailure { code:
  "malformed-envelope" }` with any accumulated health records if any frame fails envelope validation.
- Validate the `RunEventEnvelope` contract fields: `schema === "kit-vnext.run-event.v1"`, all required
  fields present and typed correctly, `sequence` contiguous starting from 1, `runId` matches the
  requested id.
- For each frame whose `type` is a core-01 declared-relevant event type, parse and validate the
  payload against the declared schema; return `RunReplayFailure { code: "malformed-declared-payload" }`
  on failure, with accumulated health records.
- Map fnd-02 `StorageHealth` to `RunDegradedHealth` per the design mapping: `log-tail-repaired →
  tail-repaired`; `log-interior-corrupt → interior-corrupt`; `network-fs-degraded | read-only |
  unusable → event-log-unavailable`.
- For `log-tail-repaired`: assemble a `RunLogCorruptionRecord { kind: "tail-repaired", ... }` from the
  fnd-02 health signal, add it to `healthRecords`, set `health = "tail-repaired"`, and return a
  successful `RunReplay` (tail-repaired is usable, not a failure).
- For `log-interior-corrupt`: assemble a `RunLogCorruptionRecord { kind: "interior-corrupt", ... }`,
  add it to `healthRecords`, and return `RunReplayFailure { code: "interior-corrupt", healthRecords }`
  — fail closed (incoherent committed history yields no trustworthy ordered stream), so downstream
  `project()` and `waitRunEvents()` propagate the failure rather than acting on corrupt data. (The
  design's §Corruption-handling "mark projections degraded / recover from read-only evidence" is the
  core-06 recovery path in Epic 5, which consumes the `interior-corrupt` `healthRecords`; it is not
  this canonical `replay()`.)
- For `network-fs-degraded | read-only | unusable`: assemble a `RunLogHealthRecord { kind:
  "event-log-unavailable", ... }` and return `RunReplayFailure { code: "event-log-unavailable",
  healthRecords }`.
- Produce a deterministic `RunReplay` (same log byte sequence → same output every time); reducers and
  validators are pure; clock, ids, and storage injected — no ambient `Date.now` / `new Date` /
  `Math.random` / `crypto.randomUUID`.
- Expose the `replay()` function as the public production surface for consumption by `core-01-s4`,
  `core-01-s5`, and `core-01-s6`.

## Out of scope

- Appending `RunLogTailRepaired` events to the writer after observing `log-tail-repaired` — that is the
  writer path owned by `core-01-s4`.
- Lost-ack recovery orchestration (reacquiring the writer, deciding committed vs absent vs conflict) —
  owned by `core-01-s4`.
- Lifecycle-transition folding and projection building — owned by `core-01-s5`.
- Cursor-based incremental waiting — owned by `core-01-s6`.
- The `RunEventLog` object assembly — owned by `core-01-s4`.
- Type declarations of `RunReplay`, `RunReplayFailure`, `RunLogHealthRecord`, `RunLogCorruptionRecord`,
  `RunDegradedHealth` — declared once by `core-01-s1-event-contracts`, never redeclared here.

## Dependencies and frozen inputs

- Covers signals: Replay health, tail/interior corruption classes, and partial-write handling (replay
  side) — as listed in the Epic 3 charter `core-01` per-domain expectations table.
- Depends on: `core-01-s1-event-contracts` (type shapes); `fnd-02 EventLogStore` (Epic 1 frozen input).
- Depended on by: `core-01-s4-run-event-log-and-writer`, `core-01-s5-projections`,
  `core-01-s6-cursor-wait`.
- Shared shapes consumed (verbatim, not redeclared):
  `core-01-s1-event-contracts/RunReplay`,
  `core-01-s1-event-contracts/RunEventEnvelope`,
  `core-01-s1-event-contracts/RunReplayFailure`,
  `core-01-s1-event-contracts/RunLogHealthRecord`,
  `core-01-s1-event-contracts/RunLogCorruptionRecord`,
  `core-01-s1-event-contracts/RunDegradedHealth`,
  `core-01-s1-event-contracts/RunLogTailRepairedPayload`,
  `core-01-s1-event-contracts/RunEventCursor`.

## Acceptance criteria

- **AC-1** Given a fault-free in-memory fnd-02 store holding a log with N valid envelopes (sequences 1
  through N, correct `schema`, all required fields present, matching `runId`), `replay(runId)` returns
  `{ ok: true, value: RunReplay }` with `events.length === N`, `lastSequence === N`,
  `health === "ok"`, and `healthRecords === []` - evidence:
  `replay-happy-path.unit.test.ts` asserts `ok === true`, `value.events.length`, `value.lastSequence`,
  `value.health`, and `value.healthRecords.length` for a fixture of N = 3 events.

- **AC-2** Given a log containing a frame whose decoded object is missing the required `schema` field
  (value absent — not `"kit-vnext.run-event.v1"`), `replay(runId)` returns
  `{ ok: false, error: RunReplayFailure { code: "malformed-envelope" } }` - evidence:
  `replay-malformed-envelope.unit.test.ts` uses a fault-injected in-memory store whose frame omits
  `schema`; asserts `ok === false`, `error.code === "malformed-envelope"`.

- **AC-3** Given a log whose frames have non-contiguous sequences (e.g., sequences 1, 2, 4 with gap at
  3), `replay(runId)` returns `{ ok: false, error: RunReplayFailure { code: "malformed-envelope" } }` -
  evidence: `replay-non-contiguous-sequence.unit.test.ts` uses a fault-injected store with gap fixture;
  asserts `ok === false`, `error.code === "malformed-envelope"`.

- **AC-4** Given a log containing a frame whose `type` is `RunLifecycleTransitioned` (a core-01
  declared-relevant type) but whose `payload` is an empty object `{}` (missing all required fields of
  `RunLifecycleTransitionPayload`), `replay(runId)` returns
  `{ ok: false, error: RunReplayFailure { code: "malformed-declared-payload" } }` - evidence:
  `replay-malformed-declared-payload.unit.test.ts` uses a fault-injected store; asserts
  `ok === false`, `error.code === "malformed-declared-payload"`.

- **AC-5** Given a log whose declared-relevant frame has a well-formed `RunLifecycleTransitionPayload`
  and the fnd-02 store reports `storageHealth === "log-tail-repaired"`, `replay(runId)` returns
  `{ ok: true, value: RunReplay }` with `health === "tail-repaired"`,
  `healthRecords` containing exactly one `RunLogCorruptionRecord { kind: "tail-repaired" }` - evidence:
  `replay-tail-repaired.unit.test.ts` uses an in-memory store fault-injected with
  `storageHealth = "log-tail-repaired"`; asserts `ok === true`, `value.health === "tail-repaired"`,
  `value.healthRecords[0].kind === "tail-repaired"`, `value.healthRecords[0].storageHealth ===
  "log-tail-repaired"`.

- **AC-6** Given a fnd-02 store reporting `storageHealth === "log-interior-corrupt"`, `replay(runId)`
  fails closed, returning `{ ok: false, error: RunReplayFailure { code: "interior-corrupt" } }` whose
  `error.healthRecords` contains exactly one `RunLogCorruptionRecord { kind: "interior-corrupt" }`, so
  downstream `project()`/`waitRunEvents()` propagate the failure rather than serving incoherent history
  - evidence: `replay-interior-corrupt.unit.test.ts` uses a fault-injected store; asserts
  `ok === false`, `error.code === "interior-corrupt"`, `error.healthRecords[0].kind ===
  "interior-corrupt"`, `error.healthRecords[0].storageHealth === "log-interior-corrupt"`.

- **AC-7** Given a fnd-02 store reporting `storageHealth === "network-fs-degraded"` (and independently
  `"read-only"` and `"unusable"`), `replay(runId)` returns
  `{ ok: false, error: RunReplayFailure { code: "event-log-unavailable" } }` for each - evidence:
  `replay-event-log-unavailable.unit.test.ts` uses three separate fault-injected stores (one per
  health value); asserts `ok === false`, `error.code === "event-log-unavailable"`,
  `error.healthRecords[0].storageHealth` equals the injected value in each case.

- **AC-8** Given a fault-free log, calling `replay(runId)` twice returns two `RunReplay` values that
  are deep-equal in `events`, `lastSequence`, `writerEpoch`, `health`, and `healthRecords` — proving
  output is deterministic for a given log byte sequence - evidence:
  `replay-determinism.unit.test.ts` asserts `deepEqual(first.value, second.value)` for two calls
  against the same fixed in-memory store (no mutable ambient state).

- **AC-9** Given a log where a valid `RunLogTailRepaired` event is committed (containing a
  `RunLogTailRepairedPayload { repairedAt, lastCommittedSequence, quarantinedBytes, storageHealth:
  "log-tail-repaired" }`) and fnd-02 reports `log-tail-repaired`, the `RunLogCorruptionRecord` in
  `healthRecords` has `detectedAt` equal to the `repairedAt` from the payload and
  `lastValidSequence` equal to `lastCommittedSequence` from the payload - evidence:
  `replay-tail-repaired.unit.test.ts` (same file as AC-5) additionally asserts `healthRecords[0].detectedAt`
  and `healthRecords[0].lastValidSequence` match the fixture values from `RunLogTailRepairedPayload`.

- **AC-10** The `replay()` function is importable from the `sdk` package public entrypoint, not a
  private module path - evidence: `replay-public-import.unit.test.ts` imports `replay` from the `sdk`
  entrypoint and asserts it is a function.

## Coverage matrix

| Responsibility / spec-surface item | Proven by |
|---|---|
| Happy-path assembly: N envelopes → `RunReplay` with `health = "ok"`, `healthRecords = []` | AC-1 |
| Envelope validation: missing required field (`schema`) → `malformed-envelope` | AC-2 |
| Envelope validation: non-contiguous sequences → `malformed-envelope` | AC-3 |
| Declared-payload validation: invalid `RunLifecycleTransitionPayload` → `malformed-declared-payload` | AC-4 |
| `log-tail-repaired` → usable `RunReplay`, `health = "tail-repaired"`, `RunLogCorruptionRecord { kind: "tail-repaired" }` | AC-5, AC-9 |
| `log-interior-corrupt` → `RunReplayFailure { code: "interior-corrupt" }` (fail-closed), `RunLogCorruptionRecord { kind: "interior-corrupt" }` in `healthRecords` | AC-6 |
| `network-fs-degraded` / `read-only` / `unusable` → `RunReplayFailure { code: "event-log-unavailable" }` | AC-7 |
| Determinism: same byte sequence → same `RunReplay` output | AC-8 |
| `RunLogTailRepairedPayload` fields mapped to `RunLogCorruptionRecord` fields | AC-9 |
| `replay()` public SDK export | AC-10 |
| `core-01-s1-event-contracts/RunReplay` shape consumed (not redeclared) | AC-1 |
| `core-01-s1-event-contracts/RunEventEnvelope` consumed | AC-1, AC-2, AC-3 |
| `core-01-s1-event-contracts/RunReplayFailure` consumed | AC-2, AC-3, AC-4, AC-6, AC-7 |
| `core-01-s1-event-contracts/RunLogHealthRecord` (including `RunLogCorruptionRecord`) produced | AC-5, AC-6, AC-7, AC-9 |
| `core-01-s1-event-contracts/RunDegradedHealth` mapping | AC-5, AC-6, AC-7 |
| `core-01-s1-event-contracts/RunLogTailRepairedPayload` consumed | AC-9 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `malformed-envelope` | A committed frame decodes but the resulting object violates the `RunEventEnvelope` contract (missing required field such as `schema`, wrong schema string, wrong field type, non-contiguous sequence, or mismatched `runId`) | Return `{ ok: false, error: RunReplayFailure { code: "malformed-envelope", healthRecords } }`; include any health records accumulated before detection | AC-2 (missing field), AC-3 (non-contiguous sequence) |
| `malformed-declared-payload` | A frame for a core-01 declared-relevant type (`RunLifecycleTransitioned`, `SessionLinked`, `SessionLinkSuperseded`, `RunLogTailRepaired`, `RunAppendRejected`) has a payload that fails its declared schema | Return `{ ok: false, error: RunReplayFailure { code: "malformed-declared-payload", healthRecords } }` | AC-4 |
| `interior-corrupt` | fnd-02 reports `storageHealth === "log-interior-corrupt"` | Fail closed: return `{ ok: false, error: RunReplayFailure { code: "interior-corrupt", healthRecords: [RunLogCorruptionRecord { kind: "interior-corrupt" }] } }`; downstream `project()`/`waitRunEvents()` propagate it (the degraded recovery-read is core-06/Epic 5) | AC-6 |
| `event-log-unavailable` | fnd-02 reports `storageHealth` of `"network-fs-degraded"`, `"read-only"`, or `"unusable"` | Return `{ ok: false, error: RunReplayFailure { code: "event-log-unavailable", healthRecords: [{ kind: "event-log-unavailable", storageHealth: <injected value> }] } }` | AC-7 |
| `tail-repaired` (degraded health — not a failure) | fnd-02 reports `storageHealth === "log-tail-repaired"` | Return `{ ok: true, value: RunReplay { health: "tail-repaired", healthRecords: [RunLogCorruptionRecord { kind: "tail-repaired", ... }], ... } }`; log is usable; caller may proceed | AC-5, AC-9 |

## Quality bar

- Coverage scope and threshold: the `replay()` function and its envelope/payload validators in
  `packages/sdk/src/core/run-lifecycle/replay/**` at ≥90%, aiming for 95%. Type-only imports from
  `core-01-s1-event-contracts` contribute no instrumented lines and are excluded from the scope
  measurement.
- Coverage command and instrumented lane(s): `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/core/run-lifecycle/replay/**` — instruments the unit lane
  over the replay module scope; the full aggregate gate is `pnpm coverage:baseline`.
- Required tests, catalogued by AC and failure row:
  - `replay-happy-path.unit.test.ts` (AC-1)
  - `replay-malformed-envelope.unit.test.ts` (AC-2, AC-3; separate fixtures for missing-field and
    non-contiguous-sequence)
  - `replay-malformed-declared-payload.unit.test.ts` (AC-4)
  - `replay-tail-repaired.unit.test.ts` (AC-5, AC-9)
  - `replay-interior-corrupt.unit.test.ts` (AC-6)
  - `replay-event-log-unavailable.unit.test.ts` (AC-7; three fault fixtures: `network-fs-degraded`,
    `read-only`, `unusable`)
  - `replay-determinism.unit.test.ts` (AC-8)
  - `replay-public-import.unit.test.ts` (AC-10)
- Public exposure (import path + public-import test): `replay` exported from the `sdk` public
  entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export + barrel + `exports`
  field); proven by `replay-public-import.unit.test.ts` which imports `replay` from `sdk` (not a
  private path) and asserts it is a function. The `RunReplay` TYPE is `core-01-s1-event-contracts`'s
  public export; this story exports only the `replay` function.
- Determinism constraints: `replay()` is pure given its fnd-02 store argument; no ambient `Date.now`,
  `new Date`, `Math.random`, or `crypto.randomUUID`; clock, ids, and storage injected as ports.
  `detectedAt` in `RunLogCorruptionRecord` is derived from committed event payloads or the fnd-02 health
  signal, not from a live clock call inside `replay()`.
- Dependency boundaries: `sdk` imports only pure runtime libraries and `core-01-s1-event-contracts`
  types; it must not import `testkit`, any `provider-*`, `cli`, or `mcp`. Test files are exempt from
  the production-testkit rule and may import the fake in-memory fnd-02 store.
- File-size budget (lines per file; default soft cap ~200): `replay.ts` (main function) ≤ 200 lines;
  `envelope-validator.ts` ≤ 200 lines; `payload-validator.ts` ≤ 200 lines;
  `health-classifier.ts` ≤ 150 lines. Test files ≤ 200 lines each.
- Domain non-negotiables:
  - Tail-repaired is a usable result, not a failure; callers that need mutation-safety must inspect
    `health` themselves.
  - Interior-corrupt fails closed: `replay()` returns `RunReplayFailure { code: "interior-corrupt" }`
    (with the `RunLogCorruptionRecord` in `healthRecords`); it never serves incoherent committed history
    as a successful `RunReplay`. The degraded recovery-read over read-only evidence is core-06/Epic 5.
  - Replay output is deterministic: same fnd-02 byte sequence → same `RunReplay` every time.
  - Declared-payload validation covers only core-01 declared-relevant types; well-formed unknown future
    payloads are preserved in `events` and do not fail replay.

## Required reading

- `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md` — type definitions for
  all consumed and produced shapes.
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  — §Event envelope, §Corruption handling, §Writer-epoch fencing and partial-write recovery (replay
  side only; writer-recovery orchestration is core-01-s4).
- `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  — §Failure and degraded modes, §Testing strategy.
- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md` (when
  ready) — the single producer of all consumed shape declarations.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the `sdk` public entrypoint.
- `docs/engineering/test-lanes.md` — unit lane rules; no real FS/network/process.
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — sdk → pure libs only; testkit excluded
  from production source.

## Deliverable

The `packages/sdk/src/core/run-lifecycle/replay/` module providing the `replay()` function, plus
the evidence pack.

## Evidence pack

- Test proving each AC: `replay-happy-path.unit.test.ts` (AC-1); `replay-malformed-envelope.unit.test.ts`
  (AC-2, AC-3); `replay-malformed-declared-payload.unit.test.ts` (AC-4);
  `replay-tail-repaired.unit.test.ts` (AC-5, AC-9); `replay-interior-corrupt.unit.test.ts` (AC-6);
  `replay-event-log-unavailable.unit.test.ts` (AC-7); `replay-determinism.unit.test.ts` (AC-8);
  `replay-public-import.unit.test.ts` (AC-10).
- Negative fixtures:
  - Missing-`schema` frame fixture in `replay-malformed-envelope.unit.test.ts` (AC-2).
  - Gap-sequence frame fixture in `replay-malformed-envelope.unit.test.ts` (AC-3).
  - Empty-payload `RunLifecycleTransitioned` frame fixture in `replay-malformed-declared-payload.unit.test.ts` (AC-4).
  - `storageHealth = "network-fs-degraded"`, `"read-only"`, `"unusable"` fixtures in
    `replay-event-log-unavailable.unit.test.ts` (AC-7).
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the `packages/sdk/src/core/run-lifecycle/replay/**`
  scope.
- Public-import test result for `replay` imported from the `sdk` entrypoint.
- Boundary/forbidden-symbol sweep (runnable recipe):
  `grep -REn "testkit|provider-(codex|local|github|markdown)|/cli/|/mcp/" packages/sdk/src/core/run-lifecycle/replay/`
  over path root `packages/sdk/src/core/run-lifecycle/replay/`; forbidden-token set = `testkit`,
  `provider-codex|local|github|markdown`, `/cli/`, `/mcp/`; expected result zero matches (exit code
  1), captured into the evidence pack.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/core/run-lifecycle/replay/` only; test files under
  `packages/sdk/tests/core/run-lifecycle/replay/`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/run-lifecycle/replay/**`,
  `packages/sdk/tests/core/run-lifecycle/replay/**`.
- Forbidden dependencies (production source): `testkit`, any `provider-*` package, `cli`, `mcp`.
- STOP when: lifecycle/projection folding is needed (core-01-s5), writer construction or lost-ack
  orchestration is needed (core-01-s4), cursor-wait polling is needed (core-01-s6), or type
  declarations for `RunReplay` / `RunReplayFailure` / `RunLogHealthRecord` need to be authored (those
  belong to core-01-s1-event-contracts).

## Characterization Review

Architect-recorded review of this contract's load-bearing scope decisions. Each entry records
rationale, the design line it traces to, the falsification criterion, and the escalation path.

### Decision: tail-repaired-is-usable

- Rationale: a repaired tail preserves a usable committed history while carrying degraded health
  evidence for projections and downstream gates.
- Design trace: `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md`
  (`RunDegradedHealth` includes `tail-repaired`);
  `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  (`tail-repaired` state is usable after `RunLogTailRepaired`).
- Falsification: replay returns `RunReplayFailure` for `tail-repaired`, drops the health record, or
  treats tail repair as an authoritative append failure.
- Escalation: if a repaired tail cannot be safely replayed, raise a design defect against the
  corruption protocol rather than reclassifying it locally.

### Decision: interior-corrupt-fails-closed

- Rationale: incoherent committed history cannot authorize replay-derived state or future appends, so
  replay must surface a hard failure.
- Design trace: `docs/design/30-domain-reference/core/run-lifecycle-and-state/contracts.md`
  (`RunReplayFailure` includes `interior-corrupt`);
  `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  (`interior-corrupt` committed history is incoherent and authoritative appends fail closed).
- Falsification: replay returns usable events for an interior-corrupt log, or a downstream story treats
  interior corruption as a repaired/partial health state.
- Escalation: if storage health cannot distinguish tail from interior corruption, escalate to fnd-02 /
  core-01 design; do not silently downgrade the failure.

### Decision: declared-payload-validation-scoped-to-core-01

- Rationale: replay validates only the payloads core-01 declares relevant, preserving sibling-domain
  ownership while still rejecting malformed core-01 state-authoring payloads.
- Design trace: `docs/design/30-domain-reference/core/run-lifecycle-and-state/event-log-writer-and-corruption.md`
  (declared relevant payload for lifecycle state);
  `docs/design/30-domain-reference/core/run-lifecycle-and-state/projections-lifecycle-and-tests.md`
  (malformed payloads for core-01 declared-relevant event types).
- Falsification: replay parses or rejects sibling-domain payloads beyond core-01's declared catalog, or
  accepts malformed core-01 lifecycle/linkage/corruption payloads.
- Escalation: if a sibling-domain payload must affect core-01 replay, require that domain to declare the
  contract and add a DAG edge; do not broaden replay parsing ad hoc.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - stories](./README.md) · **← Prev:** [core-01-s1-event-contracts - host-neutral run-log contract surface implementation story](./core-01-s1-event-contracts.md) · **Next →:** [core-01-s3-lifecycle-and-linkage - lifecycle legal-transition table and session linkage rules implementation story](./core-01-s3-lifecycle-and-linkage.md)

<!-- /DOCS-NAV -->
