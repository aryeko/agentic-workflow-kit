# Package Layout

Use this reference only for the package file tree and docs-only boundary.

## Write Boundary

Write only the target epic execution package:

- `docs/implementation/epics/<epic-slug>/execution/plan.md`
- `docs/implementation/epics/<epic-slug>/execution/tracker.md`
- `docs/implementation/epics/<epic-slug>/execution/prompts/<story-id>/implementer.md`
- `docs/implementation/epics/<epic-slug>/execution/prompts/<story-id>/reviewer.md`

Do not edit source DAGs, story contracts, design docs, feature code, package code, generated runtime
state, commits, PRs, or another epic's package.

## Required Tree

```text
docs/implementation/epics/<epic-slug>/execution/
  plan.md
  tracker.md
  prompts/
    <story-id>/
      implementer.md
      reviewer.md
```

Every selected ready story must have exactly one implementer prompt and one reviewer prompt.

## Per-Epic Boundary

The package is per epic. Keep all files under the selected epic's `execution/` directory. Do not
mix story ids, prompt content, tracker rows, or plan sections across epics.

If a package already exists, inspect it first and update only the files needed for the selected
epic. Preserve runtime evidence that came from a later execution run unless the user explicitly
asks for a package reset.

## Projection Trace

Each package file must make the projection auditable:

- story-specific sections and rows include `source story` and `source AC ids`;
- package-level sections cite the source inventory they summarize;
- prompt paths map exactly to selected story ids;
- no row or prompt may exist without a ready source story contract.

An untraceable package element is a blocker, not a creative-writing gap.

## Role Boundary

The package records what a later execution run must honor. It does not start execution.

Do not stage, commit, push, open PRs, dispatch implementation work, update story status beyond the
initial tracker state, or perform delivery closeout while authoring the package.
