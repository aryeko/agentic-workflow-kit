# Delivery inputs

This page is the handoff from technical solution to delivery-track planning.

## Open technical questions

| Question | Blocking? | Recommended default | Resolution path |
| --- | --- | --- | --- |
| What exact field names should agent profiles and task bindings use in `.workflow/config.yaml`? | no | Use `agents.profiles.<profileName>` plus `agents.bindings.<taskType>`. | Resolve in the config-schema story with schema/doc tests. |
| Which structured-output schemas should be built in for V1? | no | Start with child-run-result, review-result, planning-result, run-analysis, recovery-decision, and migration-report. | Resolve in the driver contract/schema story with fixtures. |
| What exact final MCP tool names should ship? | no | Use the `workflow_*` tool family from `05-api-surface.md` unless implementation discovers a host naming constraint. | Resolve in the API-surface story with MCP tool schema tests. |
| Which budget dimensions are enforceable live in Codex? | no | Enforce wall time/tool counts live; report token budgets from transcript/analyzer until live telemetry is proven. | Resolve in budget/telemetry story with real Codex session evidence. |
| How should child-session speed policy map to Codex service tiers? | no | Use a normalized `derive \| fast \| standard` policy: derive inherits, fast opts into Codex Fast, standard explicitly clears inherited Fast and persists the Codex opt-out marker. | Resolve in a late config-hardening story with schema/docs tests and Codex tool-input tests. |
| Should GitHub evidence be collected by child prompt discipline or parent-side helper modules? | no | Keep child-owned GitHub workflow for V1, but require structured evidence extraction and analyzer validation. | Revisit after story-level runtime hardening. |
| What backlog formats should migration support first? | no | Markdown tables and existing kit-like trackers first; defer issue tracker imports. | Resolve in migration story with fixtures. |
| How should abort affect an active child session if the host cannot cancel it cleanly? | no | Record abort request, call available abort signal, stop parent launching immediately, and classify remaining child state conservatively. | Resolve in run-control story with fake driver and Codex driver tests. |

No open question blocks delivery-track planning; each can become a bounded story input.

## Inputs for delivery tracker/story briefs

| Story brief input | PRD criteria | Technical solution sections to cite | Sequencing/file-contention notes |
| --- | --- | --- | --- |
| Product API facade for MCP and CLI | WF-5, RUN-1, RUN-2, OBS-1, OBS-2, OBS-3, HC-1, HC-2 | `technical-solution.md`; `05-api-surface.md`; `03-data-contracts.md` | Foundation story before runtime surface expansion. Touches shared command contracts, MCP tool schemas, CLI args/output, tests. |
| Config agent profiles, prompts, structured outputs, and budget schema | POL-3, POL-4, POL-5, POL-6, POL-7, HC-2 | `technical-solution.md`; `01-architecture-and-domains.md`; `03-data-contracts.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Foundation story. Touches `schema.ts`, generated JSON schema, presets, config docs, CLI/MCP schemas, prompt/output schema references. |
| Workflow-step independence hardening | WF-1, WF-2, WF-3, WF-4, WF-5 | `technical-solution.md`; `02-runtime-flows.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Can run after config foundation. Touches skills and references; avoid mixing with runtime code. |
| Tracker validation command/tool | TRK-1, TRK-3, TRK-4 | `technical-solution.md`; `01-architecture-and-domains.md`; `02-runtime-flows.md`; `03-data-contracts.md`; `05-api-surface.md` | Foundation for migration/runtime. Touches parser, handlers, CLI, MCP tools. |
| Backlog migration/import workflow | TRK-2, TRK-3 | `technical-solution.md`; `01-architecture-and-domains.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Depends on tracker validation. Touches skills/references and maybe orchestrator helpers. |
| Provider-neutral driver contract | HC-1, HC-2, RUN-1, OBS-4 | `technical-solution.md`; `01-architecture-and-domains.md`; `02-runtime-flows.md`; `03-data-contracts.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Foundation before deeper Codex/runtime work. Touches `StoryRunner.ts`, Codex driver, tests. |
| Child-session speed policy | POL-3, Q-4, HC-1, HC-2 | `technical-solution.md`; `01-architecture-and-domains.md`; `03-data-contracts.md` | Late config-hardening story before release. Touches `schema.ts`, config loader, Codex tool input, config docs, generated schema, presets/examples, and plugin fixture sync. |
| Story-level runtime policies | RUN-1, RUN-3, RUN-5, RUN-6, POL-4, POL-5 | `technical-solution.md`; `02-runtime-flows.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Depends on agent profiles, budgets, and driver contract. Touches `WorkflowRunner`, guards, metrics. |
| Track-level autopilot continuation and stop semantics | RUN-2, RUN-3, RUN-4, RUN-6 | `technical-solution.md`; `02-runtime-flows.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Depends on story-level policies. High contention with `WorkflowRunner`. |
| Run control and abort | OBS-1, OBS-2, OBS-3, RUN-6 | `technical-solution.md`; `02-runtime-flows.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Depends on runner control state and driver cancellation. Touches handlers, MCP tools, runner. |
| Run event stream and MCP streaming | OBS-1, OBS-3, OBS-7, FUT-2 | `technical-solution.md`; `02-runtime-flows.md`; `03-data-contracts.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Depends on normalized run event stream. Touches `RunJournal`, handlers, MCP tools. |
| Analyzer/report bundle | OBS-4, OBS-5, OBS-6, FUT-1, FUT-2 | `technical-solution.md`; `03-data-contracts.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Can run in parallel with streaming after event schema is stable. Touches analyzer/report tests. |
| GitHub evidence hardening | HC-3, RUN-4, RUN-6, OBS-4 | `technical-solution.md`; `01-architecture-and-domains.md`; `02-runtime-flows.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Can follow story-level runtime. Touches prompts, evidence parser, analyzer. |
| Docs, examples, and package smoke | WF-5, HC-4, FUT-1, FUT-2 | `technical-solution.md`; `01-architecture-and-domains.md`; `04-ai-observability-operations.md`; `05-api-surface.md` | Final stabilization. Touches docs, fixtures, smoke tests, package/plugin metadata. |
