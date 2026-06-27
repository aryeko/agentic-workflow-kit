---
title: Agent Session Metrics Design
status: high-level design
last-reviewed: "2026-06-27"
---

# Agent Session Metrics Design

This document specifies the shared `agent-session-metrics` skill and its
deterministic local metrics package. The package reports observable execution
metrics for one agent session and, by default, its spawned worker tree.

The package is provider-neutral at its public boundary. Version 1 implements
only the `codex` provider adapter, but the API, CLI, report schema, tests, and
skill language must allow future `claude` and `gemini` adapters without changing
review or retro callers.

The package is a reusable local utility. It is not a code review workflow, a
delivery retro analyzer, or a workflow-kit-specific report generator. Review and
retro workflows consume its JSON output.

## Goals

- Resolve an agent session by session id, explicit record file, or current
  local session.
- Summarize root session metrics and spawned worker/subagent metrics.
- Reconstruct the parent-child session tree from observed provider records.
- Report per-session provider, model, reasoning effort, role, nickname,
  duration, timestamps, and token usage when surfaced.
- Aggregate token usage and duration across the selected session tree.
- Produce stable provider-neutral JSON for tools and readable Markdown for
  humans.
- Keep parsing deterministic, streaming, tested, and independent of LLM
  judgment.
- Keep provider-specific parsing behind adapters; add only the Codex adapter in
  the first implementation.

## Non-Goals

- Do not review code, rank findings, inspect PRs, or classify delivery defects.
- Do not depend on `ccusage`, app-server, OpenTelemetry, analytics APIs, or
  network access at runtime.
- Do not infer missing model, effort, duration, or token counts from defaults.
- Do not mutate provider sessions, repository files, PRs, or skill state.
- Do not parse private chain-of-thought beyond structured metadata and visible
  response/tool records needed for metrics.
- Do not create placeholder Claude or Gemini adapters before their record shapes
  are characterized and tested.

## Installation Target

The skill should live in the shared user skill directory:

```text
/Users/aryekogan/.agents/skills/agent-session-metrics
```

It is shared because local session metrics are not workflow-kit-specific. The
workflow-kit review instructions can reference the skill later, but the skill
must not import repository modules or assume this repository exists.

## Provider Adapter Model

The package core owns the public contract, validation, aggregation, and
rendering. Provider adapters own discovery and parsing for one provider.

Each adapter must implement this conceptual interface:

```js
/**
 * @typedef {Object} ProviderAdapter
 * @property {string} id
 * @property {string[]} supportedRecordKinds
 * @property {(options: ResolveHomeOptions) => Promise<string>} resolveHome
 * @property {(options: ResolveTargetOptions) => Promise<ResolvedTarget>} resolveTarget
 * @property {(options: DiscoverSessionsOptions) => AsyncIterable<SessionRecordRef>} discoverSessions
 * @property {(record: SessionRecordRef) => Promise<SessionSummary>} summarizeSession
 */
```

Adapter rules:

- The core never reads provider-specific directories directly.
- The core never branches on provider record internals outside adapter
  registration.
- Adapters return the same `SessionSummary` shape; unavailable provider fields
  are `null` or `unavailable`.
- Token accounting rules belong to each adapter, but aggregation always sums
  final per-session totals exactly once.
- Adding a provider requires adapter fixtures and tests before exposing it in
  the CLI.

## Version 1 Provider: Codex

The first implementation includes only a `codex` adapter.

Codex adapter responsibilities:

- Resolve Codex home from `--provider-home`, `CODEX_HOME`, then `~/.codex`.
- Resolve Codex session ids and record files from:

  ```text
  <codex-home>/sessions/**/*.jsonl
  <codex-home>/archived_sessions/**/*.jsonl
  ```

- Parse Codex local JSONL records.
- Detect Codex subagent parent-child relationships.
- Select the final cumulative Codex `token_count` snapshot for token totals
  instead of summing all `token_count` events.

