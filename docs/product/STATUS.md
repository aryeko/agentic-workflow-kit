---
title: "Product layer — status"
status: living — progress + next steps
last-reviewed: "2026-06-27"
---

# Product layer — status

_Branch: `product-layer`. The product-definition layer for the `agentic-workflow-kit` suite
(product **Jig**). Product is the source of truth; the `docs/design/` corpus is a supporting
reference, reconciled to follow._

## Done

- **Product-first reframe** — product = source of truth; design = supporting reference.
- **README (the product definition)** — who/why; the *"single-session discipline, generalized
  to scale"* value proposition (corroborated by the Codex, Claude, and OpenAI *Harness
  engineering* guides, plus superpowers); the suite map; the principles (policy-not-posture,
  enforce-vs-guide); the tracks pointer.
- **Jig deep-dive** (`products/jig.md`) — the package, organized around **five guarantees**:
  ① control & trust · ② you own the configuration · ③ never lose work, resume safely ·
  ④ runs against your stack · ⑤ see everything. Plus a "Why Jig" hook.
- **Tracks** (`concepts/tracks.md`) — the parallel, independent multi-track model.
- **design→plan deep-dive** (`products/design-to-plan.md`) — producer responsibilities + the
  evidence thread (it writes the falsifiable contract Jig's gates check).

## Structure

```
docs/product/
  README.md          # product definition + suite map + principles
  STATUS.md          # this file
  authoring-plan.md  # cross-session authoring playbook
  products/          # one product-level deep-dive each
    jig.md                 [done]
    design-to-plan.md      [done]
    product-to-design.md   [stub]
    define-product.md      [stub]
    learning-loop.md       [stub]
  concepts/          # cross-cutting concepts
    tracks.md              [done]
```

## Next

1. **Remaining product overviews** (priority order): `product→design` → `define-product` →
   `learning-loop`.
2. **Method decision pending** — deeper per-feature definition: a **roadmap** (phasing) plus a
   **full PRD per feature** (problem statement · target audience · solution · requirements /
   ID'd acceptance criteria · success metrics · what success looks like), breaking products
   into features where they are large. Best-practice method under review against the plugin
   skills (`define-product`, `write-spec`, `roadmap-update`).
3. **Downstream (separate tracks):** design reconciliation (`fnd-01` split, foundation-overfit
   rework); `kit-vnext` title sweep; refinement (branding, diagrams, examples); the superpowers
   link.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](./README.md) · **← Prev:** [Product layer — authoring plan (cross-session playbook)](./authoring-plan.md) · **Next →:** [design corpus overview](../design/README.md)

<!-- /DOCS-NAV -->
