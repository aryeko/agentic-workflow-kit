---
title: "Jig — the package (main product)"
status: draft — product overview
last-reviewed: "2026-06-30"
---

# Jig — the package (main product)

Jig is the deterministic execution engine you run as `jig` (the package
`@agentic-workflow-kit/jig`). You give it an approved **execution plan** and a **policy**; it
turns that plan into reviewed, landed work as far as the policy allows, or into a deliberate,
inspectable stop when the work should not continue.

This page is the product contract for Jig: who it serves, what job it does, what promises it
makes, and where its boundaries are. It does not define low-level protocol mechanics,
provider internals, safety classifiers, or delivery exit bars. Product owns what and why;
design and delivery planning own how those promises are implemented and verified.

## Product Spine

| Question | Product answer |
|---|---|
| User | An owner/operator with product and design judgment who cannot safely supervise every agent action manually. |
| Job | Turn an approved execution plan into reviewed, landed work while preserving human control. |
| Current alternative | A chain of one-off agent sessions, manual PR and review follow-up, ad hoc notes, and fragile recovery. |
| Before | The owner cannot tell whether the agent stayed inside policy, what evidence justified a merge, or how to resume safely after interruption. |
| After | The owner delegates execution under policy and receives evidence, escalation points, recovery, and a reconstructible outcome. |
| Non-fit | Jig is not a product-definition tool, a design authoring tool, an LLM project manager, or a way to bypass review judgment. |

## Workflow

Jig starts where planning ends:

1. You provide an execution plan and policy.
2. Jig runs eligible work under that policy, with the worker contained behind authorization
   and the runner holding privileged actions.
3. Jig asks for a human decision when policy, evidence, or capability proof requires it.
4. Jig lands work only on evidence, or stops in a named state with enough information to
   recover, re-plan, or reject.

```mermaid
flowchart TD
    A["You provide:<br/>approved plan + policy"] --> B["Jig runs the ready work<br/>in parallel, up to your limit"]
    B --> C{"Each story:<br/>safe to land on evidence?"}
    C -->|Yes| D["Landed<br/>with replayable evidence"]
    C -->|Needs your call| E["Parked<br/>waiting on your decision"]
    C -->|Can't proceed| F["Blocked<br/>with a logged reason"]
    E -->|You decide| B
    D --> G["A run you can replay,<br/>end to end"]
    F --> G
```

The supporting products can help produce the product definition, design, and plan. They are
strong defaults, not prerequisites. Jig's minimum input is a valid execution plan.

### Driving a run

You stay in control through a small set of deliberate actions. Each one is a single, recorded
move — not a free-form conversation with an agent.

- **Start** a run from your plan and policy, or **preview** what would run before committing.
- **Watch** it live — what's progressing, what's parked, what's blocked — and **inspect** any
  story for what happened and what evidence backs it.
- **Ask why.** Why did this story block? Why did that one merge? Why is this one waiting? Jig
  answers from the run's own record — an attributable answer, not a log you decode.
- **Decide** when a run pulls you in: approve, reject, **override** a call you'd make
  differently, or **hand off** the decision to someone else.
- **Stop** a run cleanly so it can be resumed later, and **acknowledge or snooze** a notice so
  your queue reflects what you've already seen.

