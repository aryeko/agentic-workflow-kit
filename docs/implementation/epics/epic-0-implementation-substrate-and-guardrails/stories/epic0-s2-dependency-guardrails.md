---
title: "epic0-s2-dependency-guardrails - dependency guardrails implementation story"
id: "epic0-s2-dependency-guardrails"
epic: 0
status: "story: ready"
design:
  - "docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md"
  - "docs/design/20-sdk-and-packaging/dependency-rules.md"
  - "docs/engineering/dependency-rule-enforcement.md"
---

# epic0-s2-dependency-guardrails - Dependency Guardrails

## Purpose

Make the Dependency Rule executable through static import-graph guardrails over the package graph
produced by `epic0-s1-package-graph`.

## Normative design

- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/engineering/dependency-policy.md`
- `docs/engineering/dependency-rule-enforcement.md`
- `docs/engineering/check-gate.md`

If these sources do not answer a guardrail question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `DependencyRuleCheck`.
- Events / append intents: none.
- Provider operations / commands: `pnpm deps`.
- Failure and degraded tokens: `dependency-rule-violation`, `provider-peer-import`,
  `sdk-banned-import`, `production-testkit-import`.
- Evidence records / attestations: passing and failing dependency-cruiser fixtures for every named
  package-boundary rule.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Configure dependency-cruiser to enforce the allowed and forbidden package matrix.
- Include named rules for SDK forbidden imports, provider peer imports, provider executable/testkit
  imports, testkit SDK-only imports, production testkit/fixture imports, and owner-only external
  dependency placement.
- Prove every rule with at least one passing fixture and one failing fixture or equivalent assertion.
- Wire `pnpm deps` to run the guardrails over `packages`, `tooling`, and `tests`.

## Out of scope

- Creating packages, owned by `epic0-s1-package-graph`.
- TypeScript project references, owned by `epic0-s3-typescript-solution`.
- Local gate sequencing beyond exposing `pnpm deps`, owned by `epic0-s5-check-gate`.
- Relaxing or revising the frozen Dependency Rule.

## Dependencies and frozen inputs

- Covers signals: Epic 0 Output "Static dependency guardrails that enforce the Dependency Rule."
- Depends on: `epic0-s1-package-graph`.
- Depended on by: `epic0-s5-check-gate`.
- Shared shapes consumed: `epic0-s1-package-graph/PackageTargetPathset`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `pnpm deps` runs dependency-cruiser against `packages`, `tooling`, and `tests` - evidence:
  script assertion.
- **AC-2** An SDK import from any `provider-*`, `cli`, `mcp`, or `testkit` package fails with a named
  rule violation - evidence: dependency-cruiser fixture.
- **AC-3** An SDK import from `@octokit/*`, `execa`, a native containment helper, `child_process`, an
  MCP runtime, or a CLI parser fails with a named rule violation - evidence: dependency-cruiser
  fixture.
- **AC-4** A `provider-*` package importing a peer provider package fails with a named rule violation -
  evidence: dependency-cruiser fixture.
- **AC-5** Production code importing `testkit`, conformance helpers, fixtures, or test helpers fails
  outside allowed test paths - evidence: dependency-cruiser fixture.
- **AC-6** Owner-only external dependencies are accepted only in their owning packages:
  `@octokit/*` in `provider-github`, process helpers in `provider-local`, MCP runtime in `mcp`, and
  CLI parsers in `cli` - evidence: positive and negative dependency fixtures.
- **AC-7** Cycles and non-exempt orphan modules fail the dependency lane - evidence: graph hygiene
  fixture.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Configure dependency-cruiser to enforce allowed and forbidden package matrix | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 |
| Named rule: SDK forbidden imports | AC-2, AC-3 |
| Named rule: provider peer imports | AC-4 |
| Named rule: provider executable/testkit imports | AC-5 |
| Named rule: testkit SDK-only imports | AC-2, AC-3 |
| Named rule: production testkit/fixture imports | AC-5 |
| Named rule: owner-only external dependency placement | AC-6 |
| Prove every rule with at least one passing fixture and one failing fixture | AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 |
| Wire `pnpm deps` to run guardrails over `packages`, `tooling`, and `tests` | AC-1 |
| `DependencyRuleCheck` (interface / type) | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 |
| Command `pnpm deps` | AC-1 |
| Failure token `dependency-rule-violation` | AC-2, AC-3, AC-4, AC-5, AC-6 |
| Failure token `provider-peer-import` | AC-4 |
| Failure token `sdk-banned-import` | AC-2, AC-3 |
| Failure token `production-testkit-import` | AC-5 |
| Evidence records: passing and failing fixtures for every named package-boundary rule | AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `dependency-rule-violation` | Any import edge breaks `dependency-rules.md`. | `pnpm deps` exits non-zero and names the violated rule. | AC-2, AC-3, AC-4, AC-5, AC-6 |
| `provider-peer-import` | One provider imports another provider. | The provider peer rule fails before typecheck or tests. | AC-4 |
| `sdk-banned-import` | SDK imports a concrete provider, executable, testkit, process helper, or concrete client. | The SDK-specific rule fails with package and import path evidence. | AC-2, AC-3 |
| `production-testkit-import` | Production source imports testkit or fixture helpers. | The production source rule fails while test files remain exempt. | AC-5 |

## Quality bar

- Coverage scope and threshold: dependency guardrail helper tests and fixtures at 90% minimum, aiming
  for 95%.
- Required tests, catalogued by AC and failure row: script assertion for AC-1; dependency-cruiser
  negative fixtures for AC-2 through AC-7; positive allowed-edge fixtures for AC-6.
- Determinism constraints: fixture output is stable and rule names are asserted, not snapshot-only.
- Dependency boundaries: must be no looser than
  `docs/design/20-sdk-and-packaging/dependency-rules.md`.
- File-size or module-size constraints: dependency-cruiser configuration remains focused; extract rule
  helpers if it approaches the repo file-size cap.
- Domain non-negotiables: do not weaken any guardrail to make the check pass.

## Required reading

- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/engineering/dependency-policy.md`
- `docs/engineering/dependency-rule-enforcement.md`
- `docs/engineering/check-gate.md`
- `epic0-s1-package-graph` story contract

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The dependency-cruiser configuration and fixture tests providing `DependencyRuleCheck`, plus the
evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm deps` output and `pnpm check` result.
- Coverage command and number for fixture helpers.
- Sweep-grep results showing no broad dependency-rule exclusions were added.

## Boundaries and STOP conditions

- Package or module boundary: static dependency-rule enforcement only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `.dependency-cruiser.cjs`, `tooling/dep-cruiser/**`, `tests/dependency-rules/**`.
- Forbidden dependencies: guardrail tooling must not import runtime packages or add runtime package
  dependencies to satisfy tests.
- STOP when: satisfying a story requires loosening the frozen Dependency Rule or adding a package not
  produced by `epic0-s1-package-graph`.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 0 - stories](./README.md) · **← Prev:** [epic0-s1-package-graph - package graph implementation story](./epic0-s1-package-graph.md) · **Next →:** [epic0-s3-typescript-solution - TypeScript solution implementation story](./epic0-s3-typescript-solution.md)

<!-- /DOCS-NAV -->
