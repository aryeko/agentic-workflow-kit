---
title: "Capability & Safety - capability registry"
status: approved
last-reviewed: "2026-06-19"
---

# Capability registry

This file defines the autonomous powers owned by `core-02` and the guarantee predicates used by
`evaluateCapabilityGate`. Every capability is default-off until its predicate passes.

```ts
type CapabilityId =
  | "auto-merge"
  | "auto-recover"
  | "unattended-run"
  | "escalation-auto-grant"
  | "orchestrator-decide";
```

## Shared predicate inputs

Every predicate receives:

- `mode`: `manual` or `assisted`;
- `policyDecision`: normalized Configuration & Policy result supplied by the caller, with `policyRef`
  and a boolean `permits` value for this capability, requested action, and gate scope;
- `scope`: Run, operation, provider, workspace/session, PR head, and egress-policy scope;
- `replay` and `projections` from core-01;
- recorded evidence refs supplied by the caller;
- provider `CapabilityAttestation` events selected by
  [gate-evaluation-and-records.md](gate-evaluation-and-records.md).

Shared guarantees for every non-deferred capability:

1. Mode is `assisted`; `manual` denies autonomous powers.
2. `policyDecision.permits === true` for this capability, requested action, and scope.
3. Core-01 replay/projection health is usable.
4. Required evidence is recorded, unambiguous, and not self-report-only.
5. Required attestations are fresh, positive, in scope, non-contradictory, and replayable.

## Registry

| Capability | v1 status | Unlocks | Required guarantees |
|---|---|---|---|
| `auto-merge` | `assisted` only | Runner may perform an unattended Forge merge or merge-queue enqueue for the exact PR head. | Shared guarantees; completion/verification evidence is recorded; Forge evidence is exact-head and unambiguous; Forge `canInspectProtection` and `supportsRulesets` are fresh positive; Forge `supportsMergeQueue` is fresh positive when policy requires queue; Work Source `supportsStatusWrite` is fresh positive when the action will mark the Task complete. |
| `auto-recover` | `assisted` only | Recovery may take a deterministic safe action such as retrying evidence collection, terminating an owned worker, or re-entering an approved recovery edge. | Shared guarantees; run lifecycle is non-terminal or on an approved recovery edge; ownership/session linkage is known; Execution Host `canKill` is fresh positive for kill-dependent recovery; Execution Host `containmentStrength` is `process-group`, `kernel-tree`, or `job-object`; Agent `preservesHostProcessParentage` is fresh positive when worker activity is involved. |
| `unattended-run` | `assisted` only | The Run may proceed without live Operator attention until it hits an approval, failed gate, terminal state, or notification condition. | Shared guarantees; Work Source `supportsClaim` is fresh positive for intake; Execution Host `canKill`, acceptable `containmentStrength`, and scoped `egress-confinement` are fresh positive for launch; Agent linkage evidence is recorded; Agent `preservesHostProcessParentage` is fresh positive for worker execution; approval relay limitations are recorded so missing relay parks rather than guesses. |
| `escalation-auto-grant` | `assisted` only | Approval relay may answer a worker escalation with a deterministic pre-authorized scoped grant. | Shared guarantees; policy permits the exact approval kind and requested scope; the grant is no broader than the request; Agent `canRelayApproval` is fresh positive; Agent `canPersistApprovalAnswerChannel` is fresh positive when the request may survive park/resume; Execution Host `egress-confinement` is fresh positive for network grants; no LLM or worker prose chooses the answer. |
| `orchestrator-decide` | deferred | Future LLM adjudication of bounded judgments. | Always denies in v1 with `capability-deferred`. AD-14 requires a later design for judgment-as-recorded-input before any predicate can allow it. |

The acceptable v1 containment floor is `process-group` or stronger. A stricter policy floor is
allowed; a weaker, unknown, stale, or absent containment attestation denies the dependent capability.

## Self-report rejection

Worker claims, Agent prose, Guardian review text, driver feature lists, and schema-only behavioral
claims may explain why a gate was requested, but they never satisfy a guarantee. A guarantee can pass
only through recorded evidence and capability attestations whose probe evidence is replayable.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Capability & Safety](./README.md) · **← Prev:** [Capability & Safety](./README.md) · **Next →:** [Capability & Safety - gate evaluation and records](./gate-evaluation-and-records.md)

<!-- /DOCS-NAV -->
