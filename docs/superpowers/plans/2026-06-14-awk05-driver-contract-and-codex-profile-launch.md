---
title: AWK05 implementation plan
owner: codex
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk05-driver-contract-and-codex-profile-launch-design.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK05.md
---

# AWK05 implementation plan

## Scope

Implement the provider-neutral launch contract additions from the AWK05 spec, limited to the
existing `StoryRunner` boundary, `WorkflowRunner`, Codex MCP driver/tool input, and focused tests.

## Steps

1. Add failing tests first.
   - Update `packages/orchestrator/tests/tool-input.test.ts` for profile-driven Codex input,
     structured-output metadata, and compatibility fallback.
   - Update `packages/orchestrator/tests/codex-mcp-runner.test.ts` for invocation and downgrade
     evidence.
   - Update `packages/orchestrator/tests/runner.test.ts` for `StoryRunRequest.profile`,
     `promptMetadata`, launch record fields, and launch event fields.

2. Update shared contracts.
   - Add `CapabilityDowngrade`, `StoryPromptMetadata`, and child launch/evidence metadata fields in
     `packages/orchestrator/src/types.ts`.
   - Update `packages/orchestrator/src/drivers/StoryRunner.ts` request/result types.

3. Update Codex input construction.
   - Change `buildCodexToolInput` to accept a profile and prompt metadata.
   - Prefer profile fields over legacy `codex.childSession` fields.
   - Add `workflowkit_profile` and `workflowkit_structured_output` config metadata.
   - Preserve existing writable-root injection and legacy config merge behavior.

4. Update Codex runner.
   - Pass request profile and prompt metadata into `buildCodexToolInput`.
   - Return driver capability downgrades in `StoryRunResult` and `ChildResultEvidence`.
   - Keep `codex/event`, `session_configured`, MCP progress, and validation behavior unchanged.

5. Update workflow runner launch metadata.
   - Select `config.agents.resolved.implementStory`.
   - Compute prompt metadata from the rendered prompt.
   - Store profile, prompt, structured-output, and downgrade fields in launch records and
     `child-launch-requested` events.
   - Pass profile and prompt metadata to the child runner.

6. Verify.
   - Run focused tests:
     `pnpm vitest run packages/orchestrator/tests/codex-mcp-runner.test.ts packages/orchestrator/tests/codex-mcp-events.test.ts packages/orchestrator/tests/schema-validation.test.ts packages/orchestrator/tests/tool-input.test.ts packages/orchestrator/tests/runner.test.ts`
   - Run `pnpm check`.
   - Rendered/browser verification is not applicable because AWK05 has no UI surface; record the
     downgrade to repository tests in the handoff.

7. Review and ship.
   - Run configured subagent pre-PR review with product docs, architecture docs, story brief, spec,
     plan, diff, and verification evidence.
   - Fix any review findings within the configured loop limit and rerun verification.
   - Mark AWK05 `done`, commit, create/update PR, wait for CI and Codex bot review, update branch
     on latest `main`, rerun verification, squash merge, and delete branch if all gates pass.
