# 01 — Product Layer Read (R01-PRODUCT-LAYER-READ)

## 1. Summary

The current jig PRD work is mostly coherent in scope: the suite is positioned as a product layer above the existing engineering design, with `docs/product/README.md` stating product ownership and `docs/product/jig.md` defining five promises for the base product. The read shows a substantial move from pure orientation toward requirements-grade detail in `docs/product/prds/jig/*`, now carrying a full AC set and target phasing.

However, several sections now blur the boundary between *product intent* and *design/implementation detail*. The strongest complexity pattern is “contract-by-rows” expansion: detailed behavior (especially risk classification, protected-file policy, fault-resume interactions, and event fields) is now mostly encoded in acceptance-criterion tables in `docs/product/prds/jig/08-acceptance-criteria.md` rather than confined to a higher-level requirement statement.

Observed from `git diff --name-status v-next...HEAD -- docs/product`, this branch changes
14 product files: `docs/product/README.md` and `docs/product/status.md` are modified, and
the new `docs/product/prds/**` tree is added. The review also treats existing product
orientation files (`docs/product/jig.md`, `docs/product/concepts.md`, and
`docs/product/supporting-products/*`) plus the untracked `docs/product/jig.candidate.md` as
source material, but those orientation/supporting files are not changed by this branch diff.
The candidate is useful input, not a product-layer page; R06 resolves it as a local-only
source outside `docs/product/`.

## 2. Product Intent

### What is currently clear

- Source-of-truth stance is explicit: product intent is separate from engineering design and should drive reconciliation when they diverge (`docs/product/README.md`, `docs/product/status.md`, `docs/product/jig.md`).
- Upstream/downstream boundaries are defined at product level (`execution plan` is the only hard input boundary for this suite layer) in `docs/product/README.md` and reiterated in `docs/product/README.md` workflow map and in `docs/product/prds/jig/01-context.md`.
- The suite intent remains user-owned control with policy-driven behavior, not AI-driven direction (`docs/product/README.md`, `docs/product/README.md`, `docs/product/jig.md`, `docs/product/prds/jig/02-principles.md`).
- Supporting-product intent is still framed as optional, enabling products: define-product, product→design, design→plan, and learning-loop (`docs/product/README.md`, `docs/product/supporting-products/define-product.md`, `docs/product/supporting-products/product-to-design.md`, `docs/product/supporting-products/design-to-plan.md`, `docs/product/supporting-products/learning-loop.md`).

### Intent vs. implementation boundaries

- **Product-level intent present**: Why each product exists, who owns what, and what decision points are at human level are written at orientation depth in `docs/product/README.md`, `docs/product/jig.md`, and `docs/product/supporting-products/*`.
- **Product-level requirements present**: the Jig PRD (especially `docs/product/prds/jig/01-context.md`, `docs/product/prds/jig/02-principles.md`, and `docs/product/prds/jig/05-phases.md`) captures non-functional and phased commitments.
- **Boundary leakage appears where design assumptions enter as product acceptance language**: in the PRD tables some requirements read like implementation contracts for a near-final architecture rather than invariants the design must support.

## 3. Current Product Doc Inventory

### Core product layer

- `docs/product/README.md` — suite intent, contracts framing, product/design relationship, anti-hype policy.
- `docs/product/jig.md` — main product overview with five promise areas and control-vs-guide framing.
- `docs/product/concepts.md` — tracks model and per-track policy/profile scoping.
- `docs/product/status.md` — transitional execution plan for this authoring wave (scaffolding complete, next phases, downstream tracker handoff).

### Supporting products

- `docs/product/supporting-products/design-to-plan.md` — producer contract and evidence-thread responsibilities.
- `docs/product/supporting-products/product-to-design.md` — design artifact production contract.
- `docs/product/supporting-products/define-product.md` — PRD creation contract and evidence-thread start.
- `docs/product/supporting-products/learning-loop.md` — suite-level between-runs hardening contract.

### PRD index and Jig PRD set

- `docs/product/prds/README.md` — PRD catalog index and structure (`jig/` plus section map).
- `docs/product/prds/jig/README.md` — PRD ownership/delegation map to design and delivery.
- `docs/product/prds/jig/01-context.md` through `10-glossary.md` — full PRD content, including problems, principles, phases, risks, quality bars, ACs, and terminology.
- `docs/product/jig.candidate.md` (untracked in this worktree at read time) — prior candidate orientation/implementation sketch used as source input; includes sequencing and product promises; should be mined as local-only source, not left as a parallel product page.

### Diff signal against `v-next`

