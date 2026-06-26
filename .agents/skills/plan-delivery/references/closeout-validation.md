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
- self-blocking ready contracts stop with a `$plan-epic` route-back when STOP conditions or unresolved
  predicate inputs overlap selected ACs or failure/degraded triggers;
- source-readiness preflights passed before package readiness, including substrate-presence (PD-9),
  predicate-input (PD-10), failure-token/catalog closure (PD-11), and manifest/gate-lane coverage
  (PD-12);
- source-readiness refused or cleared the source-level PR #167 regrade checks before package readiness:
  phantom consumer edges, pure/value/classifier stories owning writer obligations without a writer seam,
  and unattended safety actions missing classification producer plus committed gate record;
- no package artifact invents, rewrites, or strengthens failure / degraded / validation tokens beyond the
  exact producer catalog ownership recorded in the source inventory;
- no package artifact papers over an orphaned manifest item or incomplete evidence pack; every
  spec-surface manifest item in selected stories has `manifest item -> AC-n -> standing gate lane`, and
  every non-command evidence-pack entry has a concrete file range, fixture id, or generated artifact id;
- provider-specific runtime model IDs are absent;
- reasoning tier is greater than or equal to the carried suggested-tier floor;
- reviewer routing uses `frontier-reviewer`.

## Independent Reviewer

After deterministic local validation passes, dispatch exactly one independent read-only reviewer for
the target package. The reviewer must assess quality, correctness, compliance, and readiness for
implementation against:

- `references/source-readiness.md`;
- `references/package-layout.md`;
- `references/model-routing.md`;
- `references/plan-artifact.md`;
- `references/tracker-artifact.md`;
- `references/implementer-prompt.md`;
- `references/reviewer-prompt.md`;
- this closeout checklist;
- the target epic's frozen DAG and selected ready story contracts;
- the generated execution package.

The reviewer must not edit files, stage, commit, push, open PRs, merge, dispatch implementation work,
or update tracker state. Treat reviewer blocking findings as package blockers. If the reviewer reports
only non-blocking issues, record the judgment and rationale in the closeout report.

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
- invented per-round or merge-back commit hashes before execution (the per-round record and `merge`
  field stay empty until the execution run records real hashes);
- tracker statuses outside the canonical lifecycle in `tracker-artifact.md`.

Use repo docs navigation commands only when the repo requires them for new or moved Markdown files.
If skipped, state why.

## Readiness Verdict

Mark `ready_for_implementation` only when all completeness, projection, compliance, and static
checks pass and the independent reviewer returns no blocking findings. The verdict must name:

- sources reviewed;
- selected stories covered;
- per-artifact checks performed;
- source-readiness preflight results, including failure-token/catalog closure;
- manifest/gate-lane coverage (PD-12) and evidence-pack completeness result;
- independent reviewer verdict;
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
- source-readiness preflight results for substrate-presence (PD-9), predicate-input (PD-10),
  failure-token/catalog closure (PD-11), manifest/gate-lane coverage (PD-12), and evidence-pack
  completeness;
- projection audit result;
- independent reviewer verdict;
- `ready_for_implementation` or `blocked`;
- `pnpm check` command/result, or why skipped;
- blockers and assumptions.
