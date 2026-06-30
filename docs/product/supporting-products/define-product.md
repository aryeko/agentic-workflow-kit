---
title: "Define product (supporting product)"
status: draft — product overview
last-reviewed: "2026-06-27"
---

# Define product (supporting product)

Define product is the **first stage** in the suite's workflow. It helps produce a **product
definition (PRD)** — the global *what* and *why* — with ID'd acceptance criteria that every
downstream product references. The output feeds product → design, which feeds design → plan,
which feeds Jig. When the evidence thread running through the whole delivery is strong, it is
because a clear PRD with falsifiable, ID'd ACs was its starting point.

This document is a **product-level overview**: what define-product does _for you_ and _why it
matters_, not how it is built. The kit's existing `define-product` skill
(`agentic-workflow-kit:define-product`) is prior art — this product is, in a real sense, the
productization of that skill — and the existing multi-file PRD template/examples are a
concrete model the guidelines build on. This doc describes the
product at altitude, in terms of what it produces.

Note: throughout this doc, "ID'd ACs" refers to a **content feature of the PRD artifact** —
acceptance criteria identified with a stable label so downstream products can cite them by ID.
The numbered requirements below (PRD-n) are this product's own requirement identifiers — a
different thing.

## Why define product

**Everything downstream inherits the PRD's clarity.** A vague product definition does not
stop execution — it produces a faithful build of the wrong thing. The design inherits the
ambiguity, the plan decomposes the ambiguous design, and Jig faithfully executes a
well-structured plan in the wrong direction. By that point the problem is expensive.

The single-session lesson generalizes: the most common delivery failure is not a broken build,
it is a correct build of a misunderstood goal. Define product addresses that at the source —
before any architecture decisions, before any story decomposition, before any code — by
producing a PRD that states the problem, the audience, the solution, and the requirements with
ID'd, falsifiable acceptance criteria. You review the product definition once, at the cheapest
possible moment, instead of reconstructing it from a diff.

Like the other supporting products, define-product is **optional**: a strong default that
encodes the author's product-practice experience as a repeatable starting point. The author
does not claim to be the best product manager — only to have encoded a practice worth starting
from. Bring your own product spec, and the suite accepts it; the kit **enables and supports**
here, it does not limit.

A concrete proof point: this product layer's own definition (the
[product README](../README.md)) is slated to graduate into a full PRD via define-product —
the first real dogfood test of this product.

## Responsibilities

Define product is a **producer**: it is organized around what it is responsible for
generating — four responsibilities, each with intended behavior and ID'd requirements.

### Elicitation and interview

**Intended behavior.** Define product **asks only the questions that are blocking** — the ones
without which the PRD cannot be written — and records everything else as a stated assumption.
The goal is a complete PRD, not an exhaustive interview. Asking too much slows the work and
transfers burden to the user; asking too little leaves the PRD under-specified.

**Product requirements.**

- **PRD-1.** The elicitation asks **only blocking questions** — questions whose answers are
  required to complete the PRD. Open-ended exploration beyond what is blocking is out of
  scope.
- **PRD-2.** Non-blocking unknowns are **recorded as stated assumptions** in the PRD, not
  silently papered over. A stated assumption is a reviewable decision; a silent one is a
  hidden defect.
- **PRD-3.** The elicitation is **conversational and minimal** — the user drives direction;
  define-product structures and fills in around what they supply.

### Produce the PRD

**Intended behavior.** The primary output is a **product definition** that states the
problem, the target audience, the solution, the requirements with ID'd acceptance criteria,
the success metrics, and the delivery phases. This is the global *what* and *why* — the
direction the whole delivery is set against. Its ID'd ACs are the evidence thread's starting
point: design → plan carries them forward as the criteria Jig's gates ultimately check.

**Product requirements.**

- **PRD-4.** The PRD covers the required sections: **problem · audience · solution ·
  requirements with ID'd ACs · success metrics · delivery phases.**
- **PRD-5.** Acceptance criteria in the PRD are **ID'd with a stable label** — so downstream
  products (design → plan) and ultimately Jig's gates can reference them unambiguously.
- **PRD-6.** Acceptance criteria are **falsifiable, not prose intentions.** A criterion that
  can't be shown true or false is not a criterion. (This is the same discipline that
  design → plan requires of story-level ACs — it starts here, at the product level, so the
  evidence thread begins with checkable inputs.)
