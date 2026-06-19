# Evidence gates and merge

Completion and merge are decided from evidence and policy, not worker prose.

```mermaid
flowchart TB
  Worker["Worker self-report"] --> Hint["Hint only"]

  Git["Local git evidence"] --> Gate["Completion / merge gate"]
  Verify["Runner-owned verify evidence"] --> Gate
  Forge["Forge evidence"] --> Gate
  Policy["Resolved policy"] --> Gate
  Attestation["Capability attestations"] --> Gate
  Hint -. not sufficient .-> Gate

  Gate -->|all predicates pass| Merge["Runner may merge"]
  Gate -->|missing or ambiguous| Block["Park / block / fail closed"]
```

## Exact-head rule

Merge-related evidence must bind to the same candidate head SHA. If the PR head, branch head, action-observed head, or expected head do not match, the gate fails closed.

Full details live in [Completion and merge](../30-domain-reference/core/completion-and-merge/README.md).
