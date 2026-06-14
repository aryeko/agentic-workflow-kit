---
title: AWK134 implementation plan
owner: codex-2026-06-14T09-55-09Z
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk134-conservative-defaults-and-api-fidelity-design.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK134.md
---

# AWK134 implementation plan

## Scope

Implement the conservative launch approval gate, conservative init preset selection, API capability
truthfulness, typed analysis result, and repo-relative path hardening from the detailed spec. Keep
the diff out of GitHub verification, run-state durability, and module decomposition.

## Steps

1. Red tests for approval and API fidelity.
   - Add handler and MCP tests showing `dryRun: false` without `confirmNonDryRun` returns a blocked
     approval-required `RunState` and does not launch a child.
   - Add `cli-args` coverage for `--yes`.
   - Add facade expectation for the full capability set including `trackerMigration: true`.
   - Run the focused tests and confirm the expected failures.

2. Red tests for path hardening and conservative preset selection.
   - Add config/override validation tests for `paths.tracksDir: ../../etc`, another path field, and
     `overrides.tracksDir: ../../etc`.
   - Update preset-selection tests to expect `push-only` for all auto-selected signal combinations
     while still asserting the shipped preset files keep their semantics.
   - Run the focused tests and confirm the expected failures.

3. Implement the approval gate.
   - Add `confirmNonDryRun?: boolean` to `CliOverrides`.
   - Parse CLI `--yes` into `confirmNonDryRun`.
   - Add MCP `confirmNonDryRun` input and pass it through.
   - In `runWorkflowHandler`, return a structured blocked `RunState` before constructing
     `WorkflowRunner` when a non-dry-run launch lacks approval.
   - Keep default MCP dry-run behavior unchanged.

4. Implement path validation.
   - Export or duplicate a small repo-relative path validator from config code without adding a new
     dependency.
   - Apply it to all `paths.*` repo-relative config keys and `git.worktreeDir`.
   - Validate `overrides.tracksDir` inside `loadResolvedConfig` so CLI, MCP, and handlers share the
     boundary.
   - Update human and generated schema mirrors.

5. Implement preset/API/type fixes.
   - Change `selectPreset` to return `push-only` by default for all detected signals.
   - Update comments, workflow-init skill text, and mirrored plugin fixture content if required by
     sync tests.
   - Change `capabilitiesFromConfig` to report `trackerMigration: true`.
   - Type `analyzeRunHandler` as `WorkflowRunAnalysis`.

6. Verify focused behavior.
   - Run:
     `pnpm --filter @agentic-workflow-kit/orchestrator vitest run packages/orchestrator/tests/handlers.test.ts packages/orchestrator/tests/mcp-server.test.ts packages/orchestrator/tests/cli-args.test.ts packages/orchestrator/tests/config-loader.test.ts packages/orchestrator/tests/config-resolve.test.ts packages/orchestrator/tests/preset.test.ts packages/orchestrator/tests/api-facade.test.ts`
   - Run:
     `pnpm vitest run test/presets.test.ts test/config-schema.test.ts test/skill-authoring.test.ts`
   - Fix failures within scope.

7. Full gate, review, and tracker closeout.
   - Run `pnpm check`.
   - Run required pre-PR read-only subagent review with repo instructions, product docs,
     architecture docs, story brief, detailed spec, plan, implementation diff, and verification
     output.
   - Apply at most two local pre-PR fix loops.
   - Re-run `pnpm check`, mark tracker `done`, commit, push, open PR, update PR column, then follow
     configured CI, Codex review, rebase, final verification, squash merge, and branch deletion.
