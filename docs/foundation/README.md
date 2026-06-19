# Foundation

This directory records foundation-layer facts for the tracked kit-vnext tree:
tooling, verification, workspace shape, CI, and test containment. It does not
define package boundaries or domain behavior; those are owned by
`docs/design/`.

## Current tracked foundation

- `package.json` pins Node 24+ and pnpm 11.5.1.
- `pnpm-workspace.yaml` declares `packages/*` as the only pnpm workspace
  package pattern.
- `tooling/` and `tests/` are not pnpm workspace packages. They are still part
  of the gate through TypeScript project references, dependency-cruiser, and
  Vitest configuration.
- `packages/` is the workspace slot for implementation packages. Its contents
  are design-owned and added by implementation work.

## Local verify gate

`pnpm check` runs the local required gate in this order:

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm deps`
4. `pnpm typecheck`
5. `pnpm test:unit`
6. `pnpm test:int`
7. `pnpm test:conf`

The gate is fail-fast. `pnpm test:smoke` is intentionally outside `pnpm check`
because the smoke lane is the only lane intended for real processes and network
access.

## CI split

The required GitHub Actions job is named `check`. It installs dependencies,
runs `pnpm check`, and then runs `pnpm pack:dry-run`.

The separate `smoke` job runs `pnpm test:smoke`. It is gated by push or the
`smoke` pull-request label and should not be treated as part of the local inner
loop.

## Zero-real-process guard

The guard lives in the test setup and uses Vitest primitives:

- `vi.stubGlobal` replaces global process/network entry points such as
  `fetch`.
- `vi.mock` replaces Node modules used for process or network side effects,
  including process spawning and socket/HTTP clients.

The guard applies only to the Vitest projects configured to load that setup.
Those lanes fail immediately when a test accidentally attempts a covered real
process or network operation. The smoke lane is excluded by design so real
driver tests can run there when explicitly requested.

This guard is a containment layer, not a replacement for design-owned capability
attestation, credential isolation, or provider seam tests.
