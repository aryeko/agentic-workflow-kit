---
title: AWK04 detailed technical story spec
owner: codex
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK04.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
---

# AWK04 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK04.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| How much non-interactive artifact creation belongs in skills versus CLI/MCP API? | Keep this story instruction/template focused. Add alignment language that skills and future artifact APIs share artifact responsibilities and validation expectations, but do not implement CLI/MCP artifact create/validate runtime code in AWK04. | AWK04's scope boundary excludes runtime execution changes. AWK01 owns facade terminology, and later API/runtime stories can implement non-interactive artifact commands without coupling that work to markdown skill hardening. |

## Exact types/contracts

- `references/prd-contract.md` must describe independent PRD authoring from notes, brainstorming, existing docs, or session context; explicit assumptions; blocking questions; and PRD responsibility boundaries versus technical solution, tracker, story brief, detailed spec, plan, and runtime artifacts.
- `references/technical-solution-contract.md` must allow a technical solution to be authored from a PRD, existing design docs, technical notes, or session context; it must document assumptions and blocking questions as part of the artifact.
- `references/story-brief-contract.md` must continue to require the not-implementation-ready note and must also require brief authors to record assumptions, blockers, and artifact-boundary constraints.
- `references/templates/*` must expose those contract requirements in generated artifacts:
  - PRD templates include explicit assumptions and open questions sections.
  - Technical solution template includes explicit assumptions and open technical questions.
  - Story brief template includes assumptions, blockers, and artifact boundaries.
- `skills/define-product/SKILL.md`, `skills/design-technical-solution/SKILL.md`, and `skills/plan-delivery-track/SKILL.md` must treat upstream artifacts as optional inputs when explicit context is sufficient, ask only blocking questions, and record safe assumptions.
- No TypeScript public API, Zod schema, CLI command, MCP tool input, or runtime event contract changes are in scope.

## Exact files/modules

```text
skills/define-product/SKILL.md  Clarify independent PRD authoring inputs, assumptions/blockers, self-review, and artifact responsibility boundaries.
skills/design-technical-solution/SKILL.md  Allow PRD-backed or external-context-backed HLD authoring, require assumptions/blockers, and keep HLD high-level rather than story-local.
skills/plan-delivery-track/SKILL.md  Support PRD+HLD, HLD-only, or sufficient existing backlog/design context; require explicit assumptions, blockers, and story-brief citations without writing detailed specs/plans.
references/prd-contract.md  Document independent inputs, assumptions/open questions, and artifact boundaries.
references/technical-solution-contract.md  Document non-linear HLD inputs, assumptions, blockers, and downstream story-brief handoff boundaries.
references/story-brief-contract.md  Require assumptions, blocking questions, and artifact boundary notes.
references/templates/prd/README.md  Add generated assumptions/open-questions and downstream boundary language.
references/templates/prd/09-risks-and-open-questions.md  Make safe assumptions and blocking questions explicit.
references/templates/technical-solution-template.md  Add assumptions and blocking-question requirements.
references/templates/story-brief-template.md  Add assumptions and artifact-boundary sections.
examples/example-prd/README.md  Show the PRD boundary and assumption/open-question pattern.
examples/example-prd/09-risks-and-open-questions.md  Include concrete assumptions and blocking/open-question examples.
examples/example-tracker/stories/LK01.md  Show story-brief assumptions and artifact boundaries.
examples/example-tracker/stories/LK02.md  Show story-brief assumptions and artifact boundaries.
test/skill-authoring.test.ts  Add assertions for independent invocation, assumptions/blockers, and artifact boundaries in authoring skills.
test/prd-contract.test.ts  Add assertions for independent PRD inputs, assumptions/blockers, and artifact boundary language.
test/technical-solution-contract.test.ts  Add assertions for non-linear HLD inputs and assumptions/blockers.
test/story-brief-template.test.ts  Add assertions for assumptions/blockers and artifact boundaries in contract/template.
test/example-prd.test.ts  Add assertions for example assumptions/open questions and boundary language.
test/example-tracker.test.ts  Add assertions for example story-brief assumptions/boundaries.
```

## Query/schema/prompt/event/component design

This is instruction and markdown-contract work. There are no data queries, schema migrations,
runtime prompts, runtime events, UI components, or routes.

Prompt/instruction behavior:

- `define-product` ingests notes, brainstorming output, existing docs, or session context. It uses an upstream kit artifact only if present and relevant. It drafts from rich context, records assumptions, asks only blocking product-scope questions, and writes a contract-compliant PRD.
- `design-technical-solution` ingests a PRD when present, but may also work from external design docs, technical notes, or session context when the user explicitly asks for an HLD/technical solution and sufficient context exists. It records assumptions and blocking technical questions in the HLD and does not invent story-level implementation details.
- `plan-delivery-track` can plan from PRD+HLD, HLD alone, or existing backlog/design context when there is enough product scope, acceptance criteria or equivalent outcomes, sequencing input, and validation expectations. It records assumptions and blockers, writes tracker rows and lightweight story briefs only, and stops when source material is insufficient.

Artifact boundary language:

- PRD owns what/why and acceptance criteria.
- Technical solution owns high-level how for complex work.
- Tracker owns story sequencing, status, owner, plan link, and PR link.
- Story brief owns lightweight story-local scope and citations, not exact implementation.
- Detailed technical story spec owns exact implementation design.
- Implementation plan owns execution steps.
- Runtime artifacts own execution evidence.

## Tests

Focused command:

```bash
pnpm vitest run test/prd-contract.test.ts test/technical-solution-contract.test.ts test/story-brief-template.test.ts test/example-prd.test.ts test/example-tracker.test.ts test/skill-authoring.test.ts
```

Full configured gates:

```bash
pnpm check
```

Test scenarios:

- PRD contract and example mention notes/brainstorming/existing docs/session context, safe assumptions, blocking questions, and artifact boundaries.
- Technical solution contract and skill mention PRD/design-docs/technical-notes/session-context inputs, assumptions, blocking questions, and downstream handoff boundaries.
- Story brief contract/template/examples include assumptions, blocking questions, and artifact boundary notes while preserving the not-implementation-ready note and avoiding status mirrors.
- Authoring skills explicitly avoid unnecessary prompting and describe when to stop for blockers.
- `plan-delivery-track` does not write detailed technical story specs or implementation plans.

## Migration/deploy concerns

No data migration, package migration, feature flag, hosted deploy, or changeset is required. These
docs and skills change future plugin behavior after release. Existing trackers and examples remain
compatible because new sections are additive markdown guidance and do not change tracker columns or
story status vocabulary.

## Blocking technical questions

None
