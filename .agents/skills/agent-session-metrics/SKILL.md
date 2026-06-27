---
name: agent-session-metrics
description: Calculate local agent and Codex session metrics by running the deterministic metrics script. Use for agent or Codex session token usage, current session metrics, explicit session ids or files, subagent session trees, subagent token breakdowns, review execution token breakdowns, and local Codex JSONL metrics. Do not use for code review, delivery retro analysis, or PR review policy.
compatibility: "Requires the bundled Node.js metrics package script; v1 supports the codex provider adapter."
metadata:
  version: "0.1.0"
---

# Agent Session Metrics

Use this skill to report observable metrics for an agent session and, by default,
its spawned worker tree. Run the package script and preserve its output values
exactly.

## Workflow

1. Choose the provider.
   - Default to `codex`.
   - If the user asks for `claude` or `gemini`, report that the provider adapter
     is not implemented. Do not manually parse those provider records.
2. Choose the target.
   - For an explicit session id, use `--session-id <id>`.
   - For an explicit session file, use `--session-file <path>`.
   - For the current Codex session, read `CODEX_THREAD_ID` and pass
     `--session-id "$CODEX_THREAD_ID"`.
   - If `CODEX_THREAD_ID` is missing for a current-session request, ask the user
     for `--session-id` or `--session-file`. Do not guess.
3. Choose the scope.
   - Default to `--scope tree`.
   - Use `--scope main` only when the user asks for the root session alone.
   - Use `--scope children` only when the user asks for descendants without the
     root session.
4. Choose output.
   - Default to `--format json`.
   - Use `--format markdown` when the user wants a human-readable report.
   - Use `--pretty` only for indented JSON; it is ignored for Markdown.
5. Run the script from the skill directory:

```bash
node scripts/agent-session-metrics.mjs --provider codex --session-id "$CODEX_THREAD_ID" --scope tree --format json --pretty
```

## CLI Contract

Use this shape:

```bash
node scripts/agent-session-metrics.mjs \
  --provider codex \
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

Do not use `--current`, `--cwd`, or `--codex-home`.

## Output Rules

- Return or summarize the script output without changing numeric values.
- Preserve unavailable fields as unavailable, `null`, or omitted exactly as the
  script reports them.
- Do not invent missing model, effort, duration, token, provider, role, or
  nickname values.
- Do not inspect provider session records manually unless debugging a script
  failure.
- If the script fails because the package implementation is missing, say that
  the metrics package is not available yet and report the command that was
  attempted.
