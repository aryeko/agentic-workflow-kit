---
title: "epic0-s5-check-gate - local check gate implementation story"
id: "epic0-s5-check-gate"
epic: 0
status: "story: ready"
design:
  - "docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md"
  - "docs/engineering/check-gate.md"
  - "docs/engineering/test-lanes.md"
---

# epic0-s5-check-gate - Local Check Gate

## Purpose

Wire one local verification command so later epics prove docs nav, formatting, lint, dependency
rules, typecheck, and hermetic test lanes through `pnpm check`.

## Normative design

- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`
- `docs/engineering/dependency-rule-enforcement.md`

If these sources do not answer a gate question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `LocalCheckGate`.
- Events / append intents: none.
- Provider operations / commands: `pnpm docs:nav:check`, `pnpm format:check`, `pnpm lint`,
  `pnpm deps`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:int`, `pnpm test:conf`,
  `pnpm coverage:baseline`, `pnpm check`.
- Failure and degraded tokens: `stale-docs-nav`, `format-failed`, `lint-failed`, `deps-failed`,
  `typecheck-failed`, `unit-failed`, `integration-failed`, `conformance-failed`,
  `coverage-baseline-failed`.
- Evidence records / attestations: ordered gate transcript showing fail-fast step order.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Wire `pnpm check` to run the local gate in the order specified by `check-gate.md`.
- Keep smoke tests excluded from the fast local loop while preserving a separate smoke command.
- Configure Vitest lane names and file globs from `test-lanes.md`.
- Load the zero-real-process guard for hermetic unit and conformance-mock lanes.
- Ensure stale docs nav fails before format, lint, dependency, typecheck, or tests.

## Out of scope

- Defining dependency-cruiser rules, owned by `epic0-s2-dependency-guardrails`.
- Defining TypeScript project references, owned by `epic0-s3-typescript-solution`.
- Defining reusable package templates, owned by `epic0-s4-export-templates`.
- CI-only `pack:dry-run` and gated smoke job branch-protection changes.

## Dependencies and frozen inputs

- Covers signals: Epic 0 Output "Local `pnpm check` gate wired so later epics can prove format,
  lint, dependency, typecheck, and test lanes through one command."
- Depends on: `epic0-s2-dependency-guardrails`, `epic0-s3-typescript-solution`,
  `epic0-s4-export-templates`.
- Depended on by: later implementation epics.
- Shared shapes consumed: `epic0-s2-dependency-guardrails/DependencyRuleCheck`,
  `epic0-s3-typescript-solution/TypecheckProjectGraph`,
  `epic0-s4-export-templates/PackageTemplateContract`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `pnpm check` runs fail-fast in this order: docs nav check, format check, lint, deps,
  typecheck, unit, integration, conformance-mock, coverage baseline - evidence: gate script test.
- **AC-2** `pnpm docs:nav:check` fails when generated docs navigation is stale and runs before
  formatting - evidence: stale-nav fixture.
- **AC-3** Unit and conformance-mock lanes load the zero-real-process guard, while integration permits
  local filesystem access and smoke-real remains outside `pnpm check` - evidence: Vitest lane test.
- **AC-4** `pnpm deps` and `pnpm typecheck` in the gate consume the outputs from
  `epic0-s2-dependency-guardrails` and `epic0-s3-typescript-solution` - evidence: gate dependency
  assertion.
- **AC-5** A failure in an earlier gate step prevents later steps from running - evidence:
  fail-fast harness.
- **AC-6** `pnpm check` exits zero on the clean substrate and the transcript names every step -
  evidence: command transcript.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Wire `pnpm check` to run the local gate in the order from `check-gate.md` | AC-1 |
