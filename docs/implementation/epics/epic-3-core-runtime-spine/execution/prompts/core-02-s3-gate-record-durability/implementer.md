# Implementer Prompt: core-02-s3-gate-record-durability

## Assigned Routing

- Source story id: `core-02-s3-gate-record-durability`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.
- Model class: `general-coder`.
- Effort: `medium`.
- Suggested-tier floor: `standard`.
- Reasoning tier: `standard`.
- Routing rationale: core-02-s3-gate-record-durability covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 and carries bounded durability wrapper with fail-closed append behavior. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Exact Task

Implement source story `core-02-s3-gate-record-durability` for epic `epic-3-core-runtime-spine`. Deliver exactly the outcome in the ready source contract and nothing outside it:

The `packages/sdk/src/core/capability/record/` module providing the `appendGateRecord` function
and the local `GateRecordUnwritable` error type, plus the evidence pack.

## Why It Matters

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

The DAG dependents for this story are: none inside Epic 3. Preserve the producer/consumer shape boundaries named above so later stories can consume committed dependency inputs without re-declaring or widening this story's scope.

## Required Reading

- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s3-gate-record-durability.md` — source story contract for `core-02-s3-gate-record-durability`.
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` — frozen DAG row, dependencies, owned pathset, wave, and suggested-tier floor for `core-02-s3-gate-record-durability`.
- `docs/design/30-domain-reference/core/capability-and-safety/gate-evaluation-and-records.md`
  — §Types (`CapabilityGateRecordPayload`; `CapabilityGateFailureReason` including
  `gate-record-unwritable`), §Types last paragraph (barrier durability requirement, unwritable
  behavior).
- `docs/design/30-domain-reference/core/capability-and-safety/README.md`
  — §5 Contracts & interfaces, §6 Events & data, §8 Failure & degraded modes.
- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s2-gate-evaluator.md`
  (when ready) — the single producer of `CapabilityGateRecordPayload`.
- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md`
  (when ready) — the single producer of `RunWriter`, `AppendIntent`, `RunAppendReceipt`,
  `RunAppendFailure`, `RunDurabilityClass`.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the `sdk` public entrypoint.
- `docs/engineering/test-lanes.md` — unit lane rules; no real FS/network/process.
- `docs/design/20-sdk-and-packaging/dependency-rules.md` — sdk → pure libs only; testkit excluded
  from production source.
- `{{DEPENDENCY_COMMITS}}` — runtime slot for committed dependency story inputs when this story has dependencies.

## Acceptance Criteria

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s3-gate-record-durability.md`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`.

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

## Allowed Writes

Source story: `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-02-s3-gate-record-durability.md`. Owned pathset from the frozen DAG and source contract:

- `packages/sdk/src/core/capability/record/**`
- `packages/sdk/tests/core/capability/record/**`

Every other write is forbidden, including this execution package, tracker files, source planning artifacts, repo-wide cleanup, dependency churn, generated files outside the owned pathset, commits, pushes, PRs, and merges.

## Dependency Inputs

Direct dependency story ids: `core-02-s2-gate-evaluator`, `core-01-s1-event-contracts`.

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

Use `{{DEPENDENCY_COMMITS}}` for dependency commits that can only exist during execution. Import only producer-owned public shapes and paths named by the DAG or source contract.

## Non-Goals And STOP Conditions

### Source Out Of Scope

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

### Source Boundaries And STOP Conditions

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

Also stop and report if dependency inputs are missing, required writes fall outside the allowed pathset, a source gap blocks implementation, or any AC would need reinterpretation.

## Implementation Constraints

### Source Responsibilities

- Accept a `core-02-s2-gate-evaluator/CapabilityGateRecordPayload` (the decided gate record) and
  an injected `core-01-s1-event-contracts/RunWriter`.
