---
title: "Capability & Safety - design"
id: "core-02"
layer: "core"
status: approved
owner: "domain designer"
last-reviewed: "2026-06-19"
depends-on:
  - "core-01-run-lifecycle-and-state"
  - "prov-01-agent-execution"
  - "prov-02-forge-collaboration"
  - "prov-03-work-source"
  - "prov-04-execution-host"
---

# Capability & Safety - design

## 1. Purpose & boundaries

Capability & Safety owns the "earn autonomy" contract for the Control plane. It defines the
capability registry, the guarantee predicates that unlock each autonomous power, the mode rules for
`manual` and `assisted`, and the `CapabilityGateRecord` event written for every capability
evaluation.

Out of scope: approval adjudication, park/resume mechanics, merge mechanics, recovery action
selection, Work Source status policy, provider probing, and concrete Driver behavior. This domain
evaluates recorded evidence and capability attestations; it never calls or imports a concrete Driver.

Owned requirements: FR-7 for gating irreversible actions, NFR-SAFE for fail-closed autonomy,
NFR-DET for pure recorded-evidence decisions, and NFR-TEST for mock-only Control plane tests.

## 2. Required reading

Read: [README.md](../../README.md), [requirements.md](../../requirements.md),
[decisions.md](../../decisions.md), [architecture.md](../../architecture.md),
[conventions.md](../../conventions.md), [glossary.md](../../glossary.md),
[_templates/domain-design-template.md](../../_templates/domain-design-template.md), and
[charter.md](charter.md). Approved dependency read: [core-01 design](../core-01-run-lifecycle-and-state/design.md),
[contracts](../core-01-run-lifecycle-and-state/design/contracts.md),
[event log protocol](../core-01-run-lifecycle-and-state/design/event-log-writer-and-corruption.md), and
[projection/lifecycle rules](../core-01-run-lifecycle-and-state/design/projections-lifecycle-and-tests.md).
Provider contract inputs read: [prov-01](../prov-01-agent-execution/design.md),
[prov-01 contracts](../prov-01-agent-execution/design/contracts-and-conformance.md),
[prov-01 capabilities](../prov-01-agent-execution/design/capabilities-and-conformance.md),
[prov-02](../prov-02-forge-collaboration/design.md), [prov-03](../prov-03-work-source/design.md),
[prov-04](../prov-04-execution-host/design.md), and
[prov-04 contracts](../prov-04-execution-host/design/contracts-and-conformance.md).
No later core-domain drafts were read or used.

## 3. Context diagram

```mermaid
flowchart LR
  subgraph CORE["Control plane"]
    CAP["Capability & Safety"]; APR["Approval & Escalation"]; CMP["Completion / Verification / Merge"]
    REC["Recovery, Reconciliation & Coordination"]; RL["Run Lifecycle & Event State"]
  end
  AG["Agent"]; FG["Forge"]; WS["Work Source"]; EH["Execution Host"]
  APR -->|"gate escalation-auto-grant"| CAP
  CMP -->|"gate auto-merge"| CAP
  REC -->|"gate auto-recover"| CAP
  CAP -->|"append CapabilityGateRecord"| RL
  CAP -->|"replay events + projections"| RL
  AG -->|"CapabilityAttestation events"| RL
  FG -->|"CapabilityAttestation events"| RL
  WS -->|"CapabilityAttestation events"| RL
  EH -->|"CapabilityAttestation events"| RL
```

Dependency Rule statement: `core-02` depends on `core-01` for Event log primitives and on provider
contract event payloads for capability attestations. It does not depend on Codex, GitHub, Markdown,
Local, mock, or any other concrete Driver.

## 4. Design

Low-level detail is split to keep this entry point focused:

- [Capability registry](design/capability-registry.md) defines the v1 capabilities and guarantee
  predicates.
- [Gate evaluation and records](design/gate-evaluation-and-records.md) defines attestation handling,
  self-report rejection, and the `CapabilityGateRecord` payload.

Core decisions: `manual` records explanations but denies autonomous powers; `assisted` can allow only
deterministic policy-enabled capabilities whose guarantees hold. `auto` mode and LLM adjudication are
deferred by AD-14, so `orchestrator-decide` always denies with `capability-deferred` in v1. Every
capability is default-off, and a missing fresh positive attestation is equivalent to absent
capability. Gate evaluation is a pure function of recorded Event log evidence, provider attestations,
projections, policy refs, and caller-supplied `evaluatedAt`. An `allow` decision is usable only after
`CapabilityGateRecord` is appended; if the record is unwritable, the caller must deny. The v1
containment floor for `unattended-run` and kill-dependent `auto-recover` is `process-group` or
stronger unless policy requires a stricter floor.

## 5. Contracts & interfaces

```ts
evaluateCapabilityGate(
  request: CapabilityGateRequest,
  replay: RunReplay,
  projections: RunProjections
): CapabilityGateRecordPayload
```

