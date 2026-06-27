---
title: "Product layer — status"
status: living — progress + next steps
last-reviewed: "2026-06-27"
---

# Product layer — status

_The product-definition layer for the `agentic-workflow-kit` suite (product **Jig**).
Scaffolding tier MERGED to `v-next` via PR [#177](https://github.com/aryeko/agentic-workflow-kit/pull/177)
(commit `a33c3a2`). Product is the source of truth; the `docs/design/` corpus is a
**supporting reference**, reconciled to follow — not a co-authority._

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
  - `products/jig.md` — the package; five guarantees (① control & trust · ② you own the
    configuration · ③ never lose work, resume safely · ④ runs against your stack · ⑤ see
    everything) + "Why Jig". AC prefixes: FENCE/EARN/GUARD/DOOR/MERGE/CFG/RESUME/ISO/STACK/SEE.
  - `products/design-to-plan.md` — producer responsibilities + the evidence thread. Prefixes:
    PLAN/DAG/AC/PROF/GEN.
  - `products/product-to-design.md` — PTD-\*.
  - `products/define-product.md` — PRD-\* (the first stage; the evidence thread starts here).
  - `products/learning-loop.md` — LOOP-\* (separate, suite-level, between-runs).
- **`concepts/tracks.md`** — the parallel independent-track model.

```
docs/product/
  README.md          # product definition + suite map + principles
  STATUS.md          # this file (handoff)
  authoring-plan.md  # cross-session authoring playbook
  products/          # jig · design-to-plan · product-to-design · define-product · learning-loop  [all done]
  concepts/          # tracks  [done]
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

### Restructure steps (Phase 0b — mechanical, not yet executed)

A real move from today's layout; recorded here, executed in a later pass:

1. Re-home overviews: `products/jig.md` → `docs/product/jig.md` (top level); the four
   supporting `products/*.md` → `docs/product/supporting-products/` (drop the `products/` folder).
2. `concepts/tracks.md` → `docs/product/concepts.md` (drop the `concepts/` folder).
3. Merge `STATUS.md` + `authoring-plan.md` → one transient `docs/product/status.md`.
4. Extract the market-thesis / value-prop out of `README.md` → `positioning.md` (Phase 5).
5. Add `.workflow/config.yaml` with `paths.prdsDir: docs/product/prds` — **required** so
   `define-product` writes PRDs under `docs/product/prds/` (default is `docs/prds`). No
   `.workflow/config.yaml` exists yet.
6. Create `docs/product/prds/README.md` as the PRD index as the first PRD lands.
7. Run the docs-nav generator + gate after the moves (relative links / nav will shift).

### Phases, dependencies, and what can parallelize

| Phase | Work | Depends on | Parallelism |
| --- | --- | --- | --- |
| **0 · Engine** | Pipeline + contracts + example shipped in plugin 0.7.0 | — | **DONE / verified** |
| **0b · Restructure** | Mechanical layout move (see _Restructure steps_ above): re-home overviews (`jig.md` top-level + `supporting-products/`), `concepts.md`, merge `status.md`, `.workflow/config.yaml` `paths.prdsDir`, `prds/README.md`; re-run nav + gate | — | **once, up front** (unblocks PRD location) |
| **1a · Jig PRD** | `/define-product jig` from `jig.md` + README as rich context (guarantee ACs map almost 1:1 into `08-acceptance-criteria`) | 0, 0b (PRD location) | anchor — run first, alone |
| **1b · Supporting PRDs** | `/define-product` for `design-to-plan`, `product-to-design`, `define-product`, `learning-loop` | 1a (shared vocab/anchor) | **4-way parallel** after Jig |
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

On `product-layer` (base `v-next`): see `git log --oneline v-next..product-layer`. In order —
product-first reframe → Jig deep-dive → "Why Jig" → tracks + README v2 → design→plan →
value-proposition re-author → OpenAI link → STATUS → supporting-product overviews. PR #177 **merged** to `v-next` (`a33c3a2`).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](./README.md) · **← Prev:** [Product layer — authoring plan (cross-session playbook)](./authoring-plan.md) · **Next →:** [design corpus overview](../design/README.md)

<!-- /DOCS-NAV -->
