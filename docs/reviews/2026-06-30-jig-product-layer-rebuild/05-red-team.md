# 05 - Red-Team Review (R05-RED-TEAM)

This report records the adversarial pass before final synthesis amendments. Treat its
findings as inputs to R06; `06-final-synthesis.md` is the resolved implementation handoff.

## Findings

1. **[Blocking] The recommendation can strand acceptance-criteria traceability.**
   R04 says to drop the canonical 10-file PRD ceremony, collapse/remove
   `docs/product/prds/` from canonical navigation, and create specific ACs later only "if
   needed" (`docs/reviews/2026-06-30-jig-product-layer-rebuild/04-rebuild-recommendation.md:72`,
   `:98`, `:101`). That is directionally right for product altitude, but the packet does not
   define where the current ID-bearing contract goes before deletion. Current source material
   says downstream products reference ID'd acceptance criteria
   (`docs/product/README.md:247`), the AC file says `plan-delivery-track` maps stories to
   these IDs (`docs/product/prds/jig/08-acceptance-criteria.md:5`), and `PLAN-4` requires
   story references to AC IDs from the source PRD
   (`docs/product/prds/jig/08-acceptance-criteria.md:144`). Removing the PRD tree without a
   replacement map risks losing the only stable FENCE/EARN/GUARD/etc. identifiers currently
   available to planning and verification. The handoff needs a concrete migration rule:
   either retain a minimal product-owned ID list, or name the exact design/planning artifact
   that will receive each AC family before the PRD tree is removed.

2. **[Blocking] "Rewrite from the candidate" is underconstrained and can re-import the same
   design leakage.**
   R04 correctly says `docs/product/jig.candidate.md` needs editing down and de-biasing
   (`docs/reviews/2026-06-30-jig-product-layer-rebuild/04-rebuild-recommendation.md:11`), but
   the implementation handoff mostly says to preserve the candidate and rewrite from it
   (`docs/reviews/2026-06-30-jig-product-layer-rebuild/04-rebuild-recommendation.md:95`-`:97`).
   The candidate is not clean product-only source: it points to the PRD as the behavioral
   requirements home (`docs/product/jig.candidate.md:22`, `:179`), includes phase sequencing
   (`docs/product/jig.candidate.md:22`, `:26`-`:44`), seam/driver specifics
   (`docs/product/jig.candidate.md:146`-`:159`), and execution-plan AC-reference mechanics
   (`docs/product/jig.candidate.md:157`). R01 also leaves its source status unresolved
   (`docs/reviews/2026-06-30-jig-product-layer-rebuild/01-product-layer-read.md:127`-`:128`).
   Before implementation, the packet should add a candidate de-bias checklist or section map:
   keep audience/problem/promise/guarantees/personas; rewrite or drop PRD pointers, phase
   commitments, driver lanes, schema mechanics, and design-blueprint language.

3. **[Non-blocking] The next actions are too light on navigation and stale-link cleanup.**
   R04 says to update README, collapse/remove the PRD navigation, and run docs checks
   (`docs/reviews/2026-06-30-jig-product-layer-rebuild/04-rebuild-recommendation.md:98`-`:102`),
   but it does not explicitly require a stale-reference sweep. Current generated navigation
   still lists the PRD subtree (`docs/product/README.md:360`), and the candidate contains PRD
   links (`docs/product/jig.candidate.md:7`, `:179`). Add a mechanical follow-up: search for
   `prds/jig`, `PRD`, and AC-family IDs after the rewrite; regenerate docs nav; then run the
   repo check gate or the documented docs-nav check.

4. **[Non-blocking] R02 is useful, but still frames some design mechanisms as product themes.**
   It warns against importing implementation details (`docs/reviews/2026-06-30-jig-product-layer-rebuild/02-design-reference-behaviors.md:61`-`:67`),
   yet its rebuild implications include a "proof ledger" with explicit state transitions
   (`docs/reviews/2026-06-30-jig-product-layer-rebuild/02-design-reference-behaviors.md:91`-`:95`).
   That may be the right UX concept later, but the final synthesis should label it as an
   example to translate, not product text to copy.

5. **[Non-blocking] Product intent is present, but the handoff should make the value-prop pass
   mandatory.**
   R03 identifies value proposition/JTBD as the first useful method
   (`docs/reviews/2026-06-30-jig-product-layer-rebuild/03-product-skills-inventory.md:45`-`:57`),
   while R04's outline includes audience and job but no explicit before/after, alternative,
   or non-fit check (`docs/reviews/2026-06-30-jig-product-layer-rebuild/04-rebuild-recommendation.md:53`-`:62`).
   This is not a blocker, but it is the easiest way for the rewrite to stay product-led rather
   than merely shorter.

## Verdict

The packet's core recommendation is right: do not promote the 10-file Jig PRD tree as the
canonical product layer. It is a clear improvement over accepting the branch as-is. However,
I would not hand this directly to an implementation agent yet. The two blockers are not calls
for more polish; they are safety rails needed before deletion/collapse work starts:
preserve or relocate AC identity intentionally, and constrain candidate-first rewriting so it
does not recreate the product/design blur.

## Assumptions To Keep Visible

- Product is the source of intent; design is downstream reference unless product explicitly
  delegates a detail.
- "Product-only" does not mean "no IDs or testable commitments." It means IDs and commitments
  should describe user-visible trust boundaries, not protocol mechanics.
- `docs/product/jig.candidate.md` is useful source material, not clean source of truth.
- The PRD tree is too large to remain canonical, but it currently contains some traceability
  assets that need migration before removal.

## Missing Or Weak Follow-Up Actions

- Add an AC-family disposition table: `FENCE`, `EARN`, `GUARD`, `DOOR`, `MERGE`, `CFG`,
  `RESUME`, `ISO`, `STACK`, `SEE`, `PLAN`, `SURF` -> keep in product, move to design,
  move to roadmap/planning, or delete.
- Add a candidate section-by-section keep/drop/rewrite map before assigning the rewrite.
- Decide whether `docs/product/jig.candidate.md` is tracked archive, local source only, or
  deleted after mining. Do not leave it as an ambiguous parallel product page.
- Require a stale-reference sweep and docs-nav regeneration after removing PRD navigation.
- Require a short product-value pass before finalizing `jig.md`: user, job, current
  alternative, before/after outcome, non-fit, success/counter-signal.

## Recommended Adjustments Before Implementation

1. Amend R04 or the final synthesis with a migration table for AC IDs and product-visible
   commitments before saying "collapse/remove `docs/product/prds/`."
2. Replace "rewrite from the candidate" with a bounded instruction: use the candidate for
   audience, problem, promise, guarantees, recovery, observability, and personas; do not copy
   PRD links, phase tables, driver sequencing, schema fields, or mechanism-level seams.
3. Make `docs/product/jig.md` the only canonical Jig product page, but keep any required
   conformance detail reachable through named design/planning destinations.
4. In the final handoff, include exact verification: `rg` for stale PRD references, docs-nav
   regeneration/check, and the appropriate repo gate result.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig product layer rebuild review](./README.md) · **← Prev:** [04 - Rebuild Recommendation (R04-REBUILD-RECOMMENDATION)](./04-rebuild-recommendation.md) · **Next →:** [06 - Final Synthesis](./06-final-synthesis.md)

<!-- /DOCS-NAV -->
