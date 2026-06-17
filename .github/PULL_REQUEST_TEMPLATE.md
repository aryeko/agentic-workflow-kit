## What

<!-- What this PR does and why. Link the relevant issue or tracker story if applicable. -->

## How

<!-- Key implementation decisions a reviewer needs. -->

## Test plan

<!-- Commands run and their result (e.g. `pnpm check`). Report real output, not assumption. -->

## Type of change

- [ ] feat: new feature or behavior
- [ ] fix: bug fix
- [ ] refactor: internal restructure, no behavior change
- [ ] docs: documentation only
- [ ] test: tests only
- [ ] chore: build, tooling, or dependency update

## Checklist

- [ ] `pnpm check` passes locally (Biome lint + tsc + Vitest).
- [ ] If behavior changed: docs, schema, presets, examples, and tests updated in this same PR.
- [ ] If a canonical source changed (`references/`, `presets/`, `examples/`, `skills/`, `.codex-plugin/`): materialized `plugins/agentic-workflow-kit/` copy re-synced.
- [ ] No emojis in code, comments, docs, or manifests.
- [ ] PR title follows conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
