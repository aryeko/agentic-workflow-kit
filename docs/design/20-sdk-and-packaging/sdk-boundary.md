# SDK boundary

The SDK is the reusable product library. It owns deterministic orchestration and the abstract provider contracts.

## SDK owns

```txt
Core runtime API
Run/event types
Provider interfaces
CapabilityAttestation
Evidence refs
Config/policy DTOs
Approval and gate models
Recovery and analysis models
Testable ports: clock, id, storage, leases, artifacts
```

## SDK must not own

```txt
Codex concrete protocol client
GitHub SDK / Octokit
execa
native containment helper
MCP server runtime
CLI parser
real markdown tracker mutation logic
provider SDK response types
testkit mocks
```

## Factory shape

```ts
export function createWorkflowKit(input: {
  providers: {
    agent: AgentProvider;
    executionHost: ExecutionHostProvider;
    forge: ForgeProvider;
    workSource: WorkSourceProvider;
  };
  ports: {
    clock: Clock;
    ids: IdGenerator;
    eventLog: EventLogStorePort;
    artifacts: ArtifactStorePort;
    leases: LeaseStorePort;
  };
  policy: ResolvedPolicy;
}): WorkflowKit;
```

The SDK receives concrete providers. It never discovers or imports them directly.
