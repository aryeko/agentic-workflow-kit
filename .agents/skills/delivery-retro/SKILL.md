---
name: delivery-retro
description: "Analyze completed workflow-kit delivery runs after execution. Use when asked for a post-run retro, self-improvement report, review-round/finding/token/time analysis, or delivery-run observability summary from an existing execution package, agent-session-metrics report or session id/file, PR, worker threads, and git range."
---

# Delivery Retro

Analyze a completed workflow-kit delivery run after execution. This skill is analysis-only: do not
edit the execution package, tracker, lessons ledger, delivery skills, source code, PRs, or docs while
using it unless the user explicitly asks for a separate follow-up change.

## Workflow

1. Read `references/analysis-contract.md` before running the analyzer or writing a retro report.
2. Resolve all required run handles: execution package path, session metrics source
   (`agent-session-metrics` report, Codex session id, or explicit session file), PR URL/number,
   worker thread ids or aliases when not derivable from metrics, and git range.
3. Prefer normalized observability events when present:
   `execution/observability/events.jsonl`, or an explicitly supplied events file. Summarize them with
   `node scripts/summarize-delivery-observability.mjs --events <path> --format json` before reading
   raw provider records.
4. When a future delivery run needs to record observability, append one event at a time with
   `node scripts/observe-delivery-run.mjs --events <path> --type <type> --payload <json>`. Record
   turn counts as `turn_observed` events, not by re-counting raw transcripts later. Treat the events
   file as a single-writer artifact owned by the runner/orchestrator.
5. For session duration, token usage, and spawned worker tree data, invoke the repo-local
   `agent-session-metrics` skill instead of manually scanning Codex JSONL or reading files from
   another skill directory. Pass the Codex session id or explicit session file to that skill, request
   JSON tree output, then read the canonical recursive payload from `report.main` and
   `report.main.children`.
6. Use legacy `import-session-observability.mjs` or `find-worker-aliases.mjs` only as compatibility
   fallbacks for old execution packages whose analyzer path still requires normalized events or worker
   aliases and no `agent-session-metrics` report can be produced. Do not use those scripts as the
   normal token, duration, or session-tree source.
7. Run `node scripts/analyze-delivery-run.mjs` with known handles. Start with `--format json` when
   another tool or follow-up analysis will consume the result; use `--format md` for a human-only
   report.
8. If the script returns `status: needs_input`, ask only for the missing handle names listed in the
   result. Do not produce a final retro from partial handles unless the user explicitly asks for a
   partial diagnostic.
9. If the script returns `status: ok`, report the per-story and cross-run findings, keeping observed
   facts separate from recommendations.
10. Promote only recurring defect classes as candidate lessons. Treat one-off Bucket-2 implementation
   bugs as reviewer-domain findings, not lessons-ledger entries.

## Resources

- `scripts/analyze-delivery-run.mjs`: deterministic resolver and analyzer. It prints JSON or Markdown
  to stdout, diagnostics/errors to stderr, and exits 2 for `needs_input`.
- `scripts/observe-delivery-run.mjs`: append-only recorder for future runs. Use it during delivery to
  write normalized events directly, including `turn_observed`, worker, review, PR, commit, and token
  events. For `token_usage_observed`, pass cumulative `usage` snapshots; the analyzer reports the
  latest snapshot as the run total.
- `agent-session-metrics` skill: canonical source for Codex session duration, token usage, and
  recursive worker/subagent metrics. Use its `report.main.metrics` for the target session and
  `report.main.children[*].metrics` for descendants.
- `scripts/import-session-observability.mjs`: legacy one-time backfill adapter from Codex session
  JSONL to normalized observability events for older runs that did not record `events.jsonl`; use only
  when the analyzer needs event backfill that `agent-session-metrics` does not provide.
- `scripts/summarize-delivery-observability.mjs`: report worker, review, finding, token, and turn
  counts from normalized observability events without reading raw session transcripts.
- `scripts/find-worker-aliases.mjs`: legacy line-by-line Codex session JSONL scanner for resolving
  worker aliases when no `agent-session-metrics` tree is available.
- `references/analysis-contract.md`: required handles, source precedence, report fields, confidence
  labels, and stop conditions.
- `evals/`: output and trigger evals for post-run retro behavior.

## Validation

Before trusting a change to this skill, run the analyzer fixture tests and the open-skill validation
script. For packaging or broader release, also run the repo check gate.
