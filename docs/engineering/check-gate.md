---
title: kit-vnext — Check Gate
status: high-level design
last-reviewed: "2026-06-19"
---

# Check Gate

`pnpm check` is the required local and CI gate that every implementation story must
pass. It runs eight steps in sequence, fail-fast, cheapest first. Nothing merges to
`v-next` without a green gate.

## Step Composition

| # | Script | Tool | What It Checks |
|---|---|---|---|
| 1 | `format:check` | `biome format --check .` | Formatting — catches whitespace and style before anything compiles |
| 2 | `lint` | `biome lint .` | Lint rules — catches obvious errors early |
| 3 | `deps` | `depcruise --config .dependency-cruiser.cjs packages tooling tests` | Dependency-graph rules — no cycles, no orphans, and package-boundary violations |
| 4 | `typecheck` | `tsc -b` | TypeScript project references — full compilation of all composite projects |
| 5 | `test:unit` | `vitest run --project unit` | Hermetic unit tests |
| 6 | `test:int` | `vitest run --project integration` | Integration tests (real filesystem, no network) |
| 7 | `test:conf` | `vitest run --project conformance-mock --passWithNoTests` | Conformance suites against mock drivers (hermetic); passes empty until provider mocks land |
| 8 | `coverage:baseline` | Vitest coverage reporter | Baseline coverage instrumentation until implementation packages land |

**Ordering rationale.** Steps are arranged cheapest-first so that the most common
mistakes (formatting, lint) are caught in under a second, before the type-checker or
test runner is invoked. A failure in step 1 saves the full cost of steps 2–8.

## Local Inner Loop

Run `pnpm check` locally before pushing. All eight steps run. The gate completes in
seconds when packages are small and hermetic lanes have no real I/O. Smoke tests and
pack dry-run are intentionally excluded from `pnpm check` so the local loop stays fast.

## CI Split

```mermaid
flowchart TD
    A[push / PR] --> B[check job]
    B --> B1["1 format:check"]
    B1 --> B2["2 lint"]
    B2 --> B3["3 deps"]
    B3 --> B4["4 typecheck"]
    B4 --> B5["5 test:unit"]
    B5 --> B6["6 test:int"]
    B6 --> B7["7 test:conf"]
    B7 --> B8["8 coverage:baseline"]
    B8 --> B9["pack:dry-run (CI only)"]

    A --> C{smoke trigger?}
    C -->|push to main/v-next or 'smoke' label| D[smoke job]
    D --> D1["vitest run --project smoke-real"]
```

The `check` job (all eight steps plus `pack:dry-run`) is a required branch-protection
check. `pack:dry-run` runs only in CI because it exercises packaging metadata that is
meaningless before `pnpm install` with a lockfile.

The `smoke` job runs `vitest run --project smoke-real`. It fires on pushes to `main`
or `v-next`, or on PRs labelled `smoke`. It is **not** a required branch-protection
check yet; it is inert until real drivers and the native containment helper land (all
smoke tests currently pass via `passWithNoTests: true`). Add it to branch protection
once the first real smoke test is committed.

## Smoke Tests Are Excluded

Smoke tests require real processes, network, credentials, or external services. They
are not part of `pnpm check` and must not be made a dependency of the fast local loop.
See [test-lanes.md](test-lanes.md) for the `smoke-real` lane definition.

## Gate Integrity

A story is not done until `pnpm check` passes end-to-end without modification to the
gate itself. Do not skip steps, adjust thresholds, or widen the `no-orphan` exclusion
list to make the gate green. Investigate and fix the underlying issue instead.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Engineering Policy Index](./README.md) · **← Prev:** [Engineering Policy Index](./README.md) · **Next →:** [Dependency Policy](./dependency-policy.md)

<!-- /DOCS-NAV -->
