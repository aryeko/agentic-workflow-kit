---
title: "Learning loop (supporting product)"
status: draft — product overview
last-reviewed: "2026-06-27"
---

# Learning loop (supporting product)

The learning loop is a **suite-level product that runs between runs, not inside them**. Jig
owns runtime observability — structured, machine-readable records of every decision,
authorization, gate, and outcome — and the learning loop **consumes those records** as its
starting point. Via human-led root-cause retro, it traces any surfaced issue back to the
**earliest layer** that should have caught it, then **hardens that layer** — turning a
recurring defect class into a permanent, mechanical check. That is how prevention compounds
across deliveries rather than repeating.

This document is a **product-level overview**: what the learning loop does _for you_ and _why
it matters_, not how it is built. The kit's existing `delivery-retro` skill and the
lessons-ledger practice in `docs/implementation-authoring/lessons-ledger.md` are prior art
and a supporting reference — this product is the productization and generalization of that
practice. This doc describes the product at altitude.

## Why the learning loop

**Faithful execution of good inputs still lets some defects through.** Even a strong PRD,
a deliberate design, a well-decomposed plan, and Jig's control guarantees do not eliminate
defects — they reduce the attack surface. What slips through the current layer will surface as
a failure or a repeated surprise in a future run.

The naive response is to patch forward — fix the specific instance and move on. The loop
rejects that. **An instance is evidence of a class.** A story that fails because its
acceptance criterion was unprovable is not just that story; it is a signal that the planning
guideline for writing acceptance criteria has a gap. Patching the story leaves the gap in
place; promoting that gap to a mechanical check closes it for every story that follows.

That is the loop's core discipline: **trace-back, not patch-forward.** And that distinction
is how individual deliveries compound into a progressively more reliable system over time —
not by getting lucky with a particular run, but by making each failure expensive to repeat.

The prior art is live in this repo: the `delivery-retro` skill and the lessons ledger have
operated through every major delivery cycle and produced the hardened checks and
implementation-authoring conventions in `docs/implementation-authoring/`. The learning loop
is the generalization and productization of that practice.

## Responsibilities

The learning loop is organized around five responsibilities, each with intended behavior and
ID'd requirements.

### Issue intake

**Intended behavior.** The loop begins with **structured intake of any issue that surfaced**
in a run — a blocked story, a gate that failed, a policy that was wrong, a defect that
merged, a surprise in the records. Intake records the issue in a form the retro can work
from: what happened, where it was observed, and what evidence in Jig's records points at it.
This is the moment the machine-readable record becomes a human-readable signal.

**Product requirements.**

- **LOOP-1.** Issue intake consumes **Jig's machine-readable records** (see [Jig](jig.md),
  **⑤ SEE-2**) as a primary signal — not manual notes alone. The records are an input
  contract that the loop relies on.
- **LOOP-2.** Each intake entry records **what happened, where it was observed** (which run,
  which story, which gate), **and what evidence** in the records supports it. An intake entry
  that can't be traced to evidence in the records is not a loop input; it is an open
  investigation.

### Cross-stage root-cause trace

**Intended behavior.** The retro **does not stop at the symptom.** A story that blocked is
the symptom; the cause may be a planning AC that was not falsifiable, a design decision that
was implicit, a policy gate that was under-specified, or a PRD requirement that was vague. The
cross-stage trace follows the failure upstream through every layer — product, design, plan,
policy, gate, provider, prompt/eval, or harness — until it reaches the **earliest layer that
should have prevented it**. That is where hardening is applied.

**Product requirements.**

- **LOOP-3.** The root-cause trace is **cross-stage**: it does not stop at the layer where
  the symptom appeared. It explicitly asks: which upstream layer — PRD, design, plan, policy,
  gate, or harness — had the information to prevent this, and did not?
- **LOOP-4.** The trace is **human-led, not automatic.** The records provide the evidence; a
  human makes the judgment about causation. The loop does not claim to automate root-cause
  analysis — it structures and disciplines the human doing it.
- **LOOP-5.** The outcome of each trace is a **named, dated finding** that records what layer
  the root cause resided in and what allowed it to propagate. This is the input to hardening
  (LOOP-6) and to the lessons ledger (LOOP-8).

### Defect-class → mechanical-check promotion

**Intended behavior.** A root-cause finding becomes a **mechanical check** at the layer where
the defect originated — not a prose reminder, not a new guideline section, but a checkable
gate or a verifiable condition. A prose safeguard reproduces defects; a checkable box prevents
them. (This is the same discipline design → plan requires of story-level ACs — see
[design → plan](design-to-plan.md), **AC-4**; the loop applies it at the meta-level, to the
safeguards that govern the planning layer itself.)

**Product requirements.**

- **LOOP-6.** A recurring defect class is **promoted to a mechanical check** at the earliest
  layer that should catch it. The check is defined by input and proof — not by prose. A
  defect that recurs after a prose-only note is evidence the note was insufficient; the loop
  promotes it further.
- **LOOP-7.** Promotion can target **any layer** — PRD structure, design conventions, plan
  ACs, policy gates, provider checks, prompt/eval criteria, or the harness itself. The loop
  is not limited to the upstream stages; it can harden Jig's own policy and gate config
  between runs (see [Jig](jig.md), **②**). The earliest catchable layer, wherever it is, is
  where the check lands.

