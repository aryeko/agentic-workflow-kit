---
title: "Product layer — status + authoring plan"
status: transient — delete when product ready
last-reviewed: "2026-06-27"
---

# Product layer — status + authoring plan

_The product-definition layer for the `agentic-workflow-kit` suite (product **Jig**).
Scaffolding tier MERGED to `v-next` via PR [#177](https://github.com/aryeko/agentic-workflow-kit/pull/177)
(commit `a33c3a2`). Product is the source of truth; the `docs/design/` corpus is a
**supporting reference**, reconciled to follow — not a co-authority._

---

## State — high-level scaffolding COMPLETE

The product layer's high-level scaffolding is done. This session deliberately stopped here
(scaffolding only); the deep per-feature layer is a fresh session's job (see **Next**).

- **Product-first reframe** — product = source of truth; design = supporting reference.
- **README (the product definition)** — who/why; the *"single-session discipline, generalized
  to scale"* value proposition (corroborated by the Codex, Claude, and OpenAI *Harness
  engineering* guides + superpowers); the suite map; principles (policy-not-posture,
  enforce-vs-guide, tracks pointer).
- **All five product overviews** — product altitude, each: `Why <product>` → ID'd
  responsibilities/guarantees → per-track → honest edges → cross-links:
  - `jig.md` — the package; five guarantees (① control & trust · ② you own the
    configuration · ③ never lose work, resume safely · ④ runs against your stack · ⑤ see
    everything) + "Why Jig". AC prefixes: FENCE/EARN/GUARD/DOOR/MERGE/CFG/RESUME/ISO/STACK/SEE.
  - `supporting-products/design-to-plan.md` — producer responsibilities + the evidence thread.
    Prefixes: PLAN/DAG/AC/PROF/GEN.
  - `supporting-products/product-to-design.md` — PTD-\*.
  - `supporting-products/define-product.md` — PRD-\* (the first stage; the evidence thread
    starts here).
  - `supporting-products/learning-loop.md` — LOOP-\* (separate, suite-level, between-runs).
- **`concepts.md`** — the parallel independent-track model.

```
docs/product/
  README.md             # product definition + suite map + principles
  status.md             # this file (handoff + authoring plan — transient)
  jig.md                # main product overview
  supporting-products/  # design-to-plan · product-to-design · define-product · learning-loop
  concepts.md           # tracks
```

## Finalization plan — from scaffolding to finished product docs

The overviews are the **map**. Finalizing = **rigorous per-feature PRDs + a suite roadmap + a
design reconciliation**, produced by **dogfooding the kit's own pipeline**.

> **Roadmap ≠ tracker — keep them separate.** A **roadmap** is a *product* artifact: a
> suite-level, outcome-focused **Now / Next / Later** view (strategic themes, outcome
> statements, success metrics, flexible windows). It is part of finalizing the product docs
> (Phase 3, lives in `docs/product/`). A **tracker** (`plan-delivery-track` → `docs/tracks/`)
> is a *delivery* artifact: Waves, story decomposition, AC-ID linkage — that is the start of
> **execution**, downstream of the product docs, not a product doc itself (see _Downstream_).

