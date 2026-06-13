---
title: AWK05 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/01-architecture-and-domains.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
---

# AWK05 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| HC-1 | Codex remains a fully supported V1 execution host. |
| HC-2 | Provider-neutral driver contract supports future host adapters. |
| RUN-1 | Story run launch uses the driver contract and produces clear results. |
| OBS-4 | Driver lifecycle contributes telemetry and evidence. |
| POL-3 | Driver launch consumes resolved agent profiles. |
| POL-7 | Logical task types bind to profile-backed launch policy. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Architecture and domains | Agent execution domain and `StoryRunner` ownership. |
| Data contracts: Interface contracts | Defines `StoryRunner`, `StoryRunRequest`, `ResolvedAgentProfile`, and `RunEvent`. |
| AI, observability, and operations: Host behavior | Codex-specific `codex/event` handling stays inside the driver. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK02 | Driver launch must consume resolved profiles and structured-output policy. |

## Scope boundary

**In scope**

- Refine provider-neutral `StoryRunner` contract around launch, progress events, metrics, evidence, structured output, capability downgrades, and cancellation capability.
- Adapt Codex MCP driver to consume resolved profile launch policy and preserve current `codex/event`/`session_configured` behavior.
- Ensure prompt rendering records template id/hash and profile id before child launch.
- Preserve existing Codex MCP compatibility and 0.5.13-style behavior during migration.
- Pin assumption: story execution uses installed 0.5.13; the driver code being edited cannot be relied on to run this story.

**Out of scope**

- Add non-Codex drivers.
- Implement run abort end to end; AWK07 owns control application.
- Full streaming API; AWK09 owns subscriber surface.

## Candidate surfaces

- **Files/modules:** `packages/orchestrator/src/drivers/StoryRunner.ts`, `packages/orchestrator/src/drivers/codex-mcp/*`, `packages/orchestrator/src/runner/WorkflowRunner.ts`, `packages/orchestrator/src/runner/launchMetadata.ts`, `packages/orchestrator/src/types.ts`
- **Queries/schema:** none
- **Prompts/tools:** `buildGenericPrompt`, structured output and profile launch policy
- **Events/metrics:** child lifecycle events, profile/prompt metadata
- **Components/routes:** none

## Validation expectations

- Focused driver/tool-input/schema validation tests.
- `pnpm vitest run packages/orchestrator/tests/codex-mcp-runner.test.ts packages/orchestrator/tests/codex-mcp-events.test.ts packages/orchestrator/tests/schema-validation.test.ts packages/orchestrator/tests/tool-input.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Which capability downgrades are driver-level versus analyzer-only warnings? | yes | Define recorded fields and tests before refactor. |
| Should structured output be enforced through Codex input or validated post-result first? | yes | Choose V1 behavior and fallback. |
