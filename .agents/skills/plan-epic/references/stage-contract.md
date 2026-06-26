# plan-epic Stage Contract

Use this reference after `SKILL.md` activates. Read only the live source files needed for the named epic; do not load the whole corpus.

## Source Docs To Read

Before authoring, read:

- `AGENTS.md`
- `docs/implementation-authoring/delivery-pipeline/README.md`
- `docs/implementation-authoring/delivery-pipeline/10-pipeline-and-invariants.md`
- `docs/implementation-authoring/delivery-pipeline/20-plan-epic.md`
- `docs/implementation-authoring/authoring-standard/README.md`
- `docs/implementation-authoring/authoring-standard/40-story-dag.md`
- `docs/implementation-authoring/authoring-standard/50-story-contract.md`
- `docs/implementation-authoring/authoring-standard/60-coverage.md`
- `docs/implementation-authoring/operating-model/architect.md`
- `docs/implementation-authoring/operating-model/characterization-review.md`
- The target epic charter under `docs/implementation/epics/`
- Every included domain charter and frozen design seam cited by that epic

## Input Gate

`plan-epic` starts only when all are true:

- One named epic resolves to one charter under `docs/implementation/epics/`.
- The charter status is `epic: ready`.
- Included domains and cited design seams are frozen.
- The checkout is the user-requested workflow-kit worktree.
- Existing DAG/story files are absent, placeholders, or explicitly safe to fill without overwriting non-placeholder work.

## Output Gate

Done means all are true:

- The story DAG status is `story-dag: frozen`.
- Every selected story contract is `story: ready`.
- Characterization review evidence exists for each ready story.
- Every owned Story Group Signal maps exactly once to a story id or named `split`.
- The target epic charter README, not the global coverage rollup, has the owning-story cells backfilled.
- No design requirements were invented, and every AC traces to frozen design.
- Whole-graph event/record producer reconciliation and failure-token/catalog reconciliation are recorded
  in the DAG, with every consumed event/record and every consumed failure / degraded / validation token
  mapped to exactly one authoritative producer.
- DAG edge -> consumed shape/predicate reconciliation is recorded in the DAG. Every listed consumer of a
  current-DAG producer has a labelled dependency edge and a DAG-declared consumed shape/predicate.
  Consumers of prior frozen producers are valid through the reconciliation row naming that source, not
  through invented intra-DAG edges. A prose-only consumer is a Gate 3 phantom-consumer defect.
- For every applicable story contract, manifest coverage is bidirectional and durable:
  `manifest item -> AC-n -> standing gate lane`, with no orphaned manifest item and no invented AC.
- Pure/value/classifier/projection contracts own no writer, append, persistence, or event-log obligation
  unless the contract explicitly owns the writer seam.
- Unattended recovery, clear, apply, auto-retry, or similar safety actions name both the classification
  producer and the committed `auto-recover` or relevant gate record required before execution.
- An independent read-only review inspected the finished planning diff for source traceability, DAG
  correctness, story-contract quality, charter ownership, docs-nav reachability,
  implementation-readiness, and hard-boundary compliance; every reviewer finding is fixed or
  explicitly escalated.
- No execution package, dispatch prompt, feature code, or delivery run was created.

## DAG gates (Gate 3) — structure and seams

Run this seam pass **before** sizing nodes; node boundaries fall out of it, not the other way round.

**Barrel ownership and same-logic concurrency.** The SDK barrel (`packages/sdk/src/index.ts`) is a
normal owned file. Each public-symbol story **owns its own `index.ts` export line**: it declares a
public-exposure AC (export + import path + public-import test) and **includes that export line in its
owned pathset**. Concurrency is governed by the same-logic rule (canonical in
`authoring-standard/40-story-dag.md`): two non-dependent stories may share a wave only when their owned
pathsets share no logic-bearing file (file-level granularity); append-only aggregation points — the SDK
barrel, registries, manifests, index/aggregator files — are not logic-bearing, so stories share them
freely and a line-level overlap rebases when the orchestrator advances the wave, never serializing the
stories. A file-level over-serialization may be lifted only by an architect override carrying a
one-line rationale recorded on the DAG.

**Whole-graph event/record producer reconciliation.** Before freezing the DAG, enumerate every event/record
named in the design seams for this epic AND every event/record any story declares as consumed. Assert that
exactly one story (this epic or a prior frozen epic) declares each as a produced output. Record this
reconciliation table in the DAG. An event consumed by any story but produced by none is a DAG-level closure
defect — per-story closure checks cannot catch it. Gate 3 fails until every consumed event/record has a
declared producer or is escalated as a design gap.

