---
title: AWK05 detailed technical story spec
owner: codex
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK05.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/01-architecture-and-domains.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md
---

# AWK05 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK05.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Which capability downgrades are driver-level versus analyzer-only warnings? | Driver-level downgrades are recorded when launch policy cannot be applied by the active driver, specifically structured output enforcement for Codex MCP V1. Existing profile `capabilityWarnings` remain config/resolution visibility for profile settings that are not consumed by a host. Analyzer-only warnings are derived later from artifacts and are out of scope for this story. | Launch-time downgrades must be visible before and after child execution. Keeping analyzer reconstruction separate avoids coupling AWK05 to AWK10 report behavior. |
| Should structured output be enforced through Codex input or validated post-result first? | V1 records structured-output intent in WorkflowKit-owned launch artifacts and result evidence, not in Codex `config`. Because current Codex MCP compatibility does not expose a stable schema-enforcement knob, enforcement is marked false with a capability downgrade and existing post-result validation remains the compatibility backstop. | This preserves 0.5.13-style Codex launches, makes the selected schema visible in WorkflowKit evidence, and avoids sending unsupported Codex config keys or claiming hard enforcement before the host contract supports it. |

## Exact types/contracts

- `StoryRunRequest` in `packages/orchestrator/src/drivers/StoryRunner.ts` gains:
  - `profile: ResolvedAgentProfile`
  - `promptMetadata: StoryPromptMetadata`
- `StoryPromptMetadata` contains:
  - `template: string`
  - `promptHash: string`
  - `structuredOutputSchema: string`
  - `structuredOutputRequired: boolean`
- `StoryRunResult` keeps existing fields and may include `capabilityDowngrades?: CapabilityDowngrade[]`.
- `CapabilityDowngrade` in `packages/orchestrator/src/types.ts` contains:
  - `capability: string`
  - `reason: string`
  - `severity: "warning" | "error"`
  - `source: "driver" | "profile"`
- `ChildResultEvidence` adds optional `profile`, `prompt`, `structuredOutput`, and `capabilityDowngrades` fields so child result artifacts can show launch policy without parsing raw invocation.
- `ChildLaunchRecord` adds `profileName`, `profileTaskType`, `promptTemplate`, `structuredOutputSchema`, `structuredOutputRequired`, and `capabilityDowngrades`.
- `StoryRunner` keeps `runStory` / `checkTools` in V1; abort end-to-end remains AWK07.

## Exact files/modules

```text
packages/orchestrator/src/types.ts  Add launch/profile metadata and capability downgrade types.
packages/orchestrator/src/drivers/StoryRunner.ts  Refine request/result contract around resolved profile and prompt metadata.
packages/orchestrator/src/drivers/codex-mcp/toolInput.ts  Build Codex input from resolved profile first, then legacy child-session compatibility config.
packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts  Pass profile-aware input and return driver downgrades in result evidence.
packages/orchestrator/src/runner/WorkflowRunner.ts  Resolve implementStory profile, compute prompt metadata, record launch metadata, and pass it to the child runner.
packages/orchestrator/tests/tool-input.test.ts  Cover profile-driven model/reasoning/approval/sandbox/structured-output metadata and legacy compatibility.
packages/orchestrator/tests/codex-mcp-runner.test.ts  Cover Codex invocation and downgrade evidence.
packages/orchestrator/tests/runner.test.ts  Cover launch record/profile metadata and StoryRunRequest profile fields.
```

## Query/schema/prompt/event/component design

No database, query, route, or UI changes.

Prompt rendering remains `buildGenericPrompt` for the built-in `storyImplementer` template. The runner records the resolved `prompt.template`, prompt hash, and structured-output schema before child launch. Non-built-in prompt template rendering is not implemented in AWK05; the metadata still records the configured template so later prompt-registry work can use the same contract.

Codex MCP input behavior:

- `model` comes from `request.profile.effectiveModel` when present.
- `approval-policy` comes from `request.profile.approvalPolicy` when present.
- `sandbox` comes from `request.profile.sandbox` when present.
- `config.model_reasoning_effort` comes from `request.profile.effectiveReasoning` unless existing legacy config already set it.
- WorkflowKit profile, prompt, structured-output, and capability downgrade metadata are not sent through Codex `config`; they are recorded in WorkflowKit launch artifacts and result evidence.
- Existing `codex.childSession` model/approval/sandbox/config values remain compatibility fallback when a profile field is null.
- Existing writable-root injection stays intact.

Run events/artifacts:

- `child-launch-requested` includes profile name, task type, prompt template, structured-output schema, structured-output required flag, prompt hash, and capability downgrades.
- `children/<ID>.launch.json` includes the same metadata.
- `children/<ID>.json` can include profile/prompt/structured-output/capability downgrade evidence through `ChildResultEvidence`.

## Tests

- `packages/orchestrator/tests/tool-input.test.ts`
  - profile launch policy overrides legacy child-session fields
  - reasoning is written to Codex config without overwriting explicit legacy config
  - structured-output intent and downgrade metadata are present
- `packages/orchestrator/tests/codex-mcp-runner.test.ts`
  - Codex runner includes profile-aware invocation
  - result evidence includes driver capability downgrades
- `packages/orchestrator/tests/runner.test.ts`
  - runner passes resolved `implementStory` profile in `StoryRunRequest`
  - launch record and `child-launch-requested` event include profile/prompt/structured-output metadata
- Focused command:
  `pnpm vitest run packages/orchestrator/tests/codex-mcp-runner.test.ts packages/orchestrator/tests/codex-mcp-events.test.ts packages/orchestrator/tests/schema-validation.test.ts packages/orchestrator/tests/tool-input.test.ts packages/orchestrator/tests/runner.test.ts`
- Full command: `pnpm check`

## Migration/deploy concerns

No migrations or hosted deploys. Existing configs without custom `agents` fields continue to use AWK02 defaults. Existing child artifacts remain readable because new fields are additive. Existing Codex MCP launches remain compatible because profile-derived fields map to already-supported Codex tool input fields, while structured-output intent is recorded in WorkflowKit-owned evidence rather than unsupported Codex config keys.

## Blocking technical questions

None
