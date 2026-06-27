---
title: Codex Review Execution Summary
status: high-level design
last-reviewed: "2026-06-27"
---

# Codex Review Execution Summary

Codex review summaries must show how the review was executed, not only what it
found. This applies to the final summary comment for Codex GitHub automatic PR
review and to local `deep-code-review` reports.

Report only metadata that is directly surfaced by the review runtime, the
subagent API, local session records, or supported analytics/compliance exports.
Do not infer model, effort, token counts, or elapsed time from memory or
configuration defaults. If a value is not surfaced, write `not surfaced`.

## Publishing Rules

Codex GitHub automatic review may have a constrained review-output schema that
only accepts inline findings. When the review body cannot carry this summary,
publish the execution summary as a separate pull-request comment immediately
after submitting the GitHub review. The follow-up comment must start with
`## Review execution` and use the shape below.

If a separate pull-request comment is not available in the review runtime,
append the execution summary to the final posted finding body after the finding
text under the heading `## Review execution`. Prefer the separate comment path;
use the final-finding fallback only when a free pull-request comment cannot be
posted.

If the review has no P0/P1 findings, still post the separate execution-summary
comment when the comment surface is available. If no findings exist and no free
comment surface is available, the runtime may be unable to surface the summary;
do not fabricate a finding solely to carry metadata.

## Summary Comment Shape

Use this shape before the findings:

```markdown
## Review execution

Mode: Codex GitHub automatic PR review | local deep-code-review
Target: PR #123, head `abc1234`, base `v-next` / `def5678`
Duration: 8m 42s, if available
Result: 2 P1 findings, 1 non-blocking note

| Step | What ran | Agents | Model / effort | Tokens | Evidence |
|---|---|---|---|---|---|
| Scope | Read PR diff, closest `AGENTS.md`, routed sources | Root reviewer | `gpt-*`, effort `*` | Available / unavailable | 12 changed files, 3 routed sources |
| Find | Correctness, removed behavior, contract, evidence, security, convention passes | 6 finder agents | Per-agent if different | Per-agent if available | 9 candidates |
| Verify | Independent check for each candidate | 9 verifier agents | Per-agent if different | Per-agent if available | 2 confirmed, 1 plausible, 6 refuted |
| Sweep | Sibling/systemic defect sweep | 1 sweep agent | `gpt-*`, effort `*` | Available / unavailable | 1 added candidate |
| Synthesis | Dedupe, rank, publish review | Root reviewer | `gpt-*`, effort `*` | Available / unavailable | 2 final findings |
```

For local reports, the summary may include a separate non-blocking section:

```markdown
## Non-blocking notes

P2/P3 only. Not posted to GitHub unless explicitly requested.
```

## Required Fields

Every review summary must include:

- `Mode`: GitHub automatic review or local `deep-code-review`.
- `Target`: PR, branch, commit range, or path under review.
- `Duration`: elapsed time if surfaced or locally measured; otherwise
  `not surfaced`.
- `Result`: final count of blocking findings and non-blocking notes.
- `Step`: scope, find, verify, sweep, and synthesis.
- `Agents`: root reviewer, finder agents, verifier agents, sweep agent, or
  `single-agent sequential`.
- `Model / effort`: exact model and effort only when surfaced or explicitly
  chosen for that agent. If agents in a step differ, report per-agent values.
- `Tokens`: exact token counts only when surfaced by supported runtime metadata
  or local session records. Otherwise write `not surfaced`.
- `Evidence`: compact proof of what the step consumed or produced, such as
  routed source count, candidate count, verification verdict counts, or final
  finding count.

## Availability Rules

Use these availability rules when filling the table:

| Metric | Local deep-code-review | Codex GitHub automatic review |
|---|---|---|
| Target and routed sources | Available from the review workflow. | Available from PR context and review workflow. |
| Agents used | Available when subagents are explicitly spawned or when running single-agent sequential. | Report only if surfaced by the cloud review runtime. |
| Duration | Available when the local skill records start/end timestamps or local session timestamps exist. | Report only if surfaced by the cloud review runtime. |
| Model provider | Available in local session metadata. | Report only if surfaced by the cloud review runtime. |
| Exact model and effort | Report when explicitly chosen or surfaced in metadata. Otherwise `not surfaced`. | Report only if surfaced by the cloud review runtime. |
| Token counts | Locally available through the repo-local `agent-session-metrics` skill, which parses supported session metadata. | Report only if surfaced by supported cloud review, analytics, or compliance metadata. |

Token counts are best-effort execution metadata, not a correctness gate. A review
can be valid when token counts are unavailable, but the summary must say they
were unavailable.