- The branch diff itself is concentrated: `docs/product/README.md` and
  `docs/product/status.md` were modified, while the new `docs/product/prds/*` subtree was
  added. Existing orientation/supporting docs were reviewed as context, not changed by this
  branch.

## 4. Complexity and Design-Bias Symptoms

1. **Overloaded acceptance criteria with low-level operational semantics**
   - `docs/product/prds/jig/08-acceptance-criteria.md` includes very narrow behavior-level criteria (e.g., explicit risk-tier lists with concrete examples, explicit protected-file inference categories, scoped escalation behavior, concurrency derivation, and event export shape expectations).
   - This is defensible as rigor, but it resembles specification of a specific implementation surface, not just “what must be true.”

2. **Design-seeming behavior is asserted as mandatory product floor**
   - `docs/product/prds/jig/04-roles.md`, `docs/product/prds/jig/03-domain-model.md`, and `docs/product/prds/jig/06-quality-bars.md` repeatedly describe structures and invariants at a precision that belongs more naturally to design contracts than a first-pass product promise.
   - The product docs currently act as both requirements doc and partial interface contract.

3. **Status artifact has been used as process log + runbook**
   - `docs/product/status.md` now contains implementation-adjacent decisions (exact branch names/PR references, plugin provenance details, install-cache paths, specific follow-on tools) mixed into the canonical suite-contract narrative.
   - This increases maintenance burden and introduces stale-process coupling in a file intended as status + intent.

4. **Candidate-to-final alignment drift**
   - `docs/product/jig.candidate.md` is materially simpler in structure and does not include the same density of implementation-leaning criteria.
   - The current final write is materially more opinionated and prescriptive than the candidate baseline while still carrying “orientation” positioning; this is likely where design bias crept in.

5. **Cross-layer language already assumes design details**
   - Multiple places in `docs/product/README.md` and `docs/product/jig.md` reference specific behavior of seams/severity/prescriptions in ways that require design interpretation (`event log` + `single source of truth`, exact driver sequencing, anti-gaming mechanisms), without always separating “must-prove by product” vs “how to satisfy in implementation.”

6. **Complexity asymmetry across products**
   - Supporting-product docs are mostly concise, while Jig PRD has dense AC tables and long operationalized edge cases (`docs/product/prds/jig/08-acceptance-criteria.md`, `docs/product/prds/jig/09-risks-and-open-questions.md`).
   - This makes Jig look substantially more “done” than others before corresponding design/design-reconciliation pass.

## 5. Disposition Notes

This first read identified keep/drop/move candidates, but the canonical migration table now
lives in `06-final-synthesis.md`. Use that report for implementation. The high-signal
notes from this read are:

- Keep suite framing, product promise language, product-visible workflow, and honest
  success/counter-signal language.
- Mine `docs/product/jig.candidate.md` and the PRD tree only as sources; neither should
  define the new document structure.
- Move implementation-facing mechanism choices out of product tables: exact hook return
  tokens, concurrency math, timing targets, protected-file defaults, event/export fields,
  and schema-level story requirements.
- Move process history from `docs/product/status.md` into review/workstream artifacts.

## 6. Open Product Questions

1. Should `docs/product/prds/jig/08-acceptance-criteria.md` remain a near-spec-level acceptance contract, or be split into:
   - intent-level ACs for PRD consumers, and
   - design-implementation conformance checks in design docs?

2. Which current low-level requirements are mandatory product floors vs non-negotiable implementation defaults?
   - Current candidates: protected-file inference semantics, concrete risk-tier table, exact hook return actions, and strict event-log categories (`docs/product/prds/jig/08-acceptance-criteria.md`, `docs/product/prds/jig/06-quality-bars.md`).

3. What is the intended lifecycle for `docs/product/status.md` once scaffolding completes?
   - It currently reads as both historical plan and runtime status and may become stale quickly.

4. How should consistency checks handle `docs/product/jig.candidate.md`?
   - Resolved in R06: treat it as local-only source outside `docs/product/`, then delete it after mining unless an explicit archive is requested.

5. Where is the explicit “line split” between source-of-truth product intent and design-only details now enforced?
   - Current docs rely on `docs/product/README.md` statements about reconciliation, but many detailed requirements are embedded directly in PRD ACs with no explicit routing to design conformance sections.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig product layer rebuild review](./README.md) · **← Prev:** [Jig product feature-gap analysis (design → product)](../2026-06-30-jig-product-feature-gap-analysis.md) · **Next →:** [Report 2 — Design-Reference Behaviors for JIG Rebuild](./02-design-reference-behaviors.md)

<!-- /DOCS-NAV -->
