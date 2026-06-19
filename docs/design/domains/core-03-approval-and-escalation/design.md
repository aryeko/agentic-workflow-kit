---
title: "Approval & Escalation - design"
id: "core-03"
layer: "core"
status: approved
owner: "domain designer"
last-reviewed: "2026-06-19"
depends-on:
  - "core-01-run-lifecycle-and-state"
  - "core-02-capability-and-safety"
  - "fnd-01-configuration-and-policy"
  - "prov-01-agent-execution"
---

# Approval & Escalation - design

## 1. Purpose & boundaries

Approval & Escalation owns the host-neutral Approval relay decision path inside the Control plane. It
normalizes worker escalation requests into an `ApprovalRequest`, persists pending state before any
decision, classifies risk deterministically, selects the v1 mode ladder, records a `Decision`, returns
the tightest scoped grant or denial, and records the final `Outcome`.

Out of scope: catching or answering the provider protocol request, which belongs to the Agent
contract; concrete Codex behavior; approval policy schema authoring, which belongs to Configuration &
Policy; provider capability probing, which belongs to provider domains; and lifecycle authorship,
which remains with Run Lifecycle & Event State.

Owned requirements: FR-4, NFR-SAFE, and NFR-DET. This design also satisfies NFR-TEST through
mock-only Control plane tests.

## 2. Required reading

- [README.md](../../README.md)
- [requirements.md](../../requirements.md)
- [decisions.md](../../decisions.md)
- [architecture.md](../../architecture.md)
- [conventions.md](../../conventions.md)
- [glossary.md](../../glossary.md)
- [_templates/domain-design-template.md](../../_templates/domain-design-template.md)
- [charter.md](charter.md)
- [core-01 design](../core-01-run-lifecycle-and-state/design.md) and its contracts, writer, and
  lifecycle subfiles
- [core-02 design](../core-02-capability-and-safety/design.md) and its capability registry and gate
  record subfiles
- [fnd-01 design](../fnd-01-configuration-and-policy/design.md) and its policy interfaces subfiles
- [prov-01 design](../prov-01-agent-execution/design.md) and its Agent contract/capability subfiles

No later core-domain drafts and no concrete Driver designs were read or used.

## 3. Context diagram

```mermaid
flowchart LR
  subgraph CORE["Control plane"]
    APR["Approval & Escalation"]
    RL["Run Lifecycle & Event State"]
    CAP["Capability & Safety"]
    SUP["Supervision & Liveness"]
  end
  CFG["Configuration & Policy"]
  AG["Agent contract"]
  OP["Operator & Entry Surface"]

  AG -->|"AgentApprovalRequest"| APR
  APR -->|"ApprovalAnswer"| AG
  APR -->|"append request/decision/outcome + park/resume facts"| RL
  APR -->|"evaluate escalation-auto-grant / orchestrator-decide"| CAP
  APR -->|"read resolved approval + escalation policy"| CFG
  OP -->|"recorded human decision"| APR
  APR -->|"parked approval state"| SUP
```

Dependency Rule statement: `core-03` depends only on `core-01`, `core-02`, `fnd-01`, and the
host-neutral Agent contract. It introduces no dependency on Codex, GitHub, Markdown, Local, mock, or
any concrete Driver behavior.

## 4. Design

The approval flow is `normalize -> persist pending -> classify -> decide -> answer or park ->
record outcome`. The request is always recorded before classification or decision, so recovery can
resume from the Event log after process death or human latency.

Low-level detail is split to keep this entry point focused:

- [Decision model](design/decision-model.md) defines neutral `ApprovalRequest`, `Decision`, and
  `Outcome` shapes, deterministic low/medium/high risk classification, the v1 mode ladder, and the
  scoped grant taxonomy.
- [Park/resume and failures](design/park-resume-and-failures.md) defines durable pending state,
  live answer time-boxing, owned-session resume with pre-loaded grants, and named fail-closed states.
- [Interfaces, events, and tests](design/interfaces-events-and-tests.md) defines consumed/exposed
  interfaces, audit events, projections, and mock-only testing strategy.

Core decisions:

- `ApprovalPendingPersisted` is the durable checkpoint and is appended at `barrier` durability before
  any decision.
- Classification and adjudication are pure functions of recorded evidence, resolved policy, mode,
  and caller-supplied time values.
- High risk always escalates to a human regardless of mode.
- V1 supports `manual` and `assisted` only. `auto` and LLM adjudication are deferred by AD-14; later
  LLM judgment can enter only as a recorded input event.
- Assisted auto-grant is available only for low-risk policy allowlist matches after core-02 records an
  `escalation-auto-grant` allow. `orchestrator-decide` always denies with `capability-deferred` in v1.
- The selected policy-level grant is the tightest scope: `per-command`, `per-command-prefix`,
  `per-host`, `session`, or `denial`; it must map deterministically to the approved Agent
  `ScopedGrant` before `ApprovalAnswer` is sent.
