---
title: AWK02 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
---

# AWK02 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| POL-3 | Users can define named agent profiles with prompt/model/reasoning/structured-output/sandbox/approval/host settings. |
| POL-4 | Users can configure budgets per profile. |
| POL-5 | Budget actions are modeled as warn, stop-new-launches, checkpoint-stop, or abort. |
| POL-6 | Budget configuration is visible in resolved config and artifacts. |
| POL-7 | Runtime task types bind to agent profiles with defaults and per-run overrides. |
| HC-2 | Profile model is host-neutral enough for future drivers. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Data contracts | Defines `agents.profiles`, `agents.bindings`, structured output, budgets, and profile interfaces. |
| Architecture and domains | Places profile resolution in the agent execution domain. |
| AI, observability, and operations | Describes prompt boundaries and structured-output downgrade behavior. |
| API surface | Requires profile inspection APIs and config capability reporting. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK01 | Profile schemas and result envelopes should use the shared API facade. |

## Scope boundary

**In scope**

- Extend `ConfigSchema`, generated JSON schema, human config docs, presets, and examples for agent profiles, task bindings, structured-output refs, prompt refs, host settings, and budget policies.
- Add resolver logic that produces effective task profile config with legacy model/reasoning overrides preserved.
- Add validation diagnostics for missing profiles, invalid bindings, invalid budget actions, and unsupported host/profile combinations.
- Ensure old configs without `agents` still parse and get safe defaults.
- Pin assumption: the story is executed by installed 0.5.13; new profile config is for the product being built, not for executing this track.

**Out of scope**

- Refactor the Codex driver to consume resolved profiles deeply; AWK05 owns that.
- Implement live budget enforcement; AWK06/AWK08 own runtime behavior.
- Add release changesets.

## Candidate surfaces

- **Files/modules:** `packages/orchestrator/src/config/schema.ts`, `references/config.schema.json`, `references/config-schema.md`, `presets/*.yaml`, `packages/orchestrator/src/config/*`, `test/config-schema.test.ts`, `test/config-doc-sync.test.ts`, `test/presets.test.ts`
- **Queries/schema:** config schema only
- **Prompts/tools:** prompt/template refs and structured-output refs
- **Events/metrics:** resolved budget fields in config snapshots
- **Components/routes:** none

## Validation expectations

- Focused config/schema/doc/preset tests.
- Regenerate and verify `references/config.schema.json`.
- `pnpm vitest run test/config-schema.test.ts test/config-doc-sync.test.ts test/presets.test.ts packages/orchestrator/tests/config-resolve.test.ts packages/orchestrator/tests/config-loader.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Exact field names for prompt refs, structured-output refs, and budget dimensions? | yes | Define schema names and defaults before editing docs/tests. |
| Should token/cost budgets be accepted but marked unenforceable when live telemetry is missing? | yes | Specify validation and runtime downgrade behavior. |
