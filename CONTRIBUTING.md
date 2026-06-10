# Contributing to agentic-workflow-kit

Thanks for your interest. This guide covers how to build, test, and contribute. For how the system
is put together, read [docs/architecture.md](docs/architecture.md) first.

## Prerequisites

- **pnpm 11.5.1** (pinned via `packageManager`) and **Node 24+**.

```bash
pnpm install
pnpm check
```

## The verification gate

`pnpm check` is the required gate before any change is considered done. It runs:

```bash
pnpm lint        # Biome
pnpm typecheck   # tsc across root and orchestrator
pnpm test        # Vitest across root and orchestrator
```

For a focused change, run the nearest test first, then `pnpm check` before opening a PR. The
optional Codex plugin smoke (`pnpm smoke:codex-plugin`) requires the Codex CLI and is intentionally
outside `pnpm check`. Claude plugin validation uses `claude plugin validate .` when the Claude CLI is
available.

## Repository layout

See [docs/architecture.md](docs/architecture.md#where-things-live). In short:

- `skills/` — instruction-first plugin skills (the product surface).
- `references/` — the canonical contracts (config schema, tracker, PRD) and templates.
- `presets/` — the three starter configs.
- `examples/` — worked PRD and tracker.
- `mcp/server.mjs` — generated MCP runtime bundled into plugin installs.
- `packages/orchestrator/` — the TypeScript orchestrator source and standalone CLI, including the MCP server adapter, config schema (Zod), loader, and presets.
- `docs/` — architecture, the docs hub, and the getting-started guide.

## Contracts and their mirrors (read before editing)

Several artifacts are deliberately kept in sync by tests; editing one means editing its mirror:

- **Config schema.** `packages/orchestrator/src/config/schema.ts` (Zod) is the single source of truth.
  `references/config.schema.json` is **generated** from it and pinned byte-for-byte by a drift test.
  `references/config-schema.md` is the human mirror; keep its fields and defaults aligned.
- **Materialized plugin copy.** `plugins/agentic-workflow-kit/` is a byte-for-byte copy of `references/`,
  `presets/`, `examples/`, `skills/`, and `.codex-plugin/` (the local Codex marketplace fixture). It
  also carries a Codex-specific `.mcp.json` and generated `mcp/server.mjs`. The root `.mcp.json`
  keeps Claude's `mcpServers` wiring and a Codex-readable `mcp_servers` entry because the root
  Codex manifest points at it; the fixture `.mcp.json` only needs the Codex plugin-bundled shape.
  Tests assert the mirrored content and runtime artifact stay aligned — re-sync the copy after
  editing any canonical source, or the gate fails.
- **Presets** must stay fully populated and schema-valid.
- **Tracker completion** comes only from tracker state, never from a child session's prose.

## Coding conventions

- No emojis in code, comments, docs, manifests, or commit messages.
- Prefer immutable data and small, focused files (200-400 lines typical).
- Explicit contracts over implicit agent behavior; validate at boundaries and fail loud.
- No `console.log` in library code; the CLI and the structured logger are the output surface.
- If a change alters public behavior, update the relevant docs, schema, presets, examples, and tests
  in the same change.

## Documentation standard

Canonical docs are the only documentation on `main`, and they must describe the current repo state.
There are no per-story documents in the tree.

- A story's spec and plan are **transient working artifacts** under
  [`docs/superpowers/`](docs/superpowers/README.md): the first commit of a story adds them; the
  **final commit removes them** and folds their durable content into the canonical docs.
- Canonical homes are mapped in [docs/README.md](docs/README.md) — typically `README.md`,
  `docs/architecture.md`, `docs/getting-started.md`, `references/`, and `docs/test-plan/`.
- Keep durable content (decisions, contracts, runtime/data flow, tool surfaces); drop transient
  content (task breakdowns, step sequencing, review logs, dates). Git history retains the originals.
- Enforced by **maintainer review**, not a test: a story PR must leave no `docs/superpowers/specs/*`
  or `docs/superpowers/plans/*` story files and must update the affected canonical docs in the same
  PR.

## Plugin authoring

- Skills are instruction-first; add scripts only when deterministic or repeated mechanical work
  justifies them.
- Skill descriptions must be concise and trigger-specific.
- Side-effectful skills (`implement-next`, `workflow-autopilot`) are explicit-invocation-only on both
  Claude and Codex surfaces.
- `workflow-init` must remain idempotent — reconcile and report drift, never overwrite without
  confirmation.

## Commits and PRs

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`, `ci:`.
- One logical change per PR; keep the diff scoped.
- Run `pnpm check` and review `git status --short` before opening a PR.
- Do not add AI attribution to commits.
- For any user-facing change to `@agentic-workflow-kit/orchestrator`, add a changeset: `pnpm changeset` (pick the
  semver bump, write a summary) and commit the generated `.changeset/*.md`. Releases are automated from
  changesets on merge to `main` — see [`.changeset/README.md`](.changeset/README.md).

## Project status note

agentic-workflow-kit is published as v0.1.0. Local plugin fixtures and smoke tests remain the
development validation path for changes to the Claude Code and Codex plugin surfaces. Public
runtime changes should include a changeset; version bumps and changelog edits are produced by the
release PR, not by ordinary feature PRs.