For local `deep-code-review` reports, use the repo-local
`agent-session-metrics` skill as the deterministic local source for Codex
session duration, model, effort, token usage, and spawned subagent breakdowns;
do not duplicate provider JSONL parsing in the review skill.
The skill resolves the invoking session from `CODEX_THREAD_ID` and returns a
recursive JSON response at `report.main`: target session metrics are in
`report.main.metrics`, and spawned subagent metrics are in
`report.main.children[*].metrics`. Check `report.main.success` and
`report.main.error` before treating zero-valued numeric fields as observed
metrics; if the skill reports unavailable token usage, write `not surfaced` in
the execution summary instead of reporting zeros. If the skill is unavailable or
cannot resolve the session, report the affected execution-summary fields as
`not surfaced`.

## Local Probe

On 2026-06-27, a local worker subagent was spawned to test what execution
metadata is available through the current Codex desktop environment.

Task sent to worker:

```text
Say exactly: Hi

Do not inspect files, do not run commands, do not edit anything. In your final
response, include only the word Hi.
```

Visible subagent API result:

| Field | Value |
|---|---|
| Agent id | `019f076b-a7af-7412-b7b4-a73cea21375a` |
| Nickname | `Boole` |
| Final result | `Hi` |
| Timeout status | `false` |

Local session evidence:

- Session file:
  `/Users/aryekogan/.codex/sessions/2026/06/27/rollout-2026-06-27T07-52-03-019f076b-a7af-7412-b7b4-a73cea21375a.jsonl`
- Session metadata line showed `agent_role=worker`, `agent_nickname=Boole`,
  `model_provider=openai`, `thread_source=subagent`, and `cli_version=0.142.3`.
- Task timestamps showed `task_started` at `2026-06-27T04:52:04.953Z` and
  `task_complete` at `2026-06-27T04:52:10.338Z`, for an observed task duration
  of `5.385s`.
- The `token_count` event showed `input_tokens=25749`,
  `cached_input_tokens=4992`, `output_tokens=5`, `reasoning_output_tokens=0`,
  and `total_tokens=25754`.

Observed availability:

| Metric | Result |
|---|---|
| Agent id | Available from subagent API and local JSONL. |
| Agent nickname | Available from subagent API and local JSONL. |
| Agent role | Available from spawn request and local JSONL. |
| Final result | Available from subagent API and local JSONL. |
| Duration | Not directly returned by subagent API; available by parsing local JSONL timestamps. |
| Model provider | Available from local JSONL. |
| Exact model | Not surfaced for this `worker` run. |
| Reasoning effort | Not surfaced for this `worker` run. |
| Tokens | Not returned by subagent API; available by parsing local JSONL `token_count`. |

Conclusion: local token usage is accessible, but currently requires parsing the
session JSONL. Exact model and effort must be reported only when explicitly
chosen for the spawned agent or surfaced by runtime metadata.

## Nested Subagent Probe

On 2026-06-27, a new local Codex session was started from the worktree after
adding this project config:

```toml
[agents]
max_depth = 2
```

The probe asked one direct worker subagent to spawn one nested subagent and ask
the nested subagent to return exactly `nested-hi`.

Worker result:

```json
{
  "results": {
    "config_seen": true,
    "nested_spawn_attempted": true,
    "nested_spawn_succeeded": true,
    "nested_response": "nested-hi",
    "error": null
  },
  "metrics": {
    "duration": "not surfaced",
    "model": "not surfaced",
    "effort": "not surfaced",
    "tokens": "not surfaced",
    "source": "not surfaced"
  }
}
```

Parent-observed metrics:

```json
{
  "source": "local_session_jsonl",
  "session_file": "/Users/aryekogan/.codex/sessions/2026/06/27/rollout-2026-06-27T08-19-07-019f0784-7058-7d00-9651-c0618bf27d63.jsonl",
  "duration_ms": 38657,
  "time_to_first_token_ms": 12324,
  "model": "not surfaced",
  "effort": "not surfaced",
  "model_provider": "openai",
  "tokens": {
    "input_tokens": 167884,
    "cached_input_tokens": 133888,
    "output_tokens": 499,
    "reasoning_output_tokens": 166,
    "total_tokens": 168383
  }
}
```

Conclusion: `agents.max_depth = 2` was sufficient for a direct worker subagent
to spawn a nested subagent in a fresh session rooted at the configured worktree.
It did not make metrics self-observable to the worker; the worker still reported
metrics as `not surfaced`, while the parent recovered execution metadata from
local session JSONL.

## Self-Observed Metrics Probe

On 2026-06-27, a worker subagent was given its own agent id after spawn and
explicit read-only instructions for finding its session JSONL:

```text
find /Users/aryekogan/.codex/sessions -type f \
  -name '*<agent-id>.jsonl' -print -quit
```

The worker was also told to read only its own session record, extract
top-level timestamps, `turn_context` model and effort fields, `session_meta`
role/provider/nickname fields, and the latest `token_count` event.

Worker result:

