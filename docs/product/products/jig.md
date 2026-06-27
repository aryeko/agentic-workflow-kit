---
title: "Jig — the package (main product)"
status: draft — product overview
last-reviewed: "2026-06-27"
---

# Jig — the package (main product)

Jig is the deterministic execution engine you run as `jig` (the package
`@agentic-workflow-kit/jig`). You hand it one thing — a schema-conformant **execution plan**,
the decomposed, dependency-ordered work the upstream products produce — and it delivers that
work **as far as your configured policy allows**: from pushing a branch for you to review, all
the way through a verified, reviewed, merged change — or, at the throughput end,
merge-and-fix-forward, where a follow-up scan _you enable_ catches issues after. It does
this **safely, recoverably, and under your supervision** — interrupting you only when a real
decision is on the line. This is the base product; everything else in the suite exists to feed
it a good plan.

This document is a **product-level overview**: what each part of Jig does _for you_ and _why it
matters_, not how it is built. The full engineering design already lives under `docs/design/`
and is a supporting reference here, not a re-architecture.

## Why Jig

The hard part of agentic delivery isn't getting one good session — it's the long-running
_loop_ of them: implement, review, PR, address feedback, merge, next story, without it
breaking or drifting. The suite's job is to bring proven single-session discipline to that
loop (see the [product definition](../README.md)); **Jig is the engine that runs it.**

You give Jig a good plan and a policy, and it executes that loop as a **contained,
recoverable, evidence-gated** run you can actually trust — the worker only does what you
authorized, earns autonomy by proof, can't game its own gates, recovers instead of
restarting, and runs on whatever stack you bring. You keep control and are interrupted only
when a real decision is on the line. The five guarantees below are how.

## How to read this doc — the five guarantees

Jig makes five promises. They are listed control-first, because trust is the point: a fast
engine you can't trust is worthless, and the whole product is organized around earning that
trust.

1. **Control & trust** — the agent can only do what you authorized, earns autonomy by proof,
   can't weaken its own guardrails, pulls you in only for real decisions, and lands
   irreversible changes only on independent evidence.
2. **You own the configuration** — you set what's allowed and how the work is done, per track,
   guided into a sensible starting point and free to tune.
3. **Never lose work; resume safely** — a run survives crashes and failures without losing
   progress, repeating irreversible actions, or sinking on one bad story.
4. **Runs against your stack** — your agent, host, forge, and work source behind clean seams;
   every guarantee holds no matter which you bring.
5. **See everything** — every run is fully observable as structured, durable, machine-readable
   records that you and your tools can read.

### The one principle that runs through all five: enforce vs. guide

Jig draws a deliberate, three-tier line between what it **enforces** and what it merely
**guides**:

1. **System-enforced floors** — non-negotiable, on by default, not yours to turn off. There is
   exactly one hard input schema (the execution plan Jig owns), plus the control-cluster floors:
   nothing runs unauthorized, the agent can't weaken its own guardrails, and only the
   privileged runner — never the worker — performs irreversible actions like push and merge.
   These floors are what make every other promise _true_ rather than aspirational.
2. **User-enforced controls** — gates, checks, required reviews, policy, and the hardened
   defect-checks _you_ choose to impose. Strong, but your call.
3. **Product guidance** — best practices, presets, prompt strategy, per-layer authoring
   guidelines: reasoned defaults you can follow or override freely.

Most of Jig sits in tiers 2 and 3 — it _guides_, it doesn't dictate. **The control cluster
(guarantee ①) is the principled exception**: it is the one place Jig enforces rather than
guides, on purpose, because these are the floors trust stands on. The rest of this document
calls out, per guarantee, which tier each promise lives in.

---

## ① Control & trust

_The center of gravity. Lead with this: it is the part of Jig that is **enforced**, not guided._

**Intended behavior.** The agent is a contained worker that can only ever do what you've
authorized. It earns autonomy by proof rather than assumption, can't weaken its own guardrails,
pulls you in exactly when a real decision is on the line — not for routine work, and not never —
and lands irreversible changes only on independent evidence, never on its own say-so. This
cluster is **the deliberate exception to "guide, don't enforce."** These are the
**system-enforced floors** that make every other promise in this document hold; the rest of Jig
can be configured loose or strict, but these floors stand regardless.

