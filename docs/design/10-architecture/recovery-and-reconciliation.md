# Recovery and reconciliation

Recovery is in-band. The system records recovery facts; it does not edit artifacts manually.

```mermaid
flowchart TB
  Evidence["Recorded evidence"] --> Classifier["Recovery classifier"]
  Classifier --> Safety["Action safety class"]
  Safety -->|auto-safe + gate allows| Action["Apply supported recovery action"]
  Safety -->|operator required| Park["Park for operator"]
  Safety -->|forbidden| Block["Block / fail closed"]
  Action --> EventLog["Append recovery events"]
```

## Rules

- Recovery decisions are pure functions of recorded evidence.
- Ambiguity fails closed.
- Duplicate launches are prevented by leases.
- Claims are never cleared after unverified termination.
