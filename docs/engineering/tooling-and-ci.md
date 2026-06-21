---
title: kit-vnext — Tooling and CI
status: high-level design
last-reviewed: "2026-06-19"
---

# Tooling and CI

## Toolchain

| Tool | Version | Role |
|---|---|---|
| Node.js | >= 24 | Runtime and build host |
| pnpm | 11.5.1 | Package manager, workspace orchestration |
| TypeScript | ~6.0 | Type-checking and compilation |
| Biome | 2.5 | Formatting and linting (single tool, single config) |
| Vitest | 4.1 | Test runner (four lanes: unit, integration, conformance-mock, smoke-real) |
| dependency-cruiser | latest | Import graph analysis and layer enforcement |
| zod | pinned in sdk | Runtime schema validation (allowed in `sdk`; the only schema library permitted there) |
| fast-check | test-only | Property-based testing (not in production code paths) |

Changesets are deferred until packages are ready to publish. Adding changesets before
packages exist creates noise with no benefit.

## TypeScript Configuration Layout

The root `tsconfig.json` is a **solution file** — it has no `include` of its own and
only lists references:

```jsonc
// tsconfig.json (solution file)
{ "files": [], "references": [{ "path": "./tsconfig.infra.json" }] }
```

`tsconfig.infra.json` covers the current infra scope: `tooling/`, `tests/`, and
`vitest.config.ts`. It extends `tsconfig.base.json`.

`tsconfig.base.json` defines the shared compiler options: `target: ES2022`,
`module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`, `composite: true`,
`verbatimModuleSyntax: true`, `declaration: true`, `declarationMap: true`,
`sourceMap: true`.

**NodeNext ESM** is the module system for all packages. Import paths must include
explicit `.js` extensions (TypeScript resolves them to `.ts` sources at build time).

### Per-Package Pattern (for design owners)

Each package adds its own `tsconfig.json` that:

1. Extends `../../tsconfig.base.json` (adjust path for nesting depth).
2. Sets `outDir: ./dist`, `rootDir: ./src`, `composite: true`.
3. Declares only the packages it is allowed to import via `references`.
4. Is added to the root solution file (or a layer solution file) so `tsc -b` from the
   root picks it up.

```jsonc
// packages/my-package/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true
  },
  "include": ["src"],
  "references": [
    // Only packages this package is explicitly allowed to import:
    { "path": "../sdk" }
  ]
}
```

Project references enforce at compile time that a package can only import another
package declared as a reference. This is the second enforcement guard complementing
dependency-cruiser. See [dependency-rule-enforcement.md](dependency-rule-enforcement.md).

## Build Strategy

`tsc -b` builds all referenced projects in dependency order. Each package compiles to
its own `dist/` directory. Consumers use workspace-protocol links
(`"my-dep": "workspace:*"`) and TypeScript follows the `references` to resolve types
without requiring `dist/` to be built first during development.

**CLI bundle (reserved):** the `cli` package may be bundled with esbuild so it ships
as a single file with tree-shaking. The decision to use esbuild, and the exact bundle
config, belongs to the implementation track. The `tsc -b` compilation of `cli` still
happens inside the verify gate; bundling is an additional step.

**Native containment helper (reserved):** the execution-host containment helper used
by `provider-local` is a non-TypeScript artifact. The language it is written in is the
design owners' decision. Its build and packaging are reserved and not part of the
current tooling infra.

## GitHub Actions: `check.yml`

Two jobs are defined in `.github/workflows/check.yml`.

### `check` job (required, every push/PR)

Runs on `ubuntu-latest`. Steps:

1. Checkout.
2. Install pnpm 11.5.1.
3. Set up Node 24 with pnpm cache.
4. `pnpm install --frozen-lockfile`.
5. `pnpm check` (the full gate — format, lint, deps, typecheck, test:unit, test:int, test:conf, coverage).
6. `pnpm pack:dry-run`.

This job is a required branch-protection check. It must pass before any PR merges to
`v-next`. `pack:dry-run` runs only in CI because it exercises packaging metadata that
is meaningless before `pnpm install` with a lockfile.

### `smoke` job (gated)

Runs on `ubuntu-latest`. Triggered by:

- Any push to `main` or `v-next`.
- Any PR with the `smoke` label.

Steps: same setup as `check`, then `pnpm test:smoke` (`vitest run --project smoke-real`).

This job is **not** a required branch-protection check yet. It is inert until real
drivers and the native containment helper land — `smoke-real` currently has no tests
and passes via `passWithNoTests: true`. Add it to branch protection once the first real
smoke test is committed.

## Workspace Shape

`pnpm-workspace.yaml` declares `packages/*` as the only pnpm workspace package
pattern. `tooling/` and `tests/` are not pnpm workspace packages but are still part of
the gate through TypeScript project references, dependency-cruiser, and Vitest
configuration. `packages/` is the workspace slot for implementation packages; its
contents are design-owned and added by implementation work.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Engineering Policy Index](./README.md) · **← Prev:** [Testing Policy](./testing-policy.md) · **Next →:** [Provider-Neutral Agent Driver Contract (v2)](../agent-provider-contract-researches/gemini31pro.md)

<!-- /DOCS-NAV -->
