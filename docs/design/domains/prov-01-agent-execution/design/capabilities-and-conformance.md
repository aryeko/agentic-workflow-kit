---
title: "Agent Execution - capabilities and conformance"
status: draft
last-reviewed: "2026-06-18"
---

# Capabilities and conformance

This file defines the Agent capability set, event invariants, and conformance suite. It is split from
[contracts-and-conformance.md](contracts-and-conformance.md) so the type catalog stays focused.

## Capability set

| Capability | Positive evidence | Negative / absent evidence |
|---|---|---|
| `canRelayApproval` | A real or mock request is observed, normalized, recorded, and answered through the provider channel. | Approval requests park; no synthetic answer is sent. |
| `canPersistApprovalAnswerChannel` | A pending approval survives disconnect / human latency / owned resume and is answered by stable request ids. | Live-only approvals park and require Operator recovery. |
| `canResumeOwned` | A provider session id can be resumed by the owning run and linked to the same host/session scope. | Resume is disabled; stale sessions do not accept answers. |
| `emitsStructuredToolExit` | Command item has command, source=`agent`, terminal status, exitCode, and redacted outputRef. | Tool event is degraded; completion and liveness gates cannot use it as structured exit evidence. |
| `emitsGuardianReview` | Guardian review notifications include target/action/status/risk and are version-probed as stable for the scope. | Guardian data is advisory text only. |
| `preservesHostProcessParentage` | Worker commands can be tied to the host-owned worker containmentRef or equivalent remote ownership proof. | Kill-dependent autonomy and recovery remain off. |

Capability gates use the exact driver version, protocol surface, platform, host attestation ids,
freshness key, and evidence refs. Schema-only evidence can prove message shape but cannot prove
liveness, persistence, parentage, or answer delivery.

## Event invariants

- A session emits at most one `linked` event and exactly one `terminal` event.
- `approval-requested.answerChannel.channelRef` is durable only when
  `canPersistApprovalAnswerChannel` is positive; otherwise it is live-only and the run parks.
- `tool-observed.exitCode` is required. A missing or null provider exit code becomes
  `structured-tool-exit-missing`.
- `tool-observed.outputRef` is required and must refer to redacted output with a digest. Raw command
  output is not embedded in the event log.
- Guardian review events never approve or deny a kit gate by themselves.

## Conformance suite

Every Agent driver must pass:

1. Schema probe: generate or load the provider schema for the exact driver version and verify all
   mapped methods, fields, and enum values.
2. Real-driver smoke probe: start a minimal worker through the Execution Host, observe linkage,
   progress, one command with exit code, and terminal state.
3. Approval relay probe: trigger each supported approval kind, record the provider request id, answer
   with allow and deny variants, and verify the provider accepted the answer.
4. Resume probe: park a pending owned session, restart the observing client, resume by provider
   session id, and answer or continue without losing linkage.
5. Parentage probe: prove worker command process ids or command items are within the host-owned
   containment scope supplied by prov-04.
6. Incident replays: dropped approval, lost linkage, no exit code, and claim-without-evidence.
7. Adversarial mock parity: the mock must be able to produce every positive signal and every missing,
   delayed, contradictory, or lying signal named in the failure modes.

Current evidence in `../evidence/` satisfies schema and MCP tools-list probes for Codex 0.141.0, but
does not satisfy the live-driver smoke, approval persistence, structured tool-exit, or parentage
probes. Those capabilities are therefore not claimed as validated for real Codex.
