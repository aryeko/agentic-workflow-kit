# Delivery Retro Analysis Contract

Use this reference for every post-run retro. The analyzer exists to reconstruct facts from an already
completed run; it is not an execution or planning skill.

## Required Handles

A final retro requires all five handles:

- execution package path;
- Codex/agent session JSONL path;
- PR URL or number;
- worker thread ids or aliases;
- git commit range.

The script resolves handles from explicit CLI flags first, then from package text, tracker rows,
session JSONL records, and current repo conventions. If any handle remains unresolved, stop and ask
for exactly that missing handle. A partial retro is allowed only when the user explicitly asks for a
partial diagnostic.

## Normalized Observability

Prefer `execution/observability/events.jsonl` over raw session JSONL. Future delivery runs should
record this file incrementally with `scripts/observe-delivery-run.mjs`; older runs may be backfilled
once with `scripts/import-session-observability.mjs`. After backfill, analyze the normalized events
instead of repeatedly parsing raw session transcripts.

Supported normalized event types:

- `run_started`;
- `turn_observed`;
- `worker_spawned`;
- `worker_completed`;
- `review_completed`;
- `story_committed`;
- `pr_opened`, `pr_reviewed`, `pr_fixed`, `pr_merged`;
- `token_usage_observed`.

Turn counts are first-class observability. Count `turn_observed` events by role and include totals in
cross-run summaries. Do not infer turn counts from prose summaries.

`token_usage_observed.usage` must be a cumulative snapshot for the run, not a per-turn or per-call
delta. The analyzer reports the latest cumulative snapshot as the run token total. Story-scoped token
snapshots follow the same rule: use the latest attributable cumulative snapshot, not the sum of
snapshots.

`review_completed` is the review-round event. PR lifecycle events such as `pr_reviewed` and
`pr_fixed` may support rework analysis, but they do not increment story review-round counts.

The normalized events file is a single-writer artifact. The recorder assigns sequence numbers from
the current file length and is intended to be called by the runner/orchestrator, not concurrently by
parallel workers writing to the same path.

## Source Rules

- Treat `execution/tracker.md`, `execution/plan.md`, session JSONL, PR data supplied by the user, and
  git commits as source evidence.
- Treat normalized observability events as the preferred source for worker aliases, review rounds,
  findings, token usage, elapsed time, and turn counts.
- Attribute normalized events to a story only when the event contains a structured story id, such as
  `storyId`, `story_id`, `story`, `worker.storyId`, or `scope: { "type": "story", "id": "..." }`.
  Do not substring-match unstructured record text against story ids.
- Resolve worker aliases from session JSONL with `scripts/find-worker-aliases.mjs` before asking the
  user for worker ids. The scanner is deterministic and should be preferred over manually searching
  large JSONL transcripts.
- Mark each metric as `observed`, `reconstructed`, `partial`, or `unavailable`.
- Token usage may be reported only when a source exposes usage fields. If no inspected source exposes
  tokens, report `unavailable`; never estimate from transcript size, elapsed time, or message count.
- Do not dump raw worker transcripts, whole diffs, or full session JSONL into the report. Summarize
  fields and cite sources.

## Report Shape

Per story, report status, story/tracker commits when present, gate evidence, blockers, review rounds,
finding classes, elapsed time, token usage, turn counts when attributable, and missing observability
fields.

Across the run, report highest-churn stories, common finding classes, slowest phases, worker count,
turn count, reviewer/implementer rework indicators, and missing observability gaps.

Recommendations must be separate from facts. Candidate lessons-ledger entries are appropriate only
for recurring defect classes. One-off implementation bugs against a clear spec remain Bucket-2 review
findings.

## Non-Mutation Boundary

Do not edit package files, trackers, lessons, delivery skills, source files, PRs, or docs while using
this skill. A retro may recommend changes, but implementation is a separate user-approved task.
