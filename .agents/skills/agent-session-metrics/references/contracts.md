# Agent Session Metrics Contracts

This file defines the durable package surface. Keep it aligned with
`src/contracts.mjs`, `src/index.mjs`, CLI behavior, and tests.

## Provider Support

Version 1 supports one provider:

```text
codex
```

Unsupported providers such as `claude` and `gemini` must fail clearly with:

```text
provider adapter not implemented: <provider>
```

Do not add a provider to the accepted set until its adapter, fixtures, parser
tests, CLI tests, and contract notes exist.

## CLI Contract

```text
scripts/agent-session-metrics.mjs \
  --provider <name> \
  (--session-id <id> | --session-file <path>) \
  --scope tree|main|children \
  --provider-home <path> \
  --format json|markdown \
  --pretty
```

Defaults:

| Option | Default |
|---|---|
| `--provider` | `codex` |
| `--scope` | `tree` |
| `--format` | `json` |

Target flags:

| Flag | Meaning |
|---|---|
| `--session-id <id>` | Resolve a provider session/thread id through the selected adapter. |
| `--session-file <path>` | Analyze exactly one provider record file. |

Target flags are mutually exclusive. One target is required unless `--help` is
used.

Output flags:

| Flag | Meaning |
|---|---|
| `--format json` | Emit compact JSON unless `--pretty` is present. |
| `--format markdown` | Emit a compact human report. |
| `--pretty` | Pretty-print JSON only. Ignored for Markdown. |

Unsupported flags:

```text
--current
--cwd
--codex-home
```

Runtime wrappers that know the current session id pass it explicitly as
`--session-id`.

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Report produced or help printed. |
| `1` | Invalid arguments, unreadable file, malformed target, unsupported provider, or unsupported option. |
| `2` | Target could not be resolved or session-id resolution was ambiguous. |
| `3` | Internal parser invariant failed. |

## Library API

```js
export async function analyzeAgentSessionMetrics(options)
```

Input:

```js
/**
 * @typedef {Object} AnalyzeOptions
 * @property {string} [provider='codex']
 * @property {{kind: 'session-id', sessionId: string} |
 *   {kind: 'session-file', sessionFile: string}} target
 * @property {'tree'|'main'|'children'} [scope='tree']
 * @property {string} [providerHome]
 */
```

Behavior:

- Returns a `MetricsReport`.
- Never writes files.
- Never mutates provider records.
- Never infers missing model, effort, duration, or token values from defaults.
- Throws `MetricsError` for user-facing failures with a stable numeric `code`.

## Metrics Report

JSON output and the library API use this top-level shape:

```js
/**
 * @typedef {Object} MetricsReport
 * @property {'ok'} status
 * @property {string} provider
 * @property {ResolvedTarget} target
 * @property {'tree'|'main'|'children'} scope
 * @property {string} providerHome
 * @property {SessionSummary} root
 * @property {SessionSummary[]} sessions
 * @property {{rootSessionId: string, nodes: SessionTreeNode[]}} tree
 * @property {AggregateMetrics} aggregate
 * @property {string[]} warnings
 */
```

`sessions` contains only sessions included by `scope`. `root` always describes
the resolved target session, even when `scope` is `children`.

## Resolved Target

```js
/**
 * @typedef {Object} ResolvedTarget
 * @property {'session-id'|'session-file'} resolution
 * @property {string} sessionId
 * @property {string|null} recordPath
 * @property {'exact'} confidence
 */
```

`recordPath` is the provider record file read by the adapter. Future adapters
may use `null` only when their source is not file-backed.

## Session Summary

