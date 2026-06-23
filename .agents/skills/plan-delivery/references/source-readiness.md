# Source Readiness

Use this reference to validate the source epic before `$plan-delivery` writes any delivery-planning
output.

## Resolve The Target Epic

1. Resolve the requested epic slug under `docs/implementation/epics/`.
2. If the request is ambiguous, list the matching or available epic directories and ask the user
   which epic to plan.
3. Do not infer the target from partial matches when multiple plausible epic directories exist.

## Read Required Sources

Read only the source files needed to establish readiness:

- Repo-local `AGENTS.md`
- Repo-local `CLAUDE.md`
- `docs/implementation/epics/<epic-slug>/README.md`
- `docs/implementation/epics/<epic-slug>/story-dag.md`
- Every non-index file under `docs/implementation/epics/<epic-slug>/stories/`

Use `story-dag.md` as the authority for delivery order, dependencies, owned pathsets, and suggested
tiers.

Use story contract files as the authority for acceptance criteria, required reading, quality bar,
evidence pack, STOP conditions, and allowed paths.

## Validate Readiness

1. Confirm `story-dag.md` frontmatter says `status: "story-dag: frozen"`.
2. Confirm every story contract frontmatter says `status: "story: ready"`.
3. If any source is missing, ambiguous, not frozen, or not ready, stop and report the exact file and
   condition.
4. If the DAG and a story contract conflict, stop and report the conflict instead of choosing a side.

## Verify The Write Location

Follow the repo worktree policy before creating files. In workflow-kit, non-trivial docs work
normally uses a worktree off `v-next`.

Before writing, run `git rev-parse --show-toplevel` and verify it points at the intended worktree.
If it points at the wrong checkout, stop and report the mismatch.

## Related Reference

Use SRP references for downstream package details:

- `package-layout.md` for package output boundaries.
- `model-routing.md` for story routing and model decisions.
- `plan-artifact.md` for `execution/plan.md`.
- `tracker-artifact.md` for `execution/tracker.md`.
- `implementer-prompt.md` and `reviewer-prompt.md` for worker prompt details.
