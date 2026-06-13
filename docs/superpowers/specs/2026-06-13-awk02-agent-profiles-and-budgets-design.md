---
title: AWK02 detailed technical story spec
owner: codex
last-reviewed: 2026-06-13
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK02.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
---

# AWK02 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK02.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Exact field names for prompt refs, structured-output refs, and budget dimensions? | Add top-level `agents.profiles` and `agents.bindings`. Profiles use `prompt.template`, `prompt.variables`, `structuredOutput.schema`, `structuredOutput.required`, `budget.wallMs`, `budget.tokens`, `budget.toolCalls`, `budget.failedToolCalls`, and `budget.costUsd`. | These names match the technical-solution model while keeping all new fields optional and strict. They cover POL-3, POL-4, POL-5, POL-7 without changing child prompt construction in this story. |
| Should token/cost budgets be accepted but marked unenforceable when live telemetry is missing? | Accept token and cost budgets in config. The resolver marks `tokens` and `costUsd` budgets with unavailable reasons in the effective profile because live enforcement is not implemented in AWK02. Wall-time and tool-call budgets are marked enforceable in shape only; runtime enforcement is left to AWK06/AWK08. | This preserves forward-compatible policy config and makes unenforceable dimensions visible in resolved config/artifacts, instead of rejecting valid future policy. |

## Exact types/contracts

Add these public config types through `WorkflowConfig` and `ResolvedWorkflowConfig` inference:

```ts
type AgentTaskType = 'implementStory' | 'prePrReview' | 'planTrack' | 'analyzeRun' | 'recoverRun' | 'migrateTracker';
type AgentBudgetAction = 'warn' | 'stop-new-launches' | 'checkpoint-stop' | 'abort';
type AgentDriver = 'codex-mcp' | 'inline';

interface AgentPromptRef {
  template: string;
  variables: Record<string, unknown>;
}

interface AgentStructuredOutputRef {
  schema: string;
  required: boolean;
}

interface AgentBudgetDimension {
  limit: number | null;
  warnAtPercent: number | null;
  action: AgentBudgetAction;
}

interface AgentBudgetPolicy {
  wallMs: AgentBudgetDimension;
  tokens: AgentBudgetDimension;
  toolCalls: AgentBudgetDimension;
  failedToolCalls: AgentBudgetDimension;
  costUsd: AgentBudgetDimension;
}

interface AgentProfile {
  driver: AgentDriver;
  model: string | null;
  reasoning: string | null;
  approvalPolicy: string | null;
  sandbox: string | null;
  prompt: AgentPromptRef;
  structuredOutput: AgentStructuredOutputRef;
  budget: AgentBudgetPolicy;
  host: Record<string, unknown>;
}
```

Schema defaults:

- `agents.profiles.storyImplementer` defaults to `driver: codex-mcp`, `reasoning: medium`,
  `prompt.template: built-in/story-implementer`, `structuredOutput.schema: built-in/child-run-result`,
  `structuredOutput.required: true`, and `budget.wallMs.limit: 7200000` with
  `action: checkpoint-stop`.
- `agents.profiles.prePrReviewer` defaults to `driver: codex-mcp`, `reasoning: medium`,
  `prompt.template: built-in/pre-pr-reviewer`, `structuredOutput.schema: built-in/review-result`,
  `structuredOutput.required: true`, and empty budget limits.
- `planner`, `analyzer`, and `recovery` default to `driver: inline` with built-in prompt and
  structured-output schema names.
- `agents.bindings` defaults are `implementStory: storyImplementer`, `prePrReview: prePrReviewer`,
  `planTrack: planner`, `analyzeRun: analyzer`, `recoverRun: recovery`, `migrateTracker: planner`.

Validation:

- Reject empty or missing bound profile names after defaults.
- Reject a binding that references a profile key that is not present in `agents.profiles`.
- Reject budget `warnAtPercent` outside `1..100`.
- Reject negative budget limits.
- Reject unknown `budget.*.action` values.
- Reject `codex-mcp` profiles whose `approvalPolicy`, `sandbox`, `host`, prompt refs, or structured
  output refs are structurally invalid. Do not reject `inline` profiles with host settings; they are
  ignored by current drivers but visible in resolved profile data.

Resolved config contract:

```ts
interface ResolvedAgentProfile extends AgentProfile {
  name: string;
  taskType: AgentTaskType;
  effectiveModel: string | null;
  effectiveReasoning: string | null;
  budgetSupport: Record<keyof AgentBudgetPolicy, { enforceable: boolean; unavailableReason: string | null }>;
  capabilityWarnings: string[];
}

interface ResolvedWorkflowConfig {
  agents: {
    profiles: Record<string, AgentProfile>;
    bindings: Record<AgentTaskType, string>;
    resolved: Record<AgentTaskType, ResolvedAgentProfile>;
  };
}
```

