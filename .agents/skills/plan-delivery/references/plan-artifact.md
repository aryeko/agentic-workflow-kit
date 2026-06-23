# `execution/plan.md` Artifact

Author `execution/plan.md` as a concise execution record for a future run. Record what the
later execution run must honor; do not execute, dispatch, stage, commit, push, or update
tracker rows from this artifact.

Keep the plan focused on these sections, in this order.

## Source Baseline

Record:

- Repo path.
- Base branch and HEAD inspected.
- Epic slug.
- Package author and date.
- Source files read.

## Readiness Verdict

Record whether the source is package-ready:

- `ready` only when the DAG is frozen, all stories are ready, and no source edits are
  required.
- `blocked` otherwise, with the concise reason.

## Story Table

Include one row per story with:

- Story id.
- One-line job.
- Owned pathset.
- Dependencies.
- Downstream dependents.
- Suggested tier.
- Implementer model class and effort.
- Reviewer model class and effort.
- Routing rationale.

Keep routing rationale brief. Do not include the full model routing table; use
`model-routing.md` for that responsibility.

## Execution Waves

Record the topological order from the DAG.

State the dependency gate: a dependent story can start only after every dependency has
`done` status in `tracker.md`.

## Prompt Inventory

List the path to each implementer and reviewer prompt.

Do not duplicate implementer or reviewer prompt field lists; use `implementer-prompt.md`
and `reviewer-prompt.md` for those responsibilities.

## Verification Policy

Record:

- Per-story targeted checks from the story contract.
- The repo gate.
- Evidence pack requirements.

Keep this as policy for the future execution run. Do not include closeout validation
steps for this planning skill.

## Downstream Execution Metadata

Record what the later execution run must honor about:

- Model routing.
- Dependency validity.
- Tracker update authority.
- Commit boundaries.
- Evidence precedence.

Describe constraints and expected evidence only. Do not provide coordinator execution
instructions or story-completion procedures.

## Resume Semantics

Record how a later run should interpret:

- Existing tracker rows.
- Recorded commit hashes.
- Evidence conflicts.

State that evidence conflicts resolve toward verifiable evidence over prose.

## Stop Point

State that package creation ends here. Feature implementation begins only in a later
execution run.

## Exclusions

Do not include source readiness steps, package layout trees, tracker column or status
schemas, model routing tables, implementer or reviewer prompt field lists, downstream
coordinator execution instructions, or closeout validation procedures.
