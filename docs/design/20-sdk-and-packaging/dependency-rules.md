---
title: kit-vnext — dependency rules
status: high-level design
last-reviewed: "2026-06-19"
---

# Dependency rules

These rules are the authoritative allowed/forbidden dependency matrix for the kit-vnext package set.
They derive from the Dependency Rule in
[docs/design/10-architecture/architecture.md](../10-architecture/architecture.md) §2 and are enforced
statically (dependency-cruiser or equivalent). See
[docs/engineering/dependency-rule-enforcement.md](../../engineering/dependency-rule-enforcement.md)
for the tooling detail.

## Allowed

```txt
sdk          → pure runtime libraries only (e.g. zod, small pure utilities)

provider-*   → sdk

cli          → sdk + provider-*
mcp          → sdk + provider-*

testkit      → sdk
tests        → sdk + provider-* + testkit
```

## Forbidden

```txt
sdk          → provider-* (any concrete provider)
sdk          → cli
sdk          → mcp
sdk          → testkit

sdk          → @octokit/*
sdk          → execa
sdk          → native containment helper
sdk          → child_process for runtime execution
sdk          → concrete Codex protocol client
sdk          → MCP server runtime
sdk          → CLI parser

provider-*   → cli
provider-*   → mcp
provider-*   → testkit (in production source)
provider-*   → another provider-* package
```

## Provider-only dependencies

Each provider package may import the dependencies its driver requires, but those dependencies must
not appear in the SDK:

```txt
provider-github   → @octokit/*
provider-local    → execa or native containment helper
provider-codex    → Codex protocol / client integration
provider-markdown → markdown/YAML parser + filesystem mutation utilities
```

## Executable-only dependencies

```txt
cli  → CLI parser + terminal rendering library
mcp  → MCP server / runtime package
```

Both executables also wire concrete storage implementations. A native-backed store (e.g. SQLite)
must live in its own adapter package, not in the SDK. See [sdk-boundary.md](sdk-boundary.md).

## Determinism

Core SDK logic must receive clock, IDs, randomness, storage, and provider behavior as injected
ports. No ambient `Date.now`, `new Date`, `Math.random`, or `crypto.randomUUID` in deterministic
logic. See [sdk-boundary.md](sdk-boundary.md) for the factory shape that enforces this.
