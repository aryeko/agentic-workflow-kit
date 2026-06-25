# `execution/plan.md` Artifact

Author `execution/plan.md` as the durable plan for a future `orchestrated-delivery` run. Record
what the execution stage must honor; do not execute.

## Required Sections

Use these sections in order.

### Source Baseline

Record repo path, worktree path, base branch, HEAD inspected, epic slug, package author/date, and
source files read. Cite the source story inventory used for the package.

### Readiness Verdict

Use `ready` only when Gate 1 passed and every package element can be projected from ready source
contracts. Use `blocked` with exact source evidence when the package cannot be projected.

### Projection Summary

Include one row per selected story:

| story id | source AC ids | job | wave | dependencies | dependents | owned pathset | suggested-tier floor | routing |
|---|---|---|---|---|---|---|---|---|

The `routing` cell records abstract model class, effort, reasoning tier, and rationale for
implementer and reviewer. Do not record runtime model IDs.

### Execution Waves

Record the topological order from the DAG. State that a dependent story can start only after every
dependency is `merged` in `tracker.md` — its per-round commits merged back to the track branch and
its merge-back recorded.

### Prompt Inventory

List every implementer and reviewer prompt path with source story id and source `AC-n` ids.

### Verification Policy

Record per-story targeted checks, evidence-pack requirements, required sweeps, and the repo gate
from the story contracts. Do not add checks that change the accepted story bar.

### Downstream Execution Metadata

Record what the execution stage must honor:

- model class, effort, reasoning tier, and routing rationale are abstract plan decisions;
- provider-specific runtime model IDs are selected later;
- dependency validity comes from tracker `merged` state and the producer's track-branch merge-back;
- tracker write authority belongs to the orchestrator in the execution stage;
- the implementer commits each round in its story worktree; the orchestrator merges approved stories
  back to the track branch and writes the tracker — it commits no story content itself;
- commit boundaries follow owned pathsets;
- verifiable evidence wins over worker prose.

### Resume Semantics

Explain how a later run reads existing tracker rows, commit hashes, and evidence conflicts. Evidence
conflicts resolve toward git state, check output, and live review truth.

### Stop Point

State that package creation ends here and feature implementation begins only in a later execution
run.

## Exclusions

Do not include package authoring procedures, tracker schema details, prompt field lists, coordinator
execution steps, source fixes, or feature implementation instructions.
