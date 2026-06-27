---
title: "Product layer — status"
status: living — progress + next steps
last-reviewed: "2026-06-27"
---

# Product layer — status

_Branch: `product-layer` (base `v-next`; not pushed, no PR). The product-definition layer for
the `agentic-workflow-kit` suite (product **Jig**). Product is the source of truth; the
`docs/design/` corpus is a **supporting reference**, reconciled to follow — not a co-authority._

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

## Next — the deep per-feature layer (fresh session)

The overviews are the **map**. The next layer is **rigorous per-feature PRDs + a roadmap**, by
**dogfooding the kit's own pipeline**. (Note: the `product-management:*` skills the skill-list
advertises are NOT installed — ignore them; the real, more rigorous method is the
`agentic-workflow-kit` plugin.)

**Pipeline:** `define-product` → (`design-technical-solution` if technically complex) →
`plan-delivery-track` → `implement-next`.

- **`define-product`** → multi-file PRD at `docs/prds/<slug>/`, ~10 sections: 01-context
  (problem / opportunity / thesis / non-goals) · 02-principles · 03-domain-model · 04-roles
  (audience / personas) · **05-phases** (rationale, per-phase goal/scope/exit-bar) ·
  06-quality-bars · **07-success-metrics** (+ anti-metrics) · **08-acceptance-criteria** (ID'd
  ship checklist) · 09-risks · 10-glossary. Covers problem · audience · solution · requirements ·
  metrics · success · phasing.
- **Roadmap** = `plan-delivery-track` → `docs/tracks/<track>/` tracker (Wave columns +
  dependency graph + status vocab) + story briefs citing PRD AC IDs. Phasing lives in both the
  PRD's `05-phases` (product reasoning) and the tracker Waves (delivery slicing).
- **Skill / contract files** (so the next session need not re-investigate):
  `~/.claude/plugins/marketplaces/agentic-workflow-kit/skills/{define-product,design-technical-solution,plan-delivery-track}/SKILL.md`;
  `.../references/{prd,technical-solution,tracker,story-brief}-contract.md`; `.../examples/example-prd/`.

**Three decisions to make before running it:**
1. **Dogfood y/n** — run the kit's own `define-product` to define the kit's own product.
   (Recommended: yes — it's a forcing function on the tool itself.)
2. **Granularity** — one PRD per *product* (a Jig PRD with the five guarantees as `05-phases` +
   `08-AC` groups) vs. one PRD per *guarantee-feature*. Lean: product-level first; split only if
   too big.
3. **Sequencing** — package-first: start with the **Jig** PRD, feeding it `products/jig.md` +
   README as the rich context `define-product` ingests (jig.md's guarantee ACs map almost
   directly into `08-acceptance-criteria`).

**Structure reconciliation:** `docs/product/` = the suite map + source material (keep);
`docs/prds/<feature>/` = the rigorous PRDs (define-product's home); `docs/tracks/` = the roadmap.

## Downstream (separate tracks, not blocking)

- **Design reconciliation** — product now leads; the design corpus reconciles to follow: split
  `fnd-01` (Configuration & Policy); the broader foundation-overfit rework.
- **`kit-vnext` title sweep** — `docs/README.md` frontmatter title still says `kit-vnext`
  (retired as a name); fixing it triggers a tree-wide nav-label regen.
- **Refinement** — branding, diagrams, examples across the product docs (later).
- **Polish** — `define-product.md` uses `PRD-n` as its AC prefix, overloading "PRD" the
  artifact (disambiguated in-doc, but a rename candidate, e.g. `DEF-n`); add the **superpowers**
  URL in the README (currently name-only).

## Commits

On `product-layer` (base `v-next`): see `git log --oneline v-next..product-layer`. In order —
product-first reframe → Jig deep-dive → "Why Jig" → tracks + README v2 → design→plan →
value-proposition re-author → OpenAI link → STATUS → supporting-product overviews. **Not pushed;
no PR opened.**

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](./README.md) · **← Prev:** [Product layer — authoring plan (cross-session playbook)](./authoring-plan.md) · **Next →:** [design corpus overview](../design/README.md)

<!-- /DOCS-NAV -->
