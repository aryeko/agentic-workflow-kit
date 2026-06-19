---
title: kit-vnext — capability attestation
status: high-level design
last-reviewed: "2026-06-19"
---

# Capability attestation

Autonomous powers are unlocked only when their guarantees can be freshly and positively proved. A
driver does not declare that it supports a capability; it is probed, and the result is recorded as
a `CapabilityAttestation` event in the run log. The Control plane gates on recorded attestations,
never on driver self-report.

```mermaid
flowchart LR
  D["Driver"] -->|probed at launch (or on freshnessKey)| A["CapabilityAttestation\n(appended to run log)"]
  A --> G["Capability gate (SDK)"]
  G -->|fresh + positive + in scope| Allow["Autonomous action permitted"]
  G -->|absent / stale / negative / out-of-scope| Deny["Fail closed — capability off"]
```

## Ownership

`CapabilityAttestation` is an SDK-owned type. Providers emit attestation payloads; the SDK
appends them to the run log and evaluates them when a gate is consulted. The testkit validates
that provider implementations emit correctly shaped attestations, but it does not own the type.

## Attestation shape

Every `CapabilityAttestation` record carries:

| Field | Purpose |
|---|---|
| `capability` | Named provider guarantee being attested (e.g. `canKill`, `canRelayApproval`, `supportsMergeQueue`). Core autonomous powers such as `auto-merge` are *evaluated* from attestations by a gate; they are not themselves provider attestations. |
| `probeMethod` | How the probe was performed (distinguishes active test from passive observation) |
| `result` | `positive` or `negative` |
| `evidenceRef` | Reference to the raw probe evidence appended to the run log |
| `scope` | The run, driver instance, or platform context the attestation covers |
| `expiry` | When the attestation becomes stale and must be re-probed |
| `driverVersion` | Version of the driver that produced the attestation |
| `platform` | Platform/environment context |
| `freshnessKey` | Re-probe trigger: if this key changes, the attestation is stale |
| `at` | Timestamp the probe completed |
| `details` (optional) | Provider-specific proof metadata (e.g. containment strength, egress policy digest) |

## Evaluation rules

A gate treats an attestation as absent — and the corresponding capability as off — when any of
the following are true:

- No attestation for the capability is present in the run log.
- The attestation is stale (past `expiry`, or `freshnessKey` has changed).
- `result` is `negative`.
- The attestation is out of scope for the current action.
- Attestations are contradictory or non-replayable.
- The run log is degraded and replay is not usable.

Self-report from a worker or driver (prose, a claim in a tool call, an unprobed flag) is never
sufficient and is always rejected as the sole support for a gate allow.

## Capability examples by provider

- **Agent (`prov-01`):** `canRelayApproval`, `canResumeOwned`, `emitsStructuredToolExit`
- **Execution Host (`prov-04`):** `canKill`, `containmentStrength`, egress confinement (proven by
  a negative probe that a disallowed host is actually blocked)
- **Forge (`prov-02`):** `supportsRulesets`, `supportsMergeQueue`, `supportsThreadResolution`,
  `canInspectProtection`
- **Work Source (`prov-03`):** `supportsClaim`, `supportsStatusWrite`, `supportsTracks`,
  `supportsDependencies`

## Authoritative references

- Architecture overview and the "earn autonomy" principle: [architecture.md](architecture.md) §3
- Gate evaluation, capability registry, and `CapabilityGateRecord`:
  [Capability & Safety](../30-domain-reference/core/capability-and-safety/README.md) (core-02)
- Provider-specific attestation payloads and conformance requirements:
  - [Agent Execution](../30-domain-reference/providers/agent-execution/README.md) (prov-01)
  - [Execution Host](../30-domain-reference/providers/execution-host/README.md) (prov-04)
  - [Forge / Collaboration](../30-domain-reference/providers/forge-collaboration/README.md) (prov-02)
  - [Work Source](../30-domain-reference/providers/work-source/README.md) (prov-03)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [architecture overview](./README.md) · **← Prev:** [event log and state](./event-log-and-state.md) · **Next →:** [evidence gates and merge](./evidence-gates-and-merge.md)

<!-- /DOCS-NAV -->
