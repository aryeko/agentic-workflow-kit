---
title: "epic0-s3-typescript-solution - TypeScript solution implementation story"
id: "epic0-s3-typescript-solution"
epic: 0
status: "story: draft"
design:
  - "docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md"
  - "docs/engineering/dependency-rule-enforcement.md"
  - "docs/engineering/check-gate.md"
---

# epic0-s3-typescript-solution - TypeScript Solution

## Purpose

Wire TypeScript project references so package boundaries compile independently and reinforce the
Dependency Rule before later domain stories add behavior.

## Normative design

- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md`
- `docs/design/20-sdk-and-packaging/package-target.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/engineering/dependency-rule-enforcement.md`
- `docs/engineering/check-gate.md`

If these sources do not answer a TypeScript reference question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `CompositePackageProject`, `TypecheckProjectGraph`.
- Events / append intents: none.
- Provider operations / commands: `pnpm typecheck`.
- Failure and degraded tokens: `project-reference-missing`, `forbidden-ts-reference`,
  `non-composite-package-project`.
- Evidence records / attestations: root TypeScript solution reference graph and per-package
  `tsconfig.json` inventory.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Make root `tsconfig.json` a solution file that references the package projects and infrastructure
  project.
- Give every target package a composite `tsconfig.json` with `rootDir`, `outDir`, declaration output,
  and references only to packages allowed by `dependency-rules.md`.
- Ensure `pnpm typecheck` runs `tsc -b` over the full solution graph.
- Produce `CompositePackageProject` and `TypecheckProjectGraph` for export-template and check-gate
  stories.

## Out of scope

- Creating package directories or manifests, owned by `epic0-s1-package-graph`.
- Import-graph rules, owned by `epic0-s2-dependency-guardrails`.
- Package template files, owned by `epic0-s4-export-templates`.
- Runtime behavior or domain type implementation.

## Dependencies and frozen inputs

- Covers signals: Epic 0 Output "Root TypeScript solution wiring and package reference
  conventions."
- Depends on: `epic0-s1-package-graph`.
- Depended on by: `epic0-s4-export-templates`, `epic0-s5-check-gate`.
- Shared shapes consumed: `epic0-s1-package-graph/WorkspacePackageManifest`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** Root `tsconfig.json` references every target package project and the infrastructure project
  needed by repository tooling - evidence: TypeScript solution inventory test.
- **AC-2** Every target package `tsconfig.json` has `composite: true`, package-local `rootDir` and
  `outDir`, declaration output, and strict settings inherited from `tsconfig.base.json` - evidence:
  config schema test.
- **AC-3** Project references follow the allowed package dependency matrix; forbidden references are
  absent even when the import graph is empty - evidence: reference graph test.
- **AC-4** `pnpm typecheck` invokes `tsc -b` over the solution and exits zero with empty package
  skeletons - evidence: command output.
- **AC-5** A fixture package reference that violates the Dependency Rule fails before tests run -
  evidence: typecheck fixture or reference graph assertion.
- **AC-6** The story emits `TypecheckProjectGraph` evidence in stable package order - evidence:
  generated inventory artifact.

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `project-reference-missing` | A target package is absent from the root solution. | TypeScript solution inventory test fails with the missing package. | AC-1 |
| `forbidden-ts-reference` | A package `tsconfig.json` references a forbidden package. | Reference graph test fails before implementation code can rely on it. | AC-3, AC-5 |
| `non-composite-package-project` | A package project is not composite or omits declaration output. | Config schema test fails with the package named. | AC-2 |

## Quality bar

- Coverage scope and threshold: TypeScript config/reference helpers at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: root inventory for AC-1; per-package schema test
  for AC-2; reference graph positive/negative assertions for AC-3 and AC-5; command evidence for
  AC-4; stable inventory artifact test for AC-6.
- Determinism constraints: reference graph output is stable lexicographic package order.
- Dependency boundaries: TypeScript references must not allow an import edge forbidden by
  `dependency-rules.md`.
- File-size or module-size constraints: config-generation helpers stay under the repo file-size cap.
- Domain non-negotiables: do not add TypeScript references that make domain packages depend upward.

## Required reading

- `docs/design/20-sdk-and-packaging/package-target.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/engineering/dependency-rule-enforcement.md`
- `docs/engineering/check-gate.md`
- `epic0-s1-package-graph` story contract

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The TypeScript solution and package project-reference graph providing `CompositePackageProject` and
`TypecheckProjectGraph`, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm typecheck` output and `pnpm check` result.
- Coverage command and number for config/reference helpers.
- Sweep-grep results showing no forbidden project references or package aliases were added.

## Boundaries and STOP conditions

- Package or module boundary: TypeScript solution files and package `tsconfig.json` files.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `tsconfig.json`, `tsconfig.base.json`, `tsconfig.*.json`, `packages/*/tsconfig.json`.
- Forbidden dependencies: project references may only point along allowed dependency edges.
- STOP when: typecheck requires weakening strict settings, adding a forbidden reference, or changing
  the frozen package graph.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 0 - stories](./README.md) · **← Prev:** [epic0-s2-dependency-guardrails - dependency guardrails implementation story](./epic0-s2-dependency-guardrails.md) · **Next →:** [epic0-s4-export-templates - exports and templates implementation story](./epic0-s4-export-templates.md)

<!-- /DOCS-NAV -->
