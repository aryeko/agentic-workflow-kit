---
title: AWK02 implementation plan
owner: codex
last-reviewed: 2026-06-13
related:
  - ../specs/2026-06-13-awk02-agent-profiles-and-budgets-design.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK02.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
---

# AWK02 implementation plan

## Scope

Implement optional, defaulted `agents` config for named profiles, task bindings, prompt refs,
structured output refs, host settings, and budgets. Expose effective resolved profiles in
`loadResolvedConfig` while preserving the existing Codex child-session override behavior.

Out of scope: live budget enforcement, Codex driver refactor, prompt rendering refactor, new
changesets, UI or browser work.

## Steps

1. Add failing tests first:
   - `test/config-schema.test.ts`: full agents config acceptance plus invalid budget/binding cases.
   - `packages/orchestrator/tests/config-resolve.test.ts`: default agent profiles and old config
     compatibility.
   - `packages/orchestrator/tests/config-loader.test.ts`: resolved profile output and legacy
     model/reasoning override preservation.
   - Run the focused Vitest command and confirm the tests fail for missing `agents`.
2. Implement schema:
   - Extend `packages/orchestrator/src/config/schema.ts` with profile, binding, budget, prompt,
     structured-output, host, and cross-field binding validation.
   - Keep all new fields optional through defaults and strict nested objects.
3. Implement resolved config:
   - Extend `packages/orchestrator/src/types.ts`.
   - Add resolver helpers in `packages/orchestrator/src/config/configLoader.ts`.
   - Include `agents.profiles`, `agents.bindings`, and `agents.resolved` in both
     `loadResolvedConfig` and `resolveCwdOnlyConfig`.
   - Apply CLI/MCP model/reasoning overrides only to effective implement-story values and existing
     `codex.childSession`.
4. Update docs and generated contracts:
   - Regenerate `references/config.schema.json`.
   - Update `references/config-schema.md`.
   - Add fully populated `agents` blocks to all `presets/*.yaml`.
5. Verify:
   - Run focused command:
     `pnpm vitest run test/config-schema.test.ts test/config-doc-sync.test.ts test/presets.test.ts packages/orchestrator/tests/config-resolve.test.ts packages/orchestrator/tests/config-loader.test.ts`
   - Run `pnpm check`.
6. Pre-PR review:
   - Spawn the required read-only review subagent with repo instructions, PRD, technical solution,
     story brief, spec, plan, diff, and verification output.
   - Fix any findings within the configured loop limit and rerun verification.
7. Complete workflow:
   - Re-read tracker and set AWK02 to `done`.
   - Commit tracker completion.
   - Push, open PR, update PR link in tracker, wait for CI, wait for Codex review signal, rebase
     onto latest `main`, rerun `pnpm check`, merge squash, delete branch.

## Verification commands

Focused:

```bash
pnpm vitest run test/config-schema.test.ts test/config-doc-sync.test.ts test/presets.test.ts packages/orchestrator/tests/config-resolve.test.ts packages/orchestrator/tests/config-loader.test.ts
```

Required full gate:

```bash
pnpm check
```
