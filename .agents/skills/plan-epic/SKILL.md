---
name: plan-epic
description: >-
  Use only in workflow-kit when asked to author the Layer-3 story DAG and
  Layer-4 story contracts for one named ready epic, run characterization review,
  set Gate 1 (`story-dag: frozen` plus every selected story `story: ready`),
  and stop. Refuse missing, ambiguous, or non-ready epics; non-frozen domains or
  design seams; wrong worktree; overwrite risk; design gaps; feature code;
  execution packages; model/effort assignment; delivery dispatch; or docs/design
  edits.
---

# Plan Epic

Author one epic's planning artifacts at the `what` altitude only:

- Layer 3: `docs/implementation/epics/<epic>/story-dag.md`
- Layer 4: `docs/implementation/epics/<epic>/stories/<story-id>.md`
- Gate 1 handoff: `story-dag: frozen` and every selected story `story: ready`

Stop at Gate 1. The next stage is `plan-delivery`; do not start it.

## Refuse Before Work

Refuse and report exact blockers when any condition is true:

- The user did not name exactly one epic, or the name resolves ambiguously under `docs/implementation/epics/`.
- The epic charter is missing or is not `epic: ready`.
- Any included domain or required design seam is not frozen.
- The current checkout is not the requested workflow-kit worktree.
- Existing non-placeholder DAG, story, or charter content would be overwritten.
- A required acceptance criterion cannot trace to frozen design without inventing requirements.
- The request asks for feature code, `packages/` changes, execution package files, dispatch prompts, delivery execution, concrete model/effort assignment, or edits under `docs/design/`.

## Required Reads

Read `references/stage-contract.md` before authoring. It names the live source docs to read for the target epic and the exact stop conditions.

Do not work from memory or prior examples alone. The current repo artifacts win.

## Workflow

1. Verify location with `pwd`, `git rev-parse --show-toplevel`, and `git status --short --branch`; ensure writes will happen in the requested worktree.
2. Resolve the single target epic under `docs/implementation/epics/` and inspect its charter status, included domains, frozen inputs, per-domain expectations, existing DAG, and existing stories.
3. Confirm the write set is limited to that epic's charter owning-story cells, story DAG, and story contracts. Refuse if the user's write constraints are narrower than the files needed.
4. Author the story DAG from the frozen epic charter and frozen domain/design inputs. Close exactly-once coverage, name producer/consumer seams once, label acyclic dependency edges, assign owned pathsets, and add suggested tier only where the authoring standard requires it.
5. Freeze the DAG only after Gate 3 passes. Do not author contracts against a draft DAG.
6. Author each story contract against the frozen DAG. Each contract must satisfy Gates 4-6: falsifiable self-contained ACs with evidence clauses, complete spec-surface manifest, failure/degraded or validation-failure table, public exposure/import path/import test where applicable, constructability, numeric file-size budget, and runnable sweeps.
7. Run characterization review before setting `story: ready`. A spec-reviewer can assist, but the architect owns the verdict. Findings must quote the contradicted design line or AC and classify story-defect vs design-defect.
8. Backfill the target epic charter README's owning-story cells for covered or split signals. Do not update the global coverage rollup for story ownership.
9. Show Gate 1 evidence: frozen DAG, all selected stories ready, coverage closed, characterization-review evidence, and verification commands/results.
10. Stop. Report that the next stage is `plan-delivery`.

## Hard Boundaries

Never:

- Write feature code or create execution packages.
- Touch `packages/`, `docs/design/`, other epics, included domain charters, tracker files, dispatch prompts, PRs, commits, pushes, or merges.
- Assign concrete model class, effort, or reasoning tier for delivery. `plan-epic` may only record the story DAG's suggested tier floor when required by Gate 3.
- Resolve a design gap by strengthening, weakening, or guessing requirements. Escalate the gap with file and line evidence.

## Validation

At minimum, run the repository's documented planning verification that is safe for the task scope. If this skill itself is being edited, validate it with:

```bash
python3 /Users/aryekogan/.agents/skills/open-skill-creator/scripts/validate_skill.py .agents/skills/plan-epic
```