- Construct a single `AppendIntent` with event type `"CapabilityGateRecord"`, `domain = "core-02"`,
  `durability = "barrier"`, and the payload — the `durability` field is hard-pinned to `"barrier"`
  regardless of any caller input; the function accepts no caller-supplied durability parameter.
- Delegate the single-event append to the `RunWriter` and return the `RunAppendReceipt` on success.
- On `RunAppendFailure` from the writer (any code: `event-log-unavailable`, `interior-corrupt`,
  etc.), surface `gate-record-unwritable` and return a failure result — the caller must not treat
  the capability as allowed.
- Fail closed by construction: the function's return type makes the `gate-record-unwritable` failure
  branch the only alternative to a committed receipt; there is no path by which the capability is
  treated as allowed without a committed `RunAppendReceipt`.
- Expose `appendGateRecord` as the public production surface via the `sdk` public entrypoint.

### Source Spec Surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types consumed (declared by their producer stories; not redeclared here):
  `core-02-s2-gate-evaluator/CapabilityGateRecordPayload`,
  `core-01-s1-event-contracts/RunWriter`,
  `core-01-s1-event-contracts/RunEventEnvelope`,
  `core-01-s1-event-contracts/RunAppendReceipt`,
  `core-01-s1-event-contracts/RunAppendFailure`,
  `core-01-s1-event-contracts/RunDurabilityClass`,
  `core-01-s1-event-contracts/AppendIntent`.
- Events / append intents produced:
  - Event type `CapabilityGateRecord` with `domain = "core-02"` and `barrier`
    durability — appended by the function this story implements via a single `AppendIntent`.
- Provider operations / commands implemented:
  - `appendGateRecord(payload: CapabilityGateRecordPayload, writer: RunWriter): Promise<Result<RunAppendReceipt, GateRecordUnwritable>>`
    — the durable gate-record output function. Constructs an `AppendIntent` with
    `durability = "barrier"` and delegates to `RunWriter`; returns the append result or
    `GateRecordUnwritable` on failure.
- Failure and degraded tokens:
  - `gate-record-unwritable` (token owned here per design; catalog entry in
    `core-02-s2-gate-evaluator/CapabilityGateFailureReason`) — surfaced when the `RunWriter`
    returns a `RunAppendFailure` (e.g. `event-log-unavailable` or `interior-corrupt`); the
    capability MUST NOT be treated as allowed.
- Evidence records / attestations produced:
  - `RunAppendReceipt` — the committed event ref returned by a successful `RunWriter` append; the
    caller cites this as the gate record event id before acting.

Done requires every item here present with the design's names, shapes, and semantics.

Do not introduce implementation choices outside the names, events, failure tokens, determinism rules, boundary rules, import rules, conformance obligations, and safety invariants fixed above.

## Verification

### Source Quality Bar

- Coverage scope and threshold: `packages/sdk/src/core/capability/record/**` at ≥90%, aiming for
  95%. Type-only imports from producer stories contribute no instrumented lines and are excluded.
- Coverage command and instrumented lane(s): `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/core/capability/record/**` — instruments the unit lane
  over the gate-record module scope; the full aggregate gate is `pnpm coverage:baseline`.
- Required tests, catalogued by AC and failure row:
  - `gate-record-happy-path.unit.test.ts` (AC-1, AC-2)
  - `gate-record-unwritable-unavailable.unit.test.ts` (AC-3; failure row: `event-log-unavailable`)
  - `gate-record-unwritable-corrupt.unit.test.ts` (AC-4; failure row: `interior-corrupt`)
  - `gate-record-type-safety.unit.test.ts` (AC-5)
  - `gate-record-public-import.unit.test.ts` (AC-6)
- Public exposure (import path + public-import test): `appendGateRecord` exported from the `sdk`
  public entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export + barrel +
  `exports` field); proven by `gate-record-public-import.unit.test.ts` which imports
  `appendGateRecord` from `sdk` (not a private path) and asserts it is a function. The payload TYPE
  `CapabilityGateRecordPayload` is `core-02-s2-gate-evaluator`'s public export; this story exports
  only the `appendGateRecord` function and the `GateRecordUnwritable` error type.