- Missing resolved policy/provenance, missing capability, missing Agent relay, ambiguous
  ownership/session linkage, unwritable Event log, or expired parked request fails closed to a named
  state and never continues by guess.

## 5. Contracts & interfaces

Core-03 exposes host-neutral `ApprovalRequest`, `Decision`, `Outcome`, failure states, policy-level
grant planning, Agent grant mapping, and pure classification/decision functions. It consumes core-01
`RunWriter`, replay, projections, lifecycle, and session linkage; core-02 `CapabilityGateRecord`;
fnd-01 resolved approval and escalation policy; and the Agent contract's neutral approval
request/answer channel and `ScopedGrant`.

The typed contract is in [Interfaces, events, and tests](design/interfaces-events-and-tests.md).

## 6. Events & data

Core-03 emits audit events for every request, decision, and outcome through core-01 envelopes:
`ApprovalRequested`, `ApprovalPendingPersisted`, `ApprovalRiskClassified`,
`ApprovalDecisionRecorded`, `ApprovalParked`, `ApprovalResumed`, and `ApprovalOutcomeRecorded`.
Barrier durability is required for pending, decision, park/resume, and outcome facts. Future
`ApprovalInputJudgmentRecorded` is reserved for LLM judgment-as-recorded-input and is not evaluated in
v1.

Event payloads and projection contributions are defined in
[Interfaces, events, and tests](design/interfaces-events-and-tests.md).

## 7. Behavior diagram

```mermaid
sequenceDiagram
  actor Operator
  participant AG as Agent contract
  participant APR as Approval & Escalation
  participant RL as Run Lifecycle & Event State
  participant CAP as Capability & Safety

  AG->>APR: AgentApprovalRequest
  APR->>APR: normalize host-neutral ApprovalRequest
  APR->>RL: append ApprovalRequested + ApprovalPendingPersisted (barrier)
  APR->>APR: classify risk from recorded evidence + policy
  APR->>RL: append ApprovalRiskClassified
  alt high risk or manual mode or policy requires Operator
    APR->>RL: append ApprovalDecisionRecorded(human-required)
    APR->>RL: append ApprovalParked if live window elapses
    Operator->>APR: recorded decision
  else assisted low-risk allowlist
    APR->>CAP: evaluate escalation-auto-grant
    CAP->>RL: append CapabilityGateRecord (barrier)
  end
  alt grant or denial valid and channel answerable
    APR->>RL: append ApprovalDecisionRecorded
    APR->>AG: ApprovalAnswer(decisionEventId, scoped grant or denial)
    AG-->>APR: accepted or failed
    APR->>RL: append ApprovalOutcomeRecorded
  else owned session resumes later
    APR->>RL: append ApprovalResumed
    APR->>AG: answerApproval with pre-loaded grant
    APR->>RL: append ApprovalOutcomeRecorded
  end
```

## 8. Failure & degraded modes

Named fail-closed states are defined in
[Park/resume and failures](design/park-resume-and-failures.md). Capability gates treat any active
approval failure state as `escalation-auto-grant` absent. Missing capability, missing Agent relay,
missing resolved policy/provenance, ambiguous ownership/session linkage, unwritable Event log, and
expired parked request fail closed to `blocked` or `expired`; they never allow worker execution to
continue by guess.

## 9. Testing strategy

NFR-TEST is met with a deterministic in-memory core-01 Run log, fake fnd-01 resolved policies, mock
Agent contract events, and mock core-02 gate records. Tests use zero real processes, network, Forge,
Work Source, Execution Host, filesystem, or concrete Driver behavior.

The complete strategy is in [Interfaces, events, and tests](design/interfaces-events-and-tests.md).
This satisfies FR-4 by relaying approvals through durable request/decision/outcome records,
NFR-SAFE by failing closed to named states when guarantees are unavailable, NFR-DET by making every
decision a pure function of recorded evidence, and NFR-TEST by using mocks only.

## 10. Open questions

- Decision-window default remains open from the charter.
- Circuit breaker for repeated identical denials remains open from the charter.
- Exact Operator decision event payload belongs to Operator & Entry Surface; this design requires it
  to be a recorded input event with Operator identity, decision, scope, reason, and timestamp.

## 11. Definition of done

- [x] All sections complete; guidance notes removed.
- [x] Files are focused; low-level detail is split into cohesive subfiles.
- [x] Complies with the Dependency Rule; dependencies listed and justified.
- [x] Uses glossary vocabulary.
- [x] States the FR/NFR ids satisfied; shows how NFR-TEST is met.
- [x] Failure/degraded modes defined (fail-closed).
- [x] Provider-domain validation is not applicable to this core domain.
- [x] Diagrams present and consistent with architecture.md naming.