| Keep smoke tests excluded from the fast local loop; preserve a separate smoke command | AC-3 |
| Configure Vitest lane names and file globs from `test-lanes.md` | AC-3 |
| Load zero-real-process guard for unit and conformance-mock lanes | AC-3 |
| Ensure stale docs nav fails before format, lint, dependency, typecheck, or tests | AC-2, AC-5 |
| `LocalCheckGate` (interface / type) | AC-1, AC-6 |
| Command `pnpm docs:nav:check` | AC-2 |
| Command `pnpm format:check` | AC-1 |
| Command `pnpm lint` | AC-1 |
| Command `pnpm deps` | AC-1, AC-4 |
| Command `pnpm typecheck` | AC-1, AC-4 |
| Command `pnpm test:unit` | AC-1, AC-3 |
| Command `pnpm test:int` | AC-1, AC-3 |
| Command `pnpm test:conf` | AC-1, AC-3 |
| Command `pnpm coverage:baseline` | AC-1 |
| Command `pnpm check` | AC-1, AC-6 |
| Failure token `stale-docs-nav` | AC-2 |
| Failure token `format-failed` | AC-1, AC-5 |
| Failure token `lint-failed` | AC-1, AC-5 |
| Failure token `deps-failed` | AC-1, AC-4, AC-5 |
| Failure token `typecheck-failed` | AC-1, AC-4, AC-5 |
| Failure token `unit-failed` | AC-1, AC-5 |
| Failure token `integration-failed` | AC-1, AC-5 |
| Failure token `conformance-failed` | AC-1, AC-5 |
| Failure token `coverage-baseline-failed` | AC-1 |
| Evidence record: ordered gate transcript showing fail-fast step order | AC-6 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `stale-docs-nav` | Docs navigation output is stale. | `pnpm check` stops at docs nav before format/lint. | AC-2 |
| `format-failed` | Formatter check returns non-zero. | The gate stops before lint. | AC-1, AC-5 |
| `lint-failed` | Lint returns non-zero. | The gate stops before dependency analysis. | AC-1, AC-5 |
| `deps-failed` | Dependency-cruiser returns non-zero. | The gate stops before typecheck. | AC-1, AC-4, AC-5 |
| `typecheck-failed` | `tsc -b` returns non-zero. | The gate stops before tests. | AC-1, AC-4, AC-5 |
| `unit-failed` | Unit lane returns non-zero. | The gate stops before integration tests. | AC-1, AC-5 |
| `integration-failed` | Integration lane returns non-zero. | The gate stops before conformance-mock tests. | AC-1, AC-5 |
| `conformance-failed` | Conformance-mock lane returns non-zero. | The gate stops before coverage baseline. | AC-1, AC-5 |
| `coverage-baseline-failed` | Coverage baseline returns non-zero. | `pnpm check` exits non-zero and reports the baseline command. | AC-1 |

## Quality bar

- Coverage scope and threshold: gate script and lane harness tests at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: gate script order for AC-1; stale-nav fixture for
  AC-2; lane guard tests for AC-3; gate dependency assertions for AC-4; fail-fast harness for AC-5;
  clean transcript for AC-6.
- Determinism constraints: gate transcript order is stable and does not depend on filesystem glob
  ordering.
- Dependency boundaries: check gate must execute the dependency guardrails and TypeScript project
  references without weakening them.
- File-size or module-size constraints: gate helper code remains focused and extracted under tooling
  if needed.
- Domain non-negotiables: smoke-real stays outside `pnpm check`; no real process/network lane is added
  to the fast local loop.

## Required reading

- `docs/engineering/check-gate.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`
- `docs/engineering/dependency-rule-enforcement.md`
- `epic0-s2-dependency-guardrails`, `epic0-s3-typescript-solution`, and
  `epic0-s4-export-templates` story contracts

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `LocalCheckGate` script surface and lane configuration, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm docs:nav:check`, `pnpm check`, and lane command transcripts.
- Coverage command and number for gate/lane helpers.
- Sweep-grep results proving smoke-real is not in the local `pnpm check` chain.

## Boundaries and STOP conditions

- Package or module boundary: root local gate scripts and test-lane configuration.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `package.json`, `biome.json`, `vitest.config.ts`, `tooling/no-side-effects.setup.ts`,
  `tooling/docs-nav/**`, `tests/gate/**`.
- Forbidden dependencies: the gate must not rely on real providers, credentials, network, or process
  execution except where the smoke-real lane is explicitly excluded from `pnpm check`.
- STOP when: the gate can pass only by skipping a required step, weakening a guardrail, or moving
  smoke-real into the local loop.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 0 - stories](./README.md) · **← Prev:** [epic0-s4-export-templates - exports and templates implementation story](./epic0-s4-export-templates.md) · **Next →:** [Epic 0 - story DAG](../story-dag.md)

<!-- /DOCS-NAV -->
