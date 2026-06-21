---
title: kit-vnext — reading guide
status: high-level design
last-reviewed: "2026-06-19"
---

# Reading guide

Use the smallest reading path that answers your question. The orientation set is always the starting
point; after that, read only the layer(s) your task touches, plus the specific domain spec(s) within
that layer.

## Orientation set (always read first)

Every session in this design corpus starts with:

1. [Mission and scope](mission-and-scope.md)
2. [Requirements](requirements.md)
3. [Glossary](glossary.md)
4. [Design conventions](conventions.md)

Then apply the task-specific path below.

## If you are new to the project

After the orientation set, continue with:

1. [Component model](../10-architecture/component-model.md) — the runtime shape and the four seams.
2. [Package target](../20-sdk-and-packaging/package-target.md) — how the design maps to packages.
3. [Domain catalog](../30-domain-reference/domain-catalog.md) — the full list of domains, by layer.

## If you are implementing SDK/core

After the orientation set:

1. [SDK boundary](../20-sdk-and-packaging/sdk-boundary.md) — what the SDK owns and must never own.
2. [Event log and state](../10-architecture/event-log-and-state.md) — append-only log, projections,
   writer model.
3. [Capability attestation](../10-architecture/capability-attestation.md) — how capability gates
   work.
4. The relevant domain spec under [core](../30-domain-reference/core/README.md) — run lifecycle,
   completion, supervision, recovery, approvals, capability/safety, or observability.

## If you are implementing a provider driver

After the orientation set:

1. [Provider seams](../10-architecture/provider-seams.md) — the four abstract seam contracts.
2. [Provider interface model](../20-sdk-and-packaging/provider-interface-model.md) — the
   SDK-owned interfaces and CapabilityAttestation.
3. [Concrete providers](../20-sdk-and-packaging/concrete-providers.md) — what each driver package
   must implement.
4. The relevant domain spec under [providers](../30-domain-reference/providers/README.md) — agent
   execution, execution host, forge collaboration, or work source.

## If you are changing packaging or dependency rules

After the orientation set:

1. [Package target](../20-sdk-and-packaging/package-target.md)
2. [SDK boundary](../20-sdk-and-packaging/sdk-boundary.md)
3. [Dependency rules](../20-sdk-and-packaging/dependency-rules.md)

## If you are reviewing safety or capability gating

After the orientation set:

1. [Capability attestation](../10-architecture/capability-attestation.md)
2. [Evidence gates and merge](../10-architecture/evidence-gates-and-merge.md)
3. [Human control and approvals](../10-architecture/human-control-and-approvals.md)
4. [Recovery and reconciliation](../10-architecture/recovery-and-reconciliation.md)
5. [Protected policy gate](../10-architecture/protected-policy-gate.md)
6. The [capability-and-safety domain](../30-domain-reference/core/capability-and-safety/README.md)

## If you are working on operator or entry surface

After the orientation set:

1. [Human control and approvals](../10-architecture/human-control-and-approvals.md)
2. [CLI and MCP wrappers](../20-sdk-and-packaging/cli-and-mcp-wrappers.md)
3. The [operator surface domain](../30-domain-reference/edge/operator-surface/README.md)

## If you are working on foundation (config, storage, workspace, credentials)

After the orientation set:

1. [SDK boundary](../20-sdk-and-packaging/sdk-boundary.md) — storage ports and what the SDK
   must not own.
2. The relevant domain spec under
   [foundation](../30-domain-reference/foundation/README.md) — configuration/policy,
   credentials/secrets, storage/artifacts, or workspace/repository.

## Domain reference index

The full domain specs are organized under
[`30-domain-reference/`](../30-domain-reference/README.md) by layer:

| Layer | Read when |
|---|---|
| [Core](../30-domain-reference/core/README.md) | Changing run state, gates, approvals, supervision, completion, recovery, or analysis |
| [Foundation](../30-domain-reference/foundation/README.md) | Changing config, storage, workspace, or credentials |
| [Providers](../30-domain-reference/providers/README.md) | Changing provider interfaces or concrete provider behavior |
| [Edge](../30-domain-reference/edge/README.md) | Changing operator-facing command or attention surfaces |

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [orientation](./README.md) · **← Prev:** [glossary](./glossary.md) · **Next →:** [design conventions](./conventions.md)

<!-- /DOCS-NAV -->
