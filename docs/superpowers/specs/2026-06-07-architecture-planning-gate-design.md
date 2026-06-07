---
title: Architecture planning gate design
status: approved
owner: codex
last-reviewed: 2026-06-07
related:
  - skills/plan-product/SKILL.md
  - skills/plan-track/SKILL.md
  - references/prd-contract.md
  - references/tracker-contract.md
---

# Architecture planning gate design

## Diagnosis

The current planning workflow is:

```text
plan-product -> plan-track -> implement-next
```

`plan-product` produces a useful PRD, but then always hands off to `plan-track`. `plan-track`
describes itself as the technical decomposition stage and writes tracker rows plus per-story specs
from the PRD and repo audit. For complex technical products this skips the high-level architecture
artifact needed before story slicing. The missing artifact is a stable design input that captures
system architecture, modules, data/query design, AI prompts/triggers/tools, observability, deploy
surfaces, tests, and open technical questions.

## Goals

- Add a first-class technical architecture stage between PRD and tracker.
- Keep simple one-shot or low-technical-risk work lightweight.
- Make `plan-product` faster when the user has already provided rich context.
- Make `plan-track` pause for complex technical PRDs when no architecture document exists.
- Make per-story specs cite both PRD acceptance criteria and relevant architecture sections.
- Keep source skills, references, and Codex local marketplace fixtures byte-for-byte aligned.

## Non-goals

- Do not change orchestrator runtime behavior.
- Do not alter tracker status vocabulary or config schema.
- Do not add release or publish steps.
- Do not retain transient Superpowers spec/plan files in the final PR state.

## Proposed change set

1. Add `plan-architecture` as a user-invocable skill.
   - It consumes a PRD plus repo reality.
   - It writes `<prdsDir>/<slug>/architecture.md` by default.
   - It uses a canonical `references/technical-architecture-contract.md`.
   - It copies from `references/templates/technical-architecture-template.md`.
   - It shows the flow before executing and asks only blocking questions.

2. Update `plan-product`.
   - Add a context-rich fast path: ingest notes first, draft assumptions, ask only blocking
     questions, record safe assumptions instead of interrupting.
   - Recommend the next step from the PRD scope:
     - simple feature -> `plan-track`
     - complex technical feature -> `plan-architecture`
     - UI-heavy feature -> UX/content pass or architecture depending on scope
     - research-heavy feature -> validation/research first

3. Update `plan-track`.
   - Add an architecture gate after the PRD gate and before story identification.
   - Treat complex technical PRDs as blocked until a conforming architecture doc exists.
   - Consume the architecture doc during the repo audit, story slicing, tracker related links, and
     per-story spec linkage.
   - Require every per-story spec to cite relevant architecture sections.

4. Update contracts, templates, tests, and fixture.
   - Add technical architecture contract and template tests.
   - Extend skill-authoring tests for the sixth skill and metadata.
   - Extend plugin manifest tests for shipped `plan-architecture`.
   - Mirror new and changed files into `plugins/agentic-workflow-kit/`.

## Durable docs impact

Durable content belongs in:

- `references/technical-architecture-contract.md`
- `references/templates/technical-architecture-template.md`
- `skills/plan-architecture/SKILL.md`
- `skills/plan-product/SKILL.md`
- `skills/plan-track/SKILL.md`
- `test/*.ts`
- `plugins/agentic-workflow-kit/**` fixture mirror

The transient files under `docs/superpowers/` will be removed in the final implementation commit.

## Validation

Targeted red/green:

- `pnpm vitest run test/skill-authoring.test.ts test/plugin-manifest.test.ts test/technical-architecture-contract.test.ts test/technical-architecture-template.test.ts`

Full gate:

- `pnpm check`

Optional smoke:

- `pnpm smoke:codex-plugin` only if available Codex CLI state is suitable; otherwise report it as
  skipped because this repo keeps live Codex CLI validation outside the default gate.
