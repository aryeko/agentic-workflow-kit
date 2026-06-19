# Human control and approvals

The human operator is a first-class participant, not an emergency fallback.

```mermaid
sequenceDiagram
  participant Agent as Agent provider
  participant SDK as SDK core
  actor Human as Human operator

  Agent->>SDK: approval request
  SDK->>SDK: record pending request
  SDK->>SDK: classify risk and policy
  alt low-risk assisted allow
    SDK->>Agent: scoped grant
  else human required
    SDK-->>Human: attention needed
    Human->>SDK: recorded decision
    SDK->>Agent: scoped grant or denial
  end
```

## Rules

- Requests are recorded before decisions.
- High-risk requests go to a human.
- Grants are the tightest useful scope.
- `auto` / LLM adjudication is not v1.
