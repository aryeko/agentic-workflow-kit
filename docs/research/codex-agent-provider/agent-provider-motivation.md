---
title: kit-vnext - Agent provider motivation and needs
status: draft
last-reviewed: "2026-06-21"
---

# Agent provider motivation and needs

This document defines **what we need from an Agent provider and why**, before anyone defines how.
It is deliberately the layer *above*
[`agent-provider-requirements.md`](agent-provider-requirements.md): it names the abilities we must be
able to express and the truths that must stay tellable through this seam. It does not state
obligations, guarantees, shapes, or degraded behavior — those are requirements, and they are authored
downstream against this brief.

Read this first when designing the Agent seam from fresh. Read the requirements doc and the design
corpus ([`../design/30-domain-reference/providers/agent-execution/`](../../design/30-domain-reference/providers/agent-execution/README.md))
second, once the needs here are agreed.

## Why this doc exists (the layer split)

The requirements doc and the contract types push naturally toward a solution: methods, data shapes,
guarantees, fail-closed semantics. Useful — but if we start there, the solution silently inherits the
shape of whatever provider we looked at last. This brief exists to hold the line one step earlier, so
the people authoring requirements and the contract are designing against *needs*, not against a
half-remembered API.

The distinction we hold:

- A **need** names an ability we must be able to express, or a truth that must stay tellable, through
  this seam. It stops there.
- A **requirement** adds obligation and acceptance: *must*, *with fresh evidence*, *in this shape*,
  *and when absent, degrade to X*.

Same subject, two layers:

| What we need (this doc) | Requirement (downstream) |
|---|---|
| We need to know whether an ability is real, faked by the driver, only claimed, or absent. | The driver MUST return a four-valued status with evidence basis, scope, and freshness per capability. |
| We need to answer a specific surfaced request, and to know when we can't. | A reply MUST target a request id; an unanswerable channel returns a typed failure. |
| We need raw output kept out of the event log. | Payloads MUST be stored as artifact references; events carry the reference only. |

Everything to the right of that line is out of scope here. Holding this split is the point.

## Motivation

kit-vnext is a deterministic control plane that delegates bounded work to agent workers, watches them,
takes their output, and records evidence. The control plane is plain code; there is no LLM
orchestrator making the decisions.

That only works if there is **one seam** between the control plane and whatever actually runs the
agent. The runtime behind that seam is not fixed and will not stay fixed: it may be a CLI, an MCP
server, an app-server, an SDK, a remote API, a local daemon, or a mock. These runtimes differ
enormously in what they can do — one can only hand back a final result, another can be interrupted,
answered, and resumed across a restart. The control plane must run against the weak ones and the
strong ones **without changing**, and without ever being told a runtime can do something it cannot.

So the need is not "an interface to Codex." It is a way to **express what we need from any agent
runtime, and to find out honestly what each one actually offers.**

## Why design this fresh (not from a provider API)

If we derive the seam from an existing provider's surface, three failures follow:

- **Overfitting.** The provider's vocabulary (its approval enums, its event names, its session model)
  becomes our abstraction, and the next runtime has to be bent to fit a shape that was never neutral.
- **Capability laundering.** A method that exists because *this* provider has it implies every
  provider has it. Weak providers then either stub it (looks broken) or fake it (lies).
- **Hidden assumptions.** Provider APIs quietly assume a local process, a live socket, an ordered
  stream, or an owned session. Bake those in and the seam stops meaning anything for a remote API or
  an observe-only attach.

Designing from needs first lets the provider variability stay *information we discover*, not structure
we inherit. The existing Codex-shaped contract in the design corpus is a useful reference for what a
strong runtime can do — it is not the shape the seam must take.

## The need (one sentence)

A seam through which the control plane can **give an agent bounded work, watch what it does, respond
when it asks, and ask it to stop — across runtimes that support wildly different subsets of that —
without the seam ever overstating what a given runtime can actually do.**

## What we need — the abilities

We need to be *able to*:

- start a bounded unit of agent work, or rejoin one already in motion;
- hand the agent more input while it runs;
- see what the agent says, does, asks for, and produces;
- look back over what already happened, in a bounded way;
- know, in our own vocabulary, what state the run is in;
- give a structured answer to something the agent specifically asked;
- ask the run to wind down gracefully;
- find out which of these a given runtime actually offers;
- reference the heavy, sensitive output — transcripts, command output, paths — without carrying it in
  our own records.

