# Package Preflight

Use this reference before any worker dispatch. The package is the execution contract; structural files
alone are not enough.

## Required Package

For the selected epic or story batch, verify these checked-in files:

- `execution/plan.md`
- `execution/tracker.md`
- `execution/prompts/<story-id>/implementer.md` for every selected story
- `execution/prompts/<story-id>/reviewer.md` for every selected story

Reject scaffold text, empty sections, missing selected stories, missing prompt paths, or tracker rows
that cannot be mapped to the selected story ids.

## Readiness Evidence

Require explicit evidence that `$plan-delivery` performed deep artifact review and marked the package
`ready_for_implementation`. A differently-worded verdict counts as equivalent only if it asserts all
four items below; a verdict that omits any of them is not ready — refuse it. Acceptable evidence must
be inside the execution package and must identify:

- the source planning artifacts reviewed;
- the selected story ids covered;
- the artifact checks performed for `plan.md`, `tracker.md`, implementer prompts, and reviewer
  prompts;
- a final implementation-readiness verdict.

If this verdict or its evidence is absent, refuse execution and hand the package back to
`$plan-delivery`. Do not treat file presence, passing YAML/Markdown structure, or a tracker row alone
as readiness.

## Tracker Contract

Every selected story row must expose:

- `story id`
- `wave`
- `dependencies`
- `status`
- implementer model class and effort
- reviewer model class and effort
- prompt paths
- `reviewer verdict`
- `gate evidence`
- `commit hash`
- `blockers`
- `notes`

Rows with only broad approval or loose gate/commit labels are incomplete. Missing or stale rows block
execution; do not add or repair them in this skill.

## Prompt Contract

Verify packaged prompts; never rewrite them.

Implementer prompts must already include exact task, acceptance criteria, reason, source material,
allowed paths, committed dependency inputs, non-goals, implementation instructions, verification
commands, delivery format, and mutation limits.

Reviewer prompts must already include original scope and acceptance criteria, review boundaries,
required checks, verdict format, and the requirement to act as the provider `frontier-reviewer`
safeguard.

If any prompt is vague, scaffold-filled, missing fields, or asks the worker to infer scope,
acceptance criteria, files, verification, model class, effort, or delivery boundaries, refuse
execution and hand the package back to `$plan-delivery`.

## Risk And Scope Refusals

`critical` is the highest supported risk tier. If a packaged item appears to require a tier above
`critical`, lacks enough detail to execute safely, or conflicts with its frozen story contract, refuse
execution. Require planning repair through `$plan-epic` when the frozen story scope or acceptance
criteria are wrong; require a corrected execution package when only package artifacts are wrong.

Do not split, merge, shrink, reorder, or reinterpret ready story scope inside this skill.

If the package explicitly records an unresolved source-contract blocker, or a prompt asks a worker to
continue past a source STOP condition by inventing missing AC inputs, refuse before dispatch. Require
planning repair through `$plan-epic` for frozen-scope defects or `$plan-delivery` for package-only
projection defects.