The package may expose `--codex-home` as a convenience alias for
`--provider codex --provider-home <path>`, but the library API must use the
provider-neutral `providerHome` field.

## Package Layout

Use a small Node ESM package bundled inside the skill. It must run without
installing third-party dependencies.

```text
agent-session-metrics/
├── SKILL.md
├── package.json
├── agents/
│   └── openai.yaml
├── scripts/
│   └── agent-session-metrics.mjs
├── src/
│   ├── adapter-registry.mjs
│   ├── adapters/
│   │   └── codex/
│   │       ├── codex-home.mjs
│   │       ├── codex-record-parsers.mjs
│   │       ├── codex-session-index.mjs
│   │       └── codex-session-summary.mjs
│   ├── aggregate.mjs
│   ├── cli.mjs
│   ├── contracts.mjs
│   ├── jsonl-reader.mjs
│   ├── render-json.mjs
│   ├── render-markdown.mjs
│   └── session-tree.mjs
├── test/
│   ├── adapter-registry.test.mjs
│   ├── aggregate.test.mjs
│   ├── adapters/
│   │   └── codex/
│   │       ├── codex-record-parsers.test.mjs
│   │       ├── codex-session-index.test.mjs
│   │       └── codex-session-summary.test.mjs
│   ├── fixtures/
│   │   └── codex/
│   │       ├── duplicate-token-count/
│   │       ├── nested-subagents/
│   │       ├── root-only/
│   │       └── unavailable-fields/
│   └── session-tree.test.mjs
└── evals/
    ├── evals.json
    └── trigger_queries.json
```

`scripts/agent-session-metrics.mjs` is only a CLI entrypoint. All behavior must
live under `src/` so package tests can exercise it without shelling out.

## Module Responsibilities

| Module | Responsibility |
|---|---|
| `cli.mjs` | Parse arguments, normalize provider-specific aliases, call the library API, choose renderer, set exit codes. |
| `adapter-registry.mjs` | Register provider adapters, reject unsupported providers, and expose capability metadata. |
| `adapters/codex/codex-home.mjs` | Resolve Codex home for the Codex adapter. |
| `adapters/codex/codex-session-index.mjs` | Locate Codex session files, resolve targets, and scan candidate files for descendants. |
| `jsonl-reader.mjs` | Stream JSONL records with line numbers, invalid-line counts, and bounded error metadata. |
| `adapters/codex/codex-record-parsers.mjs` | Extract typed facts from Codex JSONL records without aggregating. |
| `adapters/codex/codex-session-summary.mjs` | Convert one Codex session file into one provider-neutral `SessionSummary`. |
| `session-tree.mjs` | Build parent-child relationships and ordered traversal results from summaries. |
| `aggregate.mjs` | Compute tree-level totals without changing per-session summaries. |
| `render-json.mjs` | Serialize the provider-neutral report contract. |
| `render-markdown.mjs` | Render a concise human report from the same report object. |
| `contracts.mjs` | Document typedefs and runtime validators for public objects. |

No module should combine target resolution, provider parsing, aggregation, and
rendering.

## CLI Contract

Provider flags:

```text
--provider <name>       Provider adapter to use. Version 1 supports `codex`.
--provider-home <path>  Override the provider's local data home.
--codex-home <path>     Codex-only alias for `--provider codex --provider-home`.
```

Target flags are mutually exclusive:

```text
--session-id <id>       Resolve a provider session/thread id.
--session-file <path>   Analyze one explicit provider record file.
--current               Infer the newest current-looking root session.
```

Scope flags are mutually exclusive:

```text
--tree                  Include descendants recursively. Default.
--main-only             Analyze only the target session.
--children-only         Analyze descendants only.
```

Location flags:

```text
--cwd <path>            Filter `--current` candidates by working directory when the provider supports cwd metadata.
```

Output flags:

```text
--format json|markdown  Default: json.
--pretty                Pretty-print JSON.
--help                  Print usage.
```

Exit codes:

