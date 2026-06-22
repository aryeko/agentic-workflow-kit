# Agent harness lessons research runbook

This runbook is the restart point for the agent-harness research pass. Keep it current before
moving between phases so another session can resume without relying on chat history.

## Progress

- [x] Verified primary checkout state and existing worktrees.
- [x] Fetched `origin/v-next`.
- [x] Created isolated worktree `/Users/aryekogan/repos/workflow-kit/.worktrees/harness-research`
  on branch `codex/harness-research` from `origin/v-next`.
- [x] Seeded the durable research directory.
- [x] Extracted source lessons into `source-notes/`.
- [x] Audited current repository evidence into `repo-audit/current-system-map.md`.
- [x] Synthesized the guideline matrix.
- [x] Wrote current-state audit and roadmap.
- [x] Regenerated docs navigation and ran verification gates.

## Surprises & Discoveries

- The package scaffold and foundation implementation have advanced beyond some package README prose:
  `packages/sdk/src/foundation/**` contains real foundation code and tests, while
  `packages/sdk/src/README.md` still says the directory is reserved for later behavior.

## Decision Log

| Decision | Rationale |
|---|---|
| Keep this pass docs-only. | The requested output is research and recommendations; implementation changes should follow as separate story work. |
| Use `docs/research/agent-harness-lessons/` as the durable home. | It mirrors the existing research-report pattern while keeping this audit separate from implementation contracts. |
| Separate `source-notes/` from `repo-audit/`. | This preserves provenance: first derive external guidelines, then compare against repo evidence. |
| Pin the Symphony source to commit `4cbe3a9699a73b862466c0b157ceca0c1985d6d7`. | Symphony is an active repository; source-backed claims need a stable reference. |

## Outcomes & Retrospective

- Source extraction and repo audits produced a consistent conclusion: kit-vnext's design is already
  stronger than the source set on control-plane safety, but implementation is currently strongest in
  foundation substrate and verification tooling. Provider drivers, core orchestration, analysis, and
  physical navigation/hygiene are the main follow-up areas.
- Verification completed from `/Users/aryekogan/repos/workflow-kit/.worktrees/harness-research`:
  `pnpm docs:nav`, `pnpm docs:nav:check`, `pnpm format:check`, full `pnpm check`, `git diff --check`,
  a banned-token sweep, a trailing-whitespace scan, and a local Markdown-link check.
