---
title: "Story contract — Layer 4"
status: draft
last-reviewed: "2026-06-22"
---

# Story contract (Layer 4)

> **Audience** — architect (authoring) · characterization reviewer (grading).
> **Job** — the dispatch surface. One story owns **DONE, not HOW**: a builder implements it and a
> reviewer grades it from the *same* written contract.
> **To author one** — copy [`_templates/story-contract.md`](_templates/story-contract.md), satisfy the
> six rules, then tick every box in [Gate 4](#gate-4--authoring-ready).

Each rule fixes a recurring defect class from early-epic delivery; the
[lessons ledger](../lessons-ledger.md) maps each lesson to the box that catches it.

## The six rules

| | Rule | Demands | Trap it closes |
|---|---|---|---|
| **R1** | Enumerate ACs + spec surface | ordered `AC-n`, one falsifiable assertion each, **self-contained** (enumerate the set in the AC — never "as in design") + a manifest naming every interface / event / DTO / command / evidence-record / failure-token the design defines, distinct design shapes kept distinct | "implement the spec" with nothing countable → readers re-derive different gaps |
| **R2** | Name every failure | one row per failure/degraded outcome — `token · trigger · required behavior · proven-by` — and the cited AC must assert **this row's** trigger *and* behavior | "fail closed" prose; a happy-path AC cited for a degraded row |
| **R3** | Quantify the quality bar | test lanes + exact commands; coverage scope/threshold (≥90% of the meaningful area) on an **instrumented** lane; required tests catalogued not exampled; public **import path + import test**; **numeric** file-size budget; determinism; dependency edges; domain non-negotiables | adjectival quality ("stay focused", "schema tests, e.g. …") |
| **R4** | Subset of design | every AC traces to design; make design *countable*, never add to it; design vagueness → **amend design**, don't copy it down; freeze a command's *behavior*, not a brittle flag spelling | grading code against a stronger-than-approved bar |
| **R5** | No unresolved branches | resolve every "A or B" to the design-backed outcome (escalate if design truly leaves it open); name exact outputs; cite `<producer-story>/<type>` **verbatim**; sweeps are runnable recipes | handing a design choice to the implementer |
| **R6** | Predicate inputs are evaluable | for every behavioral AC and failure row, name the concrete request field, consumed event, projection, producer-owned shape field, or resolver that supplies the value being tested; a **relational** predicate ("X inside / outside / matches / broader-than / contained / subset-of Y") names **both** operands as concrete declared fields; **compound ACs are decomposed** so each sub-predicate is sourced individually; the closure row cites a specific `Producer/Type.field`, never an input *category*; a ref, hash, citation, or token is not a decision input unless this story owns or consumes the resolver that turns it into values | a story says "deny when policy disallows" while its contract exposes only `policyRef`; "approved parent scope" with no approved-parent source; "cwd inside the workspace" with `cwd?` declared but **no workspace-root field** (one operand of a two-operand predicate unsourced) |

**Internal coverage — both ways.** Carry a matrix mapping every responsibility and manifest item to a
proving `AC-n`, and every `AC-n` back to the **standing gate lane** that re-proves it. A manifest item
with no AC is an orphaned obligation; an AC with no manifest item is invented scope; an AC whose only
proof is a manual one-off (not a named `pnpm check` / CI lane) is a manual-only proof that does not
durably hold; a responsibility reaching into another story's signal is an ownership leak — move it to
the owning story.

**Failure-token/catalog closure.** Every failure / degraded / validation token in a story must resolve to
exactly one authoritative owner: the story-owned producer catalog, or an earlier frozen design / producer
catalog. A consumer story cannot invent a token by naming it in its failure table. If the story consumes a
union / catalog, each token in its failure table must be a member of that producer catalog, cited
verbatim, and the producer story must enumerate the exact literals in enforced fixtures / catalog tests.
A token with no owner, multiple owners, or a stronger meaning than design is a source gap, not an
implementation choice.

**Negative claims need negative fixtures.** A green happy-path tool exit (`tsc -b`, `pnpm deps`,
`pnpm check`) proves only *acceptance*. Every rejection / fail-fast / degraded / validation-failure AC
names its own failing fixture or artifact — and that fixture must be **invoked by a named gate lane**
(e.g. `type:fixtures`), not only by a manual one-off command. A negative type-fixture outside the
`tsc -b` build graph is unenforced: it silently rots and a regression that widens a union or drops a
required field passes CI. The proof only counts once the standing gate re-runs it.

**Decision predicates need decision values.** If an AC says the implementation must branch on policy,
scope, capability state, approval state, authority, or any other runtime condition, the contract must
name where the branch value comes from. `policyRef`, `configHash`, `leaseId`, "design says", or a story
id can be provenance, but not the value being evaluated. If the value lives behind another system, the
contract consumes an already-frozen producer shape/resolver verbatim or stops as a source gap.

**Relational and compound predicates.** A predicate of the form *"X inside / outside / matches /
broader-than / contained-in / subset-of Y"* is undecidable unless **both** operands are declared
frozen-input fields — naming only the tested operand (the point) and not the boundary (the region) is a
closure defect, even if a tests-passing approximation substitutes an attacker-influenced or wrong-boundary
stand-in (which silently fails open). Decompose every compound AC into its sub-predicates and source each
one individually; a single unsourced sub-predicate hidden inside a bundle of sourced ones still fails
closure. The closure table cites a specific `Producer/Type.field` for each operand — an entry naming an
input *category* ("normalized request", "replay/projections") is rejected. STOP conditions are stated
**generically** — *STOP if any branch value is not produced by frozen inputs* — never as an enumerated
value list (policy / session / gate / prompt) that silently omits a class such as a workspace/containment
value.

**Producer-closure (construction obligations).** R6 makes *consumed* predicates evaluable; this closes
the mirror gap on *produced* shapes. For every required field of every record/event the story produces,
and every required public symbol the story exposes, the contract must name a declared source — an input
field, an owned-pathset file, or an explicitly stated producer/minting rule. A required output with no
producer reachable from declared inputs is a **closure defect** and a blocking gate failure, not an
implementer's puzzle. The predicate-input matrix must therefore cover construction obligations (fields
produced), not only predicates consumed.

