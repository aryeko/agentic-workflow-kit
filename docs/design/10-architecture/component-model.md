# Component model

The high-level relationship is deliberately small:

```txt
User / Agent
  -> SDK core
  -> abstract providers
  -> concrete drivers
```

## Component responsibilities

| Component | Responsibility |
|---|---|
| User / Agent | Starts, inspects, approves, waits, or triggers work. |
| SDK core | Deterministic orchestration, state, gates, approvals, recovery, analysis. |
| Abstract providers | Interfaces for external capabilities. |
| Concrete drivers | Real integrations such as Codex, Local Host, GitHub, Markdown. |

## Diagram

```mermaid
flowchart LR
  User["User<br/>human or agent"] --> SDK["SDK core"]
  SDK --> Providers["Abstract providers"]
  Providers --> Drivers["Concrete drivers"]
  Drivers --> Providers
  Providers --> SDK
  SDK --> User
```

## Rule

The SDK can depend on provider interfaces, but it must not depend on concrete provider implementations.