**Whole-graph failure-token/catalog reconciliation.** Before freezing the DAG, enumerate every shared
failure / degraded / validation catalog or union named in the design seams, every producer story catalog,
and every token any story failure table consumes. Assert that each consumed token resolves to exactly one
authoritative owner: a story-owned producer catalog in this DAG, or a prior frozen design / producer
catalog. Consumer stories cannot invent tokens by naming them in failure tables. Producer catalogs must
enumerate the exact token literals in enforced fixtures / catalog tests. A consumed token that is unowned,
maps to multiple producers, is absent from the cited producer catalog, carries a stronger meaning than the
frozen design/catalog, or is backed only by prose is a DAG-level closure defect. Gate 3 fails until the
token is assigned to one authoritative producer catalog or escalated as a design gap.

**No phantom consumers.** Gate 3 has only DAG artifacts; story contracts do not exist yet. Reject a listed
consumer of a current-DAG producer unless the DAG already contains both a labelled dependency edge to that
producer and a dependency/shared-shape reconciliation row naming the consumed shape or predicate.
Consumers of prior frozen producers are covered by the reconciliation row that names the frozen source,
not by fake external edges. A producer that merely lists prose consumers, or a consumer that has an
applicable edge but no consumed shape/predicate source, is a whole-graph closure defect. Gate 4 and
characterization review later verify that each contract consumes the DAG-declared shape or predicate
rather than inventing or dropping it.

**Value-type vs runtime-object seam.** For each shared shape, decide how its consumers use it:

- *Value type* — a data shape passed as a function input (built from fixtures in tests).
- *Runtime object* — a live instance whose methods the consumer calls.

Declare every value type in a single **type-only contract story** and point consumers at that story. A
type and the behavior that produces its values may live in different stories; a consumer that needs only
the *type* depends on the contract story, never on the *behavior* story. Gate 3 fails if any cross-story
(especially cross-domain) edge targets a producer's behavior story while the consumer uses only that
producer's value types — re-point the edge at the type-only contract story. (Symptom of getting this
wrong: a deep, narrow band chain where each behavior gates the next; the value-type seam should yield
wide bands.)

**Single producer, no collapse.** Each shared shape has exactly one producer. A type-only contract
surface that a later epic will extend, or that more than one story consumes, is its **own** story — never
merged into an executable, smoke, or behavior story that consumes it. Collapsing a contract producer into
its consumer destroys the stable seam later epics extend.

**Cross-epic forward-reference (sequencing).** Every field type a story declares must resolve to **this
epic or an already-frozen earlier epic/domain**. If a declared interface references a type owned by a
*later* epic:

- declare only the self-contained subset whose fields all resolve now;
- name the deferred remainder and the later epic that owns it;
- if the surface genuinely cannot be declared without the later-epic type, **STOP and escalate a
  design-sequencing gap** — never forward-reference or invent the missing type.

Naming a later-epic-owned interface as an owned spec-surface type is a Gate 3 failure.

**Pathset convention.** Owned pathsets follow the design's layer grouping and domain slug (derive from the
design domain directory and the prior frozen DAGs, e.g. Epic 1). Reject a pathset that places a domain's
code outside its design layer (a top-level module instead of under the layer directory) or invents a
directory not traceable to the design package decomposition.

## Contract gates (Gates 4-6) — AC depth

- Every AC is enumerated and falsifiable, with an evidence clause that names **more than a bare test-file
  path**: an exact value/equality assertion, an exhaustiveness (`never`) switch, a named negative fixture,
  or a runnable sweep (path + forbidden token + expected exit). An AC whose only evidence is "see test
  file X" fails Gate 4.
- Each failure/degraded/validation token maps to exactly one owning AC; the failure table cites that AC.
  The cited AC must assert **this row's trigger and behavior** — not the happy path, not a different token.
- **Failure-token/catalog closure.** Every failure / degraded / validation token resolves to exactly one
  authoritative producer catalog recorded in the DAG or already frozen source. Consumer rows cite producer
  tokens verbatim and cannot invent tokens; producer stories enumerate exact literals in enforced fixtures /
  catalog tests. A token that is unowned, ambiguous, absent from its cited catalog, stronger than design, or
  prose-only blocks `story: ready`.
- Every behavioral AC and every failure/degraded trigger has predicate-input coverage. The contract must
  name the request field, consumed event/projection, producer-owned field, or in-scope resolver that
  supplies each runtime branch value. A ref, hash, citation, or story id is provenance only. If an AC
  says "policy permits/denies" while the contract exposes only `policyRef`, or says "approved parent"
  without a defined approved-parent source, Gate 4 fails and the story must not become `ready`.
- **Producer-closure coverage.** For every required field of every record/event this story produces and
  every required public symbol it exposes, the predicate-input matrix must name a declared source: an input
  field, an owned-pathset file, or an explicit producer/minting rule. A required output with no reachable
  source is a **closure defect** — Gate 4 fails until it is resolved or escalated.
