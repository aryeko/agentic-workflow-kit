← [Back to README](./README.md)

# Quality bars

*Cross-cutting, non-functional requirements that apply across features and phases. Every
requirement here must hold regardless of which driver, preset, or policy is in use, unless
the scope column specifies otherwise.*

| ID | Quality bar | Applies to |
|---|---|---|
| Q-1 | **Observability latency:** events are persisted to the event log within 100 ms of occurring. A gate or state-transition event is never lost because persistence lagged. | All phases; all event types |
| Q-2 | **Credential isolation:** no forge credentials, privileged tokens, or secrets appear in the event log, worker environment, worker output, or any observable artifact. If a credential is detected in an observable position, the run halts immediately and surfaces a structured error. | All phases; all drivers |
| Q-3 | **Idempotent resume:** resuming from any saved checkpoint produces the same externally visible outcome as completing from that checkpoint without interruption. Irreversible actions already recorded are never repeated; no duplicate push, PR, or merge occurs. | All phases |
| Q-4 | **Schema validation at ingestion:** an execution plan that does not conform to the versioned input schema is rejected at ingestion with a structured, human-readable error before any story is started, any event is emitted, or any resource is allocated. | All phases |
| Q-5 | **Fail-closed on ambiguity:** when Jig cannot classify a request's risk level, cannot verify a capability, or encounters a state it cannot interpret safely, the default action is to escalate to the human or park — never to proceed under an optimistic assumption. | All phases; all gate decisions |
| Q-6 | **No silent partial progress:** a run that cannot safely continue parks in a named, inspectable state and emits a structured error that tells the user what state was reached and what is needed to continue. It never silently advances past an unsafe point or silently leaves behind partial work. | All phases |
| Q-7 | **Anti-gaming integrity:** the policy effective at run launch is the policy for the entire run. No mid-run configuration write — by the worker, the runner, or an extensibility hook — may loosen a policy constraint. Changes to protected files (CI definitions, policy, gate setup, verification configuration) halt the affected story and require explicit human re-approval and re-verification before the run may continue on that story. | All phases |
| Q-8 | **Documented, versioned contracts:** every public contract — the execution-plan schema, the event-log schema, the policy and work-profile field set, the four seam contracts, preset definitions — is documented and versioned alongside the code. Breaking changes follow a published migration path. | All phases; from Phase 0 |
| Q-9 | **Security of the authorization fence:** every request the worker makes — command execution, file write, network call, provider call — passes through the authorization check before it runs. There is no path through which a worker request executes without authorization evaluation, including via third-party agent SDK calls or MCP tool invocations. | All phases |
| Q-10 | **Audit completeness:** the event log for a completed or parked run is sufficient to reconstruct the full sequence of decisions, gate outcomes, and state transitions that occurred. No event relevant to "what happened and why" is missing or out of order. | All phases |
| Q-11 | **Concurrency safety:** stories running in parallel on the same track do not contaminate each other's authorization scope, event log, or checkpoint state. Tracks running in parallel in the same repo do not contaminate each other's policy, credentials, or records. | Phase 0 (same-track concurrency); Phase 2 (multi-track) |

---
Previous: [05-phases](./05-phases.md) · Next: [07-success-metrics](./07-success-metrics.md) · Up: [README](./README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig PRD](./README.md) · **← Prev:** [Phases](./05-phases.md) · **Next →:** [Success metrics](./07-success-metrics.md)

<!-- /DOCS-NAV -->