> **Engine is ready (was stale here).** Earlier notes implied the PRD engine still had to be
> built. It does **not** — the installed plugin `agentic-workflow-kit@0.7.0` ships the complete
> pipeline, verified 2026-06-27: `define-product`, `design-technical-solution`,
> `plan-delivery-track`, `implement-next` skills, plus `references/prd-contract.md`, the full
> `references/templates/prd/{README,01..10}`, a populated worked example
> `examples/example-prd/` (ID'd `PREFIX-n` ACs tagged `[ship blocker]`/`[target]`), and the
> tracker / story-brief contracts + example-tracker. Use `/define-product` and
> `/plan-delivery-track` directly. (The `product-management:*` skills the skill-list advertises
> are a different, shallower marketplace — ignore them.) The canonical files live in the
> install cache, not the marketplace symlink:
> `~/.claude/plugins/cache/agentic-workflow-kit/agentic-workflow-kit/0.7.0/{references,examples}/`.

**Critique gate (adopted):** the kit's `define-product` stays the PRD **engine**; we add
**`/red-team-prd`** (from the `pm-execution` plugin in the popular `phuryn/pm-skills`
marketplace) as an **adversarial gate** — it attacks each load-bearing assumption, ranks by
impact × likelihood × cheapest-to-test, and returns the cheapest test to kill a bad bet. It
runs *on* a drafted PRD regardless of format, so it composes with our pipeline rather than
replacing it. The same red-team is reused to attack the design in reconciliation (Phase 4).
We also adopt pm-skills **`outcome-roadmap`** (`/transform-roadmap`) for the suite roadmap
(Phase 3). Do **not** adopt pm-skills' own `create-prd` (shallower than our 10-section ID'd-AC
format) — `define-product` stays the PRD engine.

### Target structure (decided 2026-06-27)

Modeled on the `on-class-web/docs/product` **platform-console pattern**: each product gets an
**orientation doc** + a per-product **PRD folder**. The filesystem mirrors the suite hierarchy:
**Jig (the package / main product) sits at top level**; the four **supporting products** (the
authoring pipeline + the learning loop) group under `supporting-products/`.

```
docs/product/
  README.md            # value prop + suite map + principles + "orient here, requirements in prds/"
  positioning.md       # market thesis / competitive stance (extracted from README)  [Phase 5]
  jig.md               # the package (main product) — top-level orientation doc
  supporting-products/ # authoring pipeline + learning loop
    design-to-plan.md
    product-to-design.md
    define-product.md
    learning-loop.md   # suite-level/between-runs — grouped here, not a pipeline stage
  concepts.md          # tracks (+ future cross-cutting); was concepts/tracks.md
  roadmap.md           # suite roadmap — outcome Now/Next/Later  [Phase 3 — authored late]
  status.md            # transient — merges old STATUS + authoring-plan; DELETE when product ready
  prds/                # rigorous PRDs — define-product output  [Phase 1 — TODO]
    README.md          # PRD index — FLAT & uniform (no jig/supporting split)
    jig/               README.md · 01-context … 10-glossary  (08 = ID'd ACs; 05-phases/ as a dir if large)
    design-to-plan/      "
    product-to-design/   "
    define-product/      "  (dogfood subtlety: the skill writes its own PRD)
    learning-loop/       "

docs/design/           # supporting reference — reconciled to follow  [Phase 4 — TODO]

# ── execution layer, downstream of "product docs done" — NOT a product doc ──
docs/tracks/           # delivery trackers — plan-delivery-track output  [Downstream]
  <track>/README.md      tracker: Wave columns + dependency graph + status vocab
  <track>/stories/<ID>.md  briefs citing PRD AC IDs
```

`prds/` stays **flat and uniform** (one folder per product, no jig-vs-supporting split):
`define-product` writes to `<prdsDir>/<slug>/` flat, and uniform PRD paths avoid config
friction. The package-vs-supporting hierarchy lives in the orientation layer + README only.