- **Design→AC completeness.** For every fail-closed invariant and every emitted event the design states for
  this story's signal, assert it maps to at least one AC. Gates check AC→design (nothing invented); this
  check is the mirror: design→AC (nothing dropped). A design-stated invariant or emitted event with no
  covering AC is a dropped obligation and a Gate 4 failure.
- **Manifest coverage — both directions.** Every spec-surface manifest item maps to a proving AC, and
  every AC maps back to a manifest item or responsibility plus a standing `pnpm check` leaf or named CI
  gate lane. The durable chain is `manifest item -> AC-n -> standing gate lane`; a manifest item with no
  AC, or with an AC but no standing lane, is an orphaned obligation and Gate 4 fails.
- **Pure/value classifier boundary.** A story characterized as pure, value-only, classifier-only, or
  projection-only may return values and in-memory classifications, but it must not own writer, append,
  persistence, or event-log obligations unless the contract explicitly names the writer seam it owns. An
  unnamed writer obligation is a boundary contradiction and Gate 4 fails.
- **Safety action provenance.** Every unattended recovery, clear, apply, auto-retry, or similar safety
  action must name the classification producer that authorizes it and the committed `auto-recover` or
  relevant gate record required before execution. Stale classifications, prose safety labels, and
  uncommitted/manual checks make the action manual-only or the story not ready.
- Public-exposure AC + import path + public-import test for every exported shape.
- A numeric per-file size budget within the repo cap (200–400 typical, 800 hard).
- Runnable sweeps for forbidden symbols and re-exports. A sweep's forbidden-token set must not ban tokens
  that appear in the story's own ACs or in the normative design vocabulary for this story's signal — an
  over-broad sweep that forbids a token the story itself requires is a defect, not a safety measure.

Four named Gate-4 boxes in
`docs/implementation-authoring/authoring-standard/50-story-contract.md#gate-4--authoring-ready`
must be ticked before `story: ready`. All four are mechanical instances of *Readiness is reconstructed,
not asserted* and mirror the `plan-delivery` readiness-contract preflights at packaging time:

- **Proof-substrate match** (mirrors substrate-presence preflight, PD-9)
- **Predicate-input closure — relational & compound** (mirrors predicate-input preflight, PD-10)
- **Failure-token/catalog closure** (mirrors failure-token/catalog closure preflight, PD-11)
- **Manifest coverage** (mirrors manifest/gate-lane coverage preflight, PD-12)

## Characterization Review

Review the authored DAG and contracts before setting readiness:

- Gate 3 for the DAG, **including the seam pass above**: value-type seam, single-producer / no-collapse,
  whole-graph event/record producer reconciliation, whole-graph failure-token/catalog reconciliation,
  cross-epic forward-reference, pathset convention.
- Gates 4-6 for every story contract, including AC depth and predicate-input coverage above.
- Manifest coverage for every story contract: each manifest item maps through AC to a standing gate lane,
  and non-command Gate 5 evidence names a concrete file range, fixture id, or generated artifact id.
- Pure/value classifier boundary for each pure/value/classifier/projection story: no writer, append,
  persistence, or event-log obligation unless a writer seam is explicitly owned.
- Safety-action provenance for each unattended recovery/clear/apply/auto-retry action: classification
  producer plus committed `auto-recover` or relevant gate record are named.
- Failure-token/catalog closure for the story and DAG: each story token resolves to exactly one
  authoritative producer catalog, consumer stories invent none, and producer catalogs enumerate exact
  literals in enforced fixtures / catalog tests.
- Record each **load-bearing scope decision** (node boundaries, single-producer hoists, value-type seams,
  catalog/invariant ownership splits, cross-epic deferrals) as a named entry carrying: the rationale, the
  design line it traces to, the falsification criterion, and the escalation path if violated. A bare `[x]`
  checklist or a post-hoc
  "all checks passed" summary does **not** satisfy the gate — readiness set on an unevidenced self-check
  is a defect.
- Final Gate 1 evidence includes the matrices that apply to the epic surface: event/record
  producer-consumer reconciliation, manifest item -> AC -> gate lane, DAG edge -> consumed
  shape/predicate source, and safety action -> classification/gate source.
- Findings quote the source design line or AC they contradict.
- Findings classify `story-defect` or `design-defect`.
- The architect owns the final verdict; a spec-reviewer assists only.

## Escalation

Stop and report blockers with exact file and line evidence for:

- Missing or ambiguous requirements.
- Non-frozen inputs.
- Inconsistent source artifacts.
- Existing non-placeholder work that would be overwritten.
- Any request to expand the stage into package creation, dispatch, implementation, or design editing.
