# Closeout Validation

Use this reference only after the execution package files have been written or updated.
Keep closeout deterministic, evidence-based, and non-mutating.

## Docs Navigation

Run the repo docs navigation command only when the target repo requires it for new or
renamed Markdown files.

- Use the command documented by the repo, not an invented substitute.
- Run it before package completeness checks if it creates or updates navigation artifacts.
- If no repo requirement exists, skip it and say so in the closeout report.
- If the command changes files, include those files in the changed-file summary.

## Package Completeness

Prove the authored package exists and has one implementer prompt and one reviewer prompt
for every ready story in the package scope.

- Prefer deterministic shell checks over manual inspection claims.
- Check the exact package root authored in this run.
- Confirm `plan.md` and `tracker.md` exist.
- Count expected story ids from the story inventory used during package authoring.
- For each expected story id, confirm both prompt files exist:
  - `execution/prompts/<story-id>/implementer.md`
  - `execution/prompts/<story-id>/reviewer.md`
- Confirm there are no missing expected prompt files.
- Confirm there are no extra prompt directories outside the expected story id set.
- Treat any missing, extra, or empty required file as a blocker.

Do not restate package schema, tracker fields, prompt fields, model routing, or source
readiness rules here. Use the adjacent responsibility files for those topics.

## Deep Artifact Review

After completeness checks pass, review the authored artifacts against their owning references and
source planning files. Treat this as a blocking quality gate, not a summary pass.

Review these dimensions:

- **Compliance:** each artifact follows its owning reference:
  - `plan.md` follows `plan-artifact.md`;
  - `tracker.md` follows `tracker-artifact.md`;
  - model assignments follow `model-routing.md`;
  - implementer prompts follow `implementer-prompt.md`;
  - reviewer prompts follow `reviewer-prompt.md`;
  - package paths and per-epic boundaries follow `package-layout.md`.
- **Source correctness:** every story id, dependency, wave, owned pathset, acceptance criterion,
  required reading item, quality bar, evidence-pack item, STOP condition, and non-goal comes from
  the frozen DAG or ready story contracts. Flag omissions, additions, changed meaning, stale names,
  or invented scope.
- **Prompt quality:** each implementer prompt is decision-complete enough for the assigned model
  class, especially `cheap-coder` and other low-tier implementers. Flag vague instructions,
  broad-context delegation, missing allowed paths, missing mutation limits, missing verification,
  missing dependency inputs, or missing runtime slots.
- **Reviewer quality:** each reviewer prompt has enough original scope, runtime evidence slots,
  checklist coverage, and verdict structure to review without reopening broad planning context.
- **Tracker readiness:** tracker rows are initialized correctly, dependency gates match the DAG,
  `commit hash` cells are empty before execution, and `done` semantics are not weakened.
- **Execution readiness:** the package is ready for implementation only when all required stories
  are covered, all artifacts are self-contained, all model/effort choices are justified, prompts
  have no gray areas, and no blocker remains.

Do not mark the package ready for implementation if any blocking finding remains. Fix package
artifacts within the allowed package paths when the source evidence is clear; otherwise stop and
report the exact blocker.

## Readiness Verdict

End validation with a verdict:

- `ready_for_implementation`: every completeness, compliance, correctness, quality, and readiness
  check passed.
- `blocked`: one or more blocking findings remain.

For a blocked verdict, list each blocker with the affected artifact, source evidence, and required
repair. Do not hand off to execution with unresolved blockers.

## `pnpm check`

Run `pnpm check` only when it is appropriate for the repo state and the scope of the
package-authoring change.

Run it when:

- repo instructions require it for docs-only package changes;
- generated docs navigation artifacts are checked by the repo gate;
- the change includes executable tooling, configuration, or non-package files; or
- the current repo state is clean enough that the result will validate this change.

Skip it when:

- the change is limited to package Markdown and deterministic package checks prove the
  authored package shape;
- unrelated dirty work would make the result ambiguous; or
- repo instructions identify a lighter docs/package validation path for this scope.

When skipped, state the exact reason. Do not imply the full repo gate passed.

## Closeout Report

Report only:

- files changed;
- docs navigation command and result, or why it was skipped;
- deterministic package validation command and result;
- deep artifact review verdict: `ready_for_implementation` or `blocked`;
- blocking compliance, correctness, quality, or readiness findings, if any;
- `pnpm check` command and result, or why it was skipped;
- blockers, if any.

Stop after the report. Do not stage, commit, push, open PRs, dispatch workers, implement
stories, or update tracker completion state.