Legacy CLI/MCP overrides `--model` and `--reasoning` continue to set Codex child input exactly as
before. They also populate `effectiveModel` and `effectiveReasoning` for the selected
`implementStory` profile in resolved config without mutating the source `agents.profiles`.

## Exact files/modules

```text
packages/orchestrator/src/config/schema.ts       Add strict agents profile/binding/budget schema and defaults.
packages/orchestrator/src/config/configLoader.ts Resolve effective task profiles and budget support metadata.
packages/orchestrator/src/types.ts               Add exported profile, budget, and resolved-config type fields.
references/config.schema.json                    Regenerate from Zod schema.
references/config-schema.md                      Document agents profiles, bindings, budgets, defaults, validation, and resolved visibility.
presets/gated-automerge.yaml                     Add fully populated default agents block.
presets/push-and-merge.yaml                      Add fully populated default agents block.
presets/push-only.yaml                           Add fully populated default agents block.
test/config-schema.test.ts                       Cover valid agents config and invalid budget/binding cases.
test/config-doc-sync.test.ts                     Update doc sync expectations if needed.
test/presets.test.ts                             Continue validating populated presets through schema.
packages/orchestrator/tests/config-resolve.test.ts Add ConfigSchema default and validation coverage.
packages/orchestrator/tests/config-loader.test.ts Add resolved effective profile and CLI override coverage.
packages/orchestrator/tests/config-resolve.test.ts Add old-config compatibility coverage.
docs/tracks/agentic-workflow-kit-redesign/README.md Update AWK02 spec/plan/status/PR fields as workflow progresses.
```

## Query/schema/prompt/event/component design

There are no database queries, UI components, migrations, or prompt rewrites in AWK02.

Config schema design:

- The `agents` block is optional and defaults to a complete built-in profile set.
- Profile names are object keys. Any non-empty key is accepted.
- `agents.bindings` is a strict object keyed by known task types. Defaults cover every current task.
- Prompt and structured-output refs are identifiers or repo-relative paths represented as strings;
  AWK02 validates shape only and does not load prompt or schema files.
- Budget dimensions share one shape so future enforcement can iterate consistently.

Resolved profile design:

- `loadResolvedConfig` exposes `agents.profiles`, `agents.bindings`, and `agents.resolved`.
- `agents.resolved.<taskType>.budgetSupport.tokens` and `.costUsd` include
  `enforceable: false` and explicit unavailable reasons because live token/cost telemetry is not a
  runtime gate yet.
- `config.resolved.json` written by `RunJournal` will include the new resolved config fields when
  runtime calls pass the full resolved config, satisfying POL-6's config visibility half. Actual
  usage/budget outcomes remain AWK06/AWK08 scope.

Driver compatibility:

- `CodexMcpStoryRunner` and `toolInput.ts` are not refactored in this story.
- Existing CLI/MCP `model`, `reasoning`, `approvalPolicy`, and `sandbox` overrides keep their
  current child input behavior.
- Unsupported profile combinations are represented as resolver warnings rather than launch
  failures until AWK05 introduces driver capability negotiation.

## Tests

Write failing tests before implementation:

- `test/config-schema.test.ts`
  - JSON schema accepts a fully populated agents block.
  - JSON schema rejects invalid budget actions, invalid `warnAtPercent`, negative limits, and
    bindings that reference missing profiles.
- `packages/orchestrator/tests/config-resolve.test.ts`
  - `ConfigSchema.parse({ version: 1 })` fills safe agent defaults.
  - Existing version-only configs still parse.
  - Missing profile bindings fail with a readable `agents.bindings.<task>` path.
- `packages/orchestrator/tests/config-loader.test.ts`
  - `loadResolvedConfig` exposes resolved task profiles with budget support metadata.
  - CLI/MCP model and reasoning overrides update the effective implement-story profile while
    preserving current `codex.childSession` output.
- `test/presets.test.ts`
  - Existing preset schema validation covers fully populated presets; add direct expectations for
    default profile names if the current test only validates parse success.

Focused command:

```bash
pnpm vitest run test/config-schema.test.ts test/config-doc-sync.test.ts test/presets.test.ts packages/orchestrator/tests/config-resolve.test.ts packages/orchestrator/tests/config-loader.test.ts
```

Full gate:

```bash
pnpm check
```

## Migration/deploy concerns

- No database migrations, hosted deploys, or release changesets.
- Existing `.workflow/config.yaml` files without `agents` must parse and resolve built-in defaults.
- Presets become more verbose but remain schema-valid and backward-compatible.
- Generated `references/config.schema.json` must be regenerated from `ConfigSchema`.
- AWK13 will later fold durable spec/plan content into canonical docs and remove transient
  `docs/superpowers/` artifacts.

## Blocking technical questions

None
