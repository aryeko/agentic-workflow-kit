# plan-epic Evals

**Skill under test:** `plan-epic`
**Version pin (combined skill hash):** `3c1cb5965f9343d3`
**Status:** active

Recompute with:

```sh
# run from this skill's root; excludes EVALS.md so the pin is stable.
# LC_ALL=C pins the sort order so the hash is locale-independent (reproducible in CI / any shell).
find SKILL.md references agents evals -type f 2>/dev/null | LC_ALL=C sort |
  while IFS= read -r f; do cat "$f"; done |
  shasum -a 256 | cut -c1-16
```

## Scope

These evals operationalize PE-1 through PE-17 from `docs/implementation-authoring/delivery-pipeline/20-plan-epic.md`. A passing result needs concrete artifact evidence, not a bare PASS claim.

## Requirements Matrix

| ID | Requirement | Checks |
|---|---|---|
| PE-1 | Triggers only for one named, ready epic and refuses non-epic or not-ready-charter requests. | Trigger queries include positive named-ready prompts and near-miss negatives; output evals require explicit input-gate refusal behavior. |
| PE-2 | Produces only Layer-3 and Layer-4 markdown. | Static assertions reject code, packages, execution package files, model/effort assignment, dispatch, commits, PRs, and merges. |
| PE-3 | Sets `story: ready` only after characterization review passes. | Output must include review evidence before readiness and must not accept self-asserted readiness. `pe-ac-depth-and-falsifiable-review` requires named scope decisions with rationale, design-line trace, falsification criterion, and escalation path — not a bare checklist. |
| PE-4 | Closes coverage exactly once and backfills the epic charter README owning-story cells, not the domain rollup. | Output must identify the epic README as the oracle and refuse edits to global story ownership rollups. |
| PE-5 | Freezes the DAG before authoring contracts. | Output sequence must block contracts while DAG is draft and cite Gate 3 (including the value-type / single-producer seam pass and the whole-graph event/record producer reconciliation) before Layer 4 work. `pe-value-type-seam` checks that value types are hoisted into one type-only contract story and that value-type consumers depend on the contract story, not a behavior story. |
| PE-6 | Every contract passes Gates 4-6. | Assertions inspect for AC evidence clauses, failure rows (each cited AC asserts that row's trigger and behavior), predicate-input coverage (consumed predicates + produced-obligations), public exposure/import tests, numeric file-size budget, and runnable sweeps. `pe-ac-depth-and-falsifiable-review` rejects bare test-file-path ACs, requires a concrete falsifiable assertion or named negative fixture per AC, and maps each failure token to one owning AC. |
| PE-7 | Every AC traces to frozen design; missing requirements are design gaps. | Trap prompts require escalation instead of invented requirements. `pe-refuse-forward-reference` requires deferring or escalating later-epic-owned types rather than declaring or forward-referencing them. |
| PE-8 | Output is Gate 1 and the skill stops before package creation. | Output must hand off to `plan-delivery` and not create execution artifacts. |
| PE-9 | Never edits `docs/design/`; design gaps are escalated. | Static and trap checks reject design edits. |
| PE-10 | Never edits other epics, other contracts, or included domain charters. | Trap checks reject cross-epic and domain-charter edits. |
| PE-11 | Runtime predicates are evaluable from declared inputs, consumed events/projections, producer-owned fields, or in-scope resolvers. | `pe-refuse-unevaluable-predicate-inputs` rejects `policyRef`-only policy decisions and undefined approved-parent scope rules; readiness is refused until the source gap is repaired. |
| PE-12 | DAG frozen only after whole-graph event/record producer reconciliation: every event/record consumed by any story maps to one declared producer node (this epic or a prior frozen one); an orphaned consumed event is a Gate 3 failure, not deferred to per-story checks. | `pe-dag-level-closure` presents a plan where one story consumes `ApprovalDecisionRecorded` but no story declares it as a produced output; the output must flag it as a DAG-level closure defect, refuse to freeze the DAG, and refuse `story: ready` for the consumer until a producer is named or the gap is escalated. |
| PE-13 | Every contract's predicate-input matrix includes produced-obligations rows: every required field of every produced record/event and every required public symbol names a declared source (input field, owned-pathset file, or minting rule); a required output with no source is a blocking closure defect, not an implementer's puzzle. | `pe-producer-closure` presents a contract where `ApprovalDecisionRecorded` is listed in the spec surface as produced but the predicate-input matrix has no produced-obligations section; the output must flag this as a Gate 4 closure defect and refuse readiness. |
| PE-14 | Every design-stated fail-closed invariant and emitted event for the story's signal maps to at least one AC; a dropped invariant or emitted event is a Gate 4 story-defect finding. | `pe-design-to-ac-completeness` presents a contract for a story whose design states a resume must re-check fresh capability state, but the contract has no AC asserting that check; the output must flag the missing AC as a design→AC gap and refuse readiness. |
| PE-15 | A runnable boundary sweep's forbidden-token set must not ban a token that appears in the story's own ACs or in the normative design vocabulary for that story's signal. | `pe-sweep-vocabulary` presents a contract whose sweep recipe forbids `containment` while AC-6 requires asserting `proof.containmentEmpty`; the output must flag this as an over-broad sweep defect and refuse readiness. |
| PE-16 | Every failure/degraded table row cites an AC that asserts that row's trigger and behavior — not the happy path, not a different condition. | `pe-failure-row-ac-match` presents a contract with a failure row citing an AC that proves only the success path; the output must flag this as a Gate 4 failure and refuse readiness. |
| PE-17 | Same-logic concurrency holds: a public-symbol story's owned pathset includes its own `packages/sdk/src/index.ts` export line; same-wave stories share no logic-bearing file (file-level granularity from owned pathsets), and any file-level override carries a one-line architect rationale. | `pe-same-logic-concurrency` presents a DAG that (a) schedules two non-dependent stories in the same wave whose owned pathsets share one logic-bearing source file with no recorded override rationale, and (b) gives a public-symbol story no `index.ts` export line in its pathset; the output must flag the same-logic violation, refuse to freeze until the stories are separated or an architect override rationale is recorded, and flag the missing barrel export line as a closure/ownership defect. |

## Eval Files

- `evals/evals.json` contains output eval prompts and assertions.
- `evals/trigger_queries.json` contains trigger and near-miss trigger prompts.

## Grading Notes

Use the current repo as the source of truth. Grade refusal cases as passing only when the response names the violated gate and avoids file edits. Grade planning cases as passing only when the output proves Gate 1 with artifact-specific evidence.