This guarantee is five sub-promises. Each is a floor.

### ①.1 The fence — runtime authorization

Every request the agent makes — a command, a file write, a network or egress call, a provider
call — is checked against your policy and an approved permission set **before** it runs. The
worker that writes code holds no privileged credentials of its own.

**Product requirements.**

- **FENCE-1.** Every request is authorized against an approved permission set before it
  executes. If a request isn't declared and approved, it **fails closed** — the default is
  "no," not "ask later."
- **FENCE-2.** Permissions are approved up front. Widening them **requires re-approval, not a
  runtime ask** the agent can talk its way through mid-run.
- **FENCE-3.** The worker **never holds privileged credentials** (for example, forge
  credentials). Only the runner acts on them, on the worker's behalf, through the gates.

### ①.2 Earned trust — capability attestation

Autonomy is earned by proof, not granted by assumption. Before Jig lets a driver act
autonomously on a given capability, that capability has to be _proven_ for that driver — fresh.

**Product requirements.**

- **EARN-1.** Auto-granting any capability requires a **fresh, positive proof** that the
  relevant driver actually has it. Missing, stale, or failed proof routes to a **human,
  regardless of how permissive your policy is.**
- **EARN-2.** Proof is **per driver and re-checked**, not assumed once and trusted forever. A
  driver that can't prove a capability simply gets **less autonomy** — more human checkpoints —
  it never silently loses a guarantee.

### ①.3 Anti-gaming — it can't weaken its own guardrails

_The sharpest differentiator. An agent that can quietly relax the very gates meant to check it
has no real gates at all._

**Product requirements.**

- **GUARD-1.** The policy in force is **fixed at the moment a run launches.** The agent can't
  loosen its own constraints partway through the run.
- **GUARD-2.** If the work touches **protected parts of the project** — CI definitions, the
  policy itself, the gates, the verification setup — completion is **blocked until you
  re-approve and the work is re-verified** under the original policy. The agent cannot edit the
  rules it is being judged by and then declare itself done.

### ①.4 The doorbell — approval & escalation

You are pulled in exactly when a real decision is on the line. Not for every routine step
(that would defeat delegation), and not never (that would defeat trust).

**Product requirements.**

- **DOOR-1.** A **deterministic risk classification** drives an escalation ladder: low-risk and
  proven work can proceed automatically; medium- or high-risk or unproven work routes to a
  human; the default when in doubt is **fail closed.**
- **DOOR-2.** Escalations are **recorded the instant they happen and survive a process or
  machine dying.** The run parks in place and resumes on your decision — it does not lose your
  pending question to a crash (see ③, _never lose work_).
- **DOOR-3.** When you do grant something, the grant is **scoped as tightly as the situation
  allows** — this one command, this command prefix, this host, this session — **never a blanket
  yes.**

### ①.5 Merge-on-evidence — the worker doesn't merge its own word

The single most consequential action — landing a change — is never taken on the agent's
assertion that it's done.

**Product requirements.**

- **MERGE-1.** Completing and landing work requires **independent evidence** — passing CI,
  reviews, verification — _plus_ a proven capability, never the worker simply asserting
  "finished."
- **MERGE-2.** **Push and merge are the runner's authority, never the worker's.** The thing that
  writes the code is not the thing that ships it.
- **MERGE-3.** The conditions under which a change may merge are **explicit and bound to your
  policy** — they sit on the merge spectrum you configure (see ②), so "what counts as done" is
  your decision, made once, up front.

**Honest edges.** This cluster IS the enforced part of Jig — the deliberate exception to "guide,
don't enforce." Be clear-eyed about what that buys and what it doesn't: these floors hold
_regardless of policy_, but the **strength of any individual run depends on the gates being
real.** Policy lets you configure trivial gates — a verification step that checks nothing, a
review that rubber-stamps — and Jig will honor that configuration. What it will not let you do
is bypass the **floors themselves**: authorization, the anti-gaming protection, and
runner-owned merges hold even when your gates are weak. Jig guarantees the _shape_ of trust;
the _substance_ of each gate is yours to set well.

