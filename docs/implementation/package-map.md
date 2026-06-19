# Package Map And Dependency Boundaries

This map freezes the Wave 0 package naming and layer placement used by the
dependency-cruiser rules. Package bodies are still out of scope; each later
work item creates its package skeleton against this map.

## Naming Scheme

Every package lives directly under `packages/` and uses the scoped npm name
`@kit-vnext/<directory-name>`.

Each design domain owns exactly one package. The directory prefix encodes the
Dependency-Rule layer:

| Layer | Directory prefix | Allowed incoming direction |
|---|---|---|
| Foundation | `foundation-*` | Any layer may depend on foundation |
| Contracts | `contracts-*` | Core, drivers, edge, and contracts may depend on contracts |
| Control plane | `core-*` | Edge and composition root may depend on core |
| Drivers | `drivers-*` | Composition root and conformance tests may depend on drivers |
| Edge | `edge-*` | Composition root / runtime entrypoints |
| Test support | `conformance-kit` | Tests and conformance-only code |
| Composition root | `composition-root` | Runtime graph assembly only |

Contracts may depend on foundation packages and sibling contracts. Foundation
packages may depend on sibling foundation packages only.

## Domain Packages

| Domain | Directory | Package name | Layer |
|---|---|---|---|
| `fnd-01` | `packages/foundation-fnd-01` | `@kit-vnext/foundation-fnd-01` | Foundation |
| `fnd-02` | `packages/foundation-fnd-02` | `@kit-vnext/foundation-fnd-02` | Foundation / storage SDK boundary |
| `fnd-03` | `packages/foundation-fnd-03` | `@kit-vnext/foundation-fnd-03` | Foundation |
| `fnd-04` | `packages/foundation-fnd-04` | `@kit-vnext/foundation-fnd-04` | Foundation |
| Agent seam | `packages/contracts-agent` | `@kit-vnext/contracts-agent` | Contracts |
| Execution Host seam | `packages/contracts-execution-host` | `@kit-vnext/contracts-execution-host` | Contracts |
| Forge seam | `packages/contracts-forge` | `@kit-vnext/contracts-forge` | Contracts |
| Work Source seam | `packages/contracts-work-source` | `@kit-vnext/contracts-work-source` | Contracts |
| `core-01` | `packages/core-01` | `@kit-vnext/core-01` | Control plane |
| `core-02` | `packages/core-02` | `@kit-vnext/core-02` | Control plane |
| `core-03` | `packages/core-03` | `@kit-vnext/core-03` | Control plane |
| `core-04` | `packages/core-04` | `@kit-vnext/core-04` | Control plane |
| `core-05` | `packages/core-05` | `@kit-vnext/core-05` | Control plane |
| `core-06` | `packages/core-06` | `@kit-vnext/core-06` | Control plane |
| `core-07` | `packages/core-07` | `@kit-vnext/core-07` | Control plane |
| Codex agent driver | `packages/drivers-codex` | `@kit-vnext/drivers-codex` | Drivers |
| GitHub forge driver | `packages/drivers-github` | `@kit-vnext/drivers-github` | Drivers |
| Local execution-host driver | `packages/drivers-local` | `@kit-vnext/drivers-local` | Drivers |
| Markdown work-source driver | `packages/drivers-markdown` | `@kit-vnext/drivers-markdown` | Drivers |
| Mock provider drivers | `packages/drivers-mocks` | `@kit-vnext/drivers-mocks` | Drivers |
| `edge-01` | `packages/edge-01` | `@kit-vnext/edge-01` | Edge |
| Provider conformance kit | `packages/conformance-kit` | `@kit-vnext/conformance-kit` | Test support |
| Runtime composition root | `packages/composition-root` | `@kit-vnext/composition-root` | Composition root |

## Skeleton Convention

When a package is created, it must include:

1. `package.json` with `name`, `version`, `type`, `exports`, and `types`.
2. `tsconfig.json` extending `../../tsconfig.base.json`, with `rootDir`,
   `outDir`, `composite: true`, and references only to packages allowed by the
   Dependency Rule.
3. `src/` entrypoints that use explicit `.js` import specifiers.
4. A reference from the root TypeScript solution or its layer solution.
5. Coverage from `.dependency-cruiser.cjs`.

The package name is the boundary. Do not add ad hoc shared packages; surface
new package needs through the design process before implementation.

## SDK Placement Rules

dependency-cruiser enforces these external library placements:

| SDK / package family | Only allowed in |
|---|---|
| `octokit`, `@octokit/*` | `packages/drivers-github` |
| `execa`, native containment helper package | `packages/drivers-local` |
| `pino`, `@opentelemetry/*` | `packages/edge-01` |
| `awilix` | `packages/composition-root` |
| `node:sqlite`, `*sqlite*` packages | `packages/foundation-fnd-02` |
