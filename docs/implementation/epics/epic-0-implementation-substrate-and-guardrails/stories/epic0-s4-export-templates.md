---
title: "epic0-s4-export-templates - exports and templates implementation story"
id: "epic0-s4-export-templates"
epic: 0
status: "story: ready"
design:
  - "docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md"
  - "docs/design/20-sdk-and-packaging/package-target.md"
  - "docs/design/20-sdk-and-packaging/sdk-boundary.md"
---

# epic0-s4-export-templates - Exports and Templates

## Purpose

Give later domain stories one reusable package template and export convention so implementation
surfaces land consistently without re-deciding package scaffolding.

## Normative design

- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md`
- `docs/design/20-sdk-and-packaging/package-target.md`
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`

If these sources do not answer an export or template question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `PackageTemplateContract`, `PackageExportConvention`.
- Events / append intents: none.
- Provider operations / commands: none.
- Failure and degraded tokens: `export-map-missing`, `template-drift`, `template-forbidden-import`.
- Evidence records / attestations: template validation report and package export inventory.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Define a reusable package template that later stories can apply for package-local source,
  package-local tests, package manifests, and package TypeScript config.
- Define export conventions for public package entrypoints and package-local internal modules.
- Prove the template preserves the package dependency matrix and test-lane placement.
- Produce `PackageTemplateContract` and `PackageExportConvention` for the check-gate story.

## Out of scope

- Creating the initial package graph, owned by `epic0-s1-package-graph`.
- TypeScript project reference wiring, owned by `epic0-s3-typescript-solution`.
- Adding domain-specific exports, owned by later epic stories.
- Adding concrete providers or executable behavior.

## Dependencies and frozen inputs

- Covers signals: Epic 0 Output "Package export conventions and reusable package templates for later
  domain stories."
- Depends on: `epic0-s1-package-graph`, `epic0-s3-typescript-solution`.
- Depended on by: `epic0-s5-check-gate`.
- Shared shapes consumed: `epic0-s1-package-graph/WorkspacePackageManifest`,
  `epic0-s3-typescript-solution/CompositePackageProject`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** The template creates package-local `src`, test, manifest, and `tsconfig` files compatible
  with `WorkspacePackageManifest` and `CompositePackageProject` - evidence: template application test.
- **AC-2** Export maps expose public entrypoints without exposing internal test, fixture, or tooling
  paths - evidence: export inventory test.
- **AC-3** Applying the template to each target package yields no forbidden import or dependency edge -
  evidence: dependency fixture plus `pnpm deps`.
- **AC-4** Test file patterns produced by the template land in the correct Vitest lanes:
  `*.unit.test.ts`, `*.int.test.ts`, `*.conformance.test.ts`, and `*.smoke.test.ts` - evidence:
  template lane test.
- **AC-5** Reapplying the template is deterministic and produces no unrelated file churn - evidence:
  idempotence test.
- **AC-6** Later stories can cite `PackageTemplateContract` without restating package export rules -
  evidence: generated template contract artifact.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| Define reusable package template for source, tests, manifest, and TypeScript config | AC-1 |
| Define export conventions for public entrypoints and package-local internal modules | AC-2 |
| Prove template preserves the package dependency matrix | AC-3 |
| Prove template preserves test-lane placement | AC-4 |
| Produce `PackageTemplateContract` and `PackageExportConvention` for the check-gate story | AC-6 |
| `PackageTemplateContract` (interface / type) | AC-6 |
| `PackageExportConvention` (interface / type) | AC-2, AC-6 |
| Failure token `export-map-missing` | AC-2 |
| Failure token `template-drift` | AC-5 |
| Failure token `template-forbidden-import` | AC-3 |
| Evidence record: template validation report | AC-6 |
| Evidence record: package export inventory | AC-2 |

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `export-map-missing` | A package lacks the public export entrypoint required by the convention. | Export inventory test fails with the package named. | AC-2 |
| `template-drift` | Reapplying the template changes existing generated files unexpectedly. | Idempotence test fails and reports the changed paths. | AC-5 |
| `template-forbidden-import` | The template creates an import or dependency forbidden by the package matrix. | Dependency fixture or `pnpm deps` fails. | AC-3 |

## Quality bar

- Coverage scope and threshold: template/validation helpers at 90% minimum, aiming for 95%.
- Required tests, catalogued by AC and failure row: template application test for AC-1; export
  inventory test for AC-2; dependency fixture for AC-3; lane placement test for AC-4; idempotence
  test for AC-5; contract artifact test for AC-6.
- Determinism constraints: template output and export inventories are stable across reruns.
- Dependency boundaries: generated files must preserve `dependency-rules.md`.
- File-size or module-size constraints: generated template files stay focused and below repo
  file-size limits.
- Domain non-negotiables: templates do not encode domain behavior or provider-specific dependencies.

## Required reading

- `docs/design/20-sdk-and-packaging/package-target.md`
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/test-lanes.md`
- `epic0-s1-package-graph` and `epic0-s3-typescript-solution` story contracts

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The package template and export convention providing `PackageTemplateContract` and
`PackageExportConvention`, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm deps`, `pnpm typecheck`, and `pnpm check` results.
- Coverage command and number for template helpers.
- Sweep-grep results showing generated templates do not include domain behavior, secrets, process
  execution, network calls, or concrete provider clients.

## Boundaries and STOP conditions

- Package or module boundary: reusable package templates and export conventions only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `tooling/package-templates/**`, `tooling/package-exports/**`, `tests/package-templates/**`.
- Forbidden dependencies: generated template content must not add runtime dependencies beyond the
  owning package's allowed dependencies.
- STOP when: an export convention requires changing the frozen package graph or adding a domain
  surface before its epic.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 0 - stories](./README.md) · **← Prev:** [epic0-s3-typescript-solution - TypeScript solution implementation story](./epic0-s3-typescript-solution.md) · **Next →:** [epic0-s5-check-gate - local check gate implementation story](./epic0-s5-check-gate.md)

<!-- /DOCS-NAV -->
