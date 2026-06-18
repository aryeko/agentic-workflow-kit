# Tooling and CI

## Toolchain

| Tool | Version | Role |
|---|---|---|
| Node.js | >= 24 | Runtime and build host |
| pnpm | 11.5.1 | Package manager, workspace orchestration |
| TypeScript | ~6.0 | Type-checking and compilation |
| Biome | 2.5 | Formatting and linting (single tool, single config) |
| Vitest | 4.1 | Test runner (four lanes) |
| dependency-cruiser | latest | Import graph analysis and layer enforcement |

Changesets are deferred until packages are ready to publish. Adding changesets
before packages exist creates noise with no benefit.

## TypeScript configuration layout

The root `tsconfig.json` is a **solution file** — it has no `include` of its
own and only lists `references`:

```jsonc
// tsconfig.json (solution file)
{ "files": [], "references": [{ "path": "./tsconfig.infra.json" }] }
```

`tsconfig.infra.json` covers the current infra scope: `tooling/`, `tests/`,
and `vitest.config.ts`. It extends `tsconfig.base.json`.

`tsconfig.base.json` defines the shared compiler options: `target: ES2022`,
`module: NodeNext`, `moduleResolution: NodeNext`, `strict: true`,
`composite: true`, `verbatimModuleSyntax: true`, `declaration: true`,
`declarationMap: true`, `sourceMap: true`.

**NodeNext ESM** is the module system for all packages. Import paths must
include explicit `.js` extensions (TypeScript resolves them to `.ts` sources
at build time).

### Per-package pattern (for design owners)

Each package adds its own `tsconfig.json` that:
1. Extends `../../tsconfig.base.json` (or `../tsconfig.base.json` depending on
   nesting depth).
2. Sets `outDir: ./dist`, `rootDir: ./src`, `composite: true`.
3. Declares only the packages it is allowed to import via `references`.
4. Is added to the root solution file (or a layer solution file) so `tsc -b`
   from the root picks it up.

## Build strategy

`tsc -b` builds all referenced projects in dependency order. Each package
compiles to its own `dist/` directory. Consumers use workspace-protocol links
(`"my-dep": "workspace:*"`) and TypeScript follows the `references` to resolve
types without requiring `dist/` to be built first during development (project
references + path-mapped sources).

**Edge CLI exception (reserved):** the future `edge` CLI entry point may be
bundled with esbuild so it ships as a single file with tree-shaking. The
decision to use esbuild, and the exact bundle config, belongs to the
implementation track. The `tsc -b` compilation of the `edge` package still
happens inside the verify gate; bundling is an additional step.

**Native containment helper (reserved):** the execution-host containment helper
(related to prov-04) is a non-TypeScript artifact. The language it is written
in is the prov-04 design owners' decision. Its build and packaging are reserved
and not part of the foundation infra. A placeholder exists in the infra docs
so the gap is visible.

## GitHub Actions: `check.yml`

Two jobs are defined in `.github/workflows/check.yml`.

### `check` job (required, every push/PR)

Runs on `ubuntu-latest`. Steps: checkout, install pnpm 11.5.1, set up Node 24
with pnpm cache, `pnpm install --frozen-lockfile`, `pnpm check` (the full
seven-step gate), `pnpm pack:dry-run`.

This job is intended for branch-protection required checks. It must pass before
any PR merges to `v-next`.

### `smoke` job (gated)

Runs on `ubuntu-latest`. Triggered by:
- Any push to `main` or `v-next`
- Any PR with the `smoke` label

Steps: same setup as `check`, then `pnpm test:smoke`.

This job is **not** in required checks yet. It is inert until real drivers and
the native containment helper land — `smoke-real` currently has no tests and
passes via `passWithNoTests: true`. Add it to branch protection once the first
real smoke test is committed.