**Substrate/config variant.** A story whose deliverable is declarative substrate (`tsconfig`,
`package.json`, workspace, dependency rules, CI, linters) — or, more generally, **any story whose owned
pathset can be satisfied by erased TypeScript types alone** (a type-only contract producer) — must **not**
invent a runtime type or token, and must **not** carry a statement/branch coverage lane (erased `type` /
`interface` declarations leave V8 nothing to instrument, so the lane is satisfied vacuously: `0/0`→100%).
Config stories use `Validated artifacts:` (the files / inventories / config shapes they produce) and
`Validation failure modes:` (the invalid shapes they must reject, each with a negative fixture); the
failure table becomes a validation-failure table. A type-only producer proves its surface by
`type:fixtures` (positive + negative compile fixtures in the build graph) and a public-import test — see
the **Proof-substrate match** box in [Gate 4](#gate-4--authoring-ready).

**Cross-surface parity stories.** When a story asserts two surfaces are equivalent (e.g. CLI vs MCP),
the parity is only real if the test can fail. Either the two surfaces must **not** share a byte-identical
implementation file, **or** the parity test must vary a surface-specific input. Otherwise the assertion
is tautological — "the same code on the same input yields the same bytes" can never fail and proves
nothing. `edge-01-s2` shipped this weakness: `packages/cli/src/operator-smoke/shared.ts` was
byte-identical to the MCP copy, so the parity test compared a file against itself. State the
non-tautological parity check (distinct sources, or a varied surface-specific input) in the contract.

## Gate 4 — authoring-ready

Tick every box; an empty box means not ready.

- [ ] Every `AC-n` is falsifiable, self-contained, one assertion, and traces to design.
- [ ] Spec-surface manifest matches design and keeps distinct types/unions distinct; substrate/config
      stories use `Validated artifacts` + `Validation failure modes`, not invented types.
- [ ] Covers its story-DAG node's signal(s); shared shapes cited by producer story, not redeclared.
- [ ] Internal coverage holds both ways; no responsibility crosses the assigned signal.
- [ ] **Predicate-input closure — relational & compound** (*instance of [Readiness is reconstructed, not
      asserted](10-principles.md#readiness-is-reconstructed-not-asserted)*): every behavioral AC and every
      failure/degraded trigger names the concrete declared input, consumed event/projection, producer-owned
      field, or resolver that makes the predicate decidable; refs/hashes/citations are not accepted as
      values unless a resolver is in scope. A **relational** predicate ("X inside / outside / matches /
      broader-than / contained / subset-of Y") names **both** operands as concrete declared fields;
      **compound ACs are decomposed** so the matrix is per *sub-condition*, not per AC; each closure row
      cites a specific `Producer/Type.field`, and a row naming an input *category* ("normalized request",
      "replay/projections") is **rejected**; STOP conditions read *"any value not produced by frozen
      inputs,"* not an enumerated list.
- [ ] Producer-closure holds: every required produced record/event field and every required public
      symbol the story exposes names a declared source — an input field, an owned-pathset file, or an
      explicit producer/minting rule; a required output with no reachable producer is a blocking closure
      defect, not deferred to the implementer.
- [ ] Failure/degraded (or validation-failure) table present; **each row's cited AC actually asserts
      that row** — not the happy path, not a different condition.
- [ ] **Failure-token/catalog closure:** every failure / degraded / validation token resolves to exactly
      one authoritative producer catalog (story-owned or prior frozen); consumer rows cite producer tokens
      verbatim and cannot invent tokens; producer catalogs enumerate exact literals in enforced fixtures /
      catalog tests; no consumed token is unowned, ambiguous, or stronger than design.
- [ ] Every negative AC has a failing fixture, and that fixture is **invoked by a named gate lane**
      (e.g. `type:fixtures`) inside `pnpm check` — not only by a manual one-off; no green tool exit cited
      for a rejection, no fixture left outside the `tsc -b` build graph.
- [ ] Coverage number + enforcement command + instrumented lane stated, and the command measures the
      claimed helper scope; **substrate/config stories instead prove each validated artifact by a shape
      assertion and each validation-failure mode by a negative fixture — no coverage lane required.**
- [ ] **Proof-substrate match** (*instance of [Readiness is reconstructed, not
      asserted](10-principles.md#readiness-is-reconstructed-not-asserted)*): if the quality bar names a
      statement/branch coverage lane, the owned src pathset is **guaranteed to emit runtime substrate**
      (exported value / enum / `as const` / function) for that lane; a **type-only producer carries no
      coverage lane** and proves via `type:fixtures` (positive + negative compile fixtures in the build
      graph) + a public-import test. The contract **states which substrate the catalogs use** — bare
      `type` union vs runtime `as const` + derived union — never left to the implementer. See
      [engineering/testing-policy.md](../../engineering/testing-policy.md#proof-substrate).
- [ ] Required tests catalogued, not exampled.
- [ ] Frozen commands validated against the pinned tool version and stated as a behavior contract, not
      a flag string.
- [ ] Zero unresolved option branches — including choices the design itself leaves open.
- [ ] Cross-story contracts name exact shapes; catalog/invariant tokens cited verbatim.
- [ ] Public exposure: each public SDK shape names its import path (export + barrel + `exports`) and a
      public-import test, and the story **owns its own `index.ts` export line** — that line is in its
      owned pathset; or the story states it exposes none — **substrate/config stories that expose no
      SDK surface satisfy this by construction.**
- [ ] Cross-surface parity ACs are non-tautological: the comparison runs over distinct implementation
      files or varies a surface-specific input — never the same file compared against itself.
- [ ] Constructable: no AC or manifest shape requires a combination no value can satisfy; a fixture
      constructs each public shape.
- [ ] Safety invariants fail-closed **by construction** — the unsafe state is unrepresentable or
      rejected, proven by a fail-closed test, not left to caller discipline.
- [ ] Public-input / validator stories enumerate the negative-case matrix: missing-required,
      wrong-type, unknown-field, malformed-nested, unsafe-runtime; exported canonical catalogs
      runtime-frozen or justified.
- [ ] File-size budget is a number of lines (default soft cap ~200), not an adjective.
- [ ] Boundary/forbidden-symbol sweeps are runnable recipes — exact command, path roots, real
      forbidden-token set, expected zero-match, output captured.
- [ ] Boundaries include owned package/module, owned pathset, dependency-rule edge, and STOP conditions.

## Verification & freeze

Author-time gates are self-checks; close out a batch of contracts before the next layer consumes them.

**Gate 5 — evidence pack complete.** A claim is gradable only when the pack holds: a test/artifact per
AC; one per failure/validation row; a negative fixture per rejection; gate output (or a named unrelated
blocker); coverage command + lane + number for the stated scope; a public-import test per exposed shape;
sweep output for any cross-package change; predicate-input evidence showing each branch value comes from
a declared input/event/projection/producer shape/resolver; conformance evidence for provider ports/mocks
(real-runtime attestation only for a real driver capability). No manifest item missing; no requirement
invented beyond design. **An AC whose only proof is a command not invoked by `pnpm check` or a named CI
lane is not gradable** — a manual one-off re-run by the reviewer is not a durable proof; name the
standing gate lane that re-proves the AC, or the AC stays ungraded.

**Gate 6 — readiness matrix.** An implementation axis moves to `yes` only with cited executable
evidence. Design approval, prose, migrated code, fixtures, or worker self-report justify `partial` only.

**Independent pass.** Run the [shared close-out](README.md#verifying-a-layer): rebuild coverage from the
source artifacts (not the rollup) — the **coverage** instance of [*Readiness is reconstructed, not
asserted*](10-principles.md#readiness-is-reconstructed-not-asserted), whose reconstruct-don't-assert
discipline equally governs the substrate, predicate-input, producer-closure, and public-exposure
dimensions — and have a *different* reader run this gate, quoting the design line each finding contradicts
and labelling story-defect vs design-defect.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Authoring standard — Pillar 1](./README.md) · **← Prev:** [Story DAG — Layer 3](./40-story-dag.md) · **Next →:** [Principles — the universal bar](./10-principles.md)

<!-- /DOCS-NAV -->
