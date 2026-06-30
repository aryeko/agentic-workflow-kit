---
title: Jig product layer rebuild review
status: draft
last-reviewed: 2026-06-30
---

# Jig Product Layer Rebuild Review

Durable evidence packet for reviewing the `docs/product-phase-1a-jig-prd` branch and
recommending how to recreate the Jig product layer so it stays product-only, simple, and
not bounded by the current design or implementation.

## Source

| Field | Value |
|---|---|
| Worktree | `/Users/aryekogan/repos/workflow-kit/.worktrees/jig-prd` |
| Branch | `docs/product-phase-1a-jig-prd` |
| Head | `6766ad6057532bae7ec11a5622243981e370e190` |
| Base | `5b07285ed9026721fa1a96aa34bc8e7f2c711b57` (`v-next`) |
| Scope | Product-layer review only; no product-doc rewrite in this pass |

## Inputs Reviewed

- Current product layer: `docs/product/README.md`, `docs/product/jig.md`,
  `docs/product/concepts.md`, `docs/product/status.md`,
  `docs/product/supporting-products/*.md`, and `docs/product/prds/**`.
- Candidate source: `docs/product/jig.candidate.md` was untracked at the start of the
  review. R06 resolves it as local-only source, not a product page; the local copy now lives
  outside docs navigation at `.codex/local-sources/jig.candidate.md`.
- Design reference corpus: high-signal files under `docs/design/`, used as reference for
  product-visible behavior, not as product authority.
- Product-management references: `/Users/aryekogan/repos/pm-skills` and the cached Codex
  `product-design` plugin materials, used as reference only.

## Reports

| Report | Purpose |
|---|---|
| [01-product-layer-read.md](./01-product-layer-read.md) | Product intent, current doc jobs, complexity symptoms, and first-read disposition notes |
| [02-design-reference-behaviors.md](./02-design-reference-behaviors.md) | Design behaviors worth preserving in product language, and design detail to avoid importing |
| [03-product-skills-inventory.md](./03-product-skills-inventory.md) | PM/product skill inventory and applicability |
| [04-rebuild-recommendation.md](./04-rebuild-recommendation.md) | Recommended rebuild shape and current-branch disposition |
| [05-red-team.md](./05-red-team.md) | Adversarial review of the report packet |
| [06-final-synthesis.md](./06-final-synthesis.md) | Final target tree, keep/drop/move table, rewrite handoff plan, and verification |

## Verification

Completed 2026-06-30:

- `pnpm exec biome format --write docs/reviews/2026-06-30-jig-product-layer-rebuild`
  processed no files because the docs path is ignored by Biome config.
- First `pnpm check` failed on `docs:nav:check` with generated navigation out of date.
- The untracked `docs/product/jig.candidate.md` source was moved out of docs navigation to
  `.codex/local-sources/jig.candidate.md` before the final nav/check pass.
- `CI=true pnpm docs:nav` updated generated nav footers for the committed docs tree
  (`370` markdown files after removing the candidate from docs navigation).
- Final `pnpm check` passed: `docs:nav:check` reported nav up to date and all 8 Turbo
  tasks succeeded. The run still printed the
  repo-existing Biome lint warning/info for
  `packages/sdk/src/core/supervision/contracts/interfaces.ts` and
  `packages/sdk/tests/core/supervision/wait/wait-wrapper.unit.test.ts`.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [agentic-workflow-kit — documentation home](../../README.md) · **← Prev:** [06 - Final Synthesis](./06-final-synthesis.md) · **Next →:** [01 — Product Layer Read (R01-PRODUCT-LAYER-READ)](./01-product-layer-read.md)

**Children:** [01 — Product Layer Read (R01-PRODUCT-LAYER-READ)](./01-product-layer-read.md) · [Report 2 — Design-Reference Behaviors for JIG Rebuild](./02-design-reference-behaviors.md) · [03 — Product Skills Inventory (R03-PRODUCT-SKILLS-INVENTORY)](./03-product-skills-inventory.md) · [04 - Rebuild Recommendation (R04-REBUILD-RECOMMENDATION)](./04-rebuild-recommendation.md) · [05 - Red-Team Review (R05-RED-TEAM)](./05-red-team.md) · [06 - Final Synthesis](./06-final-synthesis.md)

<!-- /DOCS-NAV -->
