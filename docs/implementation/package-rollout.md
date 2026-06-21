---
title: kit-vnext - package rollout
status: draft
last-reviewed: "2026-06-20"
---

# Package rollout

The package target is owned by
[`docs/design/20-sdk-and-packaging/package-target.md`](../design/20-sdk-and-packaging/package-target.md).
This file tracks when implementation frontiers first create or materially fill those packages.

Design domains are not package boundaries. Most foundation and core domains land inside `packages/sdk`
as internal modules. Provider domains split between SDK-owned provider interfaces, provider packages,
and testkit conformance assets.

## Target packages

| Package | Role |
|---|---|
| `packages/sdk` | Core runtime library, provider interfaces, storage ports, in-memory defaults. |
| `packages/cli` | Terminal executable, provider wiring, filesystem store wiring. |
| `packages/mcp` | MCP server executable, provider wiring, filesystem store wiring. |
| `packages/provider-codex` | Codex Agent provider driver. |
| `packages/provider-local` | Local Execution Host provider driver. |
| `packages/provider-github` | GitHub Forge provider driver. |
| `packages/provider-markdown` | Markdown Work Source provider driver. |
| `packages/testkit` | Test-only mocks, conformance helpers, and incident fixtures. |

## Rollout by frontier

| Frontier | Package effect |
|---|---|
| Frontier 0 | Establishes the first `sdk` internal modules for config/policy and storage ports/defaults. |
| Frontier 1 | Extends `sdk` with workspace, credential, event-log, writer, projection, and artifact contracts. |
| Frontier 2 | Adds SDK provider interfaces for Work Source, Forge, and Execution Host; adds `testkit` mock/conformance surfaces; starts provider package skeletons only when a real driver story is ready. |
| Frontier 3 | Adds Agent provider interface and Codex provider skeleton as needed; fills SDK capability gates and analysis modules. |
| Frontier 4 | Extends SDK run-control modules for approval and liveness. |
| Frontier 5 | Extends SDK completion, merge-readiness, recovery, and reconciliation modules. |
| Frontier 6 | Adds `cli` and `mcp` entry surfaces only after the core control plane has complete SDK contracts to call. |

## Migration tracking

Existing repo packages and historical implementation work are not automatically considered ready under
this plan. Migration is a separate evidence question:

| Current artifact | Target treatment |
|---|---|
| Existing foundation-style packages | Evaluate for reuse against the new `sdk` internal module contracts. |
| Existing contract/provider packages | Evaluate for reuse against SDK provider interfaces and `testkit` conformance. |
| Existing conformance kit work | Reassess against the new Frontier 2 story contracts before claiming readiness. |
| Existing drivers or mocks | Migrate only with current executable evidence and capability/readiness rows. |

No current package is marked implementation-ready until the corresponding story contract has evidence
that satisfies [`readiness-matrix.md`](readiness-matrix.md).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](./README.md) · **← Prev:** [Agent provider functional requirements](./agent-provider-requirements.md) · **Next →:** [work item authoring guide](./work-item-authoring-guide.md)

<!-- /DOCS-NAV -->
