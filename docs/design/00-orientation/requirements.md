---
title: kit-vnext — requirements
status: high-level design (scaffold)
last-reviewed: 2026-06-18
---

# Requirements

Functional requirements (what the system does) and quality attributes (how well). Every quality
attribute has a **verifiable acceptance check** — adjectives alone are not requirements. Domain
charters reference these IDs to declare which requirements they own.

## Functional requirements

| ID | Requirement | Primary domain(s) |
|---|---|---|
| FR-1 | **Task intake.** Select an eligible task from the Work Source, claim it race-safely, and snapshot it (fields, spec refs, content digests, source commit) for faithful replay. | Work Source, Run Lifecycle |
| FR-2 | **Workspace provisioning.** Prepare an isolated worktree + branch and run the repo's declared setup as a contracted first step; expose local git evidence. | Workspace & Repository, Execution Host |
| FR-3 | **Delegated implementation.** An agent worker makes code edits and local commits in the workspace; the kit never does the worker's implementation labor. | Agent Execution, Execution Host |
| FR-4 | **Approval relay.** A worker can request elevated permission; the kit catches, classifies, adjudicates (policy / human; LLM later), and answers with the tightest scoped grant; requests survive human latency and process death. | Approval & Escalation, Agent Execution |
| FR-5 | **Live supervision & termination.** Liveness is derived from real worker progress; terminal conditions lead to guaranteed termination of the owned process tree. | Supervision & Liveness, Execution Host |
| FR-6 | **Independent evidence.** The runner gathers git / verification / CI / PR / review evidence itself (runner-owned verifier; local git evidence; Forge evidence); a worker's claim is a hint, never the authority. | Completion & Merge, Execution Host, Forge, Workspace & Repository |
| FR-7 | **Completion & merge.** Completion and merge are decided from evidence + explicit policy; the **runner** performs push, PR, and merge via the Forge only when all gates pass; irreversible actions are gated. | Completion & Merge, Forge, Capability & Safety |
| FR-8 | **Recovery, reconciliation & coordination.** Non-clean terminals are classified from evidence; recovery is in-band; duplicate launches are prevented by repo-level leases; reconciliation is via supported controls, never manual edits. | Recovery, Reconciliation & Coordination |
| FR-9 | **Observability & analysis.** Telemetry is structured at the source; analysis auto-fires on every terminal / blocked / supervision-lost transition. | Observability & Analysis |
| FR-10 | **Human-in-the-loop.** First-class operator surface: approve/deny, hand-off, override, inspect "why did/didn't X," and be **notified** when a run parks for attention. | Operator & Entry Surface |
| FR-11 | **Two authorities, separated.** Task status is owned by the Work Source; run activity is owned by the run event log. They never overwrite each other. | Work Source, Run Lifecycle |
| FR-12 | **Credential isolation.** Credentials are injected only at the tightest scope to the party that needs them; the **worker never holds Forge credentials**; all credential use is redacted in telemetry and audited. | Credentials & Secrets |
| FR-13 | **Adoption diagnostics.** Detect legacy/incompatible config or artifacts and refuse to run (fail closed) with adoption guidance; never silently mishandle them. | Configuration & Policy |

## Quality attributes (with acceptance checks)

| ID | Attribute | Acceptance check |
|---|---|---|
| NFR-TEST | **Testable** | The control plane runs against mock providers with **zero real processes/network**. Every driver passes a **provider conformance suite** (schema probes, real-driver smoke tests, incident replays, adversarial mocks that omit/delay/lie about signals). |
| NFR-OBS | **Observable** | Every run-state change is an event; **every terminal run has an `AnalysisRecorded` or `AnalysisFailed` event**. Invariant-tested. |
| NFR-EXT | **Extensible** | Adding a driver **touches only that provider's folder** — no core change. The Dependency Rule holds. |
| NFR-SAFE | **Safe & recoverable** | No irreversible action without its capability guarantees **attested**; unknown/ambiguous external state **fails closed** to a named state. Capability-gate + fail-closed tests. |
| NFR-SOLID | **SOLID / readable** | One responsibility per module; the **core depends only on contracts**. Review + dependency lint. |
| NFR-SCALE | **Scalable** | Concurrent runs coordinated by leases; **remote execution fits the Execution Host seam without core change**. Coordination tests + a remote-driver conformance check. |
| NFR-DET | **Deterministic control** | Every control-plane decision is a **pure function of recorded evidence**; **non-deterministic inputs (human decisions, LLM judgments, external state) enter only as recorded events**, never as replayable logic. Property-tested by replay. |
| NFR-SEC | **Security** | A stated threat model; the worker holds no Forge credentials (FR-12); scoped injection; **egress confinement attested per driver/version with negative probes**; secret redaction + retention policy; tamper-evident, audited decisions. |
| NFR-OPS | **Operability** | Concurrency/admission bounded by leases; backpressure under load; a declared **supported-platform matrix**; clear degraded states surfaced to the operator. |

## Out of scope (v1)

- Multi-project / multi-repo orchestration in a single run (a future routing layer above the Work Source).
- Hosted / multi-tenant service operation (the seams stay compatible with it; it is not built).
- A document/knowledge store (the Work Source references PRDs/designs; it does not author or store them).
- `auto` / LLM-adjudicated approvals (deferred per AD-14).
- Migration/transform of legacy runs (greenfield per AD-1; only adoption diagnostics, FR-13).
