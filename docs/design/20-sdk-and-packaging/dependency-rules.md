# Dependency rules

## Allowed

```txt
sdk -> pure runtime libraries only

provider-* -> sdk

cli -> sdk + provider-*
mcp -> sdk + provider-*

testkit -> sdk
tests -> sdk + provider-* + testkit
```

## Forbidden

```txt
sdk -> provider-*
sdk -> cli
sdk -> mcp
sdk -> testkit
sdk -> octokit / @octokit/*
sdk -> execa
sdk -> native containment helper
sdk -> child_process for runtime execution
sdk -> concrete Codex client
sdk -> MCP server runtime
sdk -> CLI parser

provider-* -> cli
provider-* -> mcp
provider-* -> testkit in production source
```

## Provider-only dependencies

```txt
provider-github -> octokit / @octokit/*
provider-local -> execa or native containment helper
provider-codex -> Codex protocol/client integration
provider-markdown -> markdown/YAML parser and filesystem mutation utilities
```

## Executable-only dependencies

```txt
cli -> CLI parser and terminal rendering
mcp -> MCP server/runtime package
```

## Determinism

Core SDK logic must use injected clocks, IDs, randomness, storage, and provider ports. No ambient `Date.now`, `new Date`, `Math.random`, or `crypto.randomUUID` in deterministic logic.
