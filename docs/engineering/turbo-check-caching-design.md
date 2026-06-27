---
title: kit-vnext — Turbo Check-Gate Caching (design)
status: partially-implemented
last-reviewed: "2026-06-23"
owner: tooling
relates-to: docs/engineering/check-gate.md
---

> **Implementation note (2026-06-26).** Phase 0 (redundancy fix), Phase 1 (Turbo
> root-task port), and Phase 2a (CI cache via `actions/cache@v6`) have landed. Phase 2b
> (Vercel Remote Cache) and Phase 3
> (per-package granularity) remain deferred. Measure Phase 2a hit rates before
> deciding on 2b.

# Turbo Check-Gate Caching

## Why

The earlier `pnpm check` ran nine steps sequentially, fail-fast
(`docs/engineering/check-gate.md`). Two problems, both in the **open**
verify-gate-composition layer, drove the Turbo port:

1. **Redundant test work.** The gate runs `test:unit && test:int && test:conf` and then
   `coverage:baseline`, which re-runs the **same three** projects under V8 coverage. The
   hermetic suites execute twice. Measured on `v-next` @ `4fa8136`:

   | Step | Time |
   |---|---|
   | docs:nav + format + lint + deps + typecheck | ~3.6s |
   | test:unit / test:int / test:conf | 4.1 / 9.2 / 1.3s |
   | coverage:baseline (re-runs the three) | 12.3s |
   | **total** | **~30s** |

   ~14s — nearly half — is duplicate. V8 instrumentation overhead is negligible here
   (12.3s with coverage ≈ 14.6s without), so the separate plain run buys almost nothing.

2. **No cross-run caching.** Every invocation re-does all work even when nothing relevant
   changed — re-running after a no-op, switching branches, a docs-only edit, or a CI
   re-run. There is no memoization keyed to inputs.

The reference repo `../on-class-web` solves (2) with Turborepo: each granular script is a
cacheable Turbo **root task** (`//#task`) with declared `inputs`/`outputs`, and the
aggregate `check` is a no-op whose Turbo task `dependsOn` every leaf. Re-running `check`
replays cached results for any leaf whose inputs are unchanged.

## Goals / non-goals

**Goals.** Eliminate the duplicate test pass; memoize gate steps by input hash so
unchanged work is skipped locally and in CI; keep the gate a faithful, fail-closed
required check (a cache hit replays the real exit code + logs, never a fabricated pass).

**Non-goals (this pass).** Per-package test isolation (Phase 3, below); a remote/shared
cache backend beyond the GitHub Actions cache (opt-in, Phase 2b); changing *what* the gate
verifies — only how often each piece re-runs.

## Design

### Phase 0 — Redundancy fix (independent of Turbo, ship first)

Collapse the gate's test section to a single pass. `coverage:baseline` already runs
unit + integration + conformance-mock and enforces the 90% thresholds, so it fully
subsumes the three plain runs **for gate purposes**:

```jsonc
// package.json
"check": "pnpm docs:nav:check && pnpm format:check && pnpm lint && pnpm deps && pnpm typecheck && pnpm coverage:baseline"
```

Keep `test:unit` / `test:int` / `test:conf` as scripts for targeted local runs — they
just leave the aggregate gate. **Effect: ~30s → ~16s, zero loss of signal.** This is
valuable on its own and de-risks Phase 1 (Turbo wraps a gate that is already correct).

### Phase 1 — Turbo root-task port (caching)

Adopt `turbo@^2.9` (matching on-class-web) and model each gate step as a cacheable root
task. The repo is a real pnpm workspace (8 packages + `tooling/` + `tests/`), but every
gate step is **repo-global** by construction — `biome .`, `tsc -b` over project
references, `depcruise` across the tree, and Vitest *projects* selected by file-suffix
glob spanning all packages. So the natural cache granularity is repo-global root tasks,
exactly the on-class-web shape. (Per-package granularity is Phase 3.)

Proposed `turbo.json`:

```jsonc
{
  "$schema": "https://turborepo.com/schema.json",
  "globalDependencies": [
    "pnpm-lock.yaml",
    "tsconfig.base.json", "tsconfig.infra.json", "tsconfig.json",
    "biome.json", ".dependency-cruiser.cjs", "vitest.config.ts"
  ],
  "globalEnv": ["CI"],
  "tasks": {
    "check": {
      "dependsOn": [
        "//#docs:nav:check", "//#format:check", "//#lint",
        "//#deps", "//#typecheck", "//#coverage:baseline"
      ],
      "outputs": []
    },
    "//#docs:nav:check": {
      "inputs": ["docs/**", "tooling/docs-nav/**", "**/README.md"],
      "outputs": []
    },
    "//#format:check": { "inputs": ["$TURBO_DEFAULT$"], "outputs": [] },
    "//#lint":         { "inputs": ["$TURBO_DEFAULT$"], "outputs": [] },
    "//#deps": {
      "inputs": ["packages/**", "tooling/**", "tests/**", ".dependency-cruiser.cjs"],
      "outputs": []
    },
    "//#typecheck": {
      "inputs": ["packages/**/*.ts", "tooling/**/*.ts", "tests/**/*.ts", "**/tsconfig*.json"],
      "outputs": ["packages/*/dist/**", "packages/*/*.tsbuildinfo", "*.tsbuildinfo"]
    },
    "//#coverage:baseline": {
      "inputs": ["packages/**", "tests/**", "tooling/**", "vitest.config.ts"],
      "outputs": ["coverage/**"]
    }
  }
}
```

