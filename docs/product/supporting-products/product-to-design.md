---
title: "Product → design (supporting product)"
status: draft — product overview
last-reviewed: "2026-06-27"
---

# Product → design (supporting product)

Product → design is the supporting product that turns a **product definition (PRD)** into a
**system and technical design** — the deliberate *how*, decided explicitly and recorded before
any plan or code is written. It is the second stage in the suite's workflow:
define-product produces the PRD; product → design converts it into a structured design
artifact that [design → plan](design-to-plan.md) then decomposes into an execution plan.

This document is a **product-level overview**: what product → design does _for you_ and
_why it matters_, not how it is built. The kit's existing `design-technical-solution` skill
is prior art and a supporting reference — this doc describes the product at altitude, in
terms of what it produces, not the files it writes.

## Why product → design

**Without it, the agent improvises the architecture.** Hand a coding agent a PRD and a goal
and it will quietly make the design decisions — module boundaries, data flows, AI surfaces,
the deploy model — as it goes. Those decisions are made once (in the first story), silently,
and then everything downstream depends on them. By the time the plan is executing, re-deciding
them is expensive.

Product → design makes architecture decisions **explicit and reviewable before anyone writes
code**. The output is a structured design artifact — not just notes but a deliberate record of
the *how* — that design → plan can read, that a human can review and correct, and that the
learning loop can trace a defect back to if something slips through. The design is _where the
architectural direction of a delivery is set_; the right time to correct it is before
execution, not after.

Like the other supporting products, product → design is **optional**: a strong default that
encodes the author's architecture experience as a repeatable starting point. The author does
not claim to be the best architect — only to have encoded a discipline worth starting from.
Bring your own design, and design → plan will accept it; the suite **enables and supports**
here, it does not limit.

## Responsibilities

Product → design is a **producer**: it is organized around what it is responsible for
generating — four responsibilities, each with intended behavior and ID'd requirements.

### Audit existing surfaces

**Intended behavior.** Before designing anything new, product → design **surveys what already
exists** — current modules, APIs, data shapes, provider integrations, and constraints — so the
design is grounded in reality, not invented in a vacuum. A design that ignores existing surfaces
produces either a faithful plan to re-build what is there or a design that conflicts with it.
The audit is what makes the design additive rather than colliding.

**Product requirements.**

- **PTD-1.** Prior to drafting the design artifact, product → design identifies **existing
  surfaces, modules, and constraints** relevant to the PRD's scope — what must be preserved,
  what can be extended, and what is out of scope.
- **PTD-2.** The audit is **explicit and recorded** in the design artifact, not an implicit
  background step. A downstream reviewer — and the learning loop — can see what was known at
  design time.

### Produce a design artifact

**Intended behavior.** The primary output is a **structured design artifact** that captures
the deliberate *how*: module boundaries, data and flow models, AI surfaces, observability,
deployment model, security boundaries, and open decisions. It is structured — not a free-form
document that can mean anything — but it is **not a strict schema**. The product layer defines
no universal design schema; the design artifact is structured by convention and by the
guidelines this product ships, not by a machine-enforced contract. (The one hard schema in the
suite is Jig's execution-plan input, which design → plan produces to, not this artifact.)

**Product requirements.**

- **PTD-3.** The design artifact covers the load-bearing dimensions of the system: **module
  boundaries, data and flow model, AI surfaces, observability, deployment, and security**.
  These are the decisions design → plan and downstream execution will depend on.
- **PTD-4.** The artifact is **structured, not schema-enforced.** Coverage and structure are
  the author's responsibility, guided by the product's template and guidelines; Jig does not
  validate the design artifact.
- **PTD-5.** The artifact captures **open decisions and deferments** explicitly — not just
  what was decided, but what was knowingly set aside and why. This prevents implicit
  assumptions from silently propagating into the plan.

### A design template

**Intended behavior.** Product → design ships a **repeatable template** that encodes the
expected structure of a design artifact — the sections to complete, the decisions to state,
and the scope boundaries to declare. The template is how the author's architecture practice
becomes a reusable starting point: new designs start from a complete skeleton rather than a
blank page.

**Product requirements.**

- **PTD-6.** A template is provided covering each load-bearing dimension (PTD-3). It is the
  **default starting point**, not a constraint — bring your own structure if you know better.
- **PTD-7.** The template is versioned so design artifacts can be traced to the template
  version that produced them.

### Guidelines and best practices

**Intended behavior.** Product → design ships **documentation** that explains not just how to
use the template but *why* each decision matters — the reasoning behind good architecture
practice at this stage, drawn from the author's experience and the kit's own evolution. This
guidance is a first-class deliverable, in the spirit of the guidance across the suite (see
[product README](../README.md)).

**Product requirements.**

- **PTD-8.** Guidelines cover the failure modes the kit has paid for: **designing without
  auditing existing surfaces** (PTD-1), **producing a design that can't be decomposed into
  right-sized stories** (the planner's downstream problem), and **leaving decisions implicit**
  that the plan will then inherit without review.
- **PTD-9.** Guidelines are **recommended, not enforced.** They sit in the suite's guide tier
  (see [product README](../README.md)). Ignore them and you trade away legibility and
  traceability; the kit won't stop you.

## Per track

A design artifact is a design **for a track** — one independent line of work, scoped to its
PRD and producing the input that design → plan decomposes for that track. A repo runs many
tracks in parallel, each with its own design advancing at its own pace. See
[Tracks — parallel independent work](../concepts.md).

## Honest edges

- **Optional, and a strong default — not a mandate.** Product → design encodes one person's
  architecture practice. Bring your own design — design → plan accepts it as long as it covers
  what design → plan needs to decompose — and the suite enables your path without resistance.
- **A design is only as good as the product definition it's given.** Product → design
  structures and records the architectural decisions for a PRD; it cannot remedy a vague or
  wrong PRD. A weak product definition yields a faithful design of the wrong system — which is
  exactly why define-product exists upstream (see [Define product](define-product.md)).
- **Structured artifact, not strict schema.** The design artifact is not validated by the
  system; its quality is the author's responsibility. A design that omits a load-bearing
  dimension or leaves a conflict unstated will propagate that gap into the plan.
- **The design is load-bearing.** Calling it optional does not mean it is unimportant.
  A missing design does not eliminate the design decisions — it hands them implicitly to the
  planning or execution stage, where they are made quietly instead of reviewably. The advice
  is: use the strong default.

## Cross-links

- **Consumes the PRD from define-product.** Product → design takes the product definition
  (see [Define product](define-product.md)) as its input. The ID'd ACs from the PRD inform
  which decisions the design must address.
- **Produces the design that design → plan turns into an execution plan.** The structured
  design artifact is the input to [design → plan](design-to-plan.md). A weak design produces
  a faithful plan of the wrong thing; getting the design right is the seam between these two
  products.
- **The design is what the plan decomposes.** design → plan's story decomposition reads the
  design's module boundaries and data flow (see [design → plan](design-to-plan.md), **DAG-3**
  / **PLAN-2**). Missing or implicit design decisions become missing or wrong dependencies in
  the plan.
- **The learning loop can trace a defect back to this layer.** Between runs, the learning
  loop's root-cause trace goes as far back as the design if that is where a defect originated
  (see [Learning loop](learning-loop.md), **LOOP-3**). The design artifact's explicit
  open-decisions record (PTD-5) is what makes that trace possible.
- **Per track** — see [Tracks](../concepts.md).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](../README.md) · **← Prev:** [Design → plan (supporting product)](./design-to-plan.md) · **Next →:** [Define product (supporting product)](./define-product.md)

<!-- /DOCS-NAV -->
