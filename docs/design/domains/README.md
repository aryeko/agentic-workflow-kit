---
title: kit-vnext — domain catalog
status: high-level design (scaffold)
last-reviewed: 2026-06-18
---

# Domain catalog

The 16 domains of vNext. Each domain lives under its layer and has a `README.md` that starts with the
chief-architect-owned Mandate, then carries the domain design. Each domain is designed in its own
session following the
[template](../_templates/domain-design-template.md) and [conventions](../conventions.md).

The Mandate is the brief, not the low-level design: responsibility, scope, owned requirements,
dependencies, required reading, deliverable, and definition of done. Slugs, layer placement, and key
dependency semantics are catalog-owned here.

## Index

| ID | Domain | Layer | Responsibility | Key dependencies |
|---|---|---|---|---|
| [edge-01](edge/edge-01-operator-surface/README.md) | Operator & Entry Surface | Edge | Human-first surface (MCP + CLI), triggers, outbound attention, "why did/didn't X" | Control plane |
| [core-01](core/core-01-run-lifecycle-and-state/README.md) | Run Lifecycle & Event State | Core | Event log + projections + writer model + run state machine + task snapshot | fnd-01 (config); fnd-02 (storage) |
| [core-02](core/core-02-capability-and-safety/README.md) | Capability & Safety | Core | Capability registry + gates over **attestations** ("earn autonomy"), modes | fnd-01; core-01; attestations |
| [core-03](core/core-03-approval-and-escalation/README.md) | Approval & Escalation | Core | Risk classify, mode ladder, policy, park/resume; judgment as recorded input | core-01, core-02; fnd-01; Agent |
| [core-04](core/core-04-supervision-and-liveness/README.md) | Supervision & Liveness | Core | Real-progress staleness, timers, wait primitive | core-01; Agent, Execution Host |
| [core-05](core/core-05-completion-and-merge/README.md) | Completion, Verification & Merge | Core | Evidence eval + fail-closed predicate + merge policy + policy snapshots | core-01/02/03; fnd-01; Forge, Execution Host, Workspace |
| [core-06](core/core-06-recovery-and-reconciliation/README.md) | Recovery, Reconciliation & Coordination | Core | Evidence-classified recovery, action-safety, repo-level leases | core-01/02; core-04/05; all seams |
| [core-07](core/core-07-observability-and-analysis/README.md) | Observability & Analysis | Core | Structured telemetry + auto-firing analyzer + metric honesty | core-01; fnd-02 (sibling event types are consumed data, not deps) |
| [prov-01](providers/prov-01-agent-execution/README.md) | Agent Execution | Providers | Agent contract + attestation + Codex driver + mock | prov-04 (host); fnd-04 (worker-safe creds/redaction) |
| [prov-02](providers/prov-02-forge-collaboration/README.md) | Forge / Collaboration | Providers | Forge contract + GitHub driver + mock (push/PR/checks/merge; remote credentials) | fnd-04 (creds) |
| [prov-03](providers/prov-03-work-source/README.md) | Work Source | Providers | Work Source contract + Markdown driver + mock (task status authority + snapshot) | fnd-02 (lease/artifact primitives) |
| [prov-04](providers/prov-04-execution-host/README.md) | Execution Host | Providers | Execution Host contract: spawn + contain + runner-owned command/verify; Local v1 / Remote later | fnd-03 (workspace); fnd-04 (injection/redaction/egress policy) |
| [fnd-01](foundation/fnd-01-configuration-and-policy/README.md) | Configuration & Policy | Foundation | Config schema, deterministic precedence + provenance, policy, adoption diagnostics | — |
| [fnd-02](foundation/fnd-02-storage-and-artifacts/README.md) | Storage & Artifacts | Foundation | Event-log persistence + lease/lock primitive + write-once artifact store | — |
| [fnd-03](foundation/fnd-03-workspace-and-repository/README.md) | Workspace & Repository | Foundation | Local git worktree lifecycle + local git evidence (local git only) | fnd-01 (repo policy); fnd-02 (leases/artifacts) |
| [fnd-04](foundation/fnd-04-credentials-and-secrets/README.md) | Credentials & Secrets | Foundation | Scoped credential injection, redaction, audit, egress policy | fnd-01 (credential refs + egress source policy) |

## Suggested design order

Foundation and seams first (they unblock the rest and make the core testable), then core, then edge:

1. **Foundation:** `fnd-01` (config), `fnd-02` (storage), `fnd-03` (workspace), `fnd-04` (credentials).
2. **Seams + mocks:** `prov-04` (execution host), `prov-03` (work source), `prov-01` (agent),
   `prov-02` (forge). Land the mock drivers early.
3. **Core spine:** `core-01` → `core-02` → `core-03`; then `core-04` and `core-05`;
   then `core-06` and `core-07` as their consumed evidence becomes available.
4. **Edge:** `edge-01`.

Reconciliation note (2026-06-19): catalog dependencies intentionally mirror domain frontmatter/body
for the affected domains. `core-05` is ordered after `core-03` because it consumes
`ApprovalDecisionRecorded` for protected-policy changes; provider domains that consume scoped
credentials list `fnd-04`, and foundation consumers list the fnd dependencies their bodies already
describe.
Core public state, reason, and failure tokens follow the kebab-case convention; canonical event type
names such as `RunLifecycleTransitioned`, `ApprovalDecisionRecorded`, and `CapabilityGateRecord`
remain cited verbatim.

## Status legend

`mandate: ready` — brief is approved, domain is ready to design. `design: draft | in-review | approved`;
`approved` means design-approved only, with implementation/conformance readiness tracked in
[the implementation readiness matrix](../../implementation/readiness-matrix.md).
