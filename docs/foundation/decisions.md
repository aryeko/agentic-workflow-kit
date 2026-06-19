# Foundation Infrastructure Decisions

These are the ADRs for the foundation pass, numbered as `FD-*`. They are distinct
from the architecture-level `AD-*` decisions in the design corpus; those are not
relitigated here and will be repopulated into `docs/` in a later step.

Each entry records what was decided and a one-line rationale. Background and
alternatives are omitted where the decision is uncontroversial; expand in a
follow-up if a decision is later questioned.

---

## FD-1 — Monorepo (pnpm workspaces)

**Decision:** The repository is a pnpm workspace monorepo. Packages are declared
in `pnpm-workspace.yaml` under `packages/`, `tooling/`, and `tests/`. Package
creation is design-owned; the foundation pass does not create any packages.

**Rationale:** Single dependency graph, atomic changesets across packages,
workspace protocol linking — standard choice for a TypeScript monorepo of this
scope.

---

## FD-2 — Verify gate composition

**Decision:** `pnpm check` runs seven steps in fail-fast order:
`format:check`, `lint`, `deps`, `typecheck`, `test:unit`, `test:int`,
`test:conf`. Smoke tests (`test:smoke`) and `pack:dry-run` are CI-only and
excluded from the local inner-loop gate.

**Rationale:** Fail-fast catches cheap errors (formatting, lint) before
expensive ones (type-checking, tests). The smoke lane requires real
processes/network and must not run locally by default. Pack dry-run is a
publishability check that only matters in CI.

---

## FD-3 — Four Vitest lanes and the zero-real-process guard

**Decision:** Four test lanes are defined in `vitest.config.ts`: `unit`,
`integration`, `conformance-mock`, `smoke-real`. The `unit` and
`conformance-mock` lanes load `tooling/no-side-effects.setup.ts`, which stubs
all process-spawning and network APIs with throwing mocks.

**Rationale:** Satisfies NFR-TEST: the control plane must run its conformance
suites against mock drivers with zero real processes or network. Hermetic lanes
are fast, reproducible, and safe for CI parallelism. Smoke isolation ensures
real-driver tests cannot pollute hermetic lanes.

---

## FD-4 — dependency-cruiser as the dependency enforcer

**Decision:** `pnpm deps` runs dependency-cruiser against `packages`,
`tooling`, and `tests`. The committed `.dependency-cruiser.cjs` enforces
two baseline rules (`no-circular`, `no-orphans`). Layer-based forbidden-edge
rules are provided as a template and are activated by design owners once the
package decomposition exists. TypeScript project references serve as a
second, compiler-level guard.

**Rationale:** Two independent guards (runtime graph analysis + compiler) make
layer violations visible at two points in the gate. Baseline rules are safe to
activate before any packages exist; layer rules require concrete package paths
to be meaningful.

---

## FD-5 — Toolchain pinning

**Decision:** Node >= 24, pnpm 11.5.1, TypeScript ~6.0 (NodeNext ESM,
`composite`, built via `tsc -b`), Biome 2.5 (format and lint combined),
Vitest 4.1. Changesets are deferred until packages publish. The edge CLI
may later bundle its entry with esbuild; that decision is reserved for
the implementation track.

**Rationale:** Current LTS-or-later tooling throughout. Biome replaces
ESLint + Prettier with a single tool and matching config. Changesets add
release overhead that is premature before any package is published.

---

## FD-6 — Docs grouped by concern under `docs/`

**Decision:** Documentation is grouped by concern under `docs/`: the ground-truth
design corpus lives in `docs/design/`, foundation infrastructure records stay in
`docs/foundation/`, and incident postmortems plus research live in `docs/history/`.
This supersedes the earlier roadmap Step 4 intent to drop the `kit-vnext/` qualifier
by flattening design docs directly into the `docs/` root.

**Rationale:** The repository is already scoped to kit-vnext, so a product-name
sub-path is redundant. A `design/` concern path preserves that simplification while
avoiding root README collisions and distinguishing architecture decisions from
foundation decisions.

---

## FD-7 — Package decomposition and open integration items are deferred

**Decision:** The package decomposition is design-owned and will be settled
during roadmap Step 2. Two open integration items are explicitly deferred to
core-01 / design owners and are not resolved by the infra:

- (a) prov-01's opaque `outputRef` string vs fnd-02's structured `ArtifactRef`
- (b) fnd-04's audit-event hash chain (`prevEventHash` / `eventHash`) vs the
  general event log being hash-free

The infra introduces no mapping and no unified hashing policy.

**Rationale:** Both items require design decisions about cross-package contracts.
Resolving them in infra would pre-empt the design pass and introduce coupling
without validation.
