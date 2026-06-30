# 04 - Rebuild Recommendation (R04-REBUILD-RECOMMENDATION)

## 1. Summary Recommendation

Do not make the new 10-file Jig PRD tree the canonical product layer. It is useful source material, but its current shape is too large, too acceptance-contract-heavy, and too biased toward the existing design corpus. The product layer should be rebuilt as a simpler, product-only Jig narrative, with a value-proposition / jobs-to-be-done pass as the spine for the next `docs/product/jig.md`.

**Claim R04-A - Product altitude is the contract.** The product layer should own audience, problem, promise, workflow, guarantees, product boundaries, success signals, and open product questions. It should not own protocol-level acceptance criteria, driver specifics, exact schema mechanics, phase exit bars, protected-file semantics, or implementation sequencing.

**Claim R04-B - Simpler is higher quality here.** The branch does not suffer from missing rigor; it suffers from misplaced rigor. The current PRD tree turns product intent into a dense conformance/specification surface. That creates a false sense that product questions are settled when several details are really design, roadmap, or planning decisions.

**Claim R04-C - Mine sources; do not seed from them.** `docs/product/jig.candidate.md` has useful language around what Jig is, why it exists, the five guarantees, policy/configuration, recovery, stack seams, event log, and personas. The PRD tree also has useful raw material. Neither should become the structural seed. The rewrite should start from the user, job, current alternative, before/after state, non-fit, success signal, and counter-signal.

The recommended end state is: one canonical Jig product doc at `docs/product/jig.md`, supported by the suite overview in `docs/product/README.md`, with design and delivery detail routed back to `docs/design/`, `docs/roadmap.md`, future trackers, or review artifacts as appropriate.

## 2. Current Branch Disposition

The branch changes `docs/product/README.md` and `docs/product/status.md`, and adds the full `docs/product/prds/` tree: 14 product files and about 964 added lines relative to `v-next`. `docs/product/jig.candidate.md` is untracked source material, not a product page.

This report intentionally does not carry the canonical keep/drop/move matrix. Use
`06-final-synthesis.md` as the single migration table and implementation handoff. The
disposition principles are:

- Keep one canonical product destination: `docs/product/jig.md`.
- Mine the candidate and PRD tree for product language; do not preserve either structure.
- Move mechanism-bearing ACs and exact operational rules to design, roadmap, or planning
  only after their traceable commitment has a named destination.
- Treat `jig.candidate.md` as local-only source outside `docs/product/`, so docs
  navigation cannot publish it as a parallel product page.

## 3. Target Product Layer Shape

Target shape for Jig should be small and authoritative:

| File | Ownership |
|---|---|
| `docs/product/README.md` | Suite-level product definition: audience, why the suite exists, product map, workflow, authority boundary between product and design |
| `docs/product/jig.md` | Canonical Jig product doc: who it serves, job to be done, problem, promise, workflow, guarantees, boundaries, success signals, open product questions |
| `docs/product/concepts.md` | Cross-product product concepts such as tracks, only where users need them |
| `docs/product/supporting-products/*.md` | Concise supporting-product overviews, kept at the same product altitude |
| `docs/product/status.md` | Transient workstream note only; delete or archive when the product layer is stable |

`docs/product/jig.md` should be the product contract senior implementers read before design reconciliation. It should explain what must be true for the user and why. It should not describe how event fields are shaped, which files count as protected, how a probe proves a capability, which driver ships in which exact lane, or what a delivery tracker must map.

Suggested `jig.md` outline:

1. Audience and job: who uses Jig and what they hire it to do.
2. Problem: long-running agentic delivery breaks at control, trust, recovery, and integration points.
3. Promise: own the direction; delegate execution under policy, evidence, recovery, and supervision.
4. Workflow: execution plan + policy in, run evidence + branch/PR/merge or deliberate stop out.
5. Guarantees: control/trust, configuration ownership, safe recovery, stack portability, observability.
6. Product boundaries: what Jig does, what upstream products do, what design owns, what the learning loop owns.
7. Success signals and counter-signals.
8. Open product questions.

## 4. Migration Principle