Stated as needs, not obligations: there is no *must*, no shape, no guarantee, and no degraded path
here. How strong each ability has to be, and what its absence means, are requirements.

## What we need — distinctions that must stay tellable

These are not rules about behavior. They are truths the abstraction must never let collapse. We need
to always be able to tell apart:

- a **message** to the agent from an **approval or grant** — talking to a worker is not permitting it;
- **seeing** a request from being **able to answer** it — observation is not a channel;
- an answer aimed at **one specific request** from a message merely sent into the run;
- a runtime **agreeing to stop** from a process **actually being gone**;
- something the **runtime does natively** from something the **driver fakes** on its behalf;
- **holding an id** from **owning the run** it names;
- a **claimed** ability from a **proven** one.

If the seam ever makes one of these pairs indistinguishable, it has lied on our behalf — no matter
what any later requirement says. Preserving these distinctions is the load-bearing part of the design.

## What we need — the spread to absorb

We need a single seam to span the entire range from "can only return a final result" to "can be
interrupted, answered, and resumed across restarts," and to treat *every* ability above as possibly
**native, possibly emulated, possibly only claimed, possibly absent**. The need is that weak and
strong runtimes are the *same kind of thing* at this seam, differing only in what they can honestly
report — not in which interface they implement.

## Design stance the fresh design should keep

Not requirements — guardrails for whoever writes the requirements and the contract:

- **Honesty over optimism.** Unknown is a first-class answer. The seam should make "we don't know"
  and "the driver faked this" expressible, never round them up to "supported."
- **Fail closed.** When an ability is absent, unproven, or only emulated, the safe default is to *not*
  do the dependent thing — not to assume it works.
- **Discover, don't infer.** What a runtime can do is something we ask and are told, scoped to that
  exact runtime/version/config — never something we deduce from a call that happened to succeed or
  from possession of an id.
- **Neutral vocabulary.** The seam's words should name roles (start, observe, answer, stop), not any
  runtime's transport, protocol, or product nouns.
- **Reference, don't carry.** Heavy and sensitive material lives behind references; our records hold
  the normalized fact and a pointer, not the payload.

## What this brief deliberately leaves out

To other layers and domains, on purpose:

- **The requirements layer** — exact abilities as obligations, evidence strength, freshness, scoping
  rules: [`agent-provider-requirements.md`](agent-provider-requirements.md).
- **The contract** — method set, data shapes, return types, event vocabulary, degraded semantics: the
  design corpus.
- **Process spawn, containment, and hard kill** — the Execution Host. Asking a run to stop is not the
  same as ending a process tree, and that line lives elsewhere.
- **Approval policy and adjudication** — whether a request should be granted, and what a grant means.
  We need to surface a request and relay an answer we are handed; we decide nothing.
- **Completion, verification, merge, recovery** — downstream of this seam entirely.
- **Credential issuance and the redaction set** — consumed, not defined here.
- **Artifact storage** — referenced, not designed here.

## Open questions to resolve before requirements and contract

1. **Ownership evidence.** What lets us trust an "I own this run" claim beyond the driver asserting
   it? Without an answer, rejoining a run can over-claim control.
2. **Faked answers to approvals.** When a runtime can only send free text, may the driver *emulate*
   answering a request by sending text? For anything approval-shaped this looks unsafe — free text is
   not a grant — and we should decide that here, as a need, not discover it later.
3. **Durability vocabulary.** What is the minimal neutral way to say whether an answer can still be
   delivered after a disconnect or a restart, across a live socket, a reconnectable thread, and a
   stateless resend?
4. **State: asked or derived.** Do we need run state as a thing we can ask for, a thing we fold from
   what we observed, or both — and what happens when those two disagree after a reconnect?
5. **More than one open request.** Can a run have several unanswered requests at once, each needing
   its own target? If so, "waiting for input" is plural, and the need should say so.
6. **Proving "emulated" never lies.** What would convince us that a driver's faked ability reports
   itself as faked and fails closed for anything safety-critical?

## How to use this doc

When authoring the requirements or the contract, every obligation should trace back to a need or a
distinction here. If a requirement has no need behind it, it is probably a provider detail that leaked
in — drop it or bring the need up to this layer first. If a need here has no requirement covering it,
the requirements are incomplete.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../README.md) · **← Prev:** [Design closure apply report](../apply/APPLY-REPORT.md) · **Next →:** [Agent provider functional requirements](./agent-provider-requirements.md)

<!-- /DOCS-NAV -->
