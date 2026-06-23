---
title: kit-vnext — SDK boundary
status: high-level design
last-reviewed: "2026-06-19"
---

# SDK boundary

The SDK is the reusable product library. It owns deterministic orchestration and the abstract provider
contracts. Its dependency surface must remain narrow: pure runtime libraries only (e.g. zod and small
pure utilities). Any dependency that pulls a platform-specific native module, a CLI parser, a network
client, or a process-execution helper is forbidden from the SDK.

## What the SDK owns

The SDK owns:

- The core runtime API exposed to callers (`createWorkflowKit` factory and its return type)
- Run and event types; the event log append/replay model
- The four provider interfaces: `AgentProvider`, `ExecutionHostProvider`, `ForgeProvider`,
  `WorkSourceProvider` (canonical type catalog:
  [provider-ports.md](provider-ports.md))
- `CapabilityAttestation` type and the capability gate evaluation logic (core-02). The canonical
  payload shape is in [provider-ports.md](provider-ports.md).
- Evidence refs, config/policy DTOs, approval and gate models
- Recovery classification and the replay/projection engine (core-06)
- Storage **port interfaces**: `EventLogStorePort`, `ArtifactStorePort`, `LeaseStorePort`
  (canonical type catalog: [storage-port-types.md](storage-port-types.md))
- **In-memory default implementations** of those storage ports (suitable for tests and simple
  single-process use)

The storage port interfaces and their in-memory defaults belong in the SDK because the Control plane
depends on them directly. See the deep spec at
[docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md](../30-domain-reference/foundation/storage-and-artifacts/README.md)
for the full contract (append durability classes, lease fencing, artifact write-once guarantees, and
network-filesystem degradation behavior). The `*StorePort` names are SDK injection names for the same
contract surface typed as `EventLogStore`, `ArtifactStore`, and `LeaseStore` in
[storage-port-types.md](storage-port-types.md).

### Where concrete stores live

The SDK's in-memory implementations are not suitable for production use across process restarts.
Production executables need a filesystem-backed store. That concrete store is **wired in by the
executables** (cli and mcp), not by the SDK itself. This keeps the SDK dependency-light.

A native-backed store — for example, a SQLite implementation that pulls a native binary dependency —
must live in its **own adapter package** outside the SDK (e.g. `store-sqlite` or similar). The SDK
depends only on the port interface, not on any concrete backend.

```
sdk           — owns port interfaces + in-memory defaults
cli / mcp     — wire in the filesystem-backed concrete store at startup
store-sqlite  — (if needed) separate adapter package; never imported by sdk
```

## What the SDK must not own

The SDK must never import:

- Concrete provider packages (`provider-codex`, `provider-local`, `provider-github`, `provider-markdown`)
- `cli` or `mcp`
- `testkit` mocks
- `@octokit/*` or any GitHub client
- `execa` or any process-execution helper
- A native containment helper
- A concrete Codex protocol client
- The MCP server runtime
- A CLI parser

These restrictions are enforced statically. See [dependency-rules.md](dependency-rules.md).

## Factory shape

The `createWorkflowKit` factory is how callers supply concrete providers and storage ports to the SDK.
The SDK receives them at construction time and never discovers or imports them directly.

```ts
type Clock = () => string;

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

`Clock` is an injected zero-argument function returning the current ISO-8601 timestamp string. Core
logic samples time only through explicit request fields or this injected clock; tests use fixed or
scripted clocks. Timer reducers receive the sampled timestamp as data and never call ambient time
directly.

All time, identity, randomness, storage, and provider behavior is injected. The SDK contains no ambient
`Date.now`, `Math.random`, or `crypto.randomUUID` in deterministic logic.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [SDK & packaging overview](./README.md) · **← Prev:** [package target](./package-target.md) · **Next →:** [provider interface model](./provider-interface-model.md)

<!-- /DOCS-NAV -->