**Per-product overview vs PRD (don't let them drift):** the orientation doc answers *what /
who / why at a glance* and (post-ship) *what it does today*; the PRD owns *requirements / why /
phasing / ACs*. Requirement detail lives only in the PRD. Pre-ship the overview is lean
orientation; it grows into an on-class-style current-state narrative as the product ships.

**Naming convention** (from on-class): only `README.md` is capitalized; everything else is
lowercase (`positioning.md`, `roadmap.md`, `concepts.md`, `status.md`, per-product docs).

### Restructure steps (Phase 0b — executed 2026-06-27)

1. Re-home overviews: `products/jig.md` → `docs/product/jig.md` (top level); the four
   supporting `products/*.md` → `docs/product/supporting-products/` (drop the `products/` folder).
2. `concepts/tracks.md` → `docs/product/concepts.md` (drop the `concepts/` folder).
3. Merge `STATUS.md` + `authoring-plan.md` → one transient `docs/product/status.md`.
4. Extract the market-thesis / value-prop out of `README.md` → `positioning.md` (Phase 5).
~~5. Add `.workflow/config.yaml`~~ — **DISCARDED.** No config file. The `define-product`
   default writes PRDs to `docs/prds/`; instead of a config, each phase description that
   calls `/define-product` explicitly specifies the PRD output path (`docs/product/prds/`).
   See Phase 1a.
6. Create `docs/product/prds/README.md` as the PRD index as the first PRD lands.
7. Run the docs-nav generator + gate after the moves (relative links / nav will shift).

### Phases, dependencies, and what can parallelize

| Phase | Work | Depends on | Parallelism |
| --- | --- | --- | --- |
| **0 · Engine** | Pipeline + contracts + example shipped in plugin 0.7.0 | — | **DONE / verified** |
| **0b · Restructure** | Mechanical layout move (see _Restructure steps_ above): re-home overviews (`jig.md` top-level + `supporting-products/`), `concepts.md`, merge `status.md` (no `.workflow/config.yaml` — discarded; path passed explicitly in Phase 1a); re-run nav + gate | — | **DONE 2026-06-27** |
| **1a · Jig PRD** | `/define-product jig` from `jig.md` + README as rich context (guarantee ACs map almost 1:1 into `08-acceptance-criteria`). **Output path: explicitly pass `docs/product/prds/jig/`** — no `.workflow/config`; default writes to `docs/prds/` | 0, 0b (PRD location) | anchor — run first, alone |
| **1b · Supporting PRDs** | `/define-product` for `design-to-plan`, `product-to-design`, `define-product`, `learning-loop`. **Output path: pass `docs/product/prds/<slug>/` for each product** — no `.workflow/config` | 1a (shared vocab/anchor) | **4-way parallel** after Jig |
| **2 · Red-team gate** | `/red-team-prd` per PRD; fold the kill-tests/fixes back in before marking the PRD `approved` | each PRD's draft | **per-PRD pipeline** — gate fires as each PRD drafts, no barrier |
| **2b · Orientation rewrite** | After each PRD is approved, rewrite that product's overview (`jig.md` / `supporting-products/<slug>.md`) from "source dump" into a **lean orientation doc** (what/who/why at a glance + link to the PRD). **Not done by `define-product`** — it only reads the overview as input and writes the PRD; the orientation doc is ours to maintain. Pre-ship = orientation; grows into on-class "what it does today" as the product ships | that product's PRD `approved` (Phase 2) | **per-product**, trails each PRD |
| **3 · Suite roadmap** | One outcome-focused **Now/Next/Later** roadmap across the suite via pm-skills `outcome-roadmap` (`/transform-roadmap`), fed by the PRDs' `05-phases` + `07-success-metrics` → `docs/product/roadmap.md` | **all** PRDs `approved` (Phase 2) | single suite-level artifact (not parallel) |
| **4 · Design reconciliation (red-team to attack)** | Diff each final PRD against `docs/design/`; where product diverges, **red-team the design's assumptions** (reuse `/red-team-prd` aimed at the design), then reconcile design to follow. Known items: split `fnd-01` (Configuration & Policy); broader foundation-overfit rework | the relevant PRD final (Phase 2) | **per-domain parallel**; independent of Phase 3 |
| **5 · Polish** | README positioning sharpen; glossary/ID consistency across PRDs; `kit-vnext → agentic-workflow-kit` rename sweep (`docs/research/`, `docs/roadmap.md`, …); rename `define-product` AC prefix `PRD-n → DEF-n` (overloads "PRD") | mostly independent | **fully parallel**; do last |

**Critical path:** P0 (done) → Jig PRD → its red-team → rewrite Jig's orientation doc → reconcile
Jig's design slice. Each product's flow is the same chain (PRD → red-team → orientation rewrite),
and the four supporting products (1b) run that chain concurrently off the anchor. The suite
roadmap (3) is a barrier — it waits for all PRDs approved, then is authored once. Phase 4 (design
reconciliation) hangs off each PRD final and runs **per-domain in parallel**, independent of the
roadmap. Phase 5 is independent and lands last. Bulk of effort = the five PRDs (Phases 1–2).

**Granularity decision (settled):** one PRD per *product* (Jig's five guarantees become `05-phases`
+ `08-AC` groups), not one PRD per guarantee-feature. Split only if a single PRD grows unwieldy.

**Scope note:** Phases 1–3 + 5 finalize the **product docs** (PRDs + suite roadmap + polish).
Phase 4 (design reconciliation) is included per request but is the heaviest, most downstream step
— it can trail behind a "product docs done" milestone if we want to cut a checkpoint there. The
**delivery tracker** (`plan-delivery-track` → `docs/tracks/`) is _execution_, downstream of all of
this — listed under _Downstream_, not part of finalizing the product docs.

## Downstream — execution layer (after product docs)

- **Delivery tracker** — `plan-delivery-track` → `docs/tracks/<track>/` (Waves + dependency
  graph + status vocab + story briefs citing PRD AC IDs), then `implement-next`. This is the
  start of **execution**, not a product doc; it consumes the finalized PRDs. Trackers can be
  authored per track in parallel once their PRD is approved, but they sit downstream of the
  "product docs done" milestone above.

## Commits

On `docs/product-finalize-plan` (base `v-next`): Phase 0b restructure committed 2026-06-27
(re-home overviews, merge status+authoring-plan, discard .workflow/config).

---

## Authoring plan (cross-session playbook)

_Merged from `authoring-plan.md` (2026-06-27). Update this section going forward; the
source file has been deleted._

### Where we are

- **Product named: Jig.** CLI `jig`; package `@agentic-workflow-kit/jig`;
  `agentic-workflow-kit` is the suite/org umbrella. "kit-vnext" is retired as a name (it is
  only a milestone/branch/tag).
- **Branch `docs/product-finalize-plan`**, in a worktree off `v-next`. Scaffolding PR #177
  merged. Phase 0b (restructure) complete.
- **Authored so far:** the product definition, tracks concept, and five product-level overviews.
  This is still high-level scaffolding, not the rigorous per-feature PRD layer.

### Decisions (and the reasoning)

1. **Product leads; design follows.** v-next was built design-first and skipped the product
   layer; this corpus answers _for whom_ and _why_ and is the source of truth for the product.
   The `docs/design/` corpus is a **supporting engineering reference**, not a co-authority:
   where the product diverges from it, the design is reconciled to follow — a deliberate
   downstream step, not gratuitous churn. Engineering decisions the product doesn't touch
   (invariants, seams, event types, package map) stay put.
2. **Jig = the product; `agentic-workflow-kit` = the suite umbrella.** A scoped package
   (`@agentic-workflow-kit/jig`) with a bare CLI (`jig`) mirrors the owner's `ghx` convention
   (`@ghx-dev/core` → CLI `ghx`).
3. **A suite, not a monolith.** Main product = the package (Jig). Supporting products
   (optional, encode the author's best practice, each produces a durable structured artifact,
   all overridable): define-product → product→design → design→plan. Plus a learning loop
   (separate, suite-level; stays out of the package's per-run hot path; can harden any layer
   between runs). Reason for "optional": the author shares a strong default, not a claim to be
   the best PM/architect/planner.
4. **Principle: humans own the direction; agents execute.** The human defines product and
   design _up front_, so the agent never executes a direction the human didn't choose —
   direction-_ownership_, not reactive correction.
5. **Policy, not posture.** How aggressively to gate / what to block on is declarative policy,
   not a fixed stance. The package supports the spectrum directly (throughput-leaning ↔
   prevention-leaning, with a middle). The configurable range is the product.
6. **OpenAI is corroboration, never a foil.** The owner learned a lot from OpenAI's _Harness
   engineering_ work; cite their articles as independent validation and as a different
   (high-throughput) design point. **Never frame the product as "OpenAI does it wrong."**
   State every principle positively, on its own terms.
7. **Honesty over hype.** No overclaiming: the promise is bounded by input quality; the
   upstream products + learning loop are methodology-dependent (not plug-and-play across the
   spectrum — that's an explicit deep-dive, not a promise); "done" rests on evidence.
8. **Define fully first; do not scope/phase yet.** Get all product requirements in front of
   us before phasing. Phases (including deferrable parts of the package, e.g. a Claude agent
   adapter) are planned _after_ requirements exist.
9. **Credibility leads with the author's own evidence** — years of iteration, the full
   workflow shipped as v0.7.0, dogfooded today — with OpenAI as corroboration.

### Steps to follow (across sessions)

1. **(done)** Brainstorm + capture the product definition → [README.md](README.md).
2. **(done)** Scaffold per-product overviews; add playbook.
3. **(done — Phase 0b)** Restructure layout into target structure.
4. **(next) Dogfood `define-product` on Jig first.** Use [jig.md](jig.md) and
   [README.md](README.md) as source material to produce the rigorous Jig PRD. **Output to
   `docs/product/prds/jig/`** — pass path explicitly (no `.workflow/config`; default writes
   to `docs/prds/`). That PRD should pin down the execution-plan input schema seam, policy
   presets, and deferrable drivers at product-requirements depth.
5. **Then the supporting products by priority** — `design→plan` next (it produces the
   package's input), then `product→design`, then `define-product`, then the `learning-loop` —
   each via the same `define-product` dogfood pipeline. **Output to `docs/product/prds/<slug>/`**
   — pass path explicitly. Land each PRD under `docs/product/prds/<slug>/`.
6. **Separately, a mechanical rename pass** later: replace `kit-vnext`-as-a-name across the
   repo (~312 files) once positioning is locked. Distinct from this authoring work.
7. **Plan phases** only once the product requirements above exist.

### Working conventions / guardrails

- **Worktree discipline.** Work in `.worktrees/product-finalize-plan` (branch
  `docs/product-finalize-plan`) off `v-next`; never edit the main checkout; confirm
  `git rev-parse --show-toplevel` before any write/commit/push. Never push to `v-next`; when
  we PR, base = `v-next`.
- **Verify gate.** `docs:nav:check` covers `docs/product/` (nav footers are generated — run
  `pnpm docs:nav`, never hand-edit them). Run `pnpm check` before a PR.
- **Tooling for the work.** Use `agentic-workflow-kit:define-product` for PRD authoring.
  **Pass the PRD output path explicitly** (e.g. `docs/product/prds/jig/`) — no `.workflow/config`.

### Reference map

- [README.md](README.md) — the product definition (problem, audience, principle, policy
  spectrum, the suite, credibility, sequencing).
- [`jig.md`](jig.md) — main product overview.
- [`supporting-products/`](supporting-products/) — per-supporting-product overviews.
- `docs/design/` — the package's frozen engineering design (the "execute ring").
- `docs/research/agent-harness-lessons/` — corroborating research (incl. OpenAI Harness
  engineering).
- `docs/implementation-authoring/` (+ `lessons-ledger.md`) — the code-authoring method and
  the defect-class ledger that the learning loop generalizes.
- `main` (v0.7.0) — prior art: the full four-stage workflow already shipped once.
- Memory: `kit-vnext-product-layer-and-jig.md`.

### Open questions

- The **execution-plan input schema** (the package ↔ design→plan seam) — define during the
  package deep-dive.
- How load-bearing the **design** accelerator is (optional vs. more central).
- **Spectrum generalization** of the upstream products + learning loop — a deep-dive when we
  reach those products, not claimed now.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](./README.md) · **← Prev:** [Learning loop (supporting product)](./supporting-products/learning-loop.md) · **Next →:** [design corpus overview](../design/README.md)

<!-- /DOCS-NAV -->
