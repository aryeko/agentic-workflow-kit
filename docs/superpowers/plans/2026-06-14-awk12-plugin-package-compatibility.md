# AWK12 implementation plan

## Story

AWK12 — Plugin package compatibility

## Inputs

- Tracker: `docs/tracks/agentic-workflow-kit-redesign/README.md`
- Brief: `docs/tracks/agentic-workflow-kit-redesign/stories/AWK12.md`
- Detailed spec: `docs/superpowers/specs/2026-06-14-awk12-plugin-package-compatibility-design.md`
- Repo policy: `.workflow/config.yaml`

## Plan

1. Add a shared root test helper for the expected MCP tool surface.
   - File: `test/plugin-tool-surface.ts`
   - Define product `workflow_*` tools and legacy compatibility tools.
   - Export an assertion that checks `tools/list` output contains both sets and no duplicate names.

2. Harden package and Codex plugin smoke tests.
   - File: `test/publish-readiness.test.ts`
   - Replace the narrow `list_eligible` / `run_story` assertion with the shared full-surface assertion for the built package MCP server.
   - File: `test/codex-plugin-smoke.vitest.ts`
   - Assert the installed Codex plugin package MCP server exposes the same full surface from a non-plugin consumer cwd.

3. Refresh package-facing docs and doc sync tests.
   - File: `packages/orchestrator/README.md`
   - Update CLI examples for current product commands: `run status`, `run stream`, `run inspect`, `run report`, `run export`, and `abort-run`.
   - Update MCP tool list to include all product tools plus the preserved legacy tools.
   - Use `.codex/agentic-workflow-kit/runs/<run-id>` in examples.
   - File: `test/docs-current-state.test.ts`
   - Add assertions for current product MCP tools, legacy coexistence wording, and current run artifact path examples.
   - File: `docs/test-plan/codex-plugin.md`
   - Note that automated Codex smoke verifies installed package MCP startup and both product and legacy tool exposure.

4. Refresh plugin manifest copy without changing invocation policy.
   - Files: `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`
   - Update concise descriptions to mention the package-backed runtime and run status/stream/report/export artifacts.
   - Preserve skill paths, Codex `mcpServers`, and explicit-invocation behavior in skill frontmatter.
   - Mirror `.codex-plugin/` into `plugins/agentic-workflow-kit/.codex-plugin/`.

5. Run focused verification and fix failures.
   - `pnpm vitest run test/plugin-manifest.test.ts test/plugin-runtime-bundle.test.ts test/publish-readiness.test.ts test/docs-current-state.test.ts`
   - `pnpm smoke:codex-plugin`
   - `pnpm build`
   - `pnpm pack:dry-run`

6. Run the required full gate.
   - `pnpm check`

7. Run required pre-PR review.
   - Spawn a read-only review subagent with the repo instructions, tracker row, brief, detailed spec, plan, diff, and verification evidence.
   - Fix any blocking findings and rerun configured verification before a second review loop if needed.

8. Complete tracker and PR flow.
   - Re-read AWK12 row and set status to `done`.
   - Commit tracker completion.
   - Push branch, open PR, update PR column, commit, and push.
   - Wait for configured CI and Codex bot review, fix at most one external review batch, run final verification, then squash-merge and delete branch when gates pass.

## Verification commands

```bash
pnpm vitest run test/plugin-manifest.test.ts test/plugin-runtime-bundle.test.ts test/publish-readiness.test.ts test/docs-current-state.test.ts
pnpm smoke:codex-plugin
pnpm build
pnpm pack:dry-run
pnpm check
```