- Determinism constraints: `appendGateRecord` is a pure delegating function given its injected
  `RunWriter`; it does not call `Date.now()`, `new Date()`, `Math.random()`, or
  `crypto.randomUUID()`. Event ids are provided by the writer (injected port); no ambient clock or
  id generation inside this module.
- Dependency boundaries: `packages/sdk/src/core/capability/record/**` must import only
  `core-02-s2-gate-evaluator` types and `core-01-s1-event-contracts` types; it must not import
  `testkit`, any `provider-*` package, `cli`, or `mcp`. Test files are exempt from the
  production-testkit rule and may import fake `RunWriter` implementations.
- File-size budget (lines per file; default soft cap ~200): `append-gate-record.ts` (main function)
  ≤ 150 lines; `types.ts` (local `GateRecordUnwritable` error type) ≤ 50 lines. Test files ≤ 200
  lines each.
- Domain non-negotiables:
  - `barrier` durability is non-negotiable: the design states the record "gates irreversible
    action"; `appendGateRecord` hard-pins `AppendIntent.durability` to `"barrier"` regardless of
    any caller input — there is no caller-supplied durability parameter and no downgrade path.
  - Fail closed by construction: the only success return path is a committed `RunAppendReceipt`;
    any writer failure → `gate-record-unwritable`; there is no silent-allow branch.
  - The function does not evaluate the gate decision (allow/deny); it only persists a decided
    payload. If the caller passes a `deny` payload, it is persisted at `barrier` just as an `allow`
    payload is — recording every decision is required by the design.

### Source Evidence Pack

- Test name or artifact proving each AC:
  `gate-record-happy-path.unit.test.ts` (AC-1, AC-2);
  `gate-record-unwritable-unavailable.unit.test.ts` (AC-3);
  `gate-record-unwritable-corrupt.unit.test.ts` (AC-4);
  `gate-record-type-safety.unit.test.ts` (AC-5);
  `gate-record-public-import.unit.test.ts` (AC-6).
- Negative fixtures:
  - Fault-injected `RunWriter` returning `RunAppendFailure { code: "event-log-unavailable" }` in
    `gate-record-unwritable-unavailable.unit.test.ts` (AC-3).
  - Fault-injected `RunWriter` returning `RunAppendFailure { code: "interior-corrupt" }` in
    `gate-record-unwritable-corrupt.unit.test.ts` (AC-4).
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for `packages/sdk/src/core/capability/record/**`.
- Public-import test result for `appendGateRecord` imported from the `sdk` entrypoint.
- Boundary/forbidden-symbol sweep (runnable recipe):
  `grep -REn "testkit|provider-(codex|local|github|markdown)|/cli/|/mcp/|Date\.now|new Date\(|Math\.random|crypto\.randomUUID" packages/sdk/src/core/capability/record/`
  over path root `packages/sdk/src/core/capability/record/`; forbidden-token set = `testkit`,
  `provider-codex|local|github|markdown`, `/cli/`, `/mcp/`, `Date.now`, `new Date(`,
  `Math.random`, `crypto.randomUUID`; expected result zero matches (exit code 1), captured into
  the evidence pack.

Run the targeted commands and `pnpm check`, then report exact command output or an explicit blocked reason. Do not treat prose-only claims as evidence.

## Delivery Report

Return a report with changed files, AC coverage by `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, tests and checks run, evidence pack, open questions, and blockers. The report is review evidence only; it is not permission to update tracker state or perform delivery actions.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Reviewer Prompt: core-02-s2-gate-evaluator](../core-02-s2-gate-evaluator/reviewer.md) · **Next →:** [Reviewer Prompt: core-02-s3-gate-record-durability](./reviewer.md)

<!-- /DOCS-NAV -->
