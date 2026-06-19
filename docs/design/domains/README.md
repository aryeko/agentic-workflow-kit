---
title: kit-vnext — domain catalog
status: high-level design (scaffold)
last-reviewed: 2026-06-18
---

# Domain catalog

The 16 domains of vNext. Each has a `charter.md` (the chief-architect-owned brief). Each is designed in
its own session, which produces a `design.md` in the domain folder following the
[template](../_templates/domain-design-template.md) and [conventions](../conventions.md).

A charter is the **mandate**, not the design: responsibility, scope, owned requirements, dependencies,
required reading, deliverable, and definition of done.

## Index

| ID | Domain | Layer | Responsibility | Key dependencies |
|---|---|---|---|---|
| [edge-01](edge-01-operator-surface/charter.md) | Operator & Entry Surface | Edge | Human-first surface (MCP + CLI), triggers, outbound attention, "why did/didn't X" | Control plane |
| [core-01](core-01-run-lifecycle-and-state/charter.md) | Run Lifecycle & Event State | Core | Event log + projections + writer model + run state machine + task snapshot | fnd-01 (config); fnd-02 (storage) |
| [core-02](core-02-capability-and-safety/charter.md) | Capability & Safety | Core | Capability registry + gates over **attestations** ("earn autonomy"), modes | fnd-01; core-01; attestations |
| [core-03](core-03-approval-and-escalation/charter.md) | Approval & Escalation | Core | Risk classify, mode ladder, policy, park/resume; judgment as recorded input | core-01, core-02; Agent |
| [core-04](core-04-supervision-and-liveness/charter.md) | Supervision & Liveness | Core | Real-progress staleness, timers, wait primitive | core-01; Agent, Execution Host |
| [core-05](core-05-completion-and-merge/charter.md) | Completion, Verification & Merge | Core | Evidence eval + fail-closed predicate + merge policy + policy snapshots | core-01/02; Forge, Execution Host, Workspace |
| [core-06](core-06-recovery-and-reconciliation/charter.md) | Recovery, Reconciliation & Coordination | Core | Evidence-classified recovery, action-safety, repo-level leases | core-01/02; core-04/05; all seams |
| [core-07](core-07-observability-and-analysis/charter.md) | Observability & Analysis | Core | Structured telemetry + auto-firing analyzer + metric honesty | core-01; fnd-02 (sibling event types are consumed data, not deps) |
| [prov-01](prov-01-agent-execution/charter.md) | Agent Execution | Providers | Agent contract + attestation + Codex driver + mock | prov-04 (host) |
| [prov-02](prov-02-forge-collaboration/charter.md) | Forge / Collaboration | Providers | Forge contract + GitHub driver + mock (push/PR/checks/merge; remote credentials) | fnd-04 (creds) |
| [prov-03](prov-03-work-source/charter.md) | Work Source | Providers | Work Source contract + Markdown driver + mock (task status authority + snapshot) | — |
| [prov-04](prov-04-execution-host/charter.md) | Execution Host | Providers | Execution Host contract: spawn + contain + runner-owned command/verify; Local v1 / Remote later | fnd-03 (workspace) |
| [fnd-01](fnd-01-configuration-and-policy/charter.md) | Configuration & Policy | Foundation | Config schema, deterministic precedence + provenance, policy, adoption diagnostics | — |
| [fnd-02](fnd-02-storage-and-artifacts/charter.md) | Storage & Artifacts | Foundation | Event-log persistence + lease/lock primitive + write-once artifact store | — |
| [fnd-03](fnd-03-workspace-and-repository/charter.md) | Workspace & Repository | Foundation | Local git worktree lifecycle + local git evidence (local git only) | — |
| [fnd-04](fnd-04-credentials-and-secrets/charter.md) | Credentials & Secrets | Foundation | Scoped credential injection, redaction, audit, egress policy | — |

## Suggested design order

Foundation and seams first (they unblock the rest and make the core testable), then core, then edge:

1. **Foundation:** `fnd-02` (storage), `fnd-03` (workspace), `fnd-04` (credentials), `fnd-01` (config).
2. **Seams + mocks:** `prov-04` (execution host), `prov-03` (work source), `prov-01` (agent),
   `prov-02` (forge). Land the mock drivers early.
3. **Core spine:** `core-01` → `core-02` → then `core-03`, `core-04`, `core-05`, `core-06`, `core-07`
   (largely parallel once the spine exists).
4. **Edge:** `edge-01`.

## Status legend

`charter: ready` — brief is approved, domain is ready to design. `design: draft | in-review | approved`.
