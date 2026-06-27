---
title: "Product layer — authoring plan (cross-session playbook)"
status: guide — how we build the product layer
last-reviewed: "2026-06-27"
---

# Product layer — authoring plan (cross-session playbook)

This is **not** a code execution plan. It is the durable plan, the decisions, and the
reasoning for authoring the product layer (`docs/product/`) across multiple sessions. Read
it first when resuming this work, then read [README.md](README.md) (the product definition)
and the per-product stubs under [`products/`](products/).

---

## Where we are

- **Product named: Jig.** CLI `jig`; package `@agentic-workflow-kit/jig`;
  `agentic-workflow-kit` is the suite/org umbrella. "kit-vnext" is retired as a name (it is
  only a milestone/branch/tag).
- **Branch `product-layer`**, in a worktree off `v-next`. Committed and pushed. **No PR yet**
  (by the owner's instruction).
- **Authored so far:** the product definition ([README.md](README.md)); five seeded product
  stubs (overview + "address when expanding" notes); this playbook. Nothing is deep-dived yet.

## Decisions (and the reasoning)

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

## Steps to follow (across sessions)

1. **(done)** Brainstorm + capture the product definition → [README.md](README.md).
2. **(done)** Scaffold per-product stubs with simple overview + "address when expanding"
   notes; add this playbook.
3. **(next) Deep-dive the package (Jig) first.** Expand [products/jig.md](products/jig.md):
   pull the product-level view from `docs/design/`; **pin down the execution-plan input
   schema** (the seam to the upstream); describe policy presets and the deferrable drivers.
4. **Then the supporting products by priority** — `design→plan` next (it produces the
   package's input), then `product→design`, then `define-product`, then the `learning-loop`.
5. **Graduate to a full PRD by dogfooding `define-product`** on this product layer; land it
   under `docs/product/` (or `docs/prds/<slug>/` per the define-product convention).
6. **Separately, a mechanical rename pass** later: replace `kit-vnext`-as-a-name across the
   repo (~312 files) once positioning is locked. Distinct from this authoring work.
7. **Plan phases** only once the product requirements above exist.

## Working conventions / guardrails

- **Worktree discipline.** Work in `.worktrees/product-layer` off `v-next`; never edit the
  main checkout; confirm `git rev-parse --show-toplevel` before any write/commit/push. Never
  push to `v-next`; when we PR, base = `v-next`. Read `AGENTS.md` and the frozen/open line in
  `CLAUDE.md` first.
- **Verify gate.** `docs:nav:check` covers `docs/product/` (nav footers are generated — run
  `pnpm docs:nav`, never hand-edit them). Run `pnpm check` before a PR.
- **Tooling for the work.** Use `product-management:product-brainstorming` for shaping;
  `agentic-workflow-kit:define-product` for the PRD dogfood (step 5).

## Reference map

- [README.md](README.md) — the product definition (problem, audience, principle, policy
  spectrum, the suite, credibility, sequencing).
- [`products/`](products/) — per-product overviews + expansion notes (package first).
- `docs/design/` — the package's frozen engineering design (the "execute ring").
- `docs/research/agent-harness-lessons/` — corroborating research (incl. OpenAI Harness
  engineering).
- `docs/implementation-authoring/` (+ `lessons-ledger.md`) — the code-authoring method and
  the defect-class ledger that the learning loop generalizes.
- `main` (v0.7.0) — prior art: the full four-stage workflow already shipped once.
- `../ghx` — the scoped-package / bare-CLI packaging convention.
- Memory: `kit-vnext-product-layer-and-jig.md`.

## Open questions

- The **execution-plan input schema** (the package ↔ design→plan seam) — define during the
  package deep-dive.
- How load-bearing the **design** accelerator is (optional vs. more central).
- **Spectrum generalization** of the upstream products + learning loop — a deep-dive when we
  reach those products, not claimed now.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](./README.md) · **← Prev:** [Learning loop (supporting product)](./products/learning-loop.md) · **Next →:** [design corpus overview](../design/README.md)

<!-- /DOCS-NAV -->
