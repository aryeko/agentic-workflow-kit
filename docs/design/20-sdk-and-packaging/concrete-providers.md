---
title: kit-vnext — concrete providers
status: high-level design
last-reviewed: "2026-06-19"
---

# Concrete providers

Concrete providers are driver packages that implement the SDK's provider interfaces and own all
host-specific side effects. Each package imports `sdk` for the interface types and for
`CapabilityAttestation`; it must not import `cli`, `mcp`, `testkit`, or another provider package.

| Package | Implements | Owns |
|---|---|---|
| `provider-codex` | `AgentProvider` | Codex protocol client, approval transport, session linkage |
| `provider-local` | `ExecutionHostProvider` | Local process execution, containment, verification commands |
| `provider-github` | `ForgeProvider` | GitHub push, PR, CI checks, reviews, rulesets, merge via Octokit |
| `provider-markdown` | `WorkSourceProvider` | Markdown tracker parse, claim, release, status writes |

All host/tool-specific risk lives in these packages. The Control plane knows nothing about Codex,
GitHub, local processes, or Markdown files — it depends only on the four interfaces.

## Storage wiring

Concrete providers do not wire storage. Storage ports (`EventLogStorePort`, `ArtifactStorePort`,
`LeaseStorePort`) are injected into the SDK at construction time by the executables (`cli` and `mcp`).
Provider packages emit artifact refs and attestation evidence via the SDK's artifact store, but they
do not own store instantiation. See [sdk-boundary.md](sdk-boundary.md) for details on where concrete
store implementations live.

## Capability attestation

Each provider probes its own capabilities and emits `CapabilityAttestation` events into the run's
event log. The SDK evaluates those attestations; providers do not gate on them directly. The
attestation type and evaluation rules are SDK-owned (see [provider-interface-model.md](provider-interface-model.md)).
Deep attestation contracts per provider are in:

- Agent: [docs/design/30-domain-reference/providers/agent-execution/](../30-domain-reference/providers/agent-execution/README.md)
- Execution Host: [docs/design/30-domain-reference/providers/execution-host/](../30-domain-reference/providers/execution-host/README.md)
- Forge: [docs/design/30-domain-reference/providers/forge-collaboration/](../30-domain-reference/providers/forge-collaboration/README.md)
- Work Source: [docs/design/30-domain-reference/providers/work-source/](../30-domain-reference/providers/work-source/README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [SDK & packaging overview](./README.md) · **← Prev:** [CLI and MCP wrappers](./cli-and-mcp-wrappers.md) · **Next →:** [testkit and conformance](./testkit-and-conformance.md)

<!-- /DOCS-NAV -->
