---
name: plan-delivery
description: >-
  Use after $plan-epic and before $orchestrated-delivery for workflow-kit/kit-vnext epics when a
  frozen story DAG plus selected `story: ready` contracts must be projected into a docs-only
  execution package under `docs/implementation/epics/EPIC_SLUG/execution/`. Produces plan,
  tracker, and per-story implementer/reviewer prompts with abstract model class, effort, reasoning
  tier, and routing rationale. Not for changing scope, acceptance criteria,
  dependency order, suggested-tier floors, source planning artifacts, feature code, or runtime model
  bindings.
---

# Plan Delivery

## Job

Convert one ready workflow-kit epic into a durable execution package for a later
`orchestrated-delivery` run. This skill is the bridge only: add dispatch how, prompt wording,
tracker rows, abstract routing, and rationale. Carry the authored what unchanged.

Write only the target epic package:

- `docs/implementation/epics/<epic-slug>/execution/plan.md`
- `docs/implementation/epics/<epic-slug>/execution/tracker.md`
- `docs/implementation/epics/<epic-slug>/execution/prompts/<story-id>/implementer.md`
- `docs/implementation/epics/<epic-slug>/execution/prompts/<story-id>/reviewer.md`

Do not implement stories, dispatch implementation workers, stage, commit, push, open PRs, edit
source DAGs or story contracts, or bind provider-specific runtime model IDs. After package closeout,
dispatch exactly one independent read-only reviewer to assess package quality, correctness,
compliance, and readiness for implementation.

## Projection Rule

Every package element must cite the source story id and `AC-n` ids it projects from. Do not add or
revise scope, ACs, dependency order, owned pathsets, or suggested-tier floors. If a package element
cannot be traced to a ready story contract without invention, or a ready contract's STOP conditions
or unresolved predicate inputs overlap selected ACs or failure/degraded triggers, stop and route the
defect back to `$plan-epic`.

## Reference Routing

Read only the references needed for the current step:

- `references/source-readiness.md`: resolve the epic, validate Gate 1, inspect source planning
  files, and verify the write location.
- `references/package-layout.md`: apply package tree and docs-only write boundaries.
- `references/model-routing.md`: choose abstract model class, effort, reasoning tier, and rationale
  without runtime model IDs.
- `references/plan-artifact.md`: author `execution/plan.md`.
- `references/tracker-artifact.md`: author `execution/tracker.md`.
- `references/implementer-prompt.md`: author implementer prompts.
- `references/reviewer-prompt.md`: author reviewer prompts.
- `references/closeout-validation.md`: audit projection trace, package completeness, independent
  reviewer requirements, and `ready_for_implementation` evidence.

## Workflow

1. Start with `source-readiness.md`. Refuse missing Gate 1 tokens, ambiguous epic selection,
   source conflicts, self-blocking ready contracts, source vagueness that would require invention,
   or the wrong worktree.
2. Use `package-layout.md` to create or update only the selected epic's execution package.
3. Use `model-routing.md` before writing plan, tracker, or prompts. Carry the DAG suggested-tier
   floor unchanged and choose a reasoning tier at or above it.
4. Use `plan-artifact.md`, `tracker-artifact.md`, `implementer-prompt.md`, and
   `reviewer-prompt.md` to write self-contained package artifacts.
5. Use `closeout-validation.md` to prove package completeness, projection trace, no runtime model
   ID binding, and the final readiness verdict.
6. After local closeout validation is complete, dispatch one independent read-only reviewer. The
   reviewer must inspect the target package and relevant skill/source references, assess quality,
   correctness, compliance, and readiness for implementation, and return severity-ordered findings or
   an explicit no-findings verdict. Do not let the reviewer edit files or execute implementation.

Stop after package closeout and independent reviewer verdict. The next stage owns execution.