| Code | Meaning |
|---|---|
| `0` | Report produced. |
| `1` | Invalid arguments, unreadable file, malformed target, unsupported provider, or unsupported option. |
| `2` | Target could not be resolved or `--current` was ambiguous. |
| `3` | Internal parser invariant failed. |

## Library API

The package must expose an importable API for tests and future automation:

```js
export async function analyzeAgentSessionMetrics(options)
```

Input shape:

```js
/**
 * @typedef {Object} AnalyzeOptions
 * @property {'codex'} provider
 * @property {{kind: 'session-id', sessionId: string} |
 *   {kind: 'session-file', sessionFile: string} |
 *   {kind: 'current', cwd?: string}} target
 * @property {'tree'|'main-only'|'children-only'} [scope]
 * @property {string} [providerHome]
 */
```

The API returns a `MetricsReport` and never writes files. Future providers extend
the `provider` union only after their adapter and fixtures land.

## Report Contract

JSON output must use this top-level shape:

```json
{
  "status": "ok",
  "provider": "codex",
  "target": {
    "resolution": "session-id",
    "sessionId": "019f...",
    "recordPath": "/Users/me/.codex/sessions/...jsonl",
    "confidence": "exact"
  },
  "scope": "tree",
  "providerHome": "/Users/me/.codex",
  "root": {},
  "sessions": [],
  "tree": {
    "rootSessionId": "019f...",
    "nodes": []
  },
  "aggregate": {},
  "warnings": []
}
```

### Session Summary

Each provider adapter must return this shape:

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
 * @property {Object} counts
 * @property {string[]} warnings
 */
```

`recordPath` is the local provider record path when the adapter reads a file.
Future adapters may set it to `null` only if they read from a non-file source.

`counts` should include observed line, invalid JSON line, turn, message, tool
call, and token-count event counts when available.

### Token Usage

Token usage must distinguish unavailable fields from zero values:

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

For Codex, `source` is `codex_token_count`, `codex_exec_json`, or
`unavailable`. Future adapters must use provider-prefixed source strings such as
`claude_usage_record` or `gemini_usage_record`.

### Tree Node

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

### Aggregate

```js
/**
 * @typedef {Object} AggregateMetrics
 * @property {number} sessionCount
 * @property {number} rootCount
 * @property {number} maxDepth
 * @property {number|null} durationMs
 * @property {TokenUsageBreakdown|null} tokenUsage
 * @property {Object} byProvider
 * @property {Object} byRole
 * @property {Object} byModel
 * @property {Object} byEffort
 */
```

Aggregate token usage is the sum of each included session's final cumulative
total. Do not include a session whose token usage is unavailable.

## Codex Parsing Rules

The Codex adapter should recognize these local JSONL records:

- `session_meta`: session id, cwd, provider, thread source, role, nickname,
  source, CLI version, and git metadata.
- `turn_context`: model, reasoning effort, turn cwd, and runtime settings.
- `event_msg` with `payload.type == "token_count"`: cumulative and last token
  usage.
- `response_item` or equivalent message records: message and tool call counts.
- `payload.source.subagent.thread_spawn`: parent thread id, depth, agent role,
  nickname, and agent path.
- `collab_tool_call` records when present in `codex exec --json` derived
  fixtures: child receiver thread ids.

The Codex parser should be forward-compatible:

- Unknown record types are counted but ignored.
- Missing optional fields become `null`, not inferred values.
- Invalid JSON lines increment `invalidJsonLines` and add a warning; they do not
  abort the run unless every line is invalid.
- Multiple `session_meta` records are allowed. The latest non-empty value wins
  for mutable metadata, while `sessionId` must stay consistent.

## Target Resolution

### `--session-id`

Provider adapters resolve `--session-id` against their own local session store.
For Codex, scan:

```text
<codex-home>/sessions/**/*.jsonl
<codex-home>/archived_sessions/**/*.jsonl
```

Prefer an exact basename suffix match:

```text
rollout-*<session-id>.jsonl
```

If multiple files match the same session id, choose the newest modified file
only when their parsed session ids agree. Otherwise return exit code `2` with an
ambiguity report.

### `--session-file`

Read exactly that file through the selected adapter. The parsed `sessionId`
still comes from provider metadata when available; filename parsing is fallback
only.

### `--current`

Infer the newest local root session by provider adapter, optionally filtered by
`--cwd`. A root session is one with no parsed `parentSessionId`. If multiple
candidate root sessions share the same recency window or the cwd filter is
missing and several active repositories are present, return exit code `2` and
print candidates instead of guessing.

## Descendant Resolution

For `--tree`, build descendants by asking the selected adapter to discover
records whose parsed parent id equals the target session id or any discovered
descendant id.

The scan can be optimized in implementation, but the contract is:

1. Parse target session through the selected provider adapter.
2. Build an index of `sessionId -> parentSessionId` from adapter-discovered
   candidate sessions.
3. Traverse recursively from the target.
4. Summarize only included sessions.

The first Codex implementation may scan all session files line-by-line. If this
is slow, add an optional cache later as a separate feature.

## Markdown Output

Markdown output should be compact and stable:

```markdown
# Agent Session Metrics