You run Jig from a terminal, drive it as a tool from your own agent, or embed it in your own
software — see [how you run it](./README.md#how-you-run-it).

## The five guarantees

1. **Control & trust** — the worker can only do what you authorized, earns autonomy by proof,
   cannot weaken its own guardrails, pulls you in for real decisions, and never ships on its
   own assertion.
2. **You own the configuration** — policy expresses risk and safety; work profile expresses how
   work is carried out; both are track-scoped and understandable to the owner.
3. **Never lose work; resume safely** — recorded progress survives interruption, irreversible
   actions are not repeated, and one blocked story does not sink independent work.
4. **Runs against your stack** — agents, execution hosts, forges, and work sources sit behind
   swappable seams, and weak drivers reduce autonomy rather than weakening guarantees.
5. **See everything** — every governed decision and outcome is visible through durable,
   structured records that owners and tools can inspect.

### Enforce vs. Guide

Most of the suite guides: it gives templates, presets, product practices, and planning
discipline the owner can adapt. Jig enforces only the floors that make delegation safe:
authorization before action, policy that cannot be quietly weakened, runner-owned irreversible
actions, and evidence before landing work. The owner still chooses the policy posture and the
strength of the gates.

## How You Use Jig

These scenarios show what Jig does _for you_. Each one makes one of the five guarantees
concrete.

### Overnight delivery of a planned epic

_Shows guarantee 1 — control & trust._

You have an approved plan — twelve stories — and you want them delivered tonight without
supervising each one. You set a cautious policy posture and point Jig at the plan. It works the
stories that are ready, in parallel up to the limit you set, and lands each one **only on real
evidence** — never on the agent's say-so. One story tries to change a file that governs your
safety rules; Jig **pauses it and asks you**, rather than quietly merging. Another fails its
checks; Jig **stops it and records why**, without holding up the independent stories.

By morning: nine landed with evidence you can replay, two waiting on a decision only you should
make, one blocked with a reason. **You spent your judgment on the two decisions that mattered —
not on babysitting twelve runs.**

### A risky change at the doorbell

_Shows guarantee 1 — the doorbell._

A story needs to touch a file that governs your safety rules — your policy, a CI gate, the
verification command itself. That is exactly the kind of change Jig will not wave through on
evidence alone. It **parks the story at the door** and hands you one decision: here is what
wants to change, here is why it was flagged, approve it narrowly or reject it. The run waits —
durably, through interruption — until you answer, then resumes from exactly there. **You are
pulled in once, for the one change that warranted your eyes — not the twenty that didn't.**

```mermaid
flowchart TD
    A["Story wants to change<br/>a rule-governing file"] --> B{"Justified by<br/>evidence alone?"}
    B -->|"No — needs you"| C["Parked at the door<br/>(durable, survives interruption)"]
    C --> D["You see what changes,<br/>and why it was flagged"]
    D -->|"Approve, narrowly"| E["Resumes from here"]
    D -->|"Reject"| F["Stops, on the record"]
```

### A safe resume after interruption

_Shows guarantee 3 — never lose work; resume safely._

Your machine dies mid-run — power, a crash, a closed laptop. You restart Jig and point it at
the same run. It does not start over and it does not double-act: the stories that already landed
stay landed, irreversible steps already taken are not repeated, and work picks up from the last
safe checkpoint. If something safety-relevant changed while it was down, Jig asks you to
re-approve before continuing rather than assuming the old answer still holds. **An interruption
costs you the time since the last checkpoint — not the run.**

### Swapping your agent

_Shows guarantee 4 — runs against your stack._

You want to move a track from one coding agent to another — a new model, a different vendor,
your own in-house runner. You change the agent in that track's work profile; the policy, the
gates, and the evidence bar stay exactly as they were. Before the new agent earns any autonomy,
Jig makes it **prove** the capabilities it claims; until it does, you get more checkpoints, not
weaker guarantees. **You change who does the work without renegotiating what "safe" means.**

## 1. Control & trust

**Intended behavior.** The agent is a contained worker. It can request work, produce code, run
checks, and report progress, but it cannot expand its own authority or land changes by
self-report. Jig is responsible for keeping the authority boundary real.

### 1.1 The fence — runtime authorization

- **FENCE-1.** Every worker request is authorized before it executes. If the request is not
  declared and approved, it fails closed.
- **FENCE-2.** Widening permission requires owner re-approval. The worker cannot negotiate a
  broader runtime grant for itself mid-run.
- **FENCE-3.** The worker never holds privileged credentials. The runner performs privileged
  actions on the worker's behalf, under policy and evidence gates.

### 1.2 Earned trust — capability attestation

- **EARN-1.** Autonomy requires fresh, positive proof that the relevant driver can perform the
  capability safely enough for the policy in force.
- **EARN-2.** Capability proof is specific to the driver and run context. Missing, stale, or
  failed proof means less autonomy and more human checkpoints, not a weakened guarantee.

### 1.3 Anti-gaming

- **GUARD-1.** The policy in force is fixed when the run launches. The worker cannot loosen
  the rules it is being judged by.
- **GUARD-2.** If the work changes parts of the project that govern policy, verification, or
  integration safety, completion pauses for explicit owner re-approval and fresh evidence. Jig
  will not let a run quietly change its own rules and then declare itself done.

### 1.4 The doorbell — approval and escalation

- **DOOR-1.** Ambiguous, risky, or unproven action routes to the owner. The default when Jig
  cannot justify autonomy is a closed door, not a guess.
- **DOOR-2.** Escalations are durable. The run parks at the decision point and resumes when the
  owner decides, even after interruption.
- **DOOR-3.** Human grants are narrow. Approval is scoped to the need in front of the run, not
  a blanket yes to future authority.

### 1.5 Merge-on-evidence

- **MERGE-1.** Completing and landing work requires independent evidence aligned to the policy,
  never the worker's self-report alone.
- **MERGE-2.** Push, PR creation, and merge are runner authority. The thing that writes code is
  not the thing that ships it.
- **MERGE-3.** Done conditions are explicit and policy-bound. The owner decides what evidence
  is required before work may land.
- **MERGE-4.** Done and merged are separate milestones. Jig proves a story is *done* — its
  evidence is met — independently of whether its PR is *mergeable right now*. Branch protection,
  a merge queue, or a conflict can hold a done story without erasing that the work is done.
- **MERGE-5.** Blocked work shows up where you already work. When a run has a safe branch and
  permission to push, a block surfaces as a real pull request with the failure reasons in a
  comment, and its status is posted to the PR — your normal review flow, not a separate
  dashboard. When it cannot safely do that, the block is still recorded for you. Jig respects
  merge queues and branch-protection rules.

### 1.6 Security — no leaks, no phone-home

- **SEC-1.** Secrets stay out of the run. Credentials and sensitive values are kept out of
  records, logs, artifacts, and exports, so the trail you keep is safe to keep.
- **SEC-2.** The worker cannot phone home. Outbound network access is confined, and the
  confinement is proven — Jig does not take the agent's word that it stayed put.
- **SEC-3.** The worker never holds your forge credentials. The runner performs the privileged
  action; the thing writing code is never the thing holding the keys.

**Honest edge.** Jig protects the shape of trust; the substance of each gate is still the
owner's responsibility. A weak review, empty verification command, or vague plan remains weak.
Jig makes that weakness visible instead of pretending it is proof.

## 2. Configuration ownership

**Intended behavior.** You set the risk posture and execution style for each track without
being handed an undifferentiated wall of knobs. Policy is the safety contract. Work profile is
how the work gets done. Jig derives live behavior from those choices and the plan.

- **CFG-1. Policy is the governance contract.** It expresses gating posture, merge spectrum,
  concurrency ceiling, retry budget, required reviews, approvals, escalation rules, and the
  anti-gaming floor. Because policy governs safety, changing it is itself governed.
- **CFG-2. The work profile is the realization.** It expresses cost, quality, and behavior:
  model, effort, prompt strategy, and role realization. It is freely tunable because it does
  not lower the safety floor.
- **CFG-3. Configuration is per track.** Each independent line of work has its own policy and
  work profile, while repo-level floors remain intact.
- **CFG-4. The actual is computed, not hand-set.** You set intent and limits; Jig derives what
  can safely run from policy and the plan's current eligible work.
- **CFG-5. Setup is guided by your intent.** Jig starts by asking how you want to work and maps
  that to a sensible starting configuration before you tune details.
- **CFG-6. Presets are strong defaults with reasoning.** They encode useful starting positions,
  explain why they exist, and remain choices you can override.
- **CFG-7. Open seams, not a closed turnkey.** Jig exposes records and extension points so
  owners and tool builders can add analyzers, dashboards, story sources, scans, and other
  surrounding tools without changing Jig's core.
- **CFG-8. Prompt strategy is guided, not magical.** Prompting can move from dynamic per task
  to templated and then to stable role prompts as the work matures; traceability comes from
  versioned guidance, not hidden agent intuition.
- **CFG-9. Setup runs only when needed.** You declare a setup command — installing dependencies,
  say — and Jig runs it only when the workspace is stale, skipping it when the tree is already
  fresh.
- **CFG-10. You set how much it asks.** A manual posture sends every escalation to you; an
  assisted posture auto-grants low-risk actions and reserves the risky ones. Which actions
  auto-grant follows a fixed risk rule you can predict — and no model adjudicates for you
  (LLM-decided autonomy is deferred; see [what Jig isn't (yet)](#what-jig-isnt-yet)).

How much Jig asks you is a dial you set (CFG-10), not a fixed personality:

```mermaid
flowchart LR
    M["Manual<br/>you decide every escalation"] --> A["Assisted<br/>low-risk auto-granted,<br/>risky ones come to you"]
    A -.-> X["Auto / LLM-adjudicated<br/>deferred — not in v1"]
```

Today the dial runs from manual to assisted; no model decides for you. The auto end is a
deliberate deferral, not a hidden default.

**Honest edge.** Presets are starting points, not a guarantee of fit. Ignoring guidance may be
valid, but it trades away legibility and traceability. Jig will not pretend those tradeoffs do
not exist.

## 3. Resilience — never lose work, resume safely

**Intended behavior.** A run survives interruption and local failure without losing recorded
progress, repeating irreversible actions, or blocking unrelated work.

### 3.1 Interruption resume

- **RESUME-1. Durable progress.** Completed work and run decisions are recorded when they
  happen. A crash does not erase progress that was already committed to the run record.
- **RESUME-2. Resume from the last safe checkpoint.** Jig resumes from a safe point instead of
  starting over, and repeated work is handled as repeatable work.
- **RESUME-3. No double effect.** Irreversible actions already taken are recognized and not
  performed again on resume.
- **RESUME-4. Fail closed and diagnosable.** If Jig cannot safely continue, it parks in a
  named, inspectable state rather than guessing forward.
- **RESUME-5. Resume integrity.** If safety-relevant assumptions changed while the run was
  stopped, Jig asks for owner re-approval and fresh evidence before continuing.

### 3.2 Work-level failure isolation

- **ISO-1. Eligibility and isolation are both dependency-aware.** A task stays ineligible until
  its prerequisites finish, so work never starts out of order; and a blocked story halts itself
  and its downstream dependents while independent work keeps moving.
- **ISO-2. Resolution is policy-determined.** Prevention-leaning policy can quarantine and
  re-plan; throughput-leaning policy can land independent work and rely on enabled follow-up
  checks. Jig follows the owner's posture.
- **ISO-3. Blocks are first-class outcomes.** A block records what happened and why, so the
  owner, supporting tools, and the learning loop can act on it.
- **ISO-4. Parallel work cannot collide.** Each run works in its own isolated workspace, and the
  same task cannot be launched twice — independent stories run at once without corrupting each
  other's tree or duplicating work.

### 3.3 Liveness — noticing a stuck run

- **LIVE-1. Jig knows the difference between thinking, stuck, and dead.** It watches progress,
  idleness, silence, and overdue approvals, so a worker that hangs is detected rather than waited
  on forever.
- **LIVE-2. A stuck run escalates instead of burning the night.** When the signals say a run is
  going nowhere, Jig parks it for your decision rather than silently spending time and budget.

**Honest edge.** Resume works from checkpoints, not individual keystrokes. Isolation is only
as good as the dependencies declared in the plan. A corrupt or contradictory substrate becomes
a diagnosable stop, not a promise of magic recovery. Jig also checks that its own storage can
do what it needs before it starts, and stops with a clear reason rather than risk a run on an
unreliable filesystem.

## 4. Stack portability

**Intended behavior.** Jig works with the stack you bring while keeping its guarantees stable.
The promise is not a specific vendor list; the promise is that changing a driver does not move
the control, evidence, and recovery boundaries.

- **STACK-1. Your guarantees do not depend on your vendor.** Control, evidence, and recovery
  hold regardless of which compatible driver you use.
- **STACK-2. Four seams are independently swappable.** Agent, Execution Host, Forge, and Work
  Source are the product-level integration boundaries.
- **STACK-3. Bring-your-own agent is a work-profile choice.** Agent and model choice belongs
  with how the owner wants work carried out.
- **STACK-4. Capabilities are attested, not assumed.** A driver proves what it can do before
  Jig grants autonomy; unproven capability means more supervision.
- **STACK-5. Seams are authority boundaries.** Credentials and irreversible authority stay
  where policy and evidence gates can govern them.

### 4.1 Trusting a driver

- **DRIVE-1. Prove a driver before you trust it.** A new agent, execution host, forge, or work
  source earns its place by passing a conformance suite — including adversarial probes — not by
  assertion.
- **DRIVE-2. Nothing escalates silently.** A provider package declares what it may do — which
  runtimes, what network, which credentials — and you approve that manifest. A change to it
  requires fresh approval.
- **DRIVE-3. Containment is reported honestly.** An execution host reports how strong its
  isolation actually is, and stronger-isolation powers unlock only when it is genuinely strong
  enough.

**Honest edge.** A seam is not a shipped driver. Drivers can arrive incrementally. Until a
driver proves a capability, the owner should expect reduced autonomy rather than a weaker
guarantee.

## 5. Full observability

**Intended behavior.** Jig makes a run reconstructible. The owner can see what was requested,
authorized, gated, approved, blocked, landed, or stopped without relying on the worker's
memory or narrative.

- **SEE-1. Full run visibility.** Decisions, authorizations, gates, evidence, approvals, state
  transitions, and outcomes are captured well enough to reconstruct what happened and why.
- **SEE-2. Structured and machine-readable by design.** The records are a product surface that
  owners and suite-level tools can consume.
- **SEE-3. The records are the evidence.** The evidence Jig uses to decide is the evidence the
  owner can inspect afterward; there is no separate story that can drift from the run.
- **SEE-4. Self-diagnosis, no extra tooling required.** A minimal Jig user can inspect the run
  records directly to diagnose a bad plan or policy. The learning loop accelerates diagnosis;
  it is not required for visibility.
- **SEE-5. Attention is a triaged queue, not a log.** Every parked, blocked, stale, or overdue
  condition becomes a notice — what it is, how urgent it is, and what you can do about it right
  now — so you work a list of decisions instead of reading a transcript.
- **SEE-6. Take the record with you.** A finished run exports as a write-once,
  redacted-by-default audit record you can archive or hand to compliance outside Jig.

**Honest edge.** Jig shows everything it governs. It does not read the agent's mind and it does
not turn evidence into judgment automatically. The owner or learning loop still interprets the
records.

## Product Boundaries

Jig owns execution under policy: authorization, escalation, evidence, recovery, stack seams,
and run visibility. The supporting products can help produce better product definitions,
designs, and execution plans, but Jig does not require them. The learning loop is between-runs
improvement, not part of Jig's per-run hot path.

Design owns the implementation details behind these promises: event schema shape, protocol
mechanics, provider contracts, exact policy classifiers, storage strategy, and delivery gates.
Planning owns delivery-level acceptance criteria and phase sequencing. Product keeps the
outcome-level commitments and the IDs above.

### What Jig isn't (yet)

Jig is honest about its edges. These are deliberate non-goals or deferrals, not gaps:

- **No model decides for you.** No LLM adjudicates approvals; risky or unallowlisted requests
  always go to a human. Low-risk auto-grants in assisted mode follow a fixed, predictable rule
  (CFG-10), never a model.
- **Local-first.** Jig runs against a local execution host now. Remote hosts are a ready seam
  with no shipped driver yet — don't expect remote execution today.
- **Operator-initiated.** A run starts because you start it; webhook and scheduler triggers come
  later.
- **A tool you run, not a service you buy.** Jig is not a hosted, multi-tenant service in v1.
- **No silent legacy coping.** Jig refuses configuration it doesn't understand, with guidance,
  rather than guessing at an outdated format.

## Success And Counter-Signals

**Success looks like:**

- Owners can explain the run's promise and boundaries from this page without reading design
  mechanics.
- Runs land or stop with clear evidence and fewer unsafe surprises.
- Review burden drops because policy, evidence, and escalation are explicit.
- Recovery feels ordinary rather than exceptional.

**Counter-signals look like:**

- Product docs require implementation protocol detail to explain the promise.
- Supporting docs cite commitment IDs that no longer exist here.
- Owners treat current design defaults as product truth instead of reconciling design to the
  product commitment.

## Open Questions

- How much of the setup and preset experience belongs in Jig itself versus surrounding
  guidance?
- How broad should first-class driver support be before stack portability feels credible?
- Which throughput-oriented follow-up checks should become shipped product surfaces, and which
  should remain extension examples?
- Delivery-level acceptance criteria should be issued later in design or planning artifacts
  that cite these product-owned IDs; they should not become a product-layer AC table.

## Related

- [Product definition](./README.md) — where Jig fits in the suite and how it relates to the
  supporting products.
- [Tracks](./concepts.md) — the track model that scopes policy, work profile, and execution.
- [Engineering design](../design/10-architecture/architecture.md) — the implementation
  reference for how the product commitments are satisfied.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Product definition](./README.md) · **← Prev:** [Product definition](./README.md) · **Next →:** [Tracks — parallel independent work](./concepts.md)

<!-- /DOCS-NAV -->