Wiring (mirrors on-class-web): aggregate scripts delegate to Turbo; leaf scripts stay as
the real commands.

```jsonc
// package.json
"check":     "turbo run check",
"check:ci":  "turbo run check --force",   // CI may force a cold gate; see Phase 2
```

Notes:
- `typecheck`/`build` are both `tsc -b` and **emit** (`dist/`, `*.tsbuildinfo`). Declaring
  those as `outputs` lets a cache hit restore them, so a warm typecheck is a true skip.
  `dist/`, `*.tsbuildinfo`, `coverage/` are already git-ignored — add `.turbo/`.
- `format:check`/`lint` use `$TURBO_DEFAULT$` (all tracked files minus git-ignored) because
  Biome's effective input set is broad; over-declaring inputs is the safe direction (it
  errs toward re-running, never toward a stale green).

**What Phase 1 actually buys at this granularity** (stated honestly): editing any source
file invalidates the `coverage` and `typecheck` tasks, so tests still re-run for real code
changes — Turbo does not make a single Vitest run incremental. The wins are:
- **No-op / branch-switch / CI-retry re-runs → ~all cache hits** (gate drops to ~1–2s of
  Turbo overhead).
- **Docs-only or config-only changes** skip the test and typecheck tasks entirely.
- Combined with Phase 0, the *cold* gate is also ~halved.

### Phase 2 — CI cache

**2a (default, no new infra).** Persist Turbo's local cache between CI runs with
`actions/cache@v6` on `.turbo`, keyed by commit SHA with restore-keys for partial hits.
This makes the wins above survive across CI runs (notably PR pushes that touch only
docs/config, and re-runs of an unchanged SHA). CI also caches the checkout-local
`.pnpm-store` directly and passes the configured store explicitly to pnpm commands.
Install uses `--store-dir`; script commands use `--config.store-dir`. That explicit
configuration avoids `pnpm/action-setup@v6`'s `PNPM_HOME` taking precedence when pnpm
resolves its global virtual store path.

**2b (opt-in).** Vercel Remote Cache (`turbo login` / `turbo link`, `TURBO_TOKEN` +
`TURBO_TEAM` secrets) to share artifacts **across** branches/PRs and between local and CI.
Higher hit rate, but adds a secret + external dependency — defer until 2a's benefit is
measured. on-class-web does not wire Turbo into CI today, so 2a is the conservative match.

**Fail-closed guarantee for a required check.** A Turbo cache hit replays the recorded
stdout/stderr and the **original exit code** — it cannot turn a red step green. If we want
belt-and-suspenders on the protected gate, `check:ci` runs with `--force` (recompute, still
populate cache for downstream local hits) or `--remote-only`. Recommended default: allow
cache reads in CI (that is the point); keep `--force` available behind `check:ci` if a
reviewer wants a periodic cold gate.

### Phase 3 — Per-package granularity (future, not now)

Each package already ships `build`/`test`/`typecheck` scripts. Once packages carry their
own Vitest config (or project filters scoped per package) and `tsc -b` references are
exercised per package, Turbo can run `test`/`typecheck` **per package** with `^build`
topological ordering — so touching one provider only re-tests that provider and its
dependents. That is the real incremental-CI payoff, but it requires restructuring the
root Vitest projects and is out of scope here. Track separately.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Under-declared `inputs` → stale green** (the cardinal Turbo failure) | Prefer `$TURBO_DEFAULT$`/broad globs; add all shared configs to `globalDependencies`; treat any "passed but shouldn't have" as a P0 inputs bug. Over-run, never under-run. |
| Required gate trusting cache replay | Replay preserves real exit code/logs; `check:ci --force` available for a guaranteed cold run. |
| Coverage thresholds via cache | A hit means inputs are identical → same coverage result; correct by construction. |
| New dev dependency / tool surface | Single well-maintained tool (Turbo 2.x), already proven in on-class-web; pin the version. |
| `.turbo` noise | git-ignore `.turbo/`; CI cache dir is ephemeral. |
| pnpm virtual-store confusion | The repo-root `.pnpm-store` is the configured pnpm store. With `enableGlobalVirtualStore`, pnpm's virtual-store links live under `<store-path>/links`; those links are not the content-addressable package store itself. |

## Rollout

1. **Phase 0** — collapse the double test run; update `check` + `docs/engineering/check-gate.md`
   step table (9 → 6 steps). `pnpm check` green as evidence.
2. **Phase 1** — add `turbo`, `turbo.json`, `.turbo/` ignore; rewire `check`/`check:ci`;
   verify cold run matches Phase 0, warm re-run is all cache hits, and a docs-only edit
   skips tests.
3. **Phase 2a** — add `.turbo` to `actions/cache` in `.github/workflows/check.yml`.
   Cache `${{ github.workspace }}/.pnpm-store` directly and pass it explicitly so install
   and gate commands use the repo-root store.
4. Measure hit rates; decide on **2b** and **Phase 3** from data.

## Expected outcome

- Cold gate: **~30s → ~16s** (Phase 0).
- Warm no-op / docs-only / CI-retry: **~16s → ~1–2s** (Phase 1 + 2a).
- Correctness of the gate is unchanged; only redundant and unchanged work is removed.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Engineering Policy Index](./README.md) · **← Prev:** [Tooling and CI](./tooling-and-ci.md) · **Next →:** [Product definition](../product/README.md)

<!-- /DOCS-NAV -->
