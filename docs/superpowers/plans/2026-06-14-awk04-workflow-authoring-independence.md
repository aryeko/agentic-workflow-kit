---
title: AWK04 implementation plan
owner: codex
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk04-workflow-authoring-independence-design.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK04.md
---

# AWK04 implementation plan

## Goal

Harden workflow authoring instructions, contracts, templates, examples, and tests so PRD, technical
solution, and delivery-track authoring can start from rich external or in-session context without
requiring a linear kit artifact chain when enough information is already present.

## Steps

1. Add failing/targeted test expectations:
   - `test/skill-authoring.test.ts` for independent invocation, assumptions/blockers, artifact
     boundaries, and plan-track source modes.
   - `test/prd-contract.test.ts` for PRD inputs, assumptions/blockers, and artifact boundaries.
   - `test/technical-solution-contract.test.ts` for non-linear HLD inputs and assumptions/blockers.
   - `test/story-brief-template.test.ts` for story-brief assumptions/blockers and artifact boundaries.
   - `test/example-prd.test.ts` and `test/example-tracker.test.ts` for worked examples.
2. Update authoring skills:
   - `define-product` keeps the context-rich fast path and makes notes, brainstorming, existing docs,
     and session context first-class inputs.
   - `design-technical-solution` supports PRD-backed or external-context-backed HLD authoring when
     enough technical context exists.
   - `plan-delivery-track` supports PRD+HLD, HLD alone, or sufficient existing backlog/design
     context; it stops only when source material cannot provide scope, outcomes, sequencing, and
     validation expectations.
3. Update contracts and templates:
   - PRD contract/template records assumptions, blockers, and artifact boundaries.
   - Technical solution contract/template records assumptions, blockers, and high-level design
     boundaries.
   - Story brief contract/template records assumptions, blockers, artifact boundaries, and preserves
     the not-implementation-ready note.
4. Update examples:
   - Example PRD shows concrete assumptions/open questions and boundary language.
   - Example tracker briefs show assumptions and artifact boundaries without adding status mirrors.
5. Run focused verification:

   ```bash
   pnpm vitest run test/prd-contract.test.ts test/technical-solution-contract.test.ts test/story-brief-template.test.ts test/example-prd.test.ts test/example-tracker.test.ts test/skill-authoring.test.ts
   ```

6. Run configured verification:

   ```bash
   pnpm check
   ```

7. Run required pre-PR review as a read-only subagent with product docs, architecture docs, story
   brief, detailed spec, plan, diff, and verification output. Fix any findings and rerun configured
   verification.
8. Re-read AWK04 tracker row, mark status `done`, commit, create PR, add PR link to tracker, and
   follow configured CI, Codex review, rebase, final verification, merge, and cleanup policy.

## Out of scope

- Runtime CLI/MCP artifact create or validate implementation.
- Zod config/schema changes.
- Tracker contract column/status changes.
- Release changeset.
