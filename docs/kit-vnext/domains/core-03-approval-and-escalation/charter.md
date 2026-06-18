---
title: "Approval & Escalation — charter"
id: "core-03"
layer: "core"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Approval & Escalation — charter

**Purpose.** Host-neutral adjudication of a worker's escalation requests, plus durable park/resume
that survives human latency and process death.

## Responsibilities (in scope)
- Normalizing and adjudicating an `ApprovalRequest`: deterministic risk classification
  (low/medium/high) and the mode ladder. **v1: policy allowlist → human** (manual/assisted).
  `auto`/LLM orchestrator-decide is deferred (AD-14); when added, the LLM verdict is a **consulted
  input recorded as an event** (not replayable logic) — the core decides whether to ask and validates
  bounds.
- Selecting the **tightest scoped grant** (per-command / per-command-prefix / per-host / session).
- The durable **park/resume** state machine: persist the pending request before deciding; time-box
  the live answer; resume the owned session with the grant pre-loaded.
- Audit events for every request, decision, and outcome.

## Out of scope
- The protocol transport that catches/answers the request — that is the Agent driver (prov-01).
- Risk/policy configuration shapes — owned by fnd-01 (this consumes them).

## Requirements owned
FR-4 (approval relay), NFR-SAFE, NFR-DET.

## Dependencies (Dependency Rule)
- Depends on: core-01 (events), core-02 (the `orchestrator-decide` / `escalation-auto-grant` gates),
  the **Agent contract** (the neutral request/decision shape).
- Must NOT: depend on the Codex driver or its enums directly.

## Required reading
Standard set + [core-02](../core-02-capability-and-safety/charter.md),
[fnd-01](../fnd-01-configuration-and-policy/charter.md), and the Agent contract in
[prov-01](../prov-01-agent-execution/charter.md).

## Deliverable
`design.md` defining: `ApprovalRequest` / `Decision` / `Outcome` (neutral); the risk rules; the mode
ladder; the scoped-grant taxonomy; the park/resume events and invariants.

## Definition of done (domain-specific)
- Adjudication is a pure function `(request, policy, mode, rules) → decision`.
- A parked approval survives process death and resumes via the owned session.
- High risk always escalates to a human regardless of mode.

## Open questions
- Decision-window default; circuit breaker for repeated identical denials.