**Cross-links.** ①.2 (earned trust) is the per-driver proof behind _runs against your stack_
(④). ①.3 (anti-gaming) is _why_ policy is protected while config is free (②). ①.4's
park/resume is the same machinery as _resume safely_ (③). ①.5's evidence is exactly what _see
everything_ (⑤) shows you, gated by the merge spectrum you set in _configuration_ (②).

---

## ② You own the configuration

**Intended behavior.** You control two distinct things: **what is allowed and required**
(your **policy**) and **how the work is actually carried out** (your **work profile**) — both
scoped **per track**. You aren't handed a raw wall of switches: a guided setup reads your
intent and drops you onto a sensible starting configuration, which you are then free to tune.
What _actually_ runs is **computed** from your settings and the plan — you never hand-set it.
Nothing here is a black box, and nothing critical can be silently weakened.

**Product requirements.**

- **CFG-1. Policy is the governance contract.** It expresses _risk_: your gating posture and
  merge spectrum, concurrency ceiling, retry budget, whether review is required, the approval
  and escalation rules, and the anti-gaming protection. Because policy governs safety, **changing
  it is gated** — re-approval and re-verification — and it carries **repo-level floors a single
  track cannot weaken.**
- **CFG-2. The work profile is the realization.** It expresses _cost, quality, and behavior_:
  which model, how much effort, the prompt strategy, and how roles are realized (for example,
  whether each story gets its own reviewer). Because it does not govern safety, it is **freely
  tunable, not safety-gated, and versionable.**
- **CFG-3. Configuration is per track.** A **track** is one independent line of work —
  PRD → design → plan → policy → work profile — that runs on its own and in parallel with
  others; a single repo hosts many. Policy and profile are scoped to the track (with policy
  still honoring the repo-level floors).
- **CFG-4. The actual is computed, not configured.** You set a _ceiling_ (policy) and a
  _realization_ (work profile); the runtime derives what actually runs from those plus what the
  plan currently permits. (Concretely, concurrency settles at roughly the smallest of: what the
  plan makes eligible times your workers-per-story, what you requested, and your maximum.) The
  point is that you set intent, not the live number — so the live number is always safe and
  always consistent with the plan.
- **CFG-5. Setup is guided by your intent.** A short conversational setup interviews _how you
  work_ — how to handle a blocked story, how aggressively to gate, whether to open PRs
  automatically, whether each story gets a reviewer, which prompt strategy — and maps your
  answers to a **named preset** (for example: _prevention_, _balanced_, _throughput_). You tune
  from there. Raw configurability is never the first thing you see. (Prior art: the existing
  `workflow-init`.)
- **CFG-6. Presets are strong defaults that carry their reasoning.** They are encoded
  best-practice starting points, usable with or without the interview, and they come with the
  _why_ — guidance plus reasoning, not a locked choice. Deviate freely.
- **CFG-7. Open seams, not a closed turnkey.** Jig exposes records, hooks, and contracts — for
  scheduling, story creation, and more — so you and contributors can build what Jig doesn't
  ship: fix-forward scanners, analyzers, evals, dashboards. Jig's job is to **enable**, not to
  build everything. (The fix-forward scanner is an _extensibility example_, not a shipped Jig
  feature.)
- **CFG-8. Prompt strategy is a guided three-level ladder.** It matches the maturity of your
  work: **fully dynamic per task** while you're still discovering patterns, **templated and
  plan-injected** as those patterns stabilize, **unified role prompts** once execution is
  solid. Traceability comes from **versioned generation guidelines at every layer** (canonical
  design → epic → story → prompt) — _recommended, not enforced_.

**Honest edges.** Presets are _starting points_, not a guarantee of fit for your project — they
encode one set of good defaults, and a real project may need tuning. The per-layer generation
guidelines are recommended, not enforced: ignore them and you trade away some legibility in how
prompts trace back to design — Jig won't stop you.

