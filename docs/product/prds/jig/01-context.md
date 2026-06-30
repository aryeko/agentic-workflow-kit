← [Back to README](./README.md)

# Context

## The problem

Reliable software delivery through a long-running agentic loop is hard. Getting one good
agent session — prompt well, plan first, manage context, test the contract — is a solved
problem. The discipline is documented, widely understood, and it works. But a real delivery
is not one session. It is weeks or months of sessions, each building on the last:
implement a story, review it, open a PR, address feedback, merge, start the next story.

That loop reliably breaks, in predictable ways:

- **The agent decides direction you didn't authorize.** Hand an agent a goal and it also
  makes product and design calls, interprets ambiguity in its own favor, and drifts as
  context fills. What you get at the end is not what you scoped.
- **Progress is lost on interruption.** A process dies, a provider times out, you pause
  for a meeting — and the run has to restart from scratch, or you can't tell what already
  happened and what needs to repeat.
- **Trust erodes at integration points.** Every push and merge is a consequential,
  irreversible action. Without independent evidence — CI, a review that checked the
  actual contract — "done" means "the agent said so," and that is not enough.
- **One stuck story sinks the whole run.** A dependency turns out to be missing; an
  ambiguous requirement blocks an implementer. If there is no isolation, everything queued
  behind that story stops too.
- **You can't see what actually happened.** When something goes wrong — wrong direction
  taken, wrong file merged, wrong policy in effect — you have no structured record of
  what the agent did, what was authorized, and why a gate fired (or didn't).

The developers who feel this most acutely are those who own the direction themselves —
solo engineers, small teams, leads, architects — where there is no large team to absorb
cleanup, and a wrongly-directed or half-finished change is expensive.

## The opportunity

Jig is the missing layer: a deterministic execution engine that applies proven single-session
discipline to the full delivery loop. If the session-level recipe (plan, verify, scope to a
session) can be encoded as a system rather than a practice, the long-running loop becomes as
disciplined as the best single session — at any scale.

The opportunity is not to build a smarter agent. It is to build a better harness: one where
the agent is a contained worker that can only do what you authorized, earns autonomy by
proof, cannot weaken its own guardrails, and lands irreversible changes only on independent
evidence. A run that fails or is interrupted can park and resume safely. A run that completes
emits a complete, machine-readable record of everything that happened. The human is
interrupted only for real decisions — not for environmental noise, not never.

## Product thesis

Give Jig a direction you chose and a policy you set; it executes your plan as far as your
policy allows — safely, recoverably, and under your supervision — interrupting you only when
a real decision is on the line.

## Non-goals

| Non-goal | Status |
|---|---|
| Acting as an LLM orchestrator — the control plane is plain code; agents are workers behind a bounded contract | out |
| Deciding product direction, design, or what to build — the human owns those calls | out |
| Providing the upstream planning pipeline (define-product, product→design, design→plan) — those are the supporting products | out |
| Being a general-purpose task runner or CI system — the domain is software delivery specifically | out |
| Owning the learning loop — that is a separate, suite-level product that consumes Jig's records | out |
| Guaranteeing the quality of a weak execution plan — the promise is faithful execution; garbage in produces garbage out | out |
| Providing a fix-forward scan implementation — Jig exposes the seam; the scan is an extensibility point (CFG-7), not a shipped feature | out |
| Supporting every agent provider at Phase 0 — the seam contract ships in Phase 0; additional drivers follow in Phase 1 | deferred |
| Advanced run analytics, cross-run history, eval harness — Phase 2 | deferred |

---
Previous: — · Next: [02-principles](./02-principles.md) · Up: [README](./README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig PRD](./README.md) · **← Prev:** [Jig PRD](./README.md) · **Next →:** [Principles](./02-principles.md)

<!-- /DOCS-NAV -->