```json
{
  "results": {
    "message": "metrics probe complete",
    "session_file_found": true,
    "commands_ran": [
      "located own session JSONL with find under /Users/aryekogan/.codex/sessions",
      "extracted timestamps, turn_context, session_meta, and last token_count with jq"
    ]
  },
  "metrics": {
    "source": "local_session_jsonl",
    "session_file": "/Users/aryekogan/.codex/sessions/2026/06/27/rollout-2026-06-27T08-21-50-019f0786-ebec-7542-bb66-4399d824859a.jsonl",
    "duration": "43 seconds",
    "model": "gpt-5.5",
    "effort": "high",
    "model_provider": "openai",
    "agent_role": "worker",
    "agent_nickname": "Averroes",
    "tokens": {
      "total_token_usage": {
        "input_tokens": 106887,
        "cached_input_tokens": 102912,
        "output_tokens": 1286,
        "reasoning_output_tokens": 498,
        "total_tokens": 108173
      },
      "last_token_usage": {
        "input_tokens": 28082,
        "cached_input_tokens": 25984,
        "output_tokens": 231,
        "reasoning_output_tokens": 154,
        "total_tokens": 28313
      }
    },
    "notes": "Token counts are from the last token_count event visible before this final response, so they may not include final response tokens."
  }
}
```

After the worker completed, parent-side parsing of the same session file showed
larger final totals:

```json
{
  "total_token_usage": {
    "input_tokens": 164549,
    "cached_input_tokens": 135936,
    "output_tokens": 2344,
    "reasoning_output_tokens": 586,
    "total_tokens": 166893
  },
  "last_token_usage": {
    "input_tokens": 29246,
    "cached_input_tokens": 28032,
    "output_tokens": 453,
    "reasoning_output_tokens": 88,
    "total_tokens": 29699
  }
}
```

Conclusion: a local subagent can self-report metrics when the parent passes the
agent id and permits read-only inspection of its own local session JSONL.
Self-reported token counts can be partial because the final response may not be
written when the worker reads the file. Parent-side post-completion parsing is
still the most complete source for final token totals.

## CLI and App-Server Metrics Surfaces

On 2026-06-27, the local Codex manual and installed CLI were checked for
first-class metrics surfaces.

Documented and generated surfaces:

- `codex exec --json` streams a `turn.completed` event with usage for the
  current CLI-run turn.
- The app-server protocol includes `thread/tokenUsage/updated` notifications
  with `ThreadTokenUsage`, including `total`, `last`, and
  `modelContextWindow`.
- The app-server protocol includes `thread/read`, `thread/list`,
  `thread/turns/list`, and `thread/turns/items/list`, but the generated
  `Thread` and `Turn` response types do not include token usage.
- The app-server protocol includes `account/usage/read`, but that returns
  account-level summaries and daily buckets, not per-review-step or per-subagent
  usage.
- OpenTelemetry can emit `codex.sse_event` with token counts on
  `response.completed`, when configured.
- Enterprise Analytics and Compliance APIs can expose aggregate usage and token
  metadata, subject to workspace permissions and lag.

Local CLI probe:

```text
codex exec --json --sandbox read-only -C <worktree> \
  "Spawn one worker subagent. Ask it to return exactly 'child-hi'..."
```

The root JSON stream included the child thread id in `collab_tool_call`
events:

```json
{
  "type": "item.completed",
  "item": {
    "type": "collab_tool_call",
    "tool": "spawn_agent",
    "sender_thread_id": "019f0790-21aa-77b1-a2ee-1cd834bec695",
    "receiver_thread_ids": ["019f0790-48a7-7dd2-9799-6ba3c05ccaa0"],
    "status": "completed"
  }
}
```

The same root stream ended with root-turn usage:

```json
{
  "type": "turn.completed",
  "usage": {
    "input_tokens": 123843,
    "cached_input_tokens": 79744,
    "output_tokens": 211,
    "reasoning_output_tokens": 31
  }
}
```

It did not include the child thread's token usage in the root stream. Parsing
the child session JSONL by the child thread id showed the child usage:

```json
{
  "total_token_usage": {
    "input_tokens": 23833,
    "cached_input_tokens": 4992,
    "output_tokens": 6,
    "reasoning_output_tokens": 0,
    "total_tokens": 23839
  }
}
```

Conclusion: for local CLI-run reviews, `codex exec --json` is a supported way
to capture root-turn usage and subagent thread ids during the run. It is not, by
itself, enough to recover completed child-agent usage unless the client also
subscribes to each child thread's token-usage notifications or reads the child
session record after completion. For the local `deep-code-review` skill, the
most complete practical strategy is parent-side post-completion enrichment:
collect subagent ids from the orchestration stream, then read each child session
record for final token totals.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Engineering Policy Index](./README.md) · **← Prev:** [Codex GitHub Code Review](./codex-github-code-review.md) · **Next →:** [Agent Session Metrics Design](./agent-session-metrics-design.md)

<!-- /DOCS-NAV -->
