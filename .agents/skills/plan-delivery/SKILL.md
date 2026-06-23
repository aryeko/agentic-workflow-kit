---
name: plan-delivery
description: >-
  Use after $plan-epic and before $orchestrated-delivery for workflow-kit/kit-vnext epics when a
  frozen story DAG and `story: ready` contracts must be converted into a docs-only execution package
  under `docs/implementation/epics/EPIC_SLUG/execution/`. Produces `plan.md`, `tracker.md`, and
  per-story implementer/reviewer prompts with model class and effort assignments. Not for writing
  feature code, running story implementation, or changing design/planning artifacts outside the
  execution package.
---

# Plan Delivery

## Contract

You are the delivery planner. Convert one ready workflow-kit epic into a decision-complete
execution package for later execution.

Write only:

- `docs/implementation/epics/<epic-slug>/execution/plan.md`
- `docs/implementation/epics/<epic-slug>/execution/tracker.md`
- `docs/implementation/epics/<epic-slug>/execution/prompts/<story-id>/implementer.md`
- `docs/implementation/epics/<epic-slug>/execution/prompts/<story-id>/reviewer.md`

Do not implement stories, edit `packages/`, dispatch workers, commit, push, open PRs, or modify the
story DAG/contracts. If the execution package already exists, inspect it first and update only the
target epic's package.

## Reference Routing

Read only the reference files needed for the current step:

- `references/source-readiness.md`: resolve the epic, read source planning files, validate
  `story-dag: frozen` and `story: ready`, and verify the write location.
- `references/package-layout.md`: apply execution package file-tree and per-epic boundary rules.
- `references/model-routing.md`: assign abstract model classes, effort, tier, and routing rationale.
- `references/plan-artifact.md`: author `execution/plan.md`.
- `references/tracker-artifact.md`: author `execution/tracker.md`.
- `references/implementer-prompt.md`: author each implementer prompt.
- `references/reviewer-prompt.md`: author each reviewer prompt.
- `references/closeout-validation.md`: validate package completeness, artifact compliance, quality,
  source correctness, and implementation readiness.

Each reference owns one responsibility. Do not duplicate field tables or schemas in this file, and
do not make one reference carry another reference's domain.

## Workflow

1. Use `source-readiness.md` first. Stop on ambiguous epic selection, missing files, non-frozen DAG,
   non-ready stories, DAG/story conflicts, or wrong worktree.
2. Use `package-layout.md` to create or update only the target epic's execution package files.
3. Use `model-routing.md` before writing artifacts that record implementer/reviewer assignments. If
   a ready story is too risky or underspecified for delivery packaging, stop and report the exact
   story as blocked for `$plan-epic` or planning repair.
4. Use `plan-artifact.md` and `tracker-artifact.md` to write the package plan and initial tracker.
5. Use `implementer-prompt.md` and `reviewer-prompt.md` to write one prompt pair per story.
6. Use `closeout-validation.md` to run deterministic package validation, deep artifact review, and
   readiness reporting.

Keep the package self-contained. Do not tell the later execution run to read another skill to
discover required fields, routing classes, prompt expectations, or tracker semantics.

Stop after package closeout. Do not run story implementation or invoke the later execution workflow.
