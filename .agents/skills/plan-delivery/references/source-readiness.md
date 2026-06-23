# Source Readiness

Use this reference before writing any execution package artifact.

## Resolve The Epic

1. Resolve the requested epic slug under `docs/implementation/epics/`.
2. If multiple epics match, ask for the exact slug.
3. Do not infer a target from a partial match when more than one epic is plausible.

## Read Sources

Read the smallest source set needed to prove the package can be projected:

- repo-local `AGENTS.md`;
- repo-local `CLAUDE.md`, if present;
- `docs/implementation/epics/<epic-slug>/README.md`;
- `docs/implementation/epics/<epic-slug>/story-dag.md`;
- every selected ready story contract under `docs/implementation/epics/<epic-slug>/stories/`.

Use `story-dag.md` as authority for story ids, jobs, dependency order, waves, owned pathsets, and
suggested-tier floors. Use story contracts as authority for acceptance criteria, source traces,
required reading, quality bars, evidence packs, non-goals, STOP conditions, and allowed writes.

## Gate 1 Check

Refuse and route back to `$plan-epic` when any condition holds:

- the story DAG frontmatter is not `status: "story-dag: frozen"`;
- any selected story contract is not `status: "story: ready"`;
- a selected story lacks a stable story id, owned pathset, dependency data, suggested-tier floor
  when required by the DAG, or ordered `AC-n` ids;
- the DAG and story contract conflict on story id, dependencies, owned pathset, suggested tier, or
  source scope;
- a package element would require adding, weakening, reordering, or interpreting scope beyond the
  frozen DAG and ready contracts.

This is a boolean gate check, not a second characterization review. Do not repair or improve the
source artifacts here.

## Projection Inventory

Before writing package files, build a source inventory with:

- epic slug and source files read;
- one row per story: story id, job, wave, dependencies, dependents, owned pathset, suggested-tier
  floor, source story contract path, and all `AC-n` ids;
- dependency contracts and public import paths named by the DAG or story contracts;
- any package-blocking vagueness, reported with the exact source file and missing fact.

Every later package artifact must be traceable to this inventory.

## Verify Write Location

Before writing, run `git rev-parse --show-toplevel` and verify it is the intended worktree. In
workflow-kit, non-trivial docs work normally happens in a worktree cut from `v-next`.

Stop on a wrong checkout. Do not write into the main checkout by accident.
