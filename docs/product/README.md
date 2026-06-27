---
title: Product definition
status: draft — product layer
last-reviewed: "2026-06-27"
---

# Product definition

> The product layer that was skipped. The design corpus under `docs/design/` answers
> _what must be true_ and _how it is built_; it never states _for whom_ and _why this_.
> This document states that, and defines the **product suite** at a high level — an
> overview, sub-modules, and a content placeholder for each product. We deepen each
> product by priority (**the package first**); phasing is planned later, once the product
> requirements are in front of us. This document is the **source of truth for the product**;
> where it diverges from the existing design, the design is reconciled to follow it —
> deliberately, as a downstream step, not by churn.

Name: **Jig** — the tool you run (`jig`). It ships as the scoped package
`@agentic-workflow-kit/jig`; **`agentic-workflow-kit`** is the suite/org umbrella that also
houses the supporting products. The milestone tag **kit-vnext** is retired as a name (it is
a branch/version, not an identity).

---

## The problem

Did you ever try to deliver real software through one long-running agent task? _Implement
this story, then review it, open a PR, address the review comments while it's still
unapproved, merge once it's approved — then move on to the next story, and the next._ Of
course you did. And it always breaks.

Agents are powerful, but they have limits, and orchestrating them across a long-running loop
is where those limits surface. A developer's scarcest resource is their **judgment and
attention**, and a long autonomous run quietly spends it: hand an agent a goal and it also
makes the product and design decisions, drifts from the goal as its context fills, and hands
you a "done" whose _direction_ you never chose and can't fully trust.

Reliable, well-designed software is not produced by a better code-writing agent alone. It
is produced by a **whole pipeline** — a clear product definition, a deliberate design, a
faithful plan, and disciplined execution — where an **experienced** human keeps the parts
only a human should own and delegates the rest under guarantees.

## From one good session to a long-running loop