Use `06-final-synthesis.md` as the canonical keep/drop/move table. This report's migration
principle is narrower: the product layer should keep outcomes and trust promises, while
mechanism detail moves to the layer that can validate it.

Examples:

- Keep "Jig will not quietly change the rules it runs under" in product.
- Move protected-file classification, glob semantics, and re-approval event shape to
  design/policy specs.
- Keep "a run is reconstructible" in product.
- Move event schema fields, export shape, and migration rules to design/observability
  specs.
- Keep "works with the user's stack" in product.
- Move driver lists, capability probe mechanics, and adapter phase sequencing to design or
  roadmap.

## 5. Rewrite Rules For Product Altitude

1. Write for the owner/operator first: what decision they make, what confidence they gain, what failure they avoid.
2. Prefer outcome language over mechanism language: "a run is reconstructible" instead of "event type X includes fields Y and Z."
3. State invariants only when they are product-visible trust boundaries: worker lacks merge authority, unsafe ambiguity parks, policy governs irreversible action.
4. Keep one authoritative definition per concept. If design owns a shape, product names the need and links or points downstream.
5. Use examples sparingly to clarify a promise, not to enumerate implementation defaults.
6. Treat phases as product direction, not delivery law. Product can say "core loop first, driver breadth later"; planning owns exact phase gates.
7. Keep open questions alive. Do not turn unresolved product assumptions into ship-blocking acceptance criteria.
8. Fail closed in wording too: if a rule needs information not present at product altitude, move it to the layer that has the operands.

## 6. Suggested Implementation Handoff

Implementation agent instructions:

1. Treat `jig.candidate.md` as local-only source outside `docs/product/`.
2. Rewrite `docs/product/jig.md` from the value-proposition / jobs-to-be-done spine in
   `06-final-synthesis.md`, using the outline in section 3.
3. Read the candidate and current PRD tree only as source material to mine product-language
   improvements. Do not copy either structure.
4. Collapse/remove `docs/product/prds/` from the canonical product navigation unless the product owner explicitly requests a separate archive.
5. Update `docs/product/README.md` so it points to `docs/product/jig.md` as the canonical Jig product layer, not to a PRD subtree.
6. Rewrite or delete `docs/product/status.md` so it no longer declares the 10-file PRD tree as the target shape.
7. If specific ACs are still needed for delivery, create them later in design/planning artifacts that cite the product doc, rather than redefining the product in table form.
8. Run docs navigation/check gates after the implementation pass.

Acceptance bar for the rewrite:

- A reader can explain Jig's audience, promise, workflow, boundaries, and five guarantees after reading one product doc.
- No product doc defines exact event fields, hook return values, driver probe mechanics, protected-file glob membership, or phase exit demonstrations.
- Product/design ownership is explicit: product says what must be true and why; design owns how contracts satisfy it.
- The new product layer is shorter, easier to maintain, and does not require the existing design to be accepted as product truth.

## 7. Risks If We Do Not Simplify

If the 10-file PRD tree becomes canonical, the product layer will look rigorous while hiding ownership confusion. Product decisions, design contracts, roadmap sequencing, and implementation acceptance bars will all live in one subtree, making every future change a cross-layer edit.

The biggest risks are:

| Risk | Consequence |
|---|---|
| Design bias becomes product truth | Current architecture choices harden before product intent is independently settled |
| Product docs become too expensive to maintain | Small product changes require editing many redundant sections and AC rows |
| Implementation agents follow mechanism over intent | Builders optimize for tables and phase bars instead of user trust, control, and recoverability |
| Open product questions disappear | Assumptions become ship blockers before validation |
| Design reconciliation becomes harder | There is no clean product source to compare against design because the product layer already imported design detail |

Simplifying now is cheaper than reconciling later. The product layer should be a clear source of intent that design can follow, not a second design corpus written in PRD form.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig product layer rebuild review](./README.md) · **← Prev:** [03 — Product Skills Inventory (R03-PRODUCT-SKILLS-INVENTORY)](./03-product-skills-inventory.md) · **Next →:** [05 - Red-Team Review (R05-RED-TEAM)](./05-red-team.md)

<!-- /DOCS-NAV -->