Provider: codex
Target: `019f...`
Scope: tree
Sessions: 4
Duration: 1m 12s
Tokens: 166,893 total

| Session | Parent | Provider | Role | Nickname | Model / effort | Duration | Tokens |
|---|---|---|---|---|---|---|---|
| `019f...` | - | codex | root | - | `gpt-5.5` / `high` | 44s | 166,893 |
```

Warnings should be a final section. Do not print raw prompts, responses,
secrets, or long transcript excerpts.

## Skill Contract

`SKILL.md` should stay thin. It should instruct the agent to run the package
script, not to manually inspect provider records unless debugging the script.

Skill trigger description should cover:

- "calculate agent session metrics",
- "calculate Codex session metrics",
- "token usage for current agent session",
- "token usage for current Codex session",
- "subagent metrics",
- "session tree",
- "review execution token breakdown",
- "local Codex JSONL metrics".

Skill body should include:

1. Choose provider: default to `codex` for version 1 unless the user explicitly
   asks for an unsupported provider.
2. Choose target: `--session-id`, `--session-file`, or `--current`.
3. Choose scope: default `--tree`, or `--main-only` if explicitly requested.
4. Run `node scripts/agent-session-metrics.mjs --provider codex ...`.
5. Return the JSON or Markdown result without rewriting the numbers.
6. If the script reports ambiguity, ask for the session id or cwd; do not guess.
7. If the user asks for Claude or Gemini metrics before those adapters exist,
   state that the provider adapter is not implemented rather than attempting
   manual parsing.

The skill should not include Codex review instructions, PR review policy, or
delivery retro guidance.

## Independent Implementation Tasks

This design supports two independent implementation tasks.

### Task A: Metrics Package

Owner: package implementation agent.

Scope:

- Create `package.json`, `scripts/`, `src/`, and `test/`.
- Implement the provider-neutral library API and CLI contract.
- Implement only the Codex provider adapter.
- Add Codex fixtures covering root-only, duplicate token counts, nested
  subagents, missing token counts, malformed lines, and ambiguous
  current-session resolution.
- Add adapter-registry tests proving unsupported providers fail cleanly.
- Use TDD: write failing tests for parser contracts before implementing each
  module.
- Use Node built-in `node:test` and `assert/strict`; no third-party
  dependencies.

Acceptance:

- `npm test` passes inside the skill package.
- `node scripts/agent-session-metrics.mjs --help` prints usage.
- `--provider codex --session-file <fixture>` returns the expected JSON.
- Unsupported providers such as `claude` and `gemini` fail with a clear
  "provider adapter not implemented" error.
- Duplicate cumulative Codex `token_count` events are not summed.
- Nested Codex child sessions are included when `--tree` is used.
- `--main-only` excludes descendants.

### Task B: Skill and Evals

Owner: skill implementation agent.

Scope:

- Create `SKILL.md`, `agents/openai.yaml`, and `evals/`.
- Reference the package CLI contract without duplicating parser internals.
- Add trigger queries for current-session metrics, explicit session id metrics,
  subagent token breakdown, review execution token breakdown, and near-miss
  requests that belong to `delivery-retro` or `deep-code-review`.
- Add unsupported-provider evals for Claude and Gemini requests.
- Add output evals that assert the agent runs the script, preserves script
  numbers, handles ambiguity by asking for a target, and does not manually invent
  metrics.

Acceptance:

- Open Agent Skills validator passes.
- Trigger evals distinguish metrics extraction from review/retro analysis.
- Unsupported-provider evals report that the adapter is not implemented.
- Output evals require script execution and prohibit inferred token/model/effort
  values.

### Integration After Both Tasks

After the package and skill are implemented:

- Update `deep-code-review` to call `agent-session-metrics` for local execution
  summaries.
- Keep Codex GitHub automatic review independent; cloud reviews may not have
  local session records.
- Add a short pointer from
  [codex-review-execution-summary.md](codex-review-execution-summary.md) to the
  new skill as the local metrics source.

## Test Strategy

Package tests are the authority for parser behavior.

Minimum tests:

- `adapter-registry`: returns the Codex adapter and rejects unsupported
  providers.
- `codex-home`: respects `--provider-home`, `CODEX_HOME`, and fallback.
- `jsonl-reader`: streams records, counts invalid JSON, preserves line numbers.
- `codex-record-parsers`: extracts session id, parent id, depth, model, effort,
  provider, role, nickname, and token usage from known Codex record shapes.
- `codex-session-summary`: selects the final token snapshot, computes duration,
  and emits warnings for unavailable fields.
- `session-tree`: builds nested tree and detects orphan children.
- `aggregate`: sums included sessions exactly once.
- `cli`: rejects ambiguous target flags, unknown options, and unsupported
  providers.

Fixture tests should include real redacted Codex JSONL fragments from the probes
recorded in [codex-review-execution-summary.md](codex-review-execution-summary.md).
Fixtures must not include private prompts beyond the minimum fields needed for
metrics extraction.

## Future Provider Adapter Requirements

Before adding a non-Codex provider:

1. Capture representative redacted local records for root sessions, child worker
   sessions, token usage, missing usage, and malformed or partial records.
2. Document the provider's home discovery and target resolution rules.
3. Add adapter fixtures and parser tests before enabling the provider in the
   CLI.
4. Map provider-specific usage fields into the shared `TokenUsageSnapshot`
   shape without inventing unavailable fields.
5. Prove parent-child reconstruction with tests, or mark tree support
   unavailable and return a clear warning.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Provider record shapes change. | Keep adapters small, tolerate unknown records, and fixture known shapes per provider. |
| Generic API hides provider-specific limitations. | Report adapter capabilities and warnings in every report. |
| Duplicate cumulative token snapshots overcount. | Use final per-session cumulative snapshot, never sum snapshots within one session. |
| `--current` guesses wrong session. | Return ambiguity with candidates unless cwd and recency make the target clear. |
| Subagent tree scan is slow. | Start with streaming scan; add cache only if measured slow. |
| Skill invents missing values. | Script reports `null` or `unavailable`; evals require preserving those values. |
| Sensitive transcript leakage. | Render only metadata and counts; never print prompts or full responses. |

## Open Questions

- Should the first Codex adapter include `archived_sessions/` by default, or only
  when `--include-archived` is passed?
- Should Markdown output include per-depth grouping, or only a flat table with
  parent ids?
- Should the Codex adapter support `codex exec --json` event files as a future
  input mode, separate from local session JSONL?
- What should the provider ids be for future Claude and Gemini adapters after
  their local record formats are characterized?

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Engineering Policy Index](./README.md) · **← Prev:** [Codex Review Execution Summary](./codex-review-execution-summary.md) · **Next →:** [Dependency Policy](./dependency-policy.md)

<!-- /DOCS-NAV -->
