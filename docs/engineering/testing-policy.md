---
title: kit-vnext — Testing Policy
status: high-level design
last-reviewed: "2026-06-19"
---

# Testing Policy

This policy defines the minimum test requirements for implementation work. It supports
the architecture requirements for deterministic replay, evidence over prose, provider
conformance, and fail-closed behavior. The local verification gate is `pnpm check` as
described in [check-gate.md](check-gate.md). This document defines which tests an item
must add or update before that gate is meaningful.

## Lanes

| Lane | Required when | Must prove | May use |
|---|---|---|---|
| Unit | Any package logic, parser, reducer, policy, mapper, or helper changes | Local behavior, typed failures, boundary validation, deterministic decisions | In-memory fakes, table tests, property tests |
| Integration | Multiple kit packages collaborate, a package reads/writes files, or projections consume persisted artifacts | Package wiring, file formats, filesystem behavior, projection/replay behavior | Temporary directories, test fixtures, fake seam drivers, recorded or mocked evidence |
| Conformance | A provider contract, driver, mock driver, seam DTO, capability, or SDK mapping changes | Real and mock providers satisfy the same contract; bad providers fail | Contract suites, schema probes, adversarial mocks, recorded evidence |
| Smoke | A real process, real SDK/provider, real CLI/MCP surface, real network, or credentialed workflow must be proven | The shipped path works against the external surface with captured evidence | Gated CI jobs or explicitly approved local runs |

Every implementation item must state which lanes it used and why omitted lanes were not
required.

## Unit Tests

Unit tests are required for deterministic code and boundary-local behavior. They must
cover success paths, typed failure paths, malformed input, and fail-closed branches.
Core tests must not depend on concrete drivers or provider SDKs.

Use injected clocks, id factories, and randomness sources. Tests for replayable logic
must pass fixed deterministic inputs rather than calling ambient time or randomness.

## Integration Tests

Integration tests are required when the risk is in package collaboration or filesystem
behavior rather than a single function. Examples: event-log append and projection
flows, config loading, artifact persistence, workspace operations that stay inside the
filesystem, and edge-to-core handoff.

Integration tests may use temporary directories, package collaboration, fake seam
drivers, and recorded or mocked evidence. They must not spawn real processes, call
real SDKs or providers, open network connections, or require credentials. Any real
process, SDK, provider, network, or credentialed path is a smoke test.

## Conformance Tests

Each provider seam requires a conformance suite before drivers can be trusted by core
gates. The suite must be shared by the real driver and its mock driver.

The provider conformance bar requires:

- **Schema probes:** validate contract-owned seam payloads and driver mappings; payload
  schemas must be JSON-Schema-representable.
- **Real smoke:** run at least one gated real-driver path for the provider capability
  being claimed.
- **Adversarial mocks:** include mocks that omit, delay, corrupt, or contradict required
  signals. These mocks must cause the kit to fail closed. A mock that lies about or
  omits a required signal must cause the conformance suite to fail — if it does not, the
  suite is incomplete.
- **Capability evidence:** prove positive, negative, stale, and missing attestation
  cases for any capability gate touched by the provider.
- **Incident replay:** preserve known failure cases as fixtures or recorded evidence when
  an implementation fixes or guards against them.

Mock success alone is not conformance. A mock is useful only when the same suite also
proves that broken provider behavior is rejected.

## Smoke Tests

Smoke tests are the only lane intended for real external processes, network, or
credentialed provider behavior. They are CI-gated or explicitly approved local runs,
not part of the normal fast local loop.

A smoke test must record enough evidence for a reviewer to decide the result without
trusting prose: the command or provider operation, the scoped environment, exit status
or provider status, and redacted output or artifact references.

## Property Tests

Use `fast-check` property tests for logic where examples are not enough. Property tests
are required for:

- Core state-machine reducers.
- Capability-gate predicates.
- Replay/projection equivalence.
- Fail-closed branches and degraded-state selection.

Properties must use deterministic seeds in CI output, or record the failing seed on
failure. Generated values must respect contract schemas and must include malformed or
boundary values where validation is the behavior under test.

Do not add `fast-check` to production code paths. It is a test dependency only.

## Coverage Targets

The project target is at least 90% coverage, with 95% as the aim. Coverage is a floor,
not evidence by itself. A change with high line coverage but no tests for typed
failures, adversarial inputs, or fail-closed branches is incomplete.

Coverage expectations apply per meaningful implementation area, not by hiding untested
risk behind aggregate repository numbers.

## Proof Substrate

Coverage is only a proof when the measured code emits **runtime substrate**. TypeScript
`type` and `interface` declarations erase at compile time, so a module that exports only
them presents `0/0` statements to V8 — which reports as 100% and clears any threshold
*vacuously*, proving nothing. Two rules follow.

- **Proof-substrate invariant.** A statement/branch coverage lane may be required of a
  module only if its owned source pathset is guaranteed to emit runtime substrate (an
  exported `const` / `enum` / function / `as const` value) sufficient for that lane. A
  deliverable satisfiable entirely by erased types carries **no** coverage lane; it proves
  its surface by type-fixtures (positive construction + negative compile fixtures inside the
  `tsc -b` build graph, run by `type:fixtures` in `pnpm check`) and a public-import test.
  The proof method is chosen by the contract, never left to the implementer.

- **`as const` catalog convention.** An exported enumerable catalog (reasons, states, modes,
  risk levels, timer names, …) is minted as a runtime `as const` array plus a derived union
  type — `export const LIVENESS_REASONS = [...] as const; export type LivenessReason =
  (typeof LIVENESS_REASONS)[number];` — **not** as a bare `type` union. The runtime array
  gives exhaustive-membership tests something to iterate and the coverage lane real
  statements to measure, and keeps sibling contract producers symmetric. Pure interfaces
  (no enumerable members) stay interfaces.

- **Value, not behavior.** A frozen `as const` array is a runtime **value**, not behavior:
  it raises nothing and runs no logic. It therefore does **not** violate a "raises none at
  runtime" / "type-only producer" STOP condition — a type-only contract story may mint
  `as const` catalogs without becoming a behavior story. State this in any contract that
  carries both an `as const` catalog and a type-only/producer STOP condition, so the two do
  not read as contradictory.

This is the engineering-policy home of the authoring standard's **Proof-substrate match**
Gate-4 box; see
[implementation-authoring/authoring-standard/50-story-contract.md](../implementation-authoring/authoring-standard/50-story-contract.md#gate-4--authoring-ready)
and the coverage-ownership rule in
[60-coverage.md](../implementation-authoring/authoring-standard/60-coverage.md).

## Evidence and Reporting

Before declaring an item complete, report:

- Lanes run and exact commands.
- Whether `pnpm check` ran and its result.
- Conformance or smoke evidence when a provider or capability is involved.
- Any lane intentionally omitted and the reason.
- Known residual risks or open questions.

Do not claim a worker self-report as proof. Gates require command output, captured
artifacts, provider statuses, schemas, or other externally verifiable evidence.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Engineering Policy Index](./README.md) · **← Prev:** [Test Lanes](./test-lanes.md) · **Next →:** [Tooling and CI](./tooling-and-ci.md)

<!-- /DOCS-NAV -->
