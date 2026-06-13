---
title: AWK04 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/02-runtime-flows.md
---

# AWK04 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| WF-1 | PRD creation works from notes, brainstorming, or existing docs. |
| WF-2 | HLD creation works from PRD, design docs, technical notes, or session context. |
| WF-3 | Track planning works from PRD+HLD, HLD alone, or existing backlog/design context when sufficient. |
| WF-4 | Workflow steps record assumptions and blockers without unnecessary prompting. |
| WF-5 | Docs distinguish artifact responsibilities. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Runtime flows: Authoring flow | Defines independent authoring step behavior. |
| Architecture and domains | Authoring domain owns workflow skills, templates, examples, and generated docs. |
| AI, observability, and operations | Prompt boundaries and story-brief citation requirements. |
| API surface | Non-interactive artifact create/validate API should align with skills. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK01 | Artifact APIs and terminology should be stable before skill/doc updates. |

## Scope boundary

**In scope**

- Harden `define-product`, `design-technical-solution`, and `plan-delivery-track` skills for non-linear invocation and explicit external context.
- Update contracts/templates/examples to clarify assumptions, blockers, and artifact boundaries.
- Add tests for PRD/HLD/tracker/story-brief templates and examples.
- Align authoring docs with transient `docs/superpowers/` story spec/plan convention.
- Pin assumption: the running track uses installed 0.5.13 skills; this story changes future plugin behavior only after release.

**Out of scope**

- Runtime execution changes.
- Detailed story spec generation changes beyond contract references.
- Release changeset.

## Candidate surfaces

- **Files/modules:** `skills/define-product/SKILL.md`, `skills/design-technical-solution/SKILL.md`, `skills/plan-delivery-track/SKILL.md`, `references/prd-contract.md`, `references/technical-solution-contract.md`, `references/story-brief-contract.md`, `references/templates/*`, `examples/*`, `test/*template*.test.ts`, `test/example-*.test.ts`
- **Queries/schema:** none
- **Prompts/tools:** workflow skill instructions
- **Events/metrics:** none expected
- **Components/routes:** none

## Validation expectations

- Focused skill/contract/template/example tests.
- `pnpm vitest run test/prd-contract.test.ts test/technical-solution-contract.test.ts test/story-brief-template.test.ts test/example-prd.test.ts test/example-tracker.test.ts test/skill-authoring.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| How much non-interactive artifact creation belongs in skills versus CLI/MCP API? | no | Coordinate with AWK01 and keep this story instruction/template focused. |
