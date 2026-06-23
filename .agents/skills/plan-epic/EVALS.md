# plan-epic Evals

**Skill under test:** `plan-epic`
**Version pin (combined skill hash):** `de9932b6b699ccfa`
**Status:** active

Recompute with:

```sh
# run from this skill's root; excludes EVALS.md so the pin is stable
find SKILL.md references agents evals -type f 2>/dev/null | sort |
  while IFS= read -r f; do cat "$f"; done |
  shasum -a 256 | cut -c1-16
```

## Scope

These evals operationalize PE-1 through PE-10 from `docs/implementation-authoring/delivery-pipeline/20-plan-epic.md`. A passing result needs concrete artifact evidence, not a bare PASS claim.

## Requirements Matrix

| ID | Requirement | Checks |
|---|---|---|
| PE-1 | Triggers only for one named, ready epic and refuses non-epic or not-ready-charter requests. | Trigger queries include positive named-ready prompts and near-miss negatives; output evals require explicit input-gate refusal behavior. |
| PE-2 | Produces only Layer-3 and Layer-4 markdown. | Static assertions reject code, packages, execution package files, model/effort assignment, dispatch, commits, PRs, and merges. |
| PE-3 | Sets `story: ready` only after characterization review passes. | Output must include review evidence before readiness and must not accept self-asserted readiness. `pe-ac-depth-and-falsifiable-review` requires named scope decisions with rationale, design-line trace, falsification criterion, and escalation path — not a bare checklist. |
| PE-4 | Closes coverage exactly once and backfills the epic charter README owning-story cells, not the domain rollup. | Output must identify the epic README as the oracle and refuse edits to global story ownership rollups. |
| PE-5 | Freezes the DAG before authoring contracts. | Output sequence must block contracts while DAG is draft and cite Gate 3 (including the value-type / single-producer seam pass) before Layer 4 work. `pe-value-type-seam` checks that value types are hoisted into one type-only contract story and that value-type consumers depend on the contract story, not a behavior story. |
| PE-6 | Every contract passes Gates 4-6. | Assertions inspect for AC evidence clauses, failure rows, public exposure/import tests, numeric file-size budget, and runnable sweeps. `pe-ac-depth-and-falsifiable-review` rejects bare test-file-path ACs, requires a concrete falsifiable assertion or named negative fixture per AC, and maps each failure token to one owning AC. |
| PE-7 | Every AC traces to frozen design; missing requirements are design gaps. | Trap prompts require escalation instead of invented requirements. `pe-refuse-forward-reference` requires deferring or escalating later-epic-owned types rather than declaring or forward-referencing them. |
| PE-8 | Output is Gate 1 and the skill stops before package creation. | Output must hand off to `plan-delivery` and not create execution artifacts. |
| PE-9 | Never edits `docs/design/`; design gaps are escalated. | Static and trap checks reject design edits. |
| PE-10 | Never edits other epics, other contracts, or included domain charters. | Trap checks reject cross-epic and domain-charter edits. |

## Eval Files

- `evals/evals.json` contains output eval prompts and assertions.
- `evals/trigger_queries.json` contains trigger and near-miss trigger prompts.

## Grading Notes

Use the current repo as the source of truth. Grade refusal cases as passing only when the response names the violated gate and avoids file edits. Grade planning cases as passing only when the output proves Gate 1 with artifact-specific evidence.
