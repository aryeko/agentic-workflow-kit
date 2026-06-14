---
title: AWK134 detailed technical story spec
owner: codex-2026-06-14T09-55-09Z
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK134.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/05-api-surface.md
---

# AWK134 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK134.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| How does an MCP caller express approval without a TTY prompt? | Add an explicit boolean `confirmNonDryRun` launch input and `CliOverrides.confirmNonDryRun`. CLI callers express the same signal with `--yes`. The handler refuses `dryRun === false` unless `confirmNonDryRun === true`. | The signal is structured, transport-neutral, easy to test, and does not rely on prose or interactive prompts. |
| Should a prior dry-run in the same run directory satisfy approval, or is approval always per-launch? | Approval is per launch for V1. A prior dry-run may inform a user, but it is not durable approval and does not bypass the gate. | Per-launch approval is the least surprising fail-closed behavior and avoids ambiguous run-directory matching. |

## Exact types/contracts

- `CliOverrides` adds `confirmNonDryRun?: boolean`.
- `parseCommand` accepts `--yes`; when present, `toOverrides` sets `confirmNonDryRun: true`.
- MCP launch tools `run_story` and `run_eligible` accept `confirmNonDryRun?: boolean` with description text that says it is required when `dryRun` is `false`.
- `runWorkflowHandler` enforces the boundary before loading tracks or launching children:
  - dry-run commands continue unchanged.
  - non-dry-run commands with `confirmNonDryRun: true` continue unchanged.
  - non-dry-run commands without approval return a structured `RunState` with `status: "blocked"`, `blockedReason: "approval_required: set confirmNonDryRun/--yes to launch non-dry-run child sessions"`, no active children, and no tracker mutation.
- `analyzeRunHandler` returns `Promise<WorkflowRunAnalysis>`.
- `WorkflowApiCapabilities.trackerMigration` is `true`.
- All configured repo-relative path fields use the existing `repoRelativePath` rule: `paths.tracksDir`, `paths.specsDir`, `paths.plansDir`, `paths.archiveDir`, `paths.prdsDir`, and `git.worktreeDir`.
- The `tracksDir` CLI/MCP override is validated with the same rule before it is resolved or used.
- `selectPreset` defaults to `push-only` for all detected repo signals. Auto-merge presets remain shipped and explicitly selectable, but init auto-selection is conservative.

## Exact files/modules

```text
packages/orchestrator/src/types.ts  Add confirmNonDryRun to CliOverrides and use typed analysis return as needed.
packages/orchestrator/src/cli/args.ts  Parse --yes into confirmNonDryRun and validate --tracks-dir with repo-relative path rules.
packages/orchestrator/src/commands/handlers.ts  Add non-dry-run approval preflight, typed analyzeRunHandler, and tracksDir override validation.
packages/orchestrator/src/mcp/tools.ts  Add confirmNonDryRun to run schemas and pass it through to overrides.
packages/orchestrator/src/config/schema.ts  Reuse repoRelativePath for all repo-relative paths.
packages/orchestrator/src/config/configLoader.ts  Validate overrides.tracksDir at config resolution.
packages/orchestrator/src/config/preset.ts  Make auto-selection return push-only by default.
packages/orchestrator/src/api/facade.ts  Report trackerMigration: true.
references/config.schema.json  Regenerate from Zod schema.
references/config-schema.md  Update path validation and CLI approval docs.
skills/workflow-init/SKILL.md  Document conservative push-only default.
plugins/agentic-workflow-kit/**  Sync materialized fixture copies for changed skills/references/presets if tests require it.
packages/orchestrator/tests/* and test/*  Add focused regression coverage.
```

## Query/schema/prompt/event/component design

- Approval gate result:
  - Uses the existing `RunState` shape so CLI/MCP legacy launch tools can return structured data without a new envelope.
  - `runId` is generated and `artifactDir` points to the would-be run directory, but no `WorkflowRunner` is created and no run artifacts are required for the refusal.
  - `blockedReason` names both approval mechanisms: `confirmNonDryRun` for API/MCP and `--yes` for CLI.
- MCP schema:
  - `dryRun` remains default-true at the tool adapter.
  - `confirmNonDryRun` is ignored for dry-runs and required for `dryRun: false`.
- CLI:
  - `--dry-run` remains opt-in for CLI; existing legacy CLI behavior for omitted `--dry-run` is now protected by `--yes`.
  - Non-dry-run CLI launch without `--yes` prints the blocked `RunState` JSON as the command result rather than starting children.
- Path validation:
  - Absolute paths and any `..` segment are rejected before `path.resolve` can escape the workspace.
  - Validation applies to both config YAML and `--tracks-dir`/MCP `tracksDir`.
- Capability surface:
  - Project inspection reports the full capability set with `trackerMigration: true`.

## Tests

- `packages/orchestrator/tests/handlers.test.ts`
  - non-dry-run `run-story` without approval returns blocked approval-required state and does not launch the injected child client.
  - non-dry-run `run-story` with `confirmNonDryRun: true` reaches the launch path.
- `packages/orchestrator/tests/mcp-server.test.ts`
  - `run_story` with `dryRun: false` and no `confirmNonDryRun` returns structured blocked state.
  - `run_story` dry-run default remains unchanged.
- `packages/orchestrator/tests/cli-args.test.ts`
  - `--yes` maps to `confirmNonDryRun: true`.
  - `--tracks-dir ../../etc` is rejected.
- `packages/orchestrator/tests/config-resolve.test.ts` or `config-loader.test.ts`
  - config path fields reject traversal.
  - override `tracksDir: ../../etc` is rejected.
- `packages/orchestrator/tests/preset.test.ts` and root `test/presets.test.ts`
  - auto-selected default is `push-only` for new/unknown repos and all current signal combinations; shipped preset semantics remain unchanged.
- `packages/orchestrator/tests/api-facade.test.ts`
  - project inspection asserts the full capability object including `trackerMigration: true`.
- Existing generated-schema drift tests cover `references/config.schema.json` after regeneration.
- Focused commands before full gate:
  - `pnpm --filter @agentic-workflow-kit/orchestrator vitest run packages/orchestrator/tests/handlers.test.ts packages/orchestrator/tests/mcp-server.test.ts packages/orchestrator/tests/cli-args.test.ts packages/orchestrator/tests/config-loader.test.ts packages/orchestrator/tests/preset.test.ts packages/orchestrator/tests/api-facade.test.ts`
  - `pnpm vitest run test/presets.test.ts test/config-schema.test.ts`
  - `pnpm check`

## Migration/deploy concerns

- Existing config files with ordinary relative paths keep working.
- Config files or overrides with absolute path or `..` escapes now fail validation. This is an intentional hardening change.
- Existing dry-run MCP/CLI calls continue unchanged.
- Existing non-dry-run automation must add `confirmNonDryRun: true` or `--yes`. This is an intentional POL-1 safety gate.
- Auto-merge preset files are not changed; only automatic preset selection becomes conservative.
- No database migrations or hosted deployment steps.

## Blocking technical questions

None
