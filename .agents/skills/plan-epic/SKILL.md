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
- A required acceptance criterion or failure trigger cannot be evaluated from declared request fields,
  consumed events/projections, producer-owned fields, or an in-scope resolver.
- The request asks for feature code, `packages/` changes, execution package files, dispatch prompts, delivery execution, concrete model/effort assignment, or edits under `docs/design/`.

## Required Reads

Read `references/stage-contract.md` before authoring. It names the live source docs to read for the target epic and the exact stop conditions.

Do not work from memory or prior examples alone. The current repo artifacts win.

## Workflow

1. Verify location with `pwd`, `git rev-parse --show-toplevel`, and `git status --short --branch`; ensure writes will happen in the requested worktree.
2. Resolve the single target epic under `docs/implementation/epics/` and inspect its charter status, included domains, frozen inputs, per-domain expectations, existing DAG, and existing stories.
3. Confirm the write set is limited to that epic's charter owning-story cells, story DAG, and story contracts. Refuse if the user's write constraints are narrower than the files needed.
4. Run the seam pass in `references/stage-contract.md` (DAG gates) **before** sizing nodes: classify each shared shape as a value type or a runtime object; hoist value types into a single type-only contract story and point consumers at it (never at the behavior story that produces the values); keep one producer per shape with no contract-into-consumer collapse; and verify every declared type resolves to this epic or an already-frozen earlier one — defer or escalate later-epic types, never forward-reference. Then author the story DAG: close exactly-once coverage, name producer/consumer seams once, label acyclic dependency edges, assign owned pathsets that follow the design layer/slug convention, and add suggested tier only where the authoring standard requires it.
5. Freeze the DAG only after Gate 3 passes (including the seam pass above). Do not author contracts against a draft DAG.
6. Author each story contract against the frozen DAG. Each contract must satisfy Gates 4-6: falsifiable self-contained ACs whose evidence clause names a concrete assertion (exact value, `never`-exhaustiveness switch, named negative fixture, or a runnable sweep) — not a bare test-file path; complete spec-surface manifest; predicate-input coverage showing every runtime branch value comes from declared inputs, consumed events/projections, producer-owned fields, or an in-scope resolver; failure/degraded or validation-failure table with each token mapped to one owning AC; public exposure/import path/import test where applicable; constructability; numeric file-size budget; and runnable sweeps.
7. Run characterization review before setting `story: ready`. A spec-reviewer can assist, but the architect owns the verdict. Record each load-bearing scope decision (node boundaries, single-producer hoists, value-type seams, cross-epic deferrals) with rationale, the design line it traces to, a falsification criterion, and an escalation path; a bare checklist or "all checks passed" summary does not satisfy the gate. Findings must quote the contradicted design line or AC and classify story-defect vs design-defect.
8. Backfill the target epic charter README's owning-story cells for covered or split signals. Do not update the global coverage rollup for story ownership.
9. Show Gate 1 evidence: frozen DAG, all selected stories ready, coverage closed, characterization-review evidence, and verification commands/results.
10. Stop. Report that the next stage is `plan-delivery`.

## Hard Boundaries

Never:

- Write feature code or create execution packages.
- Touch `packages/`, `docs/design/`, other epics, included domain charters, tracker files, dispatch prompts, PRs, commits, pushes, or merges.
- Assign concrete model class, effort, or reasoning tier for delivery. `plan-epic` may only record the story DAG's suggested tier floor when required by Gate 3.
- Resolve a design gap by strengthening, weakening, or guessing requirements. Escalate the gap with file and line evidence.
- Treat refs, hashes, citations, or story ids as the values an AC branches on unless the contract also
  owns or consumes the resolver that turns them into values.
- Declare an interface or type owned by a later epic, forward-reference a not-yet-frozen type, or merge a shared-type producer into a story that consumes it. Defer the later-epic surface (named) or escalate a design-sequencing gap.

## Validation

At minimum, run the repository's documented planning verification that is safe for the task scope. If this skill itself is being edited, validate it with:

```bash
OPEN_SKILL_CREATOR_ROOT="${OPEN_SKILL_CREATOR_ROOT:-$HOME/.agents/skills/open-skill-creator}"
python3 "$OPEN_SKILL_CREATOR_ROOT/scripts/validate_skill.py" .agents/skills/plan-epic
```
