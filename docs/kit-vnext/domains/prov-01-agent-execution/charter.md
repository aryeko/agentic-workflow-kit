---
title: "Agent Execution — charter"
id: "prov-01"
layer: "providers"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Agent Execution — charter

**Purpose.** The Agent contract (the model/worker seam) and its capability attestation, with the
**Codex** driver and a **mock**. The worker runs *on* an Execution Host (prov-04); this seam owns the
agent protocol, not the process.

## Responsibilities (in scope)
- The host-neutral **Agent contract**: drive a worker that runs on an Execution Host; a normalized
  event stream (progress / linked / approval-requested / `ToolObserved{command, exitCode, outputRef}` /
  terminal); an approval **answer** channel; resume an owned session; and **capability attestation**
  (`canRelayApproval`, `canResumeOwned`, `emitsStructuredToolExit`).
- The **Codex driver**: Phase 0 (`mcp-server` + `elicitation/create`) → Phase 1 (`app-server`,
  `turn/interrupt`, typed approvals) behind a per-version probe; maps Codex decision enums → neutral
  scoped grants; captures tool exit codes; resolves the Guardian + process-parentage questions. Runs on
  the Execution Host (prov-04) for containment/kill.
- The **mock driver**: a programmable, adversarial simulator + incident-replay fixtures (dropped
  approval, lost linkage, no exit code, claim-without-evidence).

## Out of scope
- Adjudication (core-03), supervision logic (core-04).
- **Process containment, kill, and runner-owned verify** — the Execution Host (prov-04).
- Local git (fnd-03) and remote/credentialed ops (prov-02). The worker holds no Forge credentials.

## Requirements owned
FR-3 (delegated implementation: edits + local commits), FR-4 transport, NFR-EXT, NFR-TEST.

## Dependencies (Dependency Rule)
- Depends on: prov-04 (runs/contained by the Execution Host), fnd-04 (narrow worker credentials —
  never Forge). Implements the Agent contract.
- Must NOT: depend on the control plane.

## Required reading
Standard set + [prov-04](../prov-04-execution-host/charter.md) and the provider evidence/conformance
rules in [conventions.md](../../conventions.md). Codex protocol facts go in this domain's dated
`evidence/` appendix (generate the app-server schema for the pinned version).

## Deliverable
`design.md` defining: the Agent contract + attested capabilities (validated against Codex **and** the
mock); the Codex mapping (decision enums → scoped grants, approval relay, resume, exit-code capture,
Guardian decision, process parentage); the mock's scripting surface + fixtures; the conformance suite;
degraded modes.

## Definition of done (domain-specific)
- The contract is satisfiable by Codex (validated against the generated schema in `evidence/`) AND the
  mock; the mock reproduces each named incident failure mode.
- Approval relay, resume, and structured exit-code capture are attested honestly (degrade, never fake).

## Open questions
- Guardian: integrate (consume risk levels, answer `approveGuardianDeniedAction`) vs bypass.
- Phase 0 vs app-server-first; worker-command parentage under app-server (with prov-04).
