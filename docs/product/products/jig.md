---
title: "Jig — the package (main product)"
status: stub — overview + expansion notes
last-reviewed: "2026-06-27"
---

# Jig — the package (main product)

The deterministic execution engine you run as `jig`. Input is a schema-conformant
**execution plan**; output is a reviewed, merged change landed under the configured policy —
safely, recoverably, under human supervision. This is the base product; the rest of the
suite exists to feed it a good plan. Its full engineering design already lives under
`docs/design/` (the "execute ring").

## Sub-modules (high level)

Orchestration core · the four provider seams (Agent, Execution Host, Forge, Work Source) +
drivers · event log + projections (state & metrics) · evidence gates + merge authority ·
capability attestation (earned autonomy, fail-closed) · worker/runner isolation (AD-12) ·
recovery · **policy & config** (the gating-spectrum dial) · observability & analysis ·
human control & approvals · the **execution-plan input schema** · delivery surfaces
(skill / CLI `jig` / MCP).

## Known from this session — address when expanding

- **Pull the product-level view from `docs/design/`; recontextualize, do not re-decide.**
  The invariants, seams, event types, and package map are frozen. This product doc explains
  what each module does _for the user_, not how it's built.
- **The execution-plan input schema is the highest-value contract to pin down** — it is the
  seam between this package and the upstream `design→plan` product. Define it first.
- **Policy lives here.** Generalize v0.7.0's PR/merge presets (`push-and-merge`,
  `gated-automerge`, `push-only`) into the full gating spectrum (throughput-leaning ↔
  prevention-leaning, with a middle).
- **Observability is a package feature** and is what a minimal-product user inspects to
  self-diagnose a bad plan or policy. The learning loop sits over the _upstream_, not here.
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
