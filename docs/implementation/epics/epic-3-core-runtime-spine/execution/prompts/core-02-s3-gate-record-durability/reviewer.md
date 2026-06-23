# Reviewer Prompt: core-02-s3-gate-record-durability

## Assigned Routing

- Source story id: `core-02-s3-gate-record-durability`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.
- Model class: `frontier-reviewer`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-02-s3-gate-record-durability covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 and carries bounded durability wrapper with fail-closed append behavior. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `core-02-s3-gate-record-durability`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s3-gate-record-durability.md`.
- Allowed pathset: `packages/sdk/src/core/capability/record/**`, `packages/sdk/tests/core/capability/record/**`.
- Direct dependencies: `core-02-s2-gate-evaluator`, `core-01-s1-event-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

- **AC-1** Given a fault-free fake `RunWriter` that accepts any `AppendIntent` and returns a
  `RunAppendReceipt` (with a fixed committed `eventId`), `appendGateRecord(payload, writer)` returns
  `{ ok: true, value: RunAppendReceipt }` where the receipt's `eventId` equals the value returned
  by the fake writer — evidence: `gate-record-happy-path.unit.test.ts` constructs a minimal valid
  `CapabilityGateRecordPayload` fixture (schema `"kit-vnext.capability-gate-record.v1"`, any
  `allow` decision), injects the fake writer, calls `appendGateRecord`, and asserts
  `ok === true` and `value.eventId === "<fixed-id>"` (pass).

- **AC-2** The `AppendIntent` passed to the fake writer has `type === "CapabilityGateRecord"`,
  `domain === "core-02"`, and `durability === "barrier"` — evidence:
  `gate-record-happy-path.unit.test.ts` (same file as AC-1) captures the `AppendIntent` the fake
  writer received and asserts all three fields match exactly (pass).

- **AC-3** Given a fault-injected fake `RunWriter` that returns a `RunAppendFailure` with code
  `"event-log-unavailable"`, `appendGateRecord(payload, writer)` returns
  `{ ok: false, error: GateRecordUnwritable }` and does NOT return the payload's
  `decision` field as an `allow` receipt — evidence:
  `gate-record-unwritable-unavailable.unit.test.ts` injects a writer that returns
  `RunAppendFailure { code: "event-log-unavailable" }`, calls `appendGateRecord`, and asserts
  `ok === false`, `error.token === "gate-record-unwritable"` (pass).

- **AC-4** Given a fault-injected fake `RunWriter` that returns a `RunAppendFailure` with code
  `"interior-corrupt"`, `appendGateRecord(payload, writer)` returns
  `{ ok: false, error: GateRecordUnwritable }` — evidence:
  `gate-record-unwritable-corrupt.unit.test.ts` injects a writer returning
  `RunAppendFailure { code: "interior-corrupt" }` and asserts `ok === false`,
  `error.token === "gate-record-unwritable"` (pass).

- **AC-5** `appendGateRecord` is a fail-closed function by construction: the TypeScript return type
  is `Promise<Result<RunAppendReceipt, GateRecordUnwritable>>` with no third branch; a test
  confirms the type compiles and that the only success path carries a `RunAppendReceipt` — evidence:
  `gate-record-type-safety.unit.test.ts` imports `appendGateRecord` from the `sdk` entrypoint,
  assigns the return value to `Promise<Result<RunAppendReceipt, GateRecordUnwritable>>`, and
  asserts TypeScript accepts the assignment at compile time (tsc zero errors, pass).

- **AC-6** `appendGateRecord` is importable from the `sdk` package public entrypoint, not a
  private module path — evidence: `gate-record-public-import.unit.test.ts` imports
  `appendGateRecord` from the `sdk` entrypoint and asserts it is a function (pass).

### Dependencies And Frozen Inputs

- Covers signals: `CapabilityGateRecord` barrier durability (durability part) and fail-closed for
  unwritable gate records (unwritable-gate-record part) — as recorded in the Epic 3 charter
  `core-02` per-domain expectations split row.
- Depends on: `core-02-s2-gate-evaluator` (payload type), `core-01-s1-event-contracts` (writer
  interface and append types). Band 4 via `core-02-s2`.
- Depended on by: Epic 4 / Epic 5 consumers of `appendGateRecord` (outside Epic 3 scope; not an
  intra-Epic-3 edge).
- Shared shapes consumed (verbatim, not redeclared):
  `core-02-s2-gate-evaluator/CapabilityGateRecordPayload`,
  `core-01-s1-event-contracts/RunWriter`,
  `core-01-s1-event-contracts/RunEventEnvelope`,
  `core-01-s1-event-contracts/RunAppendReceipt`,
  `core-01-s1-event-contracts/RunAppendFailure`,
  `core-01-s1-event-contracts/RunDurabilityClass`,
  `core-01-s1-event-contracts/AppendIntent`.

### Non-Goals

- Gate evaluation and the `CapabilityGateRecordPayload` decision — owned by
  `core-02-s2-gate-evaluator`.
- The capability registry, `CapabilityId`, mode handling, and guarantee predicates — owned by
  `core-02-s1-capability-registry`.
- Constructing or managing the `RunWriter` lease, epoch, or lost-ack recovery — owned by
  `core-01-s4-run-event-log-and-writer`.
- Type declarations of `CapabilityGateRecordPayload`, `RunWriter`, `AppendIntent`,
  `RunAppendReceipt`, `RunAppendFailure`, `RunDurabilityClass` — declared once by their producer
  stories, never redeclared here.
- Downstream action on an `allow` result (approval adjudication, merge mechanics, recovery
  selection) — owned by Epic 4 / Epic 5 consumers.

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/core/capability/record/` only; test files under
  `packages/sdk/tests/core/capability/record/`.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/core/capability/record/**`,
  `packages/sdk/tests/core/capability/record/**`.
- Forbidden dependencies (production source): `testkit`, any `provider-*` package, `cli`, `mcp`.
- STOP when: gate evaluation or the guarantee predicates are reached (core-02-s2), the capability
  registry or mode handling is needed (core-02-s1), writer lease/epoch/fencing behavior is needed
  (core-01-s4), or type declarations for `CapabilityGateRecordPayload` / `RunWriter` /
  `AppendIntent` / `RunAppendReceipt` / `RunAppendFailure` need to be authored (those belong to
  their producer stories).

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s3-gate-record-durability.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/core/capability/record/**`, `packages/sdk/tests/core/capability/record/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: core-02-s3-gate-record-durability](./implementer.md) · **Next →:** [Implementer Prompt: core-07-s1-telemetry-and-metrics](../core-07-s1-telemetry-and-metrics/implementer.md)

<!-- /DOCS-NAV -->