**Cross-links.** Blocked-story resolution (③) is _this same policy surface_ seen from the
failure path. Prompt-strategy choices land their consequences in the learning loop's
traceability (a suite concern, out of scope here). **The backbone of this guarantee:** _policy
is protected; config is free._ That line is exactly _why_ the anti-gaming gate (①.3) guards one
and not the other — and it is what makes per-track configuration safe to hand you.

---

## ③ Never lose work; resume safely

**Intended behavior.** A run survives both **infrastructure interruption** (a process or
machine dies, an approval expires, you pause it on purpose) and **work-level failure** (a story
turns out to be blocked) — without losing independent progress, without unsafe repetition, and
with the _resolution_ of any failure governed by **your policy.** You never restart from zero,
and you never get a silent double-merge.

### (A) Interruption resume — surviving a crash, pause, or expiry

**Product requirements.**

- **RESUME-1. Durable progress.** Completed work and state transitions are persisted **the
  moment they happen.** A crash never loses progress that was already recorded.
- **RESUME-2. Resume from the last checkpoint, not from scratch.** Only the work since the last
  safe point re-runs, and it re-runs **idempotently** — repeating it produces the same result,
  not a doubled one.
- **RESUME-3. Safe resume — no double effect.** Irreversible actions already taken (a push, a
  merge) are recorded and **never repeated** on resume.
- **RESUME-4. Fail-closed and diagnosable.** When Jig can't safely continue, it **parks in a
  named, inspectable state** rather than guessing — never silent partial progress you have to
  reconstruct.
- **RESUME-5. Resume integrity.** On resume, Jig re-validates the policy and contract context.
  If the world changed in a protected way while it was down, it **re-approves and re-verifies**
  before continuing (this is the same protection as ①.3).

### (B) Work-level failure isolation + policy-determined resolution

_The most common real case: an implementer rejects a story mid-run because a prerequisite isn't
satisfied._

**Product requirements.**

- **ISO-1. Fault isolation, dependency-aware.** A blocked or rejected story halts **only itself
  and everything downstream of it.** Every independent story keeps running. One bad story never
  sinks the whole run.
- **ISO-2. Resolution is policy-determined** — it hands off to your configuration (②):
  - _Prevention-leaning_ — quarantine the blocked subgraph, surface it for a human or a re-plan,
    and resume once it's fixed. Ancillary actions, like opening a PR for the work that _is_
    mergeable, are configurable.
  - _Throughput-leaning_ — don't block the merge on an under-defined item: merge, log the issue,
    and let a **fix-forward scan you enable** (an extensibility seam, not a shipped Jig
    feature — see ②, CFG-7) later either approve it or spawn a follow-up story to align
    direction.
- **ISO-3. Every block is a first-class, logged event** — so a human, a scan, and the learning
  loop can all see _what happened and why_ (this is what makes ⑤'s visibility real for
  failures).

**Honest edges.** Resume granularity is the **checkpoint, not the individual instruction** —
Jig resumes from the last safe checkpoint, not from the exact keystroke. Isolation is only as
accurate as the **declared dependencies**: a hidden cross-dependency the plan missed can still
surprise you — which is itself a signal that the planning layer should be hardened (a job for
the learning loop, between runs, out of scope here). And a genuinely corrupt substrate degrades
to a **diagnosable stop**, not magic recovery — Jig will tell you it can't safely proceed rather
than pretend it can.

**Cross-links.** Park-and-resume comes from ①.4's doorbell. Blocked-story resolution comes from
the policy spectrum in ②. Note the distinction between the throughput **fix-forward scan**
(instance-level, at execution time, an _enable-not-build_ seam) and the **learning loop**
(class-level, between runs, a separate suite product) — they are different things and only the
seam belongs to Jig.

---

## ④ Runs against your stack

**Intended behavior.** Jig orchestrates against _your_ stack — your **agent** (Codex, Claude,
…), your **execution host**, your **forge**, your **work source** — behind four clean seams.
Swap any one without disturbing the others. And the part that matters most: **every control,
evidence, and recovery guarantee in this document holds regardless of which driver you bring.**
A weaker driver earns _less autonomy_; it never weakens a guarantee.

