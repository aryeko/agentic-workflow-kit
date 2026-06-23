---
name: delivery-retro
description: "Analyze completed workflow-kit delivery runs after execution. Use when asked for a post-run retro, self-improvement report, review-round/finding/token/time analysis, or delivery-run observability summary from an existing execution package, session JSONL, PR, worker threads, and git range."
---

# Delivery Retro

Analyze a completed workflow-kit delivery run after execution. This skill is analysis-only: do not
edit the execution package, tracker, lessons ledger, delivery skills, source code, PRs, or docs while
using it unless the user explicitly asks for a separate follow-up change.

## Workflow

1. Read `references/analysis-contract.md` before running the analyzer or writing a retro report.
2. Resolve all required run handles: execution package path, session JSONL path, PR URL/number,
   worker thread ids or aliases, and git range.
3. Prefer normalized observability events when present:
   `execution/observability/events.jsonl`, or an explicitly supplied events file. Summarize them with
   `node scripts/summarize-delivery-observability.mjs --events <path> --format json` before reading
   raw session JSONL.
4. When a future delivery run needs to record observability, append one event at a time with
   `node scripts/observe-delivery-run.mjs --events <path> --type <type> --payload <json>`. Record
   turn counts as `turn_observed` events, not by re-counting raw transcripts later.
5. When analyzing an older run without normalized observability, backfill once with
   `node scripts/import-session-observability.mjs --session-jsonl <path> --output <events.jsonl>`.
   Treat the generated file as the analysis source after import.
6. When a session JSONL is known but worker ids or aliases are not, run
   `node scripts/find-worker-aliases.mjs --session-jsonl <path> --format workers` and pass the
   resulting comma-separated value to the analyzer's `--workers` option.
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
  events.
- `scripts/import-session-observability.mjs`: one-time backfill adapter from Codex session JSONL to
  normalized observability events for older runs that did not record `events.jsonl`.
- `scripts/summarize-delivery-observability.mjs`: report worker, review, finding, token, and turn
  counts from normalized observability events without reading raw session transcripts.
- `scripts/find-worker-aliases.mjs`: line-by-line Codex session JSONL scanner for resolving worker
  aliases without loading or manually reading the full transcript. It prints JSON, text, or a
  comma-separated analyzer `--workers` value.
- `references/analysis-contract.md`: required handles, source precedence, report fields, confidence
  labels, and stop conditions.
- `evals/`: output and trigger evals for post-run retro behavior.

## Validation

Before trusting a change to this skill, run the analyzer fixture tests and the open-skill validation
script. For packaging or broader release, also run the repo check gate.
