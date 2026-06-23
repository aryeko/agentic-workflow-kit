# Closeout Validation

Use this reference after the execution package files have been written or updated. Keep validation
deterministic, evidence-based, and non-mutating.

## Package Completeness

Prove the target package exists and covers every selected ready story:

- `execution/plan.md` exists and is non-empty;
- `execution/tracker.md` exists and is non-empty;
- each selected story id has exactly one implementer prompt and one reviewer prompt;
- no prompt directory exists for a story outside the selected source set;
- every package file is under the selected epic's `execution/` directory.

Treat missing, extra, empty, or out-of-epic files as blockers.

## Projection Audit

Audit every package artifact against the source inventory:

- every story row, prompt, routing decision, wave, dependency, pathset, verification policy, and
  tracker row cites source story id plus source `AC-n` ids;
- no package element adds or revises scope, ACs, dependency order, owned pathsets, suggested-tier
  floors, non-goals, STOP conditions, or verification bars;
- source-vague elements stop with a `$plan-epic` route-back instead of invention;
- provider-specific runtime model IDs are absent;
- reasoning tier is greater than or equal to the carried suggested-tier floor;
- reviewer routing uses `frontier-reviewer`.

## Artifact Compliance

Check each file against its owning reference:

- `plan.md` follows `plan-artifact.md`;
- `tracker.md` follows `tracker-artifact.md`;
- model routing follows `model-routing.md`;
- implementer prompts follow `implementer-prompt.md`;
- reviewer prompts follow `reviewer-prompt.md`;
- package paths follow `package-layout.md`.

## Static Checks

Run deterministic checks appropriate to the package. At minimum, inspect for:

- missing selected story prompt pairs;
- unfinished marker text in package artifacts;
- provider-specific runtime model IDs or runtime model alias/version strings;
- fake commit hashes before execution;
- tracker statuses outside the allowed set.

Use repo docs navigation commands only when the repo requires them for new or moved Markdown files.
If skipped, state why.

## Readiness Verdict

Mark `ready_for_implementation` only when all completeness, projection, compliance, and static
checks pass. The verdict must name:

- sources reviewed;
- selected stories covered;
- per-artifact checks performed;
- final verdict.

Use `blocked` if any blocker remains. List the affected artifact, source evidence, and required
repair. Stop after reporting; do not execute the package.

## Repo Gate

Run `pnpm check` only when the repo instructions and current scope make it meaningful for the
package change. If the change is limited to package Markdown and deterministic package checks cover
the authored package shape, it may be skipped with a clear reason. Do not imply the full repo gate
passed unless it was run.

## Closeout Report

Report:

- changed files;
- docs navigation command/result, or why skipped;
- deterministic package validation command/result;
- projection audit result;
- `ready_for_implementation` or `blocked`;
- `pnpm check` command/result, or why skipped;
- blockers and assumptions.
