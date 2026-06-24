---
title: "Capability & Safety - gate evaluation and records"
status: approved
last-reviewed: "2026-06-19"
---

# Gate evaluation and records

Gate evaluation is a pure function of recorded Event log evidence, projections, a caller-resolved
policy decision, and a caller-supplied `evaluatedAt`. It never calls a provider, reads live time, reads
the filesystem, reads the policy store, or writes a projection.

```ts
evaluateCapabilityGate(
  request: CapabilityGateRequest,
  replay: RunReplay,
  projections: RunProjections
): CapabilityGateRecordPayload
```

## Attestation consumption

A `CapabilityAttestation` is usable only when all checks pass:

1. It is a committed Event log fact with a valid envelope, provider domain, capability,
   `evidenceRef`, `driverVersion`, `platform`, `freshnessKey`, `scope`, `at`, and `expiry`.
2. `at <= evaluatedAt < expiry`; expired or future-dated attestations are stale.
3. Scope exactly matches the gate scope or an approved parent scope named in the gate request. A parent
   scope is usable only when it appears in the matching `providerScopes[].approvedParentScopes` list for
   the same provider and freshness key, and the attestation scope is a lexical parent of the exact gate
   scope (`<parent>/...`, `<parent>:...`, or `<parent>#...`). Scope includes provider domain, driver
   id/version, platform, repo/workspace/session or PR head as applicable, egress policy digest when
   relevant, and freshness key. The evaluator does not infer parent scopes from provider behavior.
4. Result is `positive`; any fresh in-scope `negative` or contradictory attestation for the same
   provider capability denies the guarantee.
5. Evidence is replayable: `evidenceRef` resolves to recorded probe output or an artifact digest.
   Schema-only evidence can prove shape, but cannot prove liveness, persistence, parentage, kill,
   egress confinement, or write-side Forge behavior.

Stale, absent, negative, out-of-scope, contradictory, malformed, or non-replayable evidence fails
closed. Driver declarations, worker self-report, Agent prose, Guardian review text, and a provider's
unprobed feature list never allow a gate.

## Types

```ts
type CapabilityMode = "manual" | "assisted";
type GateDecision = "allow" | "deny";
type CapabilityGateFailureReason =
  | "mode-disallows-capability" | "policy-disallows-capability" | "capability-deferred"
  | "run-log-degraded" | "required-evidence-absent" | "required-evidence-ambiguous"
  | "attestation-absent" | "attestation-stale" | "attestation-negative"
  | "attestation-out-of-scope" | "attestation-contradictory"
  | "attestation-non-replayable" | "self-report-only" | "gate-record-unwritable";
type ProviderDomain = "Agent" | "Forge" | "Work Source" | "Execution Host";

interface CapabilityGateScope {
  runId: string;
  taskId?: string;
  operationId: string;
  providerScopes: {
    provider: ProviderDomain;
    scope: string;
    freshnessKey: string;
    approvedParentScopes?: string[];
  }[];
  repoRef?: string;
  workspaceRef?: string;
  sessionId?: string;
  pullRequestRef?: string;
  expectedHeadSha?: string;
  egressPolicyDigest?: string;
}
interface CapabilityGatePolicyDecision {
  policyRef: string;
  permits: boolean;
  denialReason?: string;
}
interface AttestationRef {
  eventId: string;       // run-log event id of the appended CapabilityAttestation (envelope-level)
  provider: ProviderDomain;
  capability: string;
  evidenceRef: string;
  freshnessKey: string;
  scope: string;
  expiry: string;
}
interface GuaranteeEvaluation {
  guaranteeId: string;
  passed: boolean;
  attestationRefs: AttestationRef[];
  evidenceRefs: string[];
  failureReason?: CapabilityGateFailureReason;
}
interface CapabilityGateRequest {
  gateId: string;
  runId: string;
  capability: CapabilityId;
  mode: CapabilityMode;
  scope: CapabilityGateScope;
  policyRef: string;
  policyDecision: CapabilityGatePolicyDecision;
  requestedByDomain: string;
  requestedAction: string;
  evaluatedAt: string;
  evidenceRefs: string[];
}
interface CapabilityGateRecordPayload {
  schema: "kit-vnext.capability-gate-record.v1";
  gateId: string;
  capability: CapabilityId;
  decision: GateDecision;
  mode: CapabilityMode;
  scope: CapabilityGateScope;
  policyRef: string;
  requestedByDomain: string;
  requestedAction: string;
  evaluatedAt: string;
  evaluatedGuarantees: GuaranteeEvaluation[];
  attestationRefs: AttestationRef[];
  evidenceRefs: string[];
  failureReason?: CapabilityGateFailureReason;
}
```

`CapabilityGateRecordPayload` is appended as event type `CapabilityGateRecord` with
`domain = "core-02"` and `barrier` durability. Consumers must cite the committed record event id
before acting. If append fails, the caller denies with `gate-record-unwritable` and does not perform
the autonomous action.

## Algorithm

1. Reject with `run-log-degraded` if core-01 replay/projection health is unusable, projections are
   missing, writer fencing failed, or session linkage required by the capability is ambiguous.
2. Reject with `mode-disallows-capability`, `policy-disallows-capability`, or `capability-deferred`
   before checking provider evidence when mode, `request.policyDecision.permits`, or AD-14 prevents the
   capability. `policyDecision` is the normalized Configuration & Policy result for this
   capability/action/scope; this domain does not parse policy documents.
3. Select only committed `CapabilityAttestation` events at or before `evaluatedAt`.
4. Filter by provider domain, capability name, driver version, platform, freshness key, and scope.
5. Mark each guarantee `passed` only when required recorded evidence exists and the selected
   attestations are fresh, positive, non-contradictory, and replayable.
6. Return `allow` only if every guarantee passes; otherwise return `deny` with the first stable
   failure reason in predicate order.

The stable failure ordering is part of replay determinism. Adding new reasons in a future version
requires migration guidance for existing recorded gate payloads.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Capability & Safety](./README.md) · **← Prev:** [Capability & Safety - capability registry](./capability-registry.md) · **Next →:** [Approval & Escalation](../approval-and-escalation/README.md)

<!-- /DOCS-NAV -->
