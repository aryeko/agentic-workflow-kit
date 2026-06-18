# Scaffold Record

This file is a durable record of what the foundation pass did. It exists so
that anyone reviewing the repository history can understand the starting state
of `v-next` without reading the full git log.

## Branch lineage

`v-next` was cut from `main` at the v0.7.0 HEAD. The legacy codebase is
preserved on `main` and at tag `v0.7.0-legacy`. `v-next` is the integration
base and future mainline. No commits have been force-pushed; the full history
from `main` is reachable.

The design corpus and postmortems live on `design/autopilot-durability` and
arrive on `v-next` via a later PR (roadmap Step 3). They are not present in
the foundation pass.

## Legacy wipe — what was dropped on `v-next`

The following were removed to clear the ground for the v1.0.0 rebuild:

**Packages and feature directories:**
- `packages/` — legacy orchestrator package
- `skills/`, `presets/`, `examples/`, `plugins/`, `references/`, `assets/`

**Test and script directories:**
- `test/`, `scripts/`

**Agent and workflow configuration:**
- `.agents/`, `.workflow/`, `.claude-plugin/`, `.codex-plugin/`, `.mcp.json`

**Legacy Vitest configs:**
- `vitest.config.ts` (legacy), `vitest.codex-smoke.config.ts`

**Legacy documentation:**
- `AGENTS.md` (legacy), `README.md` (legacy), `CHANGELOG.md`
- `docs/` (legacy) — contained: README, architecture overview, brand guide,
  getting-started, PRDs, superpowers, test plan, tracks

## What was kept and refreshed

The following files were retained from `main` and updated as needed:

| File / Directory | Notes |
|---|---|
| `LICENSE` | Unchanged |
| `.gitignore` | Refreshed for monorepo layout |
| `CODE_OF_CONDUCT.md` | Unchanged |
| `SECURITY.md` | Unchanged |
| `CONTRIBUTING.md` | Updated to reference the new gate and workflow |
| `.github/` | Workflows replaced; `CODEOWNERS`, `dependabot.yml`, templates kept |
| `biome.json` | Refreshed for Biome 2.5 |
| `pnpm-workspace.yaml` | Updated for monorepo package globs |
| `tsconfig.json` | Replaced with solution-file pattern |
| Root `package.json` | Updated scripts, dependencies, and metadata |

## What was built (foundation infra)

The following were created new on `v-next`:

| Artifact | What it is |
|---|---|
| `tsconfig.base.json` | Shared compiler options (NodeNext ESM, strict, composite) |
| `tsconfig.infra.json` | Covers `tooling/`, `tests/`, `vitest.config.ts` |
| `vitest.config.ts` | Four test lane definitions (unit, integration, conformance-mock, smoke-real) |
| `tooling/no-side-effects.setup.ts` | Zero-real-process guard for unit and conformance-mock lanes |
| `.dependency-cruiser.cjs` | Baseline rules (no-circular, no-orphans) + layer-rule template |
| `tests/infra/no-side-effects.unit.test.ts` | Verifies the guard stubs throw correctly |
| `tests/infra/enforcer-wired.unit.test.ts` | Verifies the dependency-cruiser baseline is wired |
| `.github/workflows/check.yml` | `check` job (gate) + `smoke` job (gated) |
| `docs/` | This documentation tree (9 files) |

## Open integration items (deferred)

Two integration questions were surfaced during the foundation pass and are
explicitly left unresolved. They require design decisions and are deferred to
core-01 / design owners:

1. **outputRef vs ArtifactRef:** prov-01 uses an opaque `outputRef: string`;
   fnd-02 uses a structured `ArtifactRef`. No mapping or unification is
   introduced by the infra.

2. **Audit hash chain vs hash-free log:** fnd-04's audit events carry
   `prevEventHash` / `eventHash` (a hash chain); the general event log is
   hash-free. No unified hashing policy is introduced by the infra.

These items will be resolved when the design pass settles the relevant
contracts (roadmap Step 2).
