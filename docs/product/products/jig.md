---
title: "Jig — the package (main product)"
status: stub — overview + expansion notes
last-reviewed: "2026-06-27"
---

# Jig — the package (main product)

The deterministic execution engine you run as `jig`. Input is a schema-conformant
**execution plan**; output is the work delivered as far as your configured policy allows —
safely, recoverably, under human supervision — up to a reviewed, merged change (the policy
spectrum runs from push-only through merge-and-fix-forward). This is the base product; the
rest of the suite exists to feed it a good plan. Its full engineering design already lives
under `docs/design/` (the "execute ring").

## Sub-modules (high level)

Orchestration core · the four provider seams (Agent, Execution Host, Forge, Work Source) +
drivers · event log + projections (state & metrics) · evidence gates + merge authority ·
capability attestation (earned autonomy, fail-closed) · worker/runner isolation (AD-12) ·
recovery · **policy & config** (the gating-spectrum dial) · observability & analysis ·
human control & approvals · the **execution-plan input schema** · delivery surfaces
(skill / CLI `jig` / MCP).

## Known from this session — address when expanding

- **Pull the product-level view from the `docs/design/` supporting reference.** This product
  doc explains what each module does _for the user_ — a product overview, not a re-architecture
  of the engineering internals.
- **The execution-plan input schema is the highest-value contract to pin down** — it is the
  seam between this package and the upstream `design→plan` product, and the **one hard schema
  boundary** in the suite. The product layer does not define universal PRD/design schemas.
  Define it first.
- **Policy lives here.** Generalize v0.7.0's PR/merge presets into the full gating spectrum —
  a real range of explicit policies: push-only, merge-ready, human-approved merge,
  evidence-gated automerge, merge-and-fix-forward (the throughput end), through the author's
  prevention-leaning default.
- **Observability is a package feature** — it emits **structured, machine-readable
  records/events** that suite-level tools (learning loops, evals, dashboards, analyzers)
  consume, and is what a minimal-product user inspects to self-diagnose a bad plan or
  policy. The learning loop is a separate product that stays out of this package's per-run
  hot path — but between runs its root-cause retro can harden any layer, including this
  package's policy and gate config.
- **Phasing may defer parts of the package itself** — e.g., a specific agent adapter such
  as a Claude adapter (v0.7.0/v-next drove Codex). List deferrable drivers/seams when we
  plan phases.
- **Prior art to mine:** v0.7.0 `implement-next` / `workflow-autopilot`, the
  `@agentic-workflow-kit/orchestrator` package, `.workflow/config.yaml`; v-next
  `orchestrated-delivery` and the 16 design domains.
- Delivery surface (skill / CLI / MCP) is intentionally deferred as a detail.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](../README.md) · **← Prev:** [Product definition](../README.md) · **Next →:** [Design → plan (supporting product)](./design-to-plan.md)

<!-- /DOCS-NAV -->
