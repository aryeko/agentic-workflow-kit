# Capability attestation

Autonomy is unlocked only by fresh, positive, scoped evidence.

```mermaid
flowchart LR
  Driver["Concrete driver"] --> Probe["Probe capability"]
  Probe --> Attest["CapabilityAttestation<br/>recorded by SDK"]
  Attest --> Gate["Capability gate"]
  Gate -->|fresh + positive + in scope| Allow["Allow capability"]
  Gate -->|missing / stale / negative| Deny["Fail closed"]
```

## Ownership fix

`CapabilityAttestation` is owned by the SDK, not the testkit. Testkit imports and validates the SDK type; providers emit it; the SDK evaluates it.

## Required shape

The SDK-owned shape includes:

```txt
capability
probeMethod
result
evidenceRef
scope
expiry
driverVersion
platform
freshnessKey
at
details?
```

`details` carries provider-specific proof metadata such as containment strength or egress policy digest.