**Product requirements.**

- **STACK-1. Your guarantees don't depend on your vendor** _(lead with this — it is the
  differentiator)_. Control, evidence, and recovery hold no matter whose driver you plug in: the
  worker stays contained behind the seam, irreversible actions stay the runner's, and gates
  stand on **evidence, not the agent's word.** This invariance is precisely what makes "bring
  any agent" _safe_ instead of a leap of faith. Provider-agnosticism on its own is table stakes;
  guarantee-invariance is the promise.
- **STACK-2. Four swappable seams.** **Agent · Execution Host · Forge · Work Source** — each a
  stable contract. Bring a driver for each, and swap any one independently of the others.
- **STACK-3. Bring your own agent is a work-profile choice.** Which agent and model _is_ the
  Agent seam — so "vendor independence" and the work profile's model dial (②, CFG-2) are the
  same lever seen from two angles.
- **STACK-4. Capabilities are attested, not assumed.** What a given driver can do autonomously
  is **proven per driver** (①.2). A driver that can't prove a capability simply gets more human
  escalation — never a silently degraded guarantee.
- **STACK-5. Seams are security boundaries.** Credentials and authority **do not cross a seam.**
  The worker never holds forge credentials; only the runner performs irreversible actions
  (①.1, ①.5).

**Honest edges.** A **seam is not a shipped driver.** The seam — the universal contract — is
what Jig guarantees; drivers ship _incrementally_ against it. Be explicit about which exist
today (Codex drove the current generation of this work) versus which are buildable against the
contract but may lag (a Claude adapter, for instance). A partial driver means **reduced
autonomy**, not magic — you'll do more of the supervising until that driver proves itself.

**Cross-links.** Driver-independence is the control cluster (①) seen from the integration angle.
Attestation is earned trust (①.2), per driver. Bring-your-own-agent is the configuration model
choice (②, CFG-2). The framing to lead with is **invariance, not "we have four seams"** — the
seam count is plumbing; the promise is that your guarantees don't move when your vendor does.

---

## ⑤ See everything

**Intended behavior.** Every run is fully observable — what the agent did, what was authorized,
what was gated, what passed or failed, and why a story blocked — captured as **structured,
durable, machine-readable records.** You can reconstruct the whole run; so can your tools; and
even running Jig entirely on its own, you can diagnose a bad plan or a bad policy straight from
those records.

**Product requirements.**

- **SEE-1. Full run visibility.** Decisions, authorizations, gates, evidence, approvals, state
  transitions, and outcomes are all captured. You can reconstruct **what happened and why**
  without re-running anything.
- **SEE-2. Structured and machine-readable by design.** The records are an **input contract**,
  not human-only logs — the substrate that suite tools consume (the learning loop, evals,
  dashboards, analyzers). Observability is a deliberate product surface here, not an
  afterthought bolted on.
- **SEE-3. The records ARE the evidence.** Observability and the gates share **one source of
  truth** — you see exactly what the system saw when it decided. There is no separate audit log
  that can drift out of agreement with what actually governed the run.
- **SEE-4. Self-diagnosis, no extra tooling required.** On the minimal product — Jig alone — you
  inspect the records directly to diagnose a bad plan or a bad policy. The learning loop is an
  **accelerant, not a prerequisite**; you are never blind without it.

**Honest edges.** This is "see everything **Jig governs**" — the control-plane events, the
gates, the evidence — **not** "read the agent's mind." The records give you the _evidence_, not
the _diagnosis_: a human or the learning loop still interprets them. It is a **substrate, not an
oracle** — it tells you faithfully what happened, and leaves the judgment to you.

**Cross-links.** "The records are the evidence" connects straight to merge-on-evidence (①.5) —
same source of truth. Machine-readable records are the input contract for the learning loop and
the enable-not-build seams (②, CFG-7). And full visibility is what makes _resume safely_'s
"first-class logged block" (③, ISO-3) actually inspectable.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](../README.md) · **← Prev:** [Product definition](../README.md) · **Next →:** [Tracks — parallel independent work](../concepts/tracks.md)

<!-- /DOCS-NAV -->
