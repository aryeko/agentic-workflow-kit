# Source Readiness

Use this reference before writing any execution package artifact.

## Resolve The Epic

1. Resolve the requested epic slug under `docs/implementation/epics/`.
2. If multiple epics match, ask for the exact slug.
3. Do not infer a target from a partial match when more than one epic is plausible.

## Read Sources

Read the smallest source set needed to prove the package can be projected:

- repo-local `AGENTS.md`;
- repo-local `CLAUDE.md`, if present;
- `docs/implementation/epics/<epic-slug>/README.md`;
- `docs/implementation/epics/<epic-slug>/story-dag.md`;
- every selected ready story contract under `docs/implementation/epics/<epic-slug>/stories/`.

Use `story-dag.md` as authority for story ids, jobs, dependency order, waves, owned pathsets, and
suggested-tier floors. Use story contracts as authority for acceptance criteria, source traces,
required reading, quality bars, evidence packs, non-goals, STOP conditions, and allowed writes.

If the DAG sets no suggested-tier floor for a story, there is no floor constraint — select the
reasoning tier from story risk per `references/model-routing.md` and record "no DAG floor" in the
routing rationale; do NOT invent a floor. When a floor does exist, the selected reasoning tier must
be greater than or equal to that floor, consistent with `references/model-routing.md`.

## Gate 1 Check

Refuse and route back to `$plan-epic` when any condition holds:

- the story DAG frontmatter is not `status: "story-dag: frozen"`;
- any selected story contract is not `status: "story: ready"`;
- a selected story lacks a stable story id, owned pathset, dependency data, suggested-tier floor
  when required by the DAG, or ordered `AC-n` ids;
- the DAG and story contract conflict on story id, dependencies, owned pathset, suggested tier, or
  source scope;
- a selected ready story is self-blocking: its STOP conditions name a missing source fact needed by one
  of its ACs or failure/degraded triggers, or its ACs/failure rows require a runtime branch value that is
  not supplied by a declared request field, consumed event/projection, producer-owned field, or in-scope
  resolver;
- a package element would require adding, weakening, reordering, or interpreting scope beyond the
  frozen DAG and ready contracts.
- **phantom-consumer source check**: refuse if the DAG lists a consumer of a current-DAG producer without
  both a labelled dependency edge to that producer and a dependency/shared-shape reconciliation entry
  naming the consumed shape or predicate. Consumers of prior frozen producers are valid through the
  reconciliation row naming the frozen source, not through invented intra-DAG edges. Gate 3 owns this
  check; route source repair back to `$plan-epic` instead of relying on package ordering or nonexistent
  pre-contract evidence.
- **substrate-presence preflight** (PD-9): refuse if a quality bar names a statement/branch coverage
  lane while the spec-surface manifest declares no runtime-value export (no `export const` / `as const` /
  enum / function). A retained type-only marker is corroborating, not an independent trigger — a story
  that mints `as const` catalogs and keeps the marker passes. Full rules in
  `docs/implementation-authoring/delivery-pipeline/30-plan-delivery.md#readiness-contract-preflights`.
- **predicate-input preflight** (PD-10): refuse if any AC closure row names an input category
  instead of a concrete `Producer/Type.field`, or any relational sub-predicate leaves an operand
  unsourced (decompose compound ACs; both operands cite a field, counted per sub-predicate not per AC).
  Full rules in
  `docs/implementation-authoring/delivery-pipeline/30-plan-delivery.md#readiness-contract-preflights`.
- **failure-token/catalog closure preflight** (PD-11): build the selected package inventory from the
  frozen DAG, spec-surface manifests, and failure/degraded/validation tables. Refuse if any consumed token
  is unowned, maps to multiple producers, is absent from the cited producer catalog, carries a stronger
  meaning than the frozen design/catalog, or if the producer catalog is prose-only and does not enumerate
  exact literals in enforced fixtures / catalog tests. Route the source repair back to `$plan-epic`; do
  not invent or normalize tokens during packaging. Full rules in
  `docs/implementation-authoring/delivery-pipeline/30-plan-delivery.md#readiness-contract-preflights`.
- **manifest/gate-lane coverage preflight** (PD-12): build each selected story's manifest coverage chain
  from its spec-surface manifest, ACs, and internal coverage matrix. Refuse if any manifest item lacks the
  durable chain `manifest item -> AC-n -> standing gate lane`, or if any non-command evidence-pack entry
  lacks a concrete file range, fixture id, or generated artifact id. Route orphaned manifest obligations
  to `$plan-epic` under PD-12/LSN-34; route evidence-pack range/artifact omissions under Gate 5/LSN-15.
  Full rules in
  `docs/implementation-authoring/delivery-pipeline/30-plan-delivery.md#readiness-contract-preflights`.
- **pure/value classifier boundary source check**: refuse if a selected story is classified as pure,
  value-only, classifier-only, or projection-only but owns writer, append, persistence, or event-log
  obligations without explicitly naming the writer seam it owns. Route the contradictory source contract
  back to `$plan-epic`.
- **safety-action provenance source check**: refuse if an unattended recovery, clear, apply, auto-retry,
  or similar action lacks the classification producer and committed `auto-recover` or relevant gate record
  required before execution. Do not package prompts that ask implementers to act on stale/prose
  classifications or uncommitted checks.

This is a boolean gate check, not a second characterization review. Do not repair or improve the
source artifacts here.

## Projection Inventory

Before writing package files, build a source inventory with:

- epic slug and source files read;
- one row per story: story id, job, wave, dependencies, dependents, owned pathset, suggested-tier
  floor, source story contract path, and all `AC-n` ids;
- dependency contracts and public import paths named by the DAG or story contracts;
- DAG edge -> consumed shape/predicate reconciliation for every listed consumer of a current-DAG
  producer, with the labelled producer edge and consumed shape/predicate source recorded; prior frozen
  producers are covered by a reconciliation row naming the frozen source;
- failure-token/catalog closure inventory: shared failure / degraded / validation catalogs or unions named
  by the DAG, producer story catalogs, consumed story tokens, the exact authoritative producer for each
  consumed token, and the enforced fixture / catalog-test evidence for producer exact literals;
- manifest/gate-lane coverage inventory: each spec-surface manifest item, its proving AC, the standing
  gate lane that re-proves it, and the concrete file range, fixture id, or generated artifact id for
  non-command evidence;
- pure/value classifier boundary inventory and safety-action provenance inventory where applicable;
- any package-blocking vagueness, reported with the exact source file and missing fact.
- any self-blocking STOP condition or unresolved predicate input, reported with the exact source file,
  affected AC/failure row, missing value source, and `$plan-epic` route-back.

Every later package artifact must be traceable to this inventory.

## Verify Write Location

Before writing, run `git rev-parse --show-toplevel` and verify it is the intended worktree. In
workflow-kit, non-trivial docs work normally happens in a worktree cut from `v-next`.

Stop on a wrong checkout. Do not write into the main checkout by accident.
