# Contributing to agentic-workflow-kit

This repository is the kit-vnext v1.0.0 rebuild. Read `AGENTS.md` first; it is
the contributor and agent contract. The authoritative system design lives under
`docs/design/`, and engineering policy and gate details live under `docs/engineering/`.

## Prerequisites

- Node 24+
- pnpm 11.5.1, pinned by `packageManager` in `package.json`

Install once:

```bash
pnpm install
```

For a fresh linked worktree, prefer the repo bootstrap:

```bash
bash scripts/setup-worktree.sh
```

It seeds `.turbo/` from the primary `v-next` checkout when available and installs with
an explicit repo-root `.pnpm-store`. The primary checkout's store is preferred; the
current checkout's `.pnpm-store` is the fallback. The workspace enables pnpm's global
virtual store, which places virtual-store links under `<store-path>/links`; those links
are distinct from pnpm's content-addressable package store.

## Branch and PR flow

- Branch from `v-next`.
- Open PRs into `v-next`.
- Do not push directly to `v-next`.
- Treat `main` as frozen legacy v0.7.0; do not use it for new work.
- Use one focused PR per logical change.
- Use conventional commit and PR subjects: `feat:`, `fix:`, `refactor:`,
  `docs:`, `test:`, `chore:`, `perf:`, or `ci:`.
- Do not add AI attribution footers.

For non-trivial work, use a worktree under `.worktrees/<name>` cut from
`v-next`. Verify the worktree root before any git write.

## Verify gate

`pnpm check` is the required local gate before commit and PR:

```bash
pnpm check
```

It runs the Turbo check gate. Turbo schedules the seven cacheable leaf tasks
concurrently and replays unchanged results from `.turbo/`:

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm deps`
4. `pnpm typecheck`
5. `pnpm type:fixtures`
6. `pnpm docs:nav:check`
7. `pnpm coverage:baseline`

CI runs the same gate in the required `check` job and then runs
`pnpm pack:dry-run`. The separate `smoke` job runs `pnpm test:smoke`; it is
gated and is the only test lane intended for real processes and network access.

For focused work, run the nearest relevant command first, then run `pnpm check`
before handing the change off.

## Repository layout

- `docs/design/` is the source of truth for architecture, requirements,
  decisions, glossary, and domain designs.
- `docs/engineering/` records engineering policy and gate facts for the tracked
  tree.
- `docs/research/history/` holds postmortems and research context. It is not normative
  design.
- `docs/implementation/` holds implementation waves and item charters.
- `packages/` is the pnpm workspace slot for design-owned package
  implementation.
- `tooling/` and `tests/` are included in TypeScript, dependency, and Vitest
  checks, but they are not pnpm workspace packages.

## Documentation standard

Keep durable documentation truthful to the tracked tree. If behavior, gate
composition, package boundaries, or public workflow changes, update the
canonical docs in the same PR. Do not duplicate design decisions in root docs;
point to the owning file under `docs/design/`.

Transient notes, review evidence, scratch prompts, and local run artifacts do
not belong in canonical docs unless a specific implementation charter says
otherwise.

## Code and docs conventions

- No emojis in code, comments, docs, manifests, commits, or PR titles.
- Prefer immutable updates and explicit error handling.
- Validate external input at system boundaries.
- Keep files focused; extract instead of growing broad files.
- Use Mermaid for diagrams in Markdown.
- Never print secrets, tokens, or private credentials.

If a doc fix exposes a tooling or gate mismatch, report the mismatch rather than
changing gate behavior in an unrelated PR.
