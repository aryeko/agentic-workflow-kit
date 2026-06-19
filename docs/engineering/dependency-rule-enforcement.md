# Dependency rule enforcement

The package model should be enforced by dependency-cruiser or equivalent static checks.

## Required rules

```txt
sdk -> forbidden: provider-*, cli, mcp, testkit
provider-* -> allowed: sdk
cli -> allowed: sdk, provider-*
mcp -> allowed: sdk, provider-*
testkit -> allowed: sdk
```

## SDK external dependency bans

```txt
sdk cannot import octokit, execa, native helper, MCP runtime, CLI parser, or concrete Codex client.
```

## Why

The SDK is the deterministic control plane and provider-interface owner. Concrete integrations must not leak into it.
