# Runtime flow

A run moves through intake, workspace preparation, worker execution, verification, forge operations, and settlement.

```mermaid
sequenceDiagram
  actor User as User / Agent
  participant SDK as SDK core
  participant WS as Work Source provider
  participant Host as Execution Host provider
  participant Agent as Agent provider
  participant Forge as Forge provider

  User->>SDK: start run
  SDK->>WS: select and claim task
  WS-->>SDK: task snapshot
  SDK->>Host: prepare workspace and spawn worker
  SDK->>Agent: start / observe worker
  Agent-->>SDK: progress, approval requests, terminal
  SDK->>Host: runner-owned verify
  Host-->>SDK: command evidence
  SDK->>Forge: push / PR / evidence / merge
  Forge-->>SDK: exact-head forge evidence
  SDK->>WS: write task status when allowed
  SDK-->>User: result, analysis, attention state
```

The worker implements. The SDK decides. The providers report evidence. The runner owns credentialed and irreversible actions.
