← [Back to README](./README.md)

# Glossary

| Term | Definition |
|---|---|
| **Agent Worker (Worker)** | The AI agent process that implements a story — writes code, runs local checks, produces local commits. Holds no forge credentials; cannot initiate pushes or merges. Sandboxed behind the authorization fence. |
| **Anti-gaming protection** | The guarantee that the policy in force at run launch cannot be loosened by the worker during the run (GUARD-1/GUARD-2). Work that touches policy, CI, or gate configuration is blocked until the human re-approves. |
| **Authorization fence** | The runtime check that every worker request passes before it executes. Fails closed on unauthorized requests. The system-enforced floor for all worker activity. |
| **Capability attestation** | A durable, per-driver proof that a specific capability is available. Produced by a capability probe; recorded in the event log; gates autonomous action. Missing, stale, or failed attestation routes to a human. |
| **Checkpoint** | The last durable saved state of a run from which it can safely resume without repeating irreversible actions. Resume granularity is the checkpoint, not the individual instruction. |
| **Escalation** | A human-facing interrupt fired when a real decision is on the line (risk classification is medium/high, capability is unproven, or classification is ambiguous). A first-class event; the run parks at the escalation point and survives restarts. |
| **Event log** | The append-only, machine-readable record of everything that happens in a run. The single source of truth for run activity. A versioned, documented product surface and the input contract for suite-level tools. |
| **Execution plan** | The single hard input schema Jig owns. A structured, versioned, dependency-ordered collection of stories produced by the upstream products or authored directly. The one hard schema boundary in the suite. |
| **Fault isolation** | The guarantee that a blocked or rejected story halts only itself and its downstream dependents; independent stories continue running. The unit of isolation is the dependency subgraph. |
| **Fix-forward scan** | An extensibility seam (CFG-7) that allows an operator-provided scanner to review merged work post-hoc and spawn fix stories for issues found. This is a seam Jig exposes, not a feature Jig ships. |
| **Gate** | A checkpoint evaluated by the runner before proceeding. Requires external, independently verifiable evidence (CI result, review approval, capability attestation). Never accepts the worker's self-report. |
| **Merge spectrum** | The configurable range from "push branch and wait for a human to merge" (prevention-leaning) to "auto-merge on evidence" (throughput-leaning). A policy setting on the track. |
| **Policy** | The governance contract for a run on a track. Expresses risk tolerance: gating posture, merge spectrum, concurrency ceiling, retry budget, review requirements, escalation rules, anti-gaming protection. Fixed at run launch; cannot be loosened during the run. |
| **Preset** | A named starting configuration (policy + work profile) that encodes the author's best-practice defaults. At Phase 0, two canonical presets ship: _prevention_ and _balanced_. The _throughput_ preset ships in Phase 1 (CFG-9). |
| **Run** | One execution of an execution plan under a specific policy and work profile on a specific track. Has a start, optional pause/resume cycles, and an end (successful, deliberate stop, or structured failure). |
| **Runner** | The Jig process that orchestrates a run: manages the plan's dependency graph, evaluates gates, routes escalations, performs irreversible actions (push, PR, merge). The privileged half of the worker/runner split. |
| **Story** | One unit of work within a plan, scoped and sized for a single agent session. The unit of fault isolation and the unit of recovery (checkpoint granularity). |
| **Track** | One independent line of work within a repo, with its own policy, work profile, and execution plan. Multiple tracks run in parallel. The unit of policy isolation. |
| **Work profile** | The realization of how work is carried out on a track. Covers model, effort, prompt strategy, and role configuration. Freely tunable; not safety-gated. |
| **Work Source** | An adapter that produces conformant execution-plan stories from an upstream task-tracking system (plan files, GitHub Issues, Jira, etc.). One of the four stable Jig seam contracts. Every Work Source driver must output stories conformant to the execution-plan schema. |
| **Worker / runner split** | The architectural invariant that separates the sandboxed agent worker (implements stories, no forge credentials) from the privileged runner (push/PR/merge authority, gate evaluation). A system-enforced floor. |
| **[ship blocker]** | An acceptance criterion designation indicating the criterion must be met before Jig ships v1.0.0. No exceptions. |
| **[target]** | An acceptance criterion designation indicating the criterion is desired and planned but may be deferred to a later phase with a documented workaround or timeline. |

---
Previous: [09-risks-and-open-questions](./09-risks-and-open-questions.md) · Next: — · Up: [README](./README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig PRD](./README.md) · **← Prev:** [Risks and open questions](./09-risks-and-open-questions.md) · **Next →:** [design corpus overview](../../../design/README.md)

<!-- /DOCS-NAV -->