- **PRD-7.** The PRD captures **delivery phases** — a sequenced breakdown of the work that
  keeps the product definition scoped and the downstream plan tractable, not an all-or-nothing
  commitment.
- **PRD-8.** The PRD is a **durable, structured artifact** — not a conversational summary.
  It is the input contract product → design reads; it needs to stand alone without the
  session that produced it.

### Templates

**Intended behavior.** Define product ships a **repeatable PRD template** that encodes the
expected structure — the sections to complete, the ID labeling convention for ACs, and the
scoping boundaries to state. The template is how the author's product practice becomes a
reusable starting point; new product definitions begin from a complete skeleton rather than a
blank page.

**Product requirements.**

- **PRD-9.** A template is provided covering each required section (PRD-4). It is the
  **default starting point**, not a constraint — adapt it to your context.
- **PRD-10.** The template is versioned so PRDs can be traced to the template version that
  produced them, feeding the learning loop's traceability.

### Guidelines and best practices

**Intended behavior.** Define product ships **documentation** that explains not just how to
fill the template but *why* each section matters — drawn from the author's experience and
from what the kit has paid for in its own evolution. This guidance is a first-class
deliverable, in the spirit of the guidance across the suite (see [product README](../README.md)).

**Product requirements.**

- **PRD-11.** Guidelines cover the failure modes the kit has paid for: **vague requirements
  that produce a faithful build of the wrong thing**, **acceptance criteria stated as prose
  intentions** (which design → plan and Jig cannot check), and **scope that was never
  bounded** (which makes every downstream decomposition unstable).
- **PRD-12.** Guidelines are **recommended, not enforced.** They sit in the suite's guide
  tier (see [product README](../README.md)). Ignore them and you trade away the upstream
  clarity that makes the evidence thread strong.

## Per track

A PRD is a product definition **for a track** — one independent line of work, scoped to its
area and producing the input that product → design converts into a design for that track. A
repo runs many tracks in parallel, each with its own PRD advancing at its own pace. See
[Tracks — parallel independent work](../concepts.md).

## Honest edges

- **Optional, and a strong default — not a mandate.** Define product encodes one person's
  product practice. Bring your own product spec — the suite enters at any stage — and the
  kit enables your path without resistance. (See the bring-your-own note in the
  [product README](../README.md).)
- **The kit amplifies your judgment; it does not supply it.** Define product captures
  *your* product decisions, elicits the ones you haven't stated, and structures the output.
  The AI does not decide what to build. The human's judgment and direction are the required
  input; define-product makes them explicit and durable.
- **A PRD's ID'd ACs are only as good as the criteria written in them.** Define product can
  structure criteria to be falsifiable and can label them for downstream reference — but a
  careless author can still write criteria that pass vacuously. The product encodes and
  enforces the *shape*; the *substance* of each criterion is the author's to set well.
  (This mirrors design → plan's and Jig's own honest edges on the same theme.)
- **The evidence thread starts here.** The ID'd ACs in the PRD flow downstream through the
  design and plan to Jig's gates. A strong PRD makes the entire thread strong; a weak one
  makes it weak regardless of how well the downstream stages execute. This is the highest-
  leverage point in the suite to get right.

## Cross-links

- **Produces the PRD that product → design consumes.** The product definition is the
  input to [product → design](product-to-design.md). The design's scope and the decisions it
  addresses are set by what the PRD specifies.
- **ID'd ACs are referenced by design → plan and ultimately checked by Jig.** The acceptance
  criteria written here, labeled for reference, are the same criteria design → plan carries
  forward as story-level checkable criteria (see [design → plan](design-to-plan.md), **AC-1**,
  **AC-2**) and that Jig's gates evaluate at merge-on-evidence
  (see [Jig](../jig.md), **① MERGE-1**) and surfaces in its records (**⑤ SEE-1**, **SEE-3**).
  The evidence thread starts here.
- **The learning loop can trace a defect back to the PRD.** Between runs, the learning loop's
  root-cause trace reaches back to the earliest layer that should have caught an issue — which
  may be a vague PRD requirement or an under-specified acceptance criterion
  (see [Learning loop](learning-loop.md), **LOOP-3**).
- **Per track** — see [Tracks](../concepts.md).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](../README.md) · **← Prev:** [Product → design (supporting product)](./product-to-design.md) · **Next →:** [Learning loop (supporting product)](./learning-loop.md)

<!-- /DOCS-NAV -->
