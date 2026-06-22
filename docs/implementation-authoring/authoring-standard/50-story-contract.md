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
> five rules, then tick every box in [Gate 4](#gate-4--authoring-ready).

Each rule fixes a recurring defect class from early-epic delivery; the
[lessons ledger](../lessons-ledger.md) maps each lesson to the box that catches it.

## The five rules

| | Rule | Demands | Trap it closes |
|---|---|---|---|
| **R1** | Enumerate ACs + spec surface | ordered `AC-n`, one falsifiable assertion each, **self-contained** (enumerate the set in the AC — never "as in design") + a manifest naming every interface / event / DTO / command / evidence-record / failure-token the design defines, distinct design shapes kept distinct | "implement the spec" with nothing countable → readers re-derive different gaps |
| **R2** | Name every failure | one row per failure/degraded outcome — `token · trigger · required behavior · proven-by` — and the cited AC must assert **this row's** trigger *and* behavior | "fail closed" prose; a happy-path AC cited for a degraded row |
| **R3** | Quantify the quality bar | test lanes + exact commands; coverage scope/threshold (≥90% of the meaningful area) on an **instrumented** lane; required tests catalogued not exampled; public **import path + import test**; **numeric** file-size budget; determinism; dependency edges; domain non-negotiables | adjectival quality ("stay focused", "schema tests, e.g. …") |
| **R4** | Subset of design | every AC traces to design; make design *countable*, never add to it; design vagueness → **amend design**, don't copy it down; freeze a command's *behavior*, not a brittle flag spelling | grading code against a stronger-than-approved bar |
| **R5** | No unresolved branches | resolve every "A or B" to the design-backed outcome (escalate if design truly leaves it open); name exact outputs; cite `<producer-story>/<type>` **verbatim**; sweeps are runnable recipes | handing a design choice to the implementer |

**Internal coverage — both ways.** Carry a matrix mapping every responsibility and manifest item to a
proving `AC-n`, and every `AC-n` back to one. A manifest item with no AC is an orphaned obligation; an
AC with no manifest item is invented scope; a responsibility reaching into another story's signal is an
ownership leak — move it to the owning story.

**Negative claims need negative fixtures.** A green happy-path tool exit (`tsc -b`, `pnpm deps`,
`pnpm check`) proves only *acceptance*. Every rejection / fail-fast / degraded / validation-failure AC
names its own failing fixture or artifact.

**Substrate/config variant.** A story whose deliverable is declarative substrate (`tsconfig`,
`package.json`, workspace, dependency rules, CI, linters) must **not** invent a runtime type or token.
Use `Validated artifacts:` (the files / inventories / config shapes it produces) and
`Validation failure modes:` (the invalid shapes it must reject, each with a negative fixture); the
failure table becomes a validation-failure table.

## Gate 4 — authoring-ready

Tick every box; an empty box means not ready.

- [ ] Every `AC-n` is falsifiable, self-contained, one assertion, and traces to design.
- [ ] Spec-surface manifest matches design and keeps distinct types/unions distinct; substrate/config
      stories use `Validated artifacts` + `Validation failure modes`, not invented types.
- [ ] Covers its story-DAG node's signal(s); shared shapes cited by producer story, not redeclared.
- [ ] Internal coverage holds both ways; no responsibility crosses the assigned signal.
- [ ] Failure/degraded (or validation-failure) table present; **each row's cited AC actually asserts
      that row** — not the happy path, not a different condition.
- [ ] Every negative AC has a failing fixture; no green tool exit cited for a rejection.
- [ ] Coverage number + enforcement command + instrumented lane stated, and the command measures the
      claimed helper scope.
- [ ] Required tests catalogued, not exampled.
- [ ] Frozen commands validated against the pinned tool version and stated as a behavior contract, not
      a flag string.
- [ ] Zero unresolved option branches — including choices the design itself leaves open.
- [ ] Cross-story contracts name exact shapes; catalog/invariant tokens cited verbatim.
- [ ] Public exposure: each public SDK shape names its import path (export + barrel + `exports`) and a
      public-import test; or the story states it exposes none.
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
sweep output for any cross-package change; conformance evidence for provider ports/mocks (real-runtime
attestation only for a real driver capability). No manifest item missing; no requirement invented
beyond design.

**Gate 6 — readiness matrix.** An implementation axis moves to `yes` only with cited executable
evidence. Design approval, prose, migrated code, fixtures, or worker self-report justify `partial` only.

**Independent pass.** Run the [shared close-out](README.md#verifying-a-layer): rebuild coverage from the
source artifacts (not the rollup), and have a *different* reader run this gate — quoting the design line
each finding contradicts and labelling story-defect vs design-defect.
