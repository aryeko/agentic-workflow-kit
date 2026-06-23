# plan-epic Stage Contract

Use this reference after `SKILL.md` activates. Read only the live source files needed for the named epic; do not load the whole corpus.

## Source Docs To Read

Before authoring, read:

- `AGENTS.md`
- `docs/implementation-authoring/delivery-pipeline/README.md`
- `docs/implementation-authoring/delivery-pipeline/10-pipeline-and-invariants.md`
- `docs/implementation-authoring/delivery-pipeline/20-plan-epic.md`
- `docs/implementation-authoring/authoring-standard/README.md`
- `docs/implementation-authoring/authoring-standard/40-story-dag.md`
- `docs/implementation-authoring/authoring-standard/50-story-contract.md`
- `docs/implementation-authoring/authoring-standard/60-coverage.md`
- `docs/implementation-authoring/operating-model/architect.md`
- `docs/implementation-authoring/operating-model/characterization-review.md`
- The target epic charter under `docs/implementation/epics/`
- Every included domain charter and frozen design seam cited by that epic

## Input Gate

`plan-epic` starts only when all are true:

- One named epic resolves to one charter under `docs/implementation/epics/`.
- The charter status is `epic: ready`.
- Included domains and cited design seams are frozen.
- The checkout is the user-requested workflow-kit worktree.
- Existing DAG/story files are absent, placeholders, or explicitly safe to fill without overwriting non-placeholder work.

## Output Gate

Done means all are true:

- The story DAG status is `story-dag: frozen`.
- Every selected story contract is `story: ready`.
- Characterization review evidence exists for each ready story.
- Every owned Story Group Signal maps exactly once to a story id or named `split`.
- The target epic charter README, not the global coverage rollup, has the owning-story cells backfilled.
- No design requirements were invented, and every AC traces to frozen design.
- No execution package, dispatch prompt, feature code, or delivery run was created.

## Characterization Review

Review the authored DAG and contracts before setting readiness:

- Gate 3 for the DAG.
- Gates 4-6 for every story contract.
- Findings quote the source design line or AC they contradict.
- Findings classify `story-defect` or `design-defect`.
- The architect owns the final verdict; a spec-reviewer assists only.

## Escalation

Stop and report blockers with exact file and line evidence for:

- Missing or ambiguous requirements.
- Non-frozen inputs.
- Inconsistent source artifacts.
- Existing non-placeholder work that would be overwritten.
- Any request to expand the stage into package creation, dispatch, implementation, or design editing.
