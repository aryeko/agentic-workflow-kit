---
title: AWK131 implementation plan
owner: codex-2026-06-14T05-01-48Z
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk131-awk13-1-provider-neutral-driver-boundary-design.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK131.md
---

# AWK131 implementation plan

## Scope

Implement the provider-neutral driver boundary described in the detailed story spec while preserving
all existing Codex behavior and public Codex-named tool/config compatibility.

## Steps

1. Add failing tests.
   - `packages/orchestrator/tests/config-loader.test.ts`: neutral `childSession` resolves; legacy
     `codex.childSession` resolves; neutral namespace wins when both are present.
   - `packages/orchestrator/tests/tool-input.test.ts`: story prompt is rendered by a neutral
     renderer and does not include Codex-only names or `@codex`; Codex launch input stays unchanged.
   - `packages/orchestrator/tests/codex-mcp-runner.test.ts`: Codex runner classifies request timeout
     as supervision-lost/recoverable and exposes downgrade descriptions through the driver method.
   - `packages/orchestrator/tests/runner.test.ts`: `WorkflowRunner` consumes driver
     `classifyError`.
   - `test/mcp-codex-control.test.ts` and `test/plugin-tool-surface.ts`: neutral control aliases
     exist and share redaction/journaling semantics while Codex aliases remain.

2. Implement minimal contracts.
   - Extend `StoryRunner.ts` with neutral child control, abort, classification, capability downgrade,
     and session-log discovery types/methods.
   - Add `drivers/promptRenderer.ts`, move the generic prompt there, and re-export/wrap from
     `drivers/codex-mcp/toolInput.ts` for compatibility.

3. Wire the Codex driver behind the neutral boundary.
   - Implement `classifyError`, `describeCapabilityDowngrades`, `controlChild`, `abort`, and
     `discoverSessionLogs` on `CodexMcpStoryRunner`.
   - Rename internal control helpers to neutral names and keep Codex exports as aliases.

4. Wire runtime and command surfaces.
   - `WorkflowRunner` uses `storyRunner.classifyError` and
     `storyRunner.describeCapabilityDowngrades`.
   - `commands/handlers.ts` uses neutral child interrupt helpers or the runner when available.
   - Register `workflow_child_reply`, `workflow_child_interrupt`, and `workflow_driver_check` in
     `mcp/tools.ts`; update server instructions.

5. Wire config and analyzer.
   - Add neutral `childSession` schema and resolved config field.
   - Keep `codex.childSession` as a compatibility alias, with neutral values taking precedence.
   - Move analyzer default session root discovery behind a driver helper and keep explicit
     `sessionRoot` override behavior.

6. Update docs and generated mirrors.
   - Update `references/config-schema.md`.
   - Regenerate `references/config.schema.json` with `pnpm generate-schema`.
   - Update any plugin/tool surface fixture required by tests.

7. Verification.
   - Run focused tests after each behavior is implemented.
   - Run `pnpm check`.
   - Run the required pre-PR subagent review with the spec, plan, diff, and verification evidence.

8. Final story hygiene.
   - Fold durable spec/plan content into canonical docs.
   - Delete this spec and plan before the final tracker-completion commit per repo policy.
   - Re-run `pnpm check`, mark AWK131 `done`, create the PR, wait for CI and Codex review, then
     auto-merge only if configured gates pass.
