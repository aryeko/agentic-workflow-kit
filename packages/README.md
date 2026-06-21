# packages/

This directory is the pnpm workspace slot for kit-vnext implementation packages.

The current design-owned package target is SDK-centered and contains exactly eight
delivery packages:

```txt
packages/
  sdk/
  cli/
  mcp/
  provider-codex/
  provider-local/
  provider-github/
  provider-markdown/
  testkit/
```

The authoritative package map and dependency matrix live in:

- `docs/design/20-sdk-and-packaging/package-target.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`
- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md`

Do not treat design domains as npm package boundaries. Domains organize the design
corpus; packages define runtime and dependency boundaries.

## Transition status

This repository still contains pre-transition implementation packages such as
`foundation-fnd-*`, `contracts-execution-host`, `drivers-mocks`, and
`conformance-kit`. They are retained so the existing source, tests, and TypeScript
project references keep working while the source is migrated into the SDK-centered
package target.

Those package names are not current package-model truth. New product code should not
add more packages in that style. A future package migration should fold the existing
source into:

- `sdk` for deterministic runtime, provider interfaces, storage ports, and in-memory
  defaults.
- `provider-*` for concrete drivers.
- `cli` and `mcp` for executable wiring.
- `testkit` for provider mocks, conformance helpers, and fixtures.

## Role of this directory

`packages/` is declared in `pnpm-workspace.yaml`:

```yaml
packages:
  - packages/*
```

Any subdirectory added here is automatically picked up by pnpm as a workspace package.

## Requirements for target packages

When a target package is added or migrated, it must:

1. Carry its own `package.json` with a scoped name, version, and correct
   `exports`/`types` fields.
2. Carry its own `tsconfig.json` that extends `../../tsconfig.base.json`, sets
   `composite: true`, and declares only the project references allowed by
   `docs/design/20-sdk-and-packaging/dependency-rules.md`.
3. Be wired into the root `tsconfig.json` solution file after its source exists.
4. Be covered by `.dependency-cruiser.cjs` rules for `sdk`, `provider-*`, `cli`,
   `mcp`, and `testkit`.
5. Follow `AGENTS.md`: focused files, immutability, no hardcoded secrets, no emojis,
   TDD, and conventional commits.
