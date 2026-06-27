# Agent Session Metrics Package

Deterministic local metrics utility for agent sessions. The package is bundled
inside the repo-local `agent-session-metrics` skill and exposes both a CLI and a
small importable API.

Version 1 supports the `codex` provider adapter only. The public surface is
provider-neutral so future Claude or Gemini adapters can be added without
changing callers.

## What It Does

- Resolves a session by provider session id or explicit session file.
- Reconstructs the root session and spawned worker/subagent tree.
- Reports per-session metadata, duration, token usage, counts, and warnings.
- Aggregates metrics for the selected scope.
- Emits stable JSON for automation or compact Markdown for humans.

The package never mutates provider session files, repository files, PRs, skills,
or branches.

## Quick Start

Run from this directory:

```bash
scripts/agent-session-metrics.mjs \
  --provider codex \
  --session-id "$CODEX_THREAD_ID" \
  --scope tree \
  --format json \
  --pretty
```

Analyze an explicit Codex JSONL file:

```bash
scripts/agent-session-metrics.mjs \
  --session-file /path/to/rollout-session.jsonl \
  --format markdown
```

Use fixture data for a local smoke test:

```bash
scripts/agent-session-metrics.mjs \
  --provider codex \
  --provider-home test/fixtures/codex/nested-subagents \
  --session-id root-tree \
  --scope tree \
  --format json \
  --pretty
```

## CLI

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

- `--provider codex`
- `--scope tree`
- `--format json`

Target flags are mutually exclusive. Use `--session-id` when the provider
should resolve the local record file, and `--session-file` when the exact record
file is already known.

`--provider-home` overrides the provider's local data home. For Codex, the
adapter otherwise uses `CODEX_HOME`, then `~/.codex`.

`--pretty` affects JSON only. Markdown output ignores it.

Unsupported options intentionally fail: `--current`, `--cwd`, and
`--codex-home`. A caller that knows the current session passes that value as
`--session-id`.

## Scopes

| Scope | Included sessions |
|---|---|
| `tree` | Target session plus recursive descendants. |
| `main` | Target session only. |
| `children` | Recursive descendants, excluding the target session. |

## Library API

Import the API entrypoint:

```js
import { analyzeAgentSessionMetrics } from './src/index.mjs';

const report = await analyzeAgentSessionMetrics({
  provider: 'codex',
  target: { kind: 'session-id', sessionId: 'root-tree' },
  providerHome: 'test/fixtures/codex/nested-subagents',
  scope: 'tree',
});
```

The API returns the same provider-neutral report emitted by JSON output and
never writes files.

## Contracts

The stable CLI, API, report, session, token, tree, aggregate, and warning
contracts are documented in [references/contracts.md](references/contracts.md).
Treat that file as the package contract for callers and tests.

## Package Layout

```text
scripts/agent-session-metrics.mjs  CLI entrypoint only
src/index.mjs                     Public API orchestration
src/adapter-registry.mjs          Provider registration and errors
src/adapters/codex/               Codex home, index, parser, summary adapter
src/contracts.mjs                 Runtime validators and shared helpers
src/jsonl-reader.mjs              JSONL reader with line-level warnings
src/session-tree.mjs              Tree construction and scope selection
src/aggregate.mjs                 Aggregate metrics
src/render-json.mjs               JSON renderer
src/render-markdown.mjs           Markdown renderer
test/                             Node test suite and Codex fixtures
```

Provider parsing belongs only under `src/adapters/<provider>/`. Core modules
must stay provider-neutral.

## Validation

```bash
npm test
scripts/agent-session-metrics.mjs --help
scripts/agent-session-metrics.mjs \
  --provider codex \
  --provider-home test/fixtures/codex/nested-subagents \
  --session-id root-tree \
  --format markdown
```

Validate the skill from the repo root:

```bash
python3 /Users/aryekogan/.agents/skills/open-skill-creator/scripts/validate_skill.py \
  .agents/skills/agent-session-metrics
```
