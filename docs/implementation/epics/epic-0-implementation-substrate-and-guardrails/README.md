---
title: Epic 0 - Implementation substrate and guardrails
epic: 0
status: "epic: frozen"
depends-on-epics: []
last-reviewed: "2026-06-22"
---

# Epic 0 - Implementation Substrate and Guardrails

## Purpose

Epic 0 makes the repository safe for feature implementation by establishing the workspace shape,
static dependency guardrails, TypeScript solution wiring, package export conventions, reusable package
templates, and the local check gate.

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|
| None | Epic 0 is the implementation substrate before domain signals are claimed. | `epic-dag.md` package graph, guardrail, solution wiring, template, and check-gate story groups. |

## Why this epic exists

The domain implementation epics need a package and verification substrate before they can land safely.
Epic 0 closes the mechanical risk first: package boundaries are present, dependency violations are
detectable, TypeScript references are rooted, and every later epic can use the same local gate.

The hard dependency edge is owned by `epic-dag.md`: Epic 1 depends on Epic 0, and no domain coverage is
claimed here.

## Frozen inputs

- `AGENTS.md` branch, worktree, and verify-gate rules.
- `docs/design/20-sdk-and-packaging/` package, dependency, SDK boundary, and wrapper guidance.
- `docs/implementation/epic-dag.md` Epic 0 node and direct dependency table.
- `docs/engineering/` verify-gate and test-lane expectations.

## Outputs

| Output | Owning story | Disposition |
|---|---|---|
| Eight-package workspace skeleton matching the frozen package boundary. | `epic0-s1-package-graph` | covered |
| Static dependency guardrails that enforce the Dependency Rule. | `epic0-s2-dependency-guardrails` | covered |
| Root TypeScript solution wiring and package reference conventions. | `epic0-s3-typescript-solution` | covered |
| Package export conventions and reusable package templates for later domain stories. | `epic0-s4-export-templates` | covered |
| Local `pnpm check` gate wired so later epics can prove format, lint, dependency, typecheck, and test lanes through one command. | `epic0-s5-check-gate` | covered |

## Scope boundaries

- In: package graph substrate, dependency guardrails, TypeScript solution wiring, package templates,
  export conventions, and local gate composition.
- Out: domain contracts, provider ports, core runtime behavior, concrete drivers, operator surfaces,
  story DAG freezing, and any design-corpus changes.
- STOP when: implementing the substrate would require inventing package boundaries outside the frozen
  design, changing domain semantics, or weakening the repository gate.

## Per-domain expectations

Epic 0 claims no domain `Story Group Signal`. Domain coverage is closed by Epic 1 through Epic 7,
which claim or defer every domain signal.

## Epic readiness

- Later epics can create package-scoped stories without redefining the package graph.
- Dependency-rule violations fail the local gate before review.
- TypeScript project references and exports let package stories compile against declared boundaries.
- The local check gate is available as the shared verification surface for every later epic.

## Deferred work

- Foundation domain signals are owned by Epic 1.
- Provider port, mock, and conformance signals are owned by Epic 2.
- Core runtime signals are owned by Epic 3 through Epic 5.
- Concrete provider driver signals are owned by Epic 6.
- Operator surface and composition signals are owned by Epic 3 and Epic 7 as described in
  `epic-dag.md`.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [epic charters](../README.md) · **← Prev:** [epic charters](../README.md) · **Next →:** [Epic 0 - stories](./stories/README.md)

**Children:** [Epic 0 - stories](./stories/README.md) · [Epic 0 - story DAG](./story-dag.md)

<!-- /DOCS-NAV -->