The complete types are in [Gate evaluation and records](design/gate-evaluation-and-records.md). The
record includes `allow`/`deny`, evaluated guarantees, attestation refs, mode, scope, evidence refs,
requested action, policy ref, and failure reason. Provider capability names remain contract-owned by
Agent, Forge, Work Source, and Execution Host.

Consumed interfaces: core-01 `RunEventLog`, `RunWriter`, `RunReplay`, `RunProjections`,
`RunLifecycleTransitioned`, `SessionLinked`, and provider `CapabilityAttestation` event payloads.
`core-02` has no concrete Driver interface.

## 6. Events & data

Consumed events: `CapabilityAttestation`, `RunLifecycleTransitioned`, `SessionLinked`,
`SessionLinkSuperseded`, provider evidence events, and caller-supplied evidence records for
completion, verification, approval, and recovery.

Emitted event: `CapabilityGateRecord` with `domain = "core-02"` and `barrier` durability because it
gates irreversible action or autonomous execution. This domain may expose latest-gate read models only
as pure projections over recorded gate records; it never writes projection state.

Core-01 degraded health, missing projections, stale writer rejection, or ambiguous session linkage
makes every autonomous capability absent.

## 7. Behavior diagram

```mermaid
sequenceDiagram
  participant CMP as Completion / Verification / Merge
  participant CAP as Capability & Safety
  participant RL as Run Lifecycle & Event State
  participant FG as Forge
  CMP->>CAP: evaluate auto-merge(gate request, evaluatedAt, evidence refs)
  CAP->>RL: replay Run events + projections
  RL-->>CAP: events, health, projections
  CAP->>CAP: select fresh in-scope positive attestations
  CAP->>CAP: evaluate guarantee predicates
  CAP->>RL: append CapabilityGateRecord(barrier)
  RL-->>CAP: committed event id or append failure
  alt record committed and decision allow
    CAP-->>CMP: allow(record event id)
    CMP->>FG: merge/enqueue using exact-head evidence
  else deny or record not committed
    CAP-->>CMP: deny(failure reason)
    CMP-->>RL: park/block/settle via lifecycle rules
  end
```

## 8. Failure & degraded modes

- `mode-disallows-capability`, `policy-disallows-capability`, or `capability-deferred`: deny.
- `run-log-degraded`: replay/projection health is not usable; deny all autonomous capabilities.
- `required-evidence-absent` or `required-evidence-ambiguous`: deny.
- `attestation-absent`, `attestation-stale`, `attestation-negative`, `attestation-out-of-scope`,
  `attestation-contradictory`, or `attestation-non-replayable`: deny.
- `self-report-only`: worker prose, Guardian text, or an unprobed driver claim is the only support;
  deny.
- `gate-record-unwritable`: the record cannot be appended at required durability; caller must not act.

The caller chooses the lifecycle consequence through core-01 legal transitions: park for Operator
attention when a human can supply a recorded decision, block when a required guarantee is unavailable,
or fail when evidence classifies an unrecoverable error. `core-02` supplies the deny reason; it does
not select recovery actions.

## 9. Testing strategy

NFR-TEST: tests use a deterministic in-memory `core-01` Run log and mock provider contract events
only. No real processes, network, Forge, Agent, Work Source, Execution Host, filesystem, or Driver is
used in Control plane tests.

Required tests: table tests for every capability in both modes; replay property tests for identical
`CapabilityGateRecord` payloads; freshness, expiry, scope, negative, contradictory, and
non-replayable attestation tests; fail-closed self-report/schema-only tests; append-failure tests; and
adversarial mock tests where attestations are omitted, delayed, stale, wrong-scope, or lying.

This satisfies FR-7 by gating irreversible/autonomous actions, NFR-SAFE by denying unknown or
ambiguous guarantees, NFR-DET by making the decision a pure function of recorded evidence, and
NFR-TEST by using mocks only for core tests.

## 10. Open questions

- Whether `auto-pr` should be a separate capability from `auto-merge`; current registry treats PR
  creation/update as a completion-domain gate and reserves `auto-merge` for the irreversible merge
  boundary.
- Whether the v1 unattended containment floor should be stricter than `process-group` on platforms
  where stronger `kernel-tree` or `job-object` containment is available.
- The exact policy shape that enables assisted capabilities belongs to Configuration & Policy; this
  design assumes a resolved `policyRef` and does not define that schema.

## 11. Definition of done

- [x] All sections complete; guidance notes removed.
- [x] Files are focused; low-level registry and gate-record detail is split into cohesive subfiles.
- [x] Complies with the Dependency Rule; dependencies listed and justified.
- [x] Uses glossary vocabulary.
- [x] States the FR/NFR ids satisfied; shows how NFR-TEST is met.
- [x] Failure/degraded modes defined (fail-closed).
- [x] Provider-domain validation is not applicable to this core domain.
- [x] Diagrams present and consistent with architecture.md naming.
- [x] Open questions captured, not silently resolved.
