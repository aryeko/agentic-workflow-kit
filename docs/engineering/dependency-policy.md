# Dependency policy

This policy applies to the SDK-centered package target.

## Package rules

```txt
sdk must not import concrete provider packages, CLI, MCP, or testkit.
provider-* packages may import sdk.
cli and mcp may import sdk and provider-* packages for wiring.
testkit may import sdk and is test-only.
```

## SDK bans

The SDK must not import:

```txt
octokit / @octokit/*
execa
native containment helper
concrete Codex protocol clients
MCP server runtime
CLI parser
provider packages
testkit
```

## Provider dependency placement

| Dependency family | Allowed package |
|---|---|
| GitHub / Octokit | `provider-github` |
| process execution / containment helpers | `provider-local` |
| Codex protocol integration | `provider-codex` |
| markdown/YAML mutation utilities | `provider-markdown` |
| MCP runtime | `mcp` |
| CLI parser | `cli` |

## Determinism

SDK decision logic must receive clock, ID, randomness, storage, and providers as injected ports.
