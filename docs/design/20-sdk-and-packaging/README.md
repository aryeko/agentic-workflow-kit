---
title: kit-vnext — SDK & packaging overview
status: high-level design
last-reviewed: "2026-06-19"
---

# SDK & packaging

This section documents the packaging model and the internal structure of kit-vnext. It is the
authoritative reader entry point for understanding how design domains map to npm packages, where each
concern lives, and which dependencies are permitted.

## Package tree

```txt
packages/
  sdk/
  cli/
  mcp/
  provider-codex/
  provider-local/
  provider-github/
  provider-markdown/
  testkit/
```

Design domains are **not** one-to-one with packages. The domains in `docs/design/` organize
thinking and ownership; packages represent runtime and dependency boundaries. The SDK uses internal
folders for domain separation without forcing separate publish artifacts for each.

## Read in order

1. [Package target](package-target.md) — what each package is and why the set is sized this way
2. [SDK boundary](sdk-boundary.md) — what the SDK owns and must never own, including storage ports
3. [Provider interface model](provider-interface-model.md) — the four SDK-owned seam contracts
4. [Provider ports](provider-ports.md) — canonical provider interfaces and shared attestation payload
5. [Storage port types](storage-port-types.md) — canonical fnd-02 storage port contracts
6. [CLI and MCP wrappers](cli-and-mcp-wrappers.md) — executable adapters and shared wiring
7. [Concrete providers](concrete-providers.md) — driver packages that implement the seam contracts
8. [Testkit and conformance](testkit-and-conformance.md) — test-only package and conformance fixtures
9. [Dependency rules](dependency-rules.md) — the complete allowed/forbidden dependency matrix

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [design corpus overview](../README.md) · **← Prev:** [high-level architecture](../10-architecture/architecture.md) · **Next →:** [package target](./package-target.md)

**Children:** [package target](./package-target.md) · [SDK boundary](./sdk-boundary.md) · [provider interface model](./provider-interface-model.md) · [SDK provider ports and capability attestation](./provider-ports.md) · [Storage port types](./storage-port-types.md) · [CLI and MCP wrappers](./cli-and-mcp-wrappers.md) · [concrete providers](./concrete-providers.md) · [testkit and conformance](./testkit-and-conformance.md) · [dependency rules](./dependency-rules.md)

<!-- /DOCS-NAV -->