```js
/**
 * @typedef {Object} SessionSummary
 * @property {string} provider
 * @property {string} sessionId
 * @property {string|null} recordPath
 * @property {string|null} parentSessionId
 * @property {number|null} depth
 * @property {string|null} cwd
 * @property {string|null} threadSource
 * @property {string|null} agentRole
 * @property {string|null} agentNickname
 * @property {string|null} modelProvider
 * @property {string|null} model
 * @property {string|null} effort
 * @property {string|null} startedAt
 * @property {string|null} completedAt
 * @property {number|null} durationMs
 * @property {TokenUsageSnapshot} tokenUsage
 * @property {SessionCounts} counts
 * @property {string[]} warnings
 */
```

Missing optional fields are `null`. Do not replace unavailable values with
process defaults.

## Session Counts

```js
/**
 * @typedef {Object} SessionCounts
 * @property {number} lines
 * @property {number} invalidJsonLines
 * @property {number} turns
 * @property {number} messages
 * @property {number} toolCalls
 * @property {number} tokenCountEvents
 * @property {number} unknownRecords
 */
```

Counts are observations from parsed provider records, not inferred totals.

## Token Usage

```js
/**
 * @typedef {Object} TokenUsageBreakdown
 * @property {number} inputTokens
 * @property {number} cachedInputTokens
 * @property {number} outputTokens
 * @property {number} reasoningOutputTokens
 * @property {number} totalTokens
 */

/**
 * @typedef {Object} TokenUsageSnapshot
 * @property {'observed'|'unavailable'} status
 * @property {string} source
 * @property {TokenUsageBreakdown|null} total
 * @property {TokenUsageBreakdown|null} last
 * @property {number|null} modelContextWindow
 */
```

Rules:

- `status: 'unavailable'` means the provider record did not surface token data.
- Zero is a real observed number and must not be treated as unavailable.
- For Codex JSONL, the adapter uses the final cumulative `token_count` snapshot.
- Aggregation sums each included session's final `tokenUsage.total` exactly once.
- Sessions with unavailable token usage are skipped in aggregate token sums.

Codex token source values:

```text
codex_token_count
unavailable
```

## Session Tree Node

```js
/**
 * @typedef {Object} SessionTreeNode
 * @property {string} provider
 * @property {string} sessionId
 * @property {string|null} parentSessionId
 * @property {number|null} depth
 * @property {string[]} children
 */
```

Tree traversal is rooted at the resolved target session.

## Aggregate Metrics

```js
/**
 * @typedef {Object} AggregateMetrics
 * @property {number} sessionCount
 * @property {number} rootCount
 * @property {number} maxDepth
 * @property {number|null} durationMs
 * @property {TokenUsageBreakdown|null} tokenUsage
 * @property {Record<string, number>} byProvider
 * @property {Record<string, number>} byRole
 * @property {Record<string, number>} byModel
 * @property {Record<string, number>} byEffort
 */
```

`durationMs` is the sum of observed included-session durations. It is `null`
when no included session has an observed duration.

Unavailable grouping values use the key `unavailable`.

## Warning Contract

Warnings are plain strings intended for review by a caller or human. They must
not include raw prompts, responses, secrets, credentials, tokens, or long
transcript excerpts.

Session-level warnings stay on `SessionSummary.warnings`. The top-level
`warnings` array prefixes session warnings with the session id and includes tree
warnings.

## Codex Adapter Contract

Home resolution order:

1. `--provider-home`
2. `CODEX_HOME`
3. `~/.codex`

Session id resolution scans:

```text
<codex-home>/sessions/**/*.jsonl
<codex-home>/archived_sessions/**/*.jsonl
```

Parsing rules:

- Unknown record types are counted and ignored.
- Invalid JSON lines increment `invalidJsonLines` and add warnings.
- If every non-empty line is invalid JSON, the run still returns a summary with
  warnings and filename-fallback session id.
- Multiple token snapshots are allowed; the latest observed snapshot wins.
- Multiple metadata records are allowed; latest non-empty mutable metadata wins.
- Conflicting session ids add a warning and keep the first observed id.

Descendant resolution for `--scope tree` and `--scope children` scans candidate
Codex session files and follows parsed `parentSessionId` links recursively.
