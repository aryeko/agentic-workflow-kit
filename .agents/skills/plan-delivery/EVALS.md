# plan-delivery Evals

**Skill under test:** `plan-delivery`
**Version pin (combined skill hash):** `75a0f4a11e14f5a2`
**Status:** active

Recompute with:

```sh
# run from this skill's root; excludes EVALS.md so the pin is stable.
# LC_ALL=C pins the sort order so the hash is locale-independent (reproducible in CI / any shell).
find SKILL.md references agents evals -type f 2>/dev/null | LC_ALL=C sort |
  while IFS= read -r f; do cat "$f"; done |
  shasum -a 256 | cut -c1-16
```

These evals operationalize PD-1 through PD-11 from
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
| PD-9: substrate-presence preflight: refuses `ready_for_implementation` when a coverage lane is named but the spec-surface manifest declares no runtime-value export — a retained type-only marker alone does **not** trigger (an `as const` catalog passes); reads the manifest, not the pathset | `negative-refuse-type-only-coverage-lane`, `positive-allow-as-const-catalog-type-only-marker` |
| PD-10: predicate-input preflight: refuses when an AC closure row names an input category not a concrete `Producer/Type.field`, or any relational sub-predicate leaves an operand unsourced (counted **per sub-predicate, not per AC** — a compound AC with ≥2 fields in total still refuses if one sub-predicate operand is unsourced); reads the manifest, not the pathset | `negative-refuse-unsourced-relational-predicate`, `negative-refuse-compound-ac-unsourced-suboperand` |
| PD-11: failure-token/catalog closure preflight: refuses `ready_for_implementation` when any selected story consumes a failure / degraded / validation token that is unowned, ambiguous, absent from the cited producer catalog, stronger than design, or backed only by prose instead of enforced exact-literal fixtures / catalog tests | `negative-refuse-unowned-failure-token` |

## Expected Evidence

For a passing positive run, inspect the generated package and require:

- Gate 1 evidence names the frozen DAG and every ready story contract read.
- Source readiness refuses any selected ready story whose STOP conditions or unresolved predicate inputs
  overlap selected ACs or failure/degraded triggers.
- Source readiness refuses any selected ready story whose consumed failure / degraded / validation token
  does not close against exactly one authoritative producer catalog with enforced exact-literal fixtures /
  catalog tests.
- `plan.md`, `tracker.md`, and every prompt contain source story id and source `AC-n` ids.
- Routing uses abstract model class, effort, suggested-tier floor, reasoning tier, and rationale only.
- No Codex `agent_type` values appear in `plan.md`, `tracker.md`, packaged prompts, or source planning
  artifacts; custom-agent role selection is runtime binding for `orchestrated-delivery`.
- No provider-specific runtime model IDs appear.
- The readiness verdict names sources, stories, per-artifact checks, and `ready_for_implementation`.
- No file outside the target epic `execution/` package is changed.

For a passing negative run, require refusal before package readiness and a route-back to
`$plan-epic` or `plan-delivery` as appropriate.
