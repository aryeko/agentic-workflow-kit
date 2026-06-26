# agentic-workflow-kit (kit-vnext v1.0.0)

kit-vnext is the v1.0.0 rebuild of `agentic-workflow-kit`: a deterministic
control plane for delegating well-scoped work to agent workers and landing it as
reviewed, merged changes under human supervision.

The control plane is plain code. Model-backed agents are workers rented behind a
bounded contract; supervision, state projection, gating, and recovery are
deterministic. The system earns autonomy through capability attestation, and
missing or stale attestation turns dependent power off. Host- and tool-specific
behavior belongs behind the Agent, Execution Host, Forge, or Work Source seams,
so concrete drivers do not leak into the core.

The event log is the source of truth for run activity. Task status belongs to the
Work Source. A worker self-report is only a hint; gates require external,
verifiable evidence. AD-12 separates roles: workers edit code and make local
commits, while runners own push, PR, verification, and merge. For v1.0.0, manual
and assisted modes are the autonomy ceiling.

The Dependency Rule is enforced mechanically: Edge -> Control plane ->
Contracts; Drivers -> Contracts; everything -> Foundation; Foundation depends on
nothing above it. `pnpm deps` and TypeScript project references enforce those
boundaries.

## Current status

`v-next` is the integration base and future mainline. `main` is frozen legacy
v0.7.0 and is not used for active development.

The design corpus under `docs/design/` is authoritative for architecture,
requirements, decisions, vocabulary, and domain designs. Foundation tooling and
the verify gate are present in the tracked tree. `packages/` is a pnpm workspace
slot; package contents are added only through the design-owned package map and
implementation track.

## Install

Use Node 24+ and the pinned pnpm version from `package.json`:

```bash
pnpm install
```

Fresh linked worktrees should use the repository setup script instead:

```bash
bash scripts/setup-worktree.sh
```

The script seeds `.turbo/` from the primary `v-next` checkout when available and installs
with an explicit repo-root pnpm store. The primary checkout's `.pnpm-store` is preferred;
if no primary checkout is discoverable, the current checkout's `.pnpm-store` is used.
`pnpm-workspace.yaml` enables pnpm's global virtual store, so pnpm places virtual-store
links under `<store-path>/links`; that is distinct from the content-addressable package
store under the same repo-local store path.

## Verify

Run the local gate before committing or opening a PR:

```bash
pnpm check
```

`pnpm check` runs via Turbo. Turbo schedules the cacheable leaf tasks concurrently,
replays unchanged results from `.turbo/`, and preserves failure exit codes on cache hits.

| Step | Command | Purpose |
| --- | --- | --- |
| Docs nav | `pnpm docs:nav:check` | Generated docs navigation freshness |
| Format | `pnpm format:check` | Biome formatting check (`biome format .`) |
| Lint | `pnpm lint` | Biome lint check |
| Dependencies | `pnpm deps` | Dependency Rule enforcement over `packages`, `tooling`, and `tests` |
| Typecheck | `pnpm typecheck` | TypeScript project references |
| Type fixtures | `pnpm type:fixtures` | Public and negative compile-time fixture proofs |
| Coverage baseline | `pnpm coverage:baseline` | Unit, integration, and conformance-mock suites under V8 coverage |

CI also runs `pnpm pack:dry-run` in the required `check` job. The gated `smoke`
job runs `pnpm test:smoke`; it is the only lane intended for real processes and
network access.

## Repository map

| Path | Role |
| --- | --- |
| `AGENTS.md` | Contributor and agent contract |
| `CLAUDE.md` | Claude Code operating layer on top of `AGENTS.md` |
| `docs/design/` | Source of truth for architecture, requirements, decisions, glossary, and domains |
| `docs/engineering/` | Engineering policy: verify gate, test lanes, tooling, and CI |
| `docs/research/history/` | Incident postmortems and research context |
| `docs/implementation/` | Implementation waves and item charters |
| `docs/roadmap.md` | Durable rebuild roadmap |
| `packages/` | pnpm workspace slot for design-owned package implementation |
| `tooling/` | Shared test and developer tooling |
| `tests/` | Cross-package and infrastructure tests |
| `.github/` | PR template, issue templates, Dependabot, and CI workflows |

Start with `AGENTS.md` for repo rules, then read only the design or foundation
file that owns your task.
