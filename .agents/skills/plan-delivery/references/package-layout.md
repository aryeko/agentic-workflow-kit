# Package Layout

Use this reference only for the execution package file tree and package boundary rules.

## Write Boundary

Write only these package files:

- `docs/implementation/epics/<epic-slug>/execution/plan.md`
- `docs/implementation/epics/<epic-slug>/execution/tracker.md`
- `docs/implementation/epics/<epic-slug>/execution/prompts/<story-id>/implementer.md`
- `docs/implementation/epics/<epic-slug>/execution/prompts/<story-id>/reviewer.md`

Do not implement stories, edit `packages/`, dispatch workers, commit, push, open PRs, or modify the
story DAG/contracts.

## Required Tree

Create or update this layout for the target epic:

```text
docs/implementation/epics/<epic-slug>/execution/
  plan.md
  tracker.md
  prompts/
    <story-id>/
      implementer.md
      reviewer.md
```

Every packaged story must have exactly one implementer prompt and one reviewer prompt under its own
`execution/prompts/<story-id>/` directory.

## Epic Boundary

The package is per epic. Keep all files under the target epic's `execution/` directory.

Do not mix story IDs across epics. Do not create, move, or update another epic's execution package
while authoring the target epic package.

## Existing Package Updates

If the target epic's execution package already exists, inspect that package first. Update only the
target epic's package files needed for the current planning output.

Preserve the per-epic boundary when repairing or extending an existing package. Do not use another
epic's prompts, tracker rows, or plan content as part of the target package.

## Self-Contained Package

Keep package content self-contained. Do not tell the later execution run to read another skill to
discover required fields, routing classes, or tracker semantics.

Each package file should carry the information needed for its own role instead of relying on
cross-epic context or external skill instructions.

## Role Boundary

Treat the package as planning output only. Record what the later execution run must honor.

Do not stage, gate, commit, close workers, update tracker rows, dispatch implementation work, or
perform closeout actions while authoring the package.
