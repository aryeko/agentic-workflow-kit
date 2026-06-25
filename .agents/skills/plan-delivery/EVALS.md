# plan-delivery Evals

**Skill under test:** `plan-delivery`
**Version pin (combined skill hash):** `3e6dfe7df261390b`
**Status:** active

Recompute with:

```sh
# run from this skill's root; excludes EVALS.md so the pin is stable
find SKILL.md references agents evals -type f 2>/dev/null | sort |
  while IFS= read -r f; do cat "$f"; done |
  shasum -a 256 | cut -c1-16
```

These evals operationalize PD-1 through PD-8 from
`docs/implementation-authoring/delivery-pipeline/30-plan-delivery.md`.

## Coverage Matrix

| requirement | eval coverage |
|---|---|
| PD-1: trigger only on frozen DAG plus ready selected stories; refuse otherwise | `evals/evals.json`: `positive-project-ready-epic`, `negative-refuse-nonready-story`; `evals/trigger_queries.json` positives and negatives |
| PD-2: projection invariant; every element cites source story id plus AC ids; no new scope, AC, dependency order, or tier | `positive-project-ready-epic`, `negative-refuse-vague-contract`, `negative-reject-runtime-model-binding` |
| PD-3: complete plan, tracker, implementer prompts, reviewer prompts; prompts are decision-complete | `positive-project-ready-epic` |
| PD-4: abstract model class, effort, reasoning tier >= floor; no runtime model IDs | `positive-project-ready-epic`, `negative-reject-runtime-model-binding` |
| PD-5: `ready_for_implementation` only with deep-readiness verdict | `positive-project-ready-epic`, `negative-refuse-vague-contract` |
| PD-6: no code writes, worker dispatch, or edits outside package | `positive-project-ready-epic`, `negative-refuse-write-code`, trigger near-miss negatives |
| PD-7: package durable and resumable from artifacts, not session prose | `positive-project-ready-epic` |
| PD-8: self-blocking ready contracts route back before packaging | `negative-refuse-self-blocking-ready-contract` |

## Expected Evidence

For a passing positive run, inspect the generated package and require:

- Gate 1 evidence names the frozen DAG and every ready story contract read.
- Source readiness refuses any selected ready story whose STOP conditions or unresolved predicate inputs
  overlap selected ACs or failure/degraded triggers.
- `plan.md`, `tracker.md`, and every prompt contain source story id and source `AC-n` ids.
- Routing uses abstract model class, effort, suggested-tier floor, reasoning tier, and rationale only.
- No provider-specific runtime model IDs appear.
- The readiness verdict names sources, stories, per-artifact checks, and `ready_for_implementation`.
- No file outside the target epic `execution/` package is changed.

For a passing negative run, require refusal before package readiness and a route-back to
`$plan-epic` or `plan-delivery` as appropriate.
