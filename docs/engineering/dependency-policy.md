---
title: kit-vnext — Dependency Policy
status: high-level design
last-reviewed: "2026-06-19"
---

# Dependency Policy

This policy turns the architecture dependency rule into implementation rules for package
dependencies, third-party libraries, dependency injection, determinism, and SDK
placement. It applies to the SDK-centered package target defined in
[docs/design/20-sdk-and-packaging/dependency-rules.md](../design/20-sdk-and-packaging/dependency-rules.md),
which is the ground truth for package names and enforced edges.

This document must not be looser than the design specification. When the two conflict,
the design specification wins.

## Package Names

The canonical packages (unscoped, v1) are:

```
sdk
cli
mcp
provider-codex
provider-local
provider-github
provider-markdown
testkit
```

## Dependency Rule

All package dependencies must follow:

| Package | May import | Must not import |
|---|---|---|
| `sdk` | Pure runtime libraries only (zod + small pure utilities) | `provider-*`, `cli`, `mcp`, `testkit`, octokit, execa, native containment helper, child_process, concrete Codex client, MCP server runtime, CLI parser |
| `provider-*` | `sdk` | `cli`, `mcp`, `testkit` (in production source), peer providers |
| `cli` | `sdk`, `provider-*` | — |
| `mcp` | `sdk`, `provider-*` | — |
| `testkit` | `sdk` (test-only) | `provider-*`, `cli`, `mcp` |

A complete view of allowed and forbidden edges is in
[dependency-rules.md](../design/20-sdk-and-packaging/dependency-rules.md).

## SDK External Dependency Bans

The `sdk` package must not import:

- `octokit` / `@octokit/*`
- `execa`
- The native containment helper
- `node:child_process` / `child_process`
- Any concrete Codex protocol client
- The MCP server runtime
- Any CLI parser
- Any provider package (`provider-codex`, `provider-local`, `provider-github`, `provider-markdown`)
- `testkit`

These are hard bans enforced by dependency-cruiser. See
[dependency-rule-enforcement.md](dependency-rule-enforcement.md) for the enforcement
mechanism.

## Provider Dependency Placement

Each external SDK or process dependency belongs to exactly one package:

| Dependency family | Owning package |
|---|---|
| `octokit` / `@octokit/*` | `provider-github` |
| `execa` or native containment helper | `provider-local` |
| Codex protocol / client integration | `provider-codex` |
| Markdown/YAML parser and filesystem mutation utilities | `provider-markdown` |
| MCP server runtime | `mcp` |
| CLI parser and terminal rendering | `cli` |

No other package may import these libraries. Absence from the table is not permission
to add the library anywhere — it still requires the acceptance checklist below.

## Injection Policy

Use explicit constructor or factory injection for all dependencies. A module receives
the ports, collaborators, and configuration it needs as typed arguments. This keeps the
control plane replayable, testable, and free of hidden ambient state.

No dependency injection container is allowed in `sdk`, `provider-*`, `cli`, `mcp`, or
`testkit`. Runtime wiring happens explicitly through factories and executable startup
code; a container must not leak into business logic, contract types, or package
internals.

## Determinism

Core `sdk` decision logic must receive clock, ID, randomness, storage, and providers as
injected ports. Do not call `Date.now`, `new Date()`, `crypto.randomUUID`,
`Math.random`, or equivalent ambient sources from deterministic logic. Pass a clock, id
factory, or randomness source through the relevant constructor or factory.

This is a determinism requirement, not a style preference. Replay, projection,
capability gating, and recovery logic must be pure over recorded inputs and injected
deterministic services.

## Result Discipline

Core decision functions must return typed outcomes rather than silently throwing or
collapsing failures into prose. Use a local discriminated union:

```ts
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };
```

Do not add a Result library by default. Throwing is reserved for programmer errors,
impossible states after exhaustive checks, or boundary failures that are immediately
caught and converted to a typed error at the system boundary.

## Per-Library Acceptance Checklist

Before adding any library, document the decision in the owning work item or design
artifact, covering:

- **Placement:** the package that will own the import and the layer rule that allows it.
- **Value:** why the library reduces code, risk, or operational complexity.
- **Boundary:** the seam, adapter, or package boundary that contains it.
- **Types:** whether external types cross package boundaries (default: no for SDKs and provider clients).
- **Tests:** the unit, integration, conformance, or smoke strategy that proves correct behavior.
- **Depcruise guard:** whether an existing rule enforces the placement or a new rule is needed.
- **Security:** credential handling, redaction, supply-chain, and input validation implications.
- **Observability:** logs, telemetry, error shape, and failure-mode impact.

If the checklist cannot be completed, do not add the dependency.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Engineering Policy Index](./README.md) · **← Prev:** [Check Gate](./check-gate.md) · **Next →:** [Dependency Rule Enforcement](./dependency-rule-enforcement.md)

<!-- /DOCS-NAV -->