### Lessons ledger

**Intended behavior.** Each promotion is **recorded in a versioned lessons ledger** — a
durable log of the defect class, the trace that identified it, the check that was introduced,
and when. The ledger is the compounding asset: it makes the loop's output legible across
multiple delivery cycles, allows the same defect class to be recognized when it re-appears,
and feeds the versioned generation guidelines that make plans and designs traceable (see
[product README](../README.md)).

**Product requirements.**

- **LOOP-8.** Each promoted check is **logged in the lessons ledger** with the defect class,
  the layer where it was caught, the trace that identified it, and the check introduced.
- **LOOP-9.** The ledger is **versioned and durable** — not discarded at the end of a cycle
  or kept in ephemeral session notes. Its entries are the evidence that the loop has run and
  that a recurring class has been addressed.
- **LOOP-10.** The ledger is **machine-readable as well as human-readable** — so downstream
  tools (analyzers, dashboards, and future loop automation) can consume it alongside Jig's
  records.

### Per-stage hardening hooks

**Intended behavior.** The loop ships **documented hardening hooks** — per-stage interfaces
through which a new check can be wired into that layer's actual execution path. Knowing that a
check *should* land at the plan layer is only half the job; the hook is how it gets there in
practice. Hooks cover every layer the loop can reach: PRD conventions, design-artifact
structure, plan AC authoring, Jig policy and gate config, provider settings, prompt/eval
criteria, and harness configuration.

**Product requirements.**

- **LOOP-11.** A documented hook is provided for each layer the loop can harden. A hook
  states **where in that layer the check lands**, **what form the check takes** (a linter, a
  gate predicate, an AC template rule, a policy setting), and **how to verify it closed the
  defect class**.
- **LOOP-12.** Hooks are **first-class deliverables**, not appendix material. The loop
  without hooks produces findings; with hooks it produces prevention.

## Per track

Learning-loop sessions consume run records **per track** — a retro is scoped to the runs and
stories for a given track, and the checks it introduces target that track's configuration
unless the defect class is clearly suite-wide (in which case the trace will say so). A repo
running many tracks in parallel produces independent retro material per track. See
[Tracks — parallel independent work](../concepts.md).

## Honest edges

- **Out of Jig's per-run hot path.** The loop is a **between-runs product**. It does not
  operate during execution. A minimal-product user running Jig alone can still inspect the
  records directly to diagnose a bad plan or policy (see [Jig](jig.md), **⑤ SEE-4**) — the
  loop is an accelerant for systematic prevention, not a prerequisite for visibility.
- **Human-led, not automatic.** The records lower the cost of root-cause analysis; they do
  not automate it. A human makes the trace and the promotion decision. This is a discipline,
  not a pipeline.
- **Distinct from the throughput fix-forward scan.** The throughput-leaning path allows an
  instance-level, execution-time scan to catch issues after merge and spawn follow-up stories
  (see [Jig](jig.md), **③ ISO-2**; **② CFG-7**). That scan is class-*instance*, at
  execution time — a different thing from the learning loop, which is class-level and
  between-runs. The loop is not a substitute for the scan, and the scan is not a substitute
  for the loop.
- **Methodology-dependent — no plug-and-play claim yet.** The loop is currently tuned to the
  author's prevention-leaning default, where it works well. A throughput-leaning user would
  aim the same root-cause discipline at specs, plans, and possibly policy — plausibly similar
  in shape, but the methodology adaptation is a deliberate deep-dive, not a current promise.
  Generalizing the loop across the full policy spectrum is an open research item. (The package
  supports the spectrum through policy; the loop is not yet there.)
- **Likely the last product to deep-dive.** The loop's value is proportional to the maturity
  of the layers it hardens. It depends on the upstream products existing and running; expanding
  the loop in depth is the right work once the others are solid.

## Cross-links

- **Consumes Jig's machine-readable records.** The structured records emitted by Jig's
  observability layer (see [Jig](jig.md), **⑤ SEE-2**) are the loop's primary input. Those
  records are an input contract, not human-only logs — the loop is one of the suite tools
  they are designed for.
- **Can harden any layer, including Jig's own configuration.** The loop's root-cause trace
  can reach as far back as the PRD and as far forward as Jig's policy and gate config
  (see [Jig](jig.md), **②**). No layer is off-limits to hardening.
- **Ties to design → plan's AC-4.** The promotion principle — prose safeguards reproduce
  defects, checkable boxes prevent them — is the same discipline design → plan requires of
  story-level acceptance criteria (see [design → plan](design-to-plan.md), **AC-4**). The
  loop applies that discipline at the meta-level: to the authoring rules and policy checks
  that govern the planning layer itself.
- **Distinct from the instance-level fix-forward scan.** The throughput-path scan
  (see [Jig](jig.md), **③ ISO-2** / **② CFG-7**) operates at execution time on individual
  story instances. The loop operates between runs on defect classes. Both serve prevention;
  neither replaces the other.
- **Per track** — see [Tracks](../concepts.md).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](../README.md) · **← Prev:** [Define product (supporting product)](./define-product.md) · **Next →:** [Product layer — status + authoring plan](../status.md)

<!-- /DOCS-NAV -->
