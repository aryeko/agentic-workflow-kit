---
title: "epic0-s1-package-graph - package graph implementation story"
id: "epic0-s1-package-graph"
epic: 0
status: "story: ready"
design:
  - "docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md"
  - "docs/design/20-sdk-and-packaging/package-target.md"
  - "docs/design/20-sdk-and-packaging/dependency-rules.md"
---

# epic0-s1-package-graph - Package Graph

## Purpose

Create the frozen eight-package workspace skeleton so later epics implement domain surfaces inside
declared package boundaries instead of inventing package layout.

## Normative design

- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md`
- `docs/implementation/epic-dag.md`
- `docs/design/20-sdk-and-packaging/package-target.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/engineering/dependency-policy.md`

If these sources do not answer a package-boundary question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name:

- Interfaces / types: `PackageTargetPathset`, `WorkspacePackageManifest`.
- Events / append intents: none.
- Provider operations / commands: none.
- Failure and degraded tokens: `package-target-missing`, `package-target-extra`,
  `package-manifest-invalid`.
- Evidence records / attestations: package inventory proving exactly `sdk`, `cli`, `mcp`,
  `provider-codex`, `provider-local`, `provider-github`, `provider-markdown`, and `testkit`.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Create a workspace package skeleton for the eight package names in `package-target.md`.
- Make `pnpm-workspace.yaml` include the package tree and no unrelated runtime package tree.
- Give every package a manifest with a stable package name, module type, private/public posture,
  and script placeholders compatible with later package stories.
- Leave package source/test directories present but behavior-free; domain implementation belongs to
  later epics.
- Produce `PackageTargetPathset` and `WorkspacePackageManifest` for downstream Epic 0 stories to cite.

## Out of scope

- Dependency-cruiser rules, owned by `epic0-s2-dependency-guardrails`.
- TypeScript project references, owned by `epic0-s3-typescript-solution`.
- Export templates, owned by `epic0-s4-export-templates`.
- Local gate composition, owned by `epic0-s5-check-gate`.
- Any domain contract, provider interface, runtime behavior, or concrete driver.

## Dependencies and frozen inputs

- Covers signals: Epic 0 Output "Eight-package workspace skeleton matching the frozen package
  boundary."
- Depends on: none.
- Depended on by: `epic0-s2-dependency-guardrails`, `epic0-s3-typescript-solution`,
  `epic0-s4-export-templates`.
- Shared shapes consumed: none.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. Avoid "exactly as
specified."

- **AC-1** `packages/` contains only the eight package directories named in
  `package-target.md` - evidence: package inventory test.
- **AC-2** `pnpm-workspace.yaml` includes `packages/*` and does not include any runtime package path
  outside the frozen package target - evidence: workspace manifest test.
- **AC-3** Every target package has a `package.json` whose package name and role match
  `package-target.md` - evidence: manifest schema test.
- **AC-4** No package manifest introduces a dependency edge forbidden by `dependency-rules.md` -
  evidence: manifest dependency test.
- **AC-5** Package source and test skeletons contain no domain behavior, provider logic, credentials,
  network calls, process execution, or Forge concepts - evidence: skeleton sweep.
- **AC-6** The package graph evidence record serializes `PackageTargetPathset` and
  `WorkspacePackageManifest` for downstream stories - evidence: generated inventory artifact.

## Failure and degraded outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `package-target-missing` | A frozen package directory or manifest is absent. | Fail the package inventory test and block downstream substrate stories. | AC-1 |
| `package-target-extra` | A runtime package directory exists outside the frozen package target. | Fail the inventory test; do not silently accept the extra package. | AC-1 |
| `package-manifest-invalid` | A package manifest has a wrong name, role, module type, or forbidden dependency. | Fail the manifest test with the offending package named. | AC-3, AC-4 |

## Quality bar

- Coverage scope and threshold: package graph tooling and inventory tests at 90% minimum, aiming for
  95%.
- Required tests, catalogued by AC and failure row: inventory test for AC-1/AC-2, manifest schema
  test for AC-3, dependency declaration test for AC-4, skeleton sweep for AC-5, evidence artifact
  test for AC-6.
- Determinism constraints: inventory order is stable lexicographic package order.
- Dependency boundaries: package names and allowed edges must match
  `docs/design/20-sdk-and-packaging/dependency-rules.md`.
- File-size or module-size constraints: generated helper modules remain below the repo file-size cap.
- Domain non-negotiables: package graph stories must not implement domain behavior.

## Required reading

- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/README.md`
- `docs/design/20-sdk-and-packaging/package-target.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/engineering/dependency-policy.md`

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The package skeleton providing `PackageTargetPathset` and `WorkspacePackageManifest`, plus the
evidence pack.

## Evidence pack

- Test name or artifact proving each AC.
- Test name or artifact proving each failure/degraded outcome row.
- `pnpm check` result, unless the gate is blocked by an unrelated repository issue that is named.
- Coverage command and number for the stated scope.
- Sweep-grep results for forbidden package names, provider behavior, process execution, network calls,
  Forge concepts, and credential material in skeleton files.
- Package inventory artifact listing the eight target packages and no extras.

## Boundaries and STOP conditions

- Package or module boundary: workspace package identity and empty skeleton only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `pnpm-workspace.yaml`, `packages/*/package.json`, `packages/*/README.md`, `packages/*/src/**`,
  `packages/*/tests/**`.
- Forbidden dependencies: no package may import or depend on a package forbidden by
  `dependency-rules.md`; no concrete provider, CLI, MCP, or testkit import may appear in `sdk`.
- STOP when: the package target would need a ninth runtime package, a missing package from the frozen
  design, or a domain contract not owned by Epic 0.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 0 - stories](./README.md) · **← Prev:** [Epic 0 - stories](./README.md) · **Next →:** [epic0-s2-dependency-guardrails - dependency guardrails implementation story](./epic0-s2-dependency-guardrails.md)

<!-- /DOCS-NAV -->
