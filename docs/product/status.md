---
title: "Product layer — status + authoring plan"
status: transient — delete when product ready
last-reviewed: "2026-06-30"
---

# Product Layer — Status + Authoring Plan

This file is a temporary workstream note for the clean Jig product-layer rebuild on
`docs/product-jig-rebuild`. It should disappear or shrink again once the product layer is
stable.

## Current State

- `docs/product/README.md` is the suite-level product definition.
- `docs/product/jig.md` is the canonical Jig product page.
- `docs/product/concepts.md` defines durable cross-product concepts such as tracks.
- `docs/product/supporting-products/*.md` contains short product-orientation pages for the
  optional upstream/supporting products.
- There is no committed product PRD tree in this baseline, and this rebuild should not create
  one.

Product intent owns audience, problem, promise, workflow, guarantees, boundaries, and success
signals. The existing `docs/design/` corpus is the engineering reference for how those
commitments are satisfied; it is not edited in this pass.

## This Rebuild Pass

Scope:

- Reframe `docs/product/jig.md` around the value-proposition spine: user, job, current
  alternative, before/after, non-fit, success signal, and counter-signal.
- Keep Jig's product-owned commitment IDs in `jig.md`.
- Rewrite mechanism-heavy language into product-altitude trust promises.
- Keep supporting-product cross-references to Jig's commitment IDs resolvable.
- Confirm the product README points to `jig.md` as the canonical package product page.

Out of scope:

- No design-doc edits.
- No acceptance-criteria table expansion in the product layer.
- No new product PRD tree.
- No implementation or driver sequencing work.

## Local Source Material

`.codex/local-sources/jig.candidate.md` is local-only, gitignored source material. It may be
mined for wording, but it is not a product page and should not be committed.

## Next After This Pass

Delivery-level acceptance criteria, phase sequencing, and mechanism-specific verification
belong in later design or planning artifacts that cite the product-owned IDs in
`docs/product/jig.md`. Product should keep the outcome-level commitments clear and avoid
turning implementation protocol into product prose.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](./README.md) · **← Prev:** [Learning loop (supporting product)](./supporting-products/learning-loop.md) · **Next →:** [PRDs — product requirements](./prds/README.md)

<!-- /DOCS-NAV -->
