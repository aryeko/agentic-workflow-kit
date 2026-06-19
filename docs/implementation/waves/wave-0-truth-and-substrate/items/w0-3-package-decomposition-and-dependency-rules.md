---
title: "w0-3 — Package decomposition & dependency-rule activation — implementation charter"
id: "w0-3"
wave: 0
layer: "tooling"
status: "item: ready"
spec: "docs/design/architecture.md (Dependency Rule); packages/README.md (design-owned map)"
---

# w0-3 — Package decomposition & dependency-rule activation

**Purpose.** Decide and document the package map for all 15 domains plus the shared packages, and turn
the Dependency Rule from a template into machine-enforced CI — the mechanical guarantee against
cross-layer mixing.

## Scope

- **Package map.** Name every package and its layer: `foundation-*` (fnd-01..04), `contracts-*` (the
  four seams), `core-*` (core-01..07), `drivers-*` (codex / github / local / markdown + mocks),
  `edge-*` (edge-01), plus the shared **conformance-kit** package and the **composition-root** package.
  Record the naming scheme, the one-package-per-domain rule, and the per-package skeleton convention
  (scoped name, `exports`/`types`, own `tsconfig.json` with `composite` + `references`, wired into the
  solution + depcruise).
- **Dependency-cruiser layer rules.** Activate the template layer rules: `core ↛ driver`,
  `contracts ↛ {core,edge,driver}`, `foundation ↛ {core,edge,driver,contracts}`
  (intra-foundation peer OK), `driver ↛ {core,edge,driver}`, `edge ↛ driver`,
  `production ↛ test-fixtures`. (Contracts MAY depend on Foundation and on sibling contracts — "Everything → Foundation" per architecture.md §2; correct the scaffolded template if it forbids `contracts → foundation`.)
- **Package-name SDK bans.** Add rules that fail if a boundary library is imported outside its one
  allowed package: `octokit` → github driver only; `execa` (+ the native helper) → local exec-host
  driver only; `pino` / `@opentelemetry/*` → edge only unless a telemetry adapter package is later
  ratified; `awilix` → composition-root only; `*sqlite*` → storage package only. This turns every "forbidden placement" cell
  in the [infra-tooling research](../../../../reviews/2026-06-19-infra-tooling-framework-research.md)
  into a CI failure.

## Out of scope

Creating the packages (each build wave creates its own, against these rules); installing any library;
the policy prose (w0-4 — but the two must agree exactly).

## Requirements owned

NFR-EXT, NFR-SOLID; the Dependency Rule as an enforced invariant.

## Required reading

`architecture.md` (Dependency Rule §); the current `.dependency-cruiser.cjs` (committed + template
rules); `packages/README.md`; the
[infra-tooling research](../../../../reviews/2026-06-19-infra-tooling-framework-research.md)
(placement matrix, required-decision #2).

## Deliverable

A package-map doc (under `docs/implementation/` or `docs/foundation/`); an updated
`.dependency-cruiser.cjs` with layer rules + package-name SDK bans active.

## Definition of done

- *Spec compliance:* the package map covers all 15 domains + conformance-kit + composition-root, each
  placed in the correct layer per the Dependency Rule.
- *Quality bar:* `pnpm deps` passes today (rules correct, trivially satisfied with no packages yet) and
  is **proven wired** — a deliberate temporary violation fixture fails `pnpm deps`, then is removed;
  `pnpm check` green.

## Boundaries

Rules + map only — no package bodies. The map is *frozen design output*; if a domain seems to need a
package the design doesn't imply, **STOP and surface** (do not invent packages — per CLAUDE.md).