There's a well-known recipe for getting good work out of a _single_ agent session — the
[Codex](https://developers.openai.com/codex/learn/best-practices) and
[Claude](https://code.claude.com/docs/en/best-practices) best-practice guides converge on it
(and OpenAI's [_Harness engineering_](https://openai.com/index/harness-engineering/) makes the
broader case — that the durable leverage is the harness around the agent, not the prompt), and
tools like **superpowers** encode it directly:

- **Prompt well** — state the goal, the context, the requirements, and how to verify.
- **Plan first** — agree on what the agent understood and steer toward your intent _before_ it
  writes code.
- **Manage context** — the most common failure ("the agent delivered something _different_ from
  what I asked") comes from a long session where requirements get forgotten or the goal quietly
  drifts; keep one session per task, and lean on subagents.
- **Test-drive the contract** — to guarantee what you asked for, capture the requirements as
  checks _first_, then have the agent satisfy them.

This works — for one session. But a real delivery isn't one session; it's a long-running
**loop** of them, and the discipline that holds a single session together doesn't survive the
loop on its own.

**The kit is that recipe, generalized to scale.** Each single-session practice becomes a stage
of the pipeline:

| For one session | Generalized to the loop |
|---|---|
| Prompt: goal + context + requirements | a **PRD** (the global _what_ and _why_) and a **design** (the global _how_) — each encoding years of iteration |
| Plan before coding | a clear, reviewable **execution plan** |
| Manage context | **decompose** the plan into story units, each sized for a single session |
| Test-drive the contract | a read-only **requirements contract** per story the implementer must satisfy — then an **independent reviewer** checks the result against that _same_ contract, so what you asked for is what's delivered |

And the loop adds what a single session never had: a **learning loop** that turns recurring
defects into permanent checks, **resource and budget** controls, and the recovery and policy
guarantees the package makes. None of it is forced on you — the kit **helps** you work through
proven practice toward a reliable agentic loop; it does not enforce a single way.

## Who it's for

- **Anyone who can and wants to own the direction** — the product definition, the design,
  and the execution policy. Solo developers, small teams, leads, and architects alike. The
  kit **amplifies your judgment and encodes your best practices — it does not substitute
  for them.** Your judgment and direction are the required input.
- **Solo engineers and small teams shipping real software** — where a wrongly-directed or
  half-finished change is expensive and there is no large team to absorb cleanup.

**Best fit today:** people with enough judgment to own product, design, and execution-policy
direction — solo builders, small teams, leads, architects. The kit helps you implement
decisions you've actually made — not have the AI make the product and design decisions for you.

**Not for:** anyone expecting the AI to decide _what_ to build or supply the engineering
judgment for them. The kit assumes you own those calls. (This is about whether you want to
own the direction — not your seniority, and not your throughput; how aggressively to gate
vs. ship is a policy dial, see below, not an audience boundary.)

## The promise

**Own the product and the design; delegate the build with confidence.** Give the kit a
schema-conformant plan (or let it help you produce one) and it executes the work as far
as your configured policy allows — up to a reviewed, merged change under the gates _you_
configure — and **interrupts you only when a real decision is on the line**. Every run it can learn from what slipped through, so the
next one is better.

The kit helps you produce strong inputs, executes them faithfully, and compounds. (Honest
boundary: faithful execution of a weak input yields weak software — which is exactly why
the kit invests in the upstream products and the learning loop, not only the runner.)

## The principle

**Humans own the direction; agents execute it.** The human defines the product and the
design _up front_, so the agent never executes a direction the human didn't choose. The
agent is a contained worker behind a bounded contract — it implements and proposes
evidence; it does not own the merge decision or set the direction. Control,
recoverability, and evidence are guarantees of the system, not best-effort behaviors.

## The workflow

```
define product → design → plan → execute
                   └──────── learning loop ────────┘
```

Each stage produces a **durable, structured artifact** that is the next stage's input.
The one hard schema boundary in the suite is **Jig's execution-plan input** — Jig owns that
schema. The upstream stages produce structured, durable artifacts but are not claimed to be
strictly schema-validated; the product layer **does not** define universal PRD/design schemas
(an explicit non-goal). The kit **enables and supports — it does not
limit**: you can enter at any stage with your own artifact (your own product spec, design,
or execution plan), as long as it meets what that stage expects as input. The package's
minimum input is a valid execution plan; everything upstream is there to help you produce
a better one.

## Policy, not posture — the gating spectrum

How aggressively to gate, how much to block on, and whether to prevent-up-front or
allow-and-scan are **declarative policy**, not a fixed product stance. v0.7.0 already
shipped this idea as PR/merge presets; v1 generalizes it.

The spectrum has two well-known poles, and the kit supports the whole range between them:

- **Throughput-leaning** — gate lightly, let work merge fast, and catch issues afterward
  with scheduled scans and fast-follow corrections. This is the published OpenAI _Harness
  engineering_ posture; it is coherent and effective in high-throughput settings where
  follow-up corrections are cheap relative to blocking progress, and the surrounding harness
  absorbs fast iteration.
- **Prevention-leaning** — gate and prove before merge; stop in a diagnosable state rather
  than lay a questionable foundation. This author's default.

The risk the prevention end guards against: **a wrong stone laid early in the wall that you
keep building on — cheap to fix now, very expensive later** (a classic example: an agent
re-coding the same logic N times instead of reusing it — it "works," but it is not what you
wanted). The throughput end accepts that risk for speed and pays it down with scans. **The
user chooses, per policy.** Neither extreme is the product; the configurable range is.

## Enforce vs. guide — the three tiers

The kit draws a deliberate line between what it **enforces** and what it merely **guides**:

1. **System-enforced floors** — non-negotiable, on by default, not yours to turn off. The
   one hard input schema (Jig's execution plan) plus the control-cluster floors: nothing
   runs unauthorized, the agent can't weaken its own guardrails, and only the runner —
   never the worker — performs irreversible actions. These floors are what make every
   promise _true_ rather than aspirational.
2. **User-enforced controls** — gates, checks, required reviews, policy, and hardened
   defect-checks _you_ choose to impose. Strong, but your call.
3. **Product guidance** — best practices, presets, prompt strategy, per-layer authoring
   guidelines: reasoned defaults you can follow or override freely.

Most of the suite sits in tiers 2 and 3 — it _guides_, it doesn't dictate. The control
cluster is the principled exception: the one place the kit enforces rather than guides,
because those are the floors trust stands on. See [Jig — the package](products/jig.md)
for the full per-guarantee breakdown.

## The product suite

The kit is a set of **individual products** that compose through shared artifacts and contracts. Each can
be used on its own; together they are the workflow. The umbrella is **Jig plus the current
supporting products plus an open space the suite can grow into** — all sharing common contracts
and runtime evidence. Below is the high-level map — overview, sub-modules, and a content
placeholder per product. The package is the priority; the supporting products follow.

The suite runs **parallel independent tracks** — each track its own
PRD → design → plan → policy → work profile, progressing independently of the others in
the same repo. See [Tracks — parallel independent work](concepts/tracks.md).

Each product has an **expansion doc** under [`products/`](products/) — a simple overview
plus the considerations we already know to address when deepening it. We deep-dive there,
**package first**: [Jig](products/jig.md) · [design→plan](products/design-to-plan.md) ·
[product→design](products/product-to-design.md) · [define-product](products/define-product.md) ·
[learning loop](products/learning-loop.md). The cross-session method, decisions, and
reasoning for building this product layer live in [authoring-plan.md](authoring-plan.md).

### 1. Jig — the package (main product)

The base product and the code itself — the deterministic execution engine you run as `jig`.
Accepts a schema-conformant execution plan and delivers the work as far as your configured
policy allows — safely, recoverably, up to a reviewed, merged change.

- **Sub-modules (high level):** orchestration core · the four provider seams (Agent,
  Execution Host, Forge, Work Source) + drivers · event log + projections (state &
  metrics) · evidence gates + merge authority · capability attestation (earned autonomy) ·
  worker/runner isolation · recovery / fail-closed · **policy & config** (the gating dial) ·
  observability & analysis (emits **structured, machine-readable records/events** that
  suite-level tools — learning loops, evals, dashboards, analyzers — consume) · human control
  & approvals · **execution-plan input schema** · delivery surfaces (skill / CLI / MCP).
- _Placeholder — product-level overview of each sub-module: what it does for the user,
  and which parts may defer (e.g., a specific agent adapter such as a Claude adapter).
  Engineering detail already lives in `docs/design/`._

### 2. Design → plan (supporting product)

Converts a design into a package-ready execution plan in the expected schema, applying the
author's planning experience.

- **Sub-modules (high level):** the execution-plan schema (the one strict schema — Jig owns
  it; design→plan produces output conformant to it) · decomposition into stories / dependency
  order · acceptance criteria + evidence clauses · guidelines & best-practices doc.
- _Placeholder._

### 3. Product → design (supporting product)

Converts a product definition into a system / technical design.

- **Sub-modules (high level):** the design document (structured output, not a strict schema) ·
  audit of existing surfaces · design template · guidelines & best-practices doc.
- _Placeholder._

### 4. Define product (supporting product)

Helps produce a product definition (PRD) with ID'd acceptance criteria the downstream
products reference.

- **Sub-modules (high level):** elicitation / interview · the PRD structure / ID'd acceptance criteria ·
  templates · guidelines & best-practices doc.
- _Placeholder._

### 5. Learning loop (supporting product)

A separate, suite-level product that stays out of the package's per-run hot path. **Jig owns
runtime observability and execution records; the learning loop is a suite-level tool that
consumes those records** and, via **human-led root-cause retro, can harden any layer —
policy, gate, provider, prompt/eval, dashboard, or execution harness** — not only the
upstream stages. When an issue surfaces it is **not** patched forward — the retro **traces it
back to the earliest layer that should have prevented it** (product, design, plan, policy,
gate, provider, prompt/eval, dashboard, or harness) and **hardens that layer** (a recurring
defect becomes a permanent, mechanical check). That is how prevention compounds.

- **Sub-modules (high level):** issue intake · cross-stage root-cause trace · defect-class
  → mechanical check promotion · lessons ledger · per-stage hardening hooks.
- _Placeholder._

> **Methodology-dependent — no plug-and-play claim (yet).** The upstream products and this
> loop are currently tuned to one methodology — the author's prevention-leaning default —
> where they work well. They are **not** a drop-in for every point on the policy spectrum.
> A throughput-leaning (OpenAI-style) user would want the same root-cause analysis aimed at
> specs, plans, and possibly policy: plausibly similar in shape, but unproven. Generalizing
> across the spectrum is a deliberate deep-dive for when we reach these products, not a
> promise made here. The **package**, by contrast, supports the spectrum directly through
> policy.

> **Why the supporting products are optional.** They encode _one person's_ best practice,
> shared as a strong default — not a claim to be the best product manager, architect, or
> planner. The author's product→design→plan workflow is the **first strong default — not the
> only valid path.** Override, modify, or replace any of them; bring your own artifact instead.
> The package is what makes the promise; the rest raises your odds of a good input.

The suite is extensible and welcomes contributed products — toward things like analyzers,
evals, dashboards, and more provider integrations. These are directions the suite can grow;
none are committed here.

## Guidelines and best practices (cross-cutting)

Every step ships **documentation** — guidelines, best practices, and the _reasoning_ behind
them, drawn from experience — in the spirit of OpenAI's _Harness engineering_ article and
this repo's own `docs/implementation-authoring/` and `docs/design/`. The guidance is a
first-class deliverable of each product, not an afterthought.

Every product and layer also ships a **versioned generation guideline** — the precondition
for prompts that trace back to design and stay legible and learnable over time — recommended,
not enforced.

## Why this is credible

- **Lived and iterated for years.** This is the author's own working method, refined across
  multiple generations of use, not a theory.
- **Already shipped once.** The full four-stage workflow shipped as v0.7.0
  (`agentic-workflow-kit`) — `define-product`, `design-technical-solution`,
  `plan-delivery-track`, and execution via `implement-next` / `workflow-autopilot`.
- **Running today, on this repo.** The kit dogfoods its own method to build itself: the
  planning skills under `.agents/skills/` (`plan-epic`, `plan-delivery`,
  `orchestrated-delivery`) and the `delivery-retro` lessons ledger are the workflow in use.
- **Independently corroborated.** Published industry experience reaches the same core
  conclusion — that the durable leverage is the _harness_ around the agent, not the prompt;
  that architecture and mechanical invariants are an early prerequisite for agent-built
  software; and that recurring human judgment should be encoded so it compounds. See the
  research catalogued under `docs/research/agent-harness-lessons/` (notably OpenAI's
  _Harness engineering_). Approaches tuned for very high throughput make different
  merge-and-autonomy tradeoffs by design — the kit makes that tradeoff a policy choice
  rather than a fixed stance.

## Relationship to the existing design corpus

This product definition is the **source of truth**. The current `docs/design/` corpus is the
design of **the package** — the deterministic control plane, the four provider seams, the
event log, evidence gates, capability attestation, and worker/runner isolation — a
**supporting reference**: valuable prior engineering work built before this product layer
existed, not a co-authority. Where the product diverges from it, the
design is **reconciled to follow** — a deliberate downstream step, not gratuitous churn.
Engineering decisions the product doesn't touch stay put. This document also names the
product the engine serves and the supporting products the corpus does not yet cover.

## Sequencing (we are not scoping yet)

Deliberately **not** phasing now. First, define every product fully (this map, then a
deep-dive per product). Then dive **package first**, by priority. Phases — including which
parts of the package itself may defer (e.g., a specific agent adapter) — are planned once
the product requirements exist in front of us.

## Open questions

- **Spectrum generalization.** How the upstream products and the learning loop adapt to
  throughput-leaning methodologies is an open deep-dive, taken when we reach those
  products — not claimed here.

_Decided:_ the product is named **Jig** — CLI `jig`, package `@agentic-workflow-kit/jig`,
under the `agentic-workflow-kit` suite umbrella. Each product gets its own deep-dive doc
under `docs/product/products/`, with this file as the index at `docs/product/README.md`; the
learning loop is a separate, suite-level product kept out of the package's per-run hot
path; it consumes the package's observability and can harden any layer (including the
package) between runs.

## Next step

Deepen **the package** product first — expand its sub-module placeholders into a
product-level overview — then proceed to the supporting products by priority.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../README.md) · **← Prev:** [documentation home](../README.md) · **Next →:** [Jig — the package (main product)](./products/jig.md)

**Children:** [Jig — the package (main product)](./products/jig.md) · [Tracks — parallel independent work](./concepts/tracks.md) · [Design → plan (supporting product)](./products/design-to-plan.md) · [Product → design (supporting product)](./products/product-to-design.md) · [Define product (supporting product)](./products/define-product.md) · [Learning loop (supporting product)](./products/learning-loop.md) · [Product layer — authoring plan (cross-session playbook)](./authoring-plan.md) · [Product layer — status](./STATUS.md)

<!-- /DOCS-NAV -->
