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
outside `pnpm check`.

## Repository layout

See [docs/architecture.md](docs/architecture.md#where-things-live). In short:

- `skills/` — instruction-first plugin skills (the product surface).
- `references/` — the canonical contracts (config schema, tracker, PRD) and templates.
- `presets/` — the three starter configs.
- `examples/` — worked PRD and tracker.
- `packages/orchestrator/` — the optional TypeScript orchestrator and CLI, including the config schema (Zod), loader, and presets.
- `docs/` — architecture, the docs hub, and the getting-started guide.

## Contracts and their mirrors (read before editing)

Several artifacts are deliberately kept in sync by tests; editing one means editing its mirror:

- **Config schema.** `packages/orchestrator/src/config/schema.ts` (Zod) is the single source of truth.
  `references/config.schema.json` is **generated** from it and pinned byte-for-byte by a drift test.
  `references/config-schema.md` is the human mirror; keep its fields and defaults aligned.
- **Materialized plugin copy.** `plugins/agentic-workflow-kit/` is a byte-for-byte copy of `references/`,
  `presets/`, `examples/`, `skills/`, and `.codex-plugin/` (the local Codex marketplace fixture). A
  test asserts they are identical — re-sync the copy after editing any canonical source, or the gate
  fails.
- **Presets** must stay fully populated and schema-valid.
- **Tracker completion** comes only from tracker state, never from a child session's prose.

## Coding conventions

- No emojis in code, comments, docs, manifests, or commit messages.
- Prefer immutable data and small, focused files (200-400 lines typical).
- Explicit contracts over implicit agent behavior; validate at boundaries and fail loud.
- No `console.log` in library code; the CLI and the structured logger are the output surface.
- If a change alters public behavior, update the relevant docs, schema, presets, examples, and tests
  in the same change.

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

agentic-workflow-kit is feature-complete locally but not yet published. The remaining pre-publish gate is a live behavioral smoke run.
