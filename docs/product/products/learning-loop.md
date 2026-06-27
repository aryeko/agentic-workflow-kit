---
title: "Learning loop (supporting product)"
status: stub — overview + expansion notes
last-reviewed: "2026-06-27"
---

# Learning loop (supporting product)

A separate, suite-level product that stays out of the package's per-run hot path. **Jig owns
runtime observability and execution records** — structured, machine-readable records/events;
**the learning loop is a suite-level tool that consumes those records** and, via human-led
root-cause retro, can harden **any layer — policy, gate, provider, prompt/eval, dashboard, or
execution harness** — not only the upstream stages. When an issue surfaces it is not patched
forward: the retro traces it back to the earliest layer that should have prevented it
(product, design, plan, policy, gate, provider, prompt/eval, dashboard, or harness) and
hardens that layer — a recurring defect becomes a permanent, mechanical check. That is how
prevention compounds.

## Sub-modules (high level)

Issue intake · cross-stage root-cause trace · defect-class → mechanical-check promotion ·
lessons ledger · per-stage hardening hooks.

## Known from this session — address when expanding

- **Separate from the package's per-run hot path.** The package carries its own
  observability; a minimal-product user inspects those records directly to diagnose a bad
  plan or policy. The learning loop is a between-runs product — its root-cause retro can
  harden any layer, including this package's own policy and gate config.
- **Methodology-dependent — no plug-and-play claim (yet).** Tuned to the author's
  prevention-leaning default, where it works well. A throughput-leaning (OpenAI-style) user
  would aim the same root-cause analysis at specs, plans, and possibly policy — plausibly
  similar in shape, but unproven. Generalizing across the policy spectrum is a deliberate
  deep-dive, not a promise.
- **Prior art:** v-next `delivery-retro` + `docs/implementation-authoring/lessons-ledger.md`.
- Likely the **last** product to deep-dive — it depends on the upstream products existing.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](../README.md) · **← Prev:** [Define product (supporting product)](./define-product.md) · **Next →:** [Product layer — authoring plan (cross-session playbook)](../authoring-plan.md)

<!-- /DOCS-NAV -->
