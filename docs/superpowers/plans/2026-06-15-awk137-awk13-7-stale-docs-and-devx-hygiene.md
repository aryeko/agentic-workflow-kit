# AWK137 implementation plan

## Scope

Implement the detailed spec at
`docs/superpowers/specs/2026-06-15-awk137-awk13-7-stale-docs-and-devx-hygiene-design.md`.

## Steps

1. Add regression tests first.
   - Extend `test/docs-current-state.test.ts` for root changelog delegation, security supported
     version, package engines, repo-checkout command forms, explicit approval, and GitHub
     verification fail-closed docs.
   - Extend `test/skill-authoring.test.ts` for the current workflow-autopilot tool surface.
   - Run `pnpm vitest run test/docs-current-state.test.ts test/skill-authoring.test.ts` and confirm
     the new tests fail before implementation.

2. Update stale root and setup documentation.
   - Replace stale `CHANGELOG.md` content with a root-level note that `packages/orchestrator/CHANGELOG.md`
     is the package release-history source of truth and the active line is `0.5.x`.
   - Update `SECURITY.md` supported versions to `0.5.x` / `< 0.5`.
   - Update `docs/getting-started.md` to use `pnpm agentic-workflow-kit -- ...` in repo-checkout CLI
     examples and document conservative init defaults, explicit non-dry-run approval, and GitHub
     verification fail-closed behavior.

3. Update package metadata.
   - Add `"engines": { "node": ">=24" }` to `packages/orchestrator/package.json` near other package
     metadata.

4. Update workflow-autopilot skill guidance.
   - Expand `skills/workflow-autopilot/SKILL.md` preferred MCP tools to include facade status/control
     tools, watch cursor tools, child controls, Codex aliases, and driver check aliases.
   - Normalize the CLI fallback to include status/stream/inspect/report/export/control where
     appropriate and keep dry-run-first guidance.
   - Copy the canonical skill file to `plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md`
     so the plugin mirror stays byte-identical.

5. Verify.
   - Run `pnpm vitest run test/docs-current-state.test.ts test/skill-authoring.test.ts`.
   - Run configured changed/full gate: `pnpm check`.
   - Check `git diff --check` and `git status --short`.

6. Close out.
   - Run configured pre-PR review using a read-only review subagent.
   - Fix any findings, rerun verification, and re-review within the configured loop limit.
   - Mark AWK137 `done`, create/push PR, wait for configured CI and Codex review, triage comments,
     squash-merge if gates pass, and clean up the worktree.
