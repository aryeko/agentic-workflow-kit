# Provider interface model

Provider interfaces live in the SDK. Provider packages implement them.

```mermaid
flowchart TB
  SDK["SDK"] --> Agent["AgentProvider interface"]
  SDK --> Host["ExecutionHostProvider interface"]
  SDK --> Forge["ForgeProvider interface"]
  SDK --> Work["WorkSourceProvider interface"]

  Codex["provider-codex"] -. implements .-> Agent
  Local["provider-local"] -. implements .-> Host
  GitHub["provider-github"] -. implements .-> Forge
  Markdown["provider-markdown"] -. implements .-> Work
```

## Interfaces

- `AgentProvider`
- `ExecutionHostProvider`
- `ForgeProvider`
- `WorkSourceProvider`

## Rule

The interface is stable, host-neutral, and SDK-owned. Driver-specific SDK objects die inside provider packages.
