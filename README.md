# agentic-workflow-kit (kit-vnext v1.0.0)

kit-vnext is a greenfield rebuild of `agentic-workflow-kit`: a system that delegates
well-scoped work to agent workers and lands it as reviewed, merged changes — safely,
recoverably, and under human supervision.

The control plane is deterministic code. There is no LLM "orchestrator". Supervision,
state, gating, and recovery are plain logic. Agents are workers rented behind a
bounded contract; the system earns autonomy incrementally through capability
attestation, not by assumption. Everything host- or tool-specific lives behind one of
four attested provider seams (Agent, Execution Host, Forge, Work Source), so drivers
can be swapped or extended without touching the core. The event log is the single
source of truth; state, metrics, and summaries are pure projections of it.

AD-12 credential isolation is enforced by design: the worker holds no Forge
credentials (it does code edits and local commits only); the runner owns push, PR
create/update, verification, and merge. Two independent authorities are never merged:
task status belongs to the Work Source; run activity belongs to the event log. A
worker's self-report never satisfies a gate by itself — evidence is always external.
In v1.0.0, manual and assisted modes are the autonomy ceiling; auto-approval is
explicitly deferred.

The Dependency Rule (Edge -> Control plane -> Contracts; Drivers -> Contracts;
Foundation -> nothing above it) is enforced mechanically by dependency-cruiser
(`pnpm deps`) and TypeScript project references. A violation fails CI, not just
review.

---

## Repo status

This is the **foundation infrastructure** for kit-vnext v1.0.0. Only monorepo
plumbing, the verify gate, test infrastructure, and CI tooling are present. There are
no domain packages yet. The full architecture and domain designs live on a separate
design branch and will be repopulated into `docs/` in a later step. The package
decomposition — which packages exist and where their boundaries fall — is
design-owned and added by the design owners in that step.

---

## Running the checks

Install dependencies once:

```
pnpm install
```

Run the full verify gate:

```
pnpm check
```

`pnpm check` runs these steps in order, fail-fast:

| Step | Command | What it checks |
|------|---------|----------------|
| Format | `biome format --check .` | All files conform to Biome formatting rules |
| Lint | `biome lint .` | All files pass Biome lint rules |
| Deps | `depcruise --config .dependency-cruiser.cjs packages tooling tests` | No Dependency-Rule violations |
| Typecheck | `tsc -b` | All TypeScript project references type-check clean |
| Unit tests | `vitest run --project unit` | Hermetic unit tests (no real network or processes) |
| Integration tests | `vitest run --project integration` | Hermetic integration tests |
| Conformance tests | `vitest run --project conformance-mock` | Hermetic contract conformance tests against mock drivers |

Two additional steps run in CI only (not part of the local inner loop):

- `pnpm pack:dry-run` — verifies each package produces a valid tarball
- `smoke` job (gated) — runs `vitest run --project smoke-real`, the only lane
  allowed real processes and network

To run smoke tests locally:

```
pnpm test:smoke
```

The `unit` and `conformance-mock` lanes load `tooling/no-side-effects.setup.ts`
before each test; that setup file stubs `fetch`, `child_process`, `net`, `http`, and
`https` so accidental side effects throw immediately.

---

## Where things live

```
docs/             Architecture docs, ADRs, design records, roadmap
  foundation/     Foundation-layer design docs
  roadmap.md      High-level roadmap

packages/         pnpm workspace slot — intentionally empty until design owners add packages
                  (see packages/README.md)

tooling/          Shared test setup and dev tooling
  no-side-effects.setup.ts   Vitest setup: stubs real network + process-spawning

tests/            Cross-package and infra tests
  infra/          Tests for tooling/setup infrastructure

biome.json        Biome formatter + linter config
.dependency-cruiser.cjs   Dependency-Rule enforcer config
tsconfig.json     Root TS solution file (references only)
tsconfig.base.json        Shared TS compiler options
tsconfig.infra.json       TS project for tooling + tests
vitest.config.ts  Four-lane Vitest config
```

Architecture decisions, domain designs, and the package decomposition are all
repopulated into `docs/` by the design owners in a later step. See `docs/roadmap.md`
for the current delivery plan once that step is complete.
