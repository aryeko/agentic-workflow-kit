# Concrete providers

Concrete providers implement SDK interfaces and own side effects.

| Package | Implements | Owns |
|---|---|---|
| `provider-codex` | `AgentProvider` | Codex protocol, approval transport, session linkage. |
| `provider-local` | `ExecutionHostProvider` | Local process execution, containment, verification commands. |
| `provider-github` | `ForgeProvider` | GitHub push, PR, checks, reviews, rulesets, merge. |
| `provider-markdown` | `WorkSourceProvider` | Markdown tracker parse, claim, release, status writes. |

## Rule

Concrete providers may import the SDK. The SDK must not import concrete providers.
