# Autopilot Supervision and Observability Design

## Context

This design captures follow-up work from analysis of autopilot session
`019ec0ea-4c8f-7633-a29a-65b3b89cec5c`, run with agentic-workflow-kit plugin
`0.5.13` against Pathway.

The run launched two stories in parallel:

- `DLD06` completed normally and merged PR #110.
- `DLD07` implemented the story and reached passing PR checks, but stalled at the
  Codex review gate because the child checked comments and review comments while
  missing the actual approval signal: a `+1` reaction on the PR body from the
  Codex bot.

The parent agent manually recovered the run by resolving the DLD06/DLD07 tracker
conflict, rerunning checks, merging PR #111, stopping stale runner processes, and
cleaning up worktrees and branches. That recovery shipped useful work, but the
orchestrator artifacts did not represent reality cleanly: live state still looked
running, metrics were sparse, and watch output was too noisy for supervision.

## User Decisions

The requested scope is intentionally narrower than the initial analysis
recommendations.

In scope:

- Fix the Codex PR review gate prompt.
- Require a fresh rebase or equivalent base update before merge.
- Expose Codex reply and interrupt controls through workflow-kit MCP.
- Improve live metrics and run JSON artifacts so tool counts, subagent counts,
  and token totals by type are available while a run is active.
- Stop the parent orchestrator from modifying the plan/tracker on `main` for
  worktree-based runs.
- Replace long blocking watch behavior with a nonblocking watch/control shape.
- Make watch output meaningful by default: per-story status, metrics, and plan
  step done/total summaries instead of every small progress event.

Out of scope:

- Analyzer reconstruction for the DLD07 manual-recovery corner case.
- Synthetic recovered-child result artifacts for manually recovered runs.
- Remote/API merge changes for linked-worktree cleanup.
- A full deterministic review helper beyond prompt guidance.

## Current System Observations

The current implementation explains the observed behavior:

- `watch_run` can block inside one MCP tool call when `wait` is true, which is
  vulnerable to host-side request timeouts.
- `metrics.live.json` preserves child metrics that are explicitly observed, but
  active Codex session logs already contain richer tool, subagent, and token
  data that live metrics does not currently reuse.
- The run analyzer has session-log parsing logic for command counts, subagent
  counts, and token totals. That logic should be shared instead of duplicated.
- The parent runner claims tracker rows before child workspace preparation,
  which writes the configured tracker in the parent checkout. With worktree
  strategy, that means the orchestrating parent can dirty `main`.
- CLI event watch prints every event in non-JSON mode, including low-value
  child progress and supervisor polling noise.

## Design Goals

1. Make live supervision accurate enough that the parent agent does not need to
   inspect raw JSONL for ordinary runs.
2. Keep completion authority unchanged: tracker state remains authoritative, but
   child worktrees own tracker mutations for worktree strategy.
3. Keep MCP tools request/response friendly; do not rely on one long-running MCP
   request staying open beyond host limits.
4. Preserve raw artifacts for debugging while making default watch output
   concise and decision-oriented.
5. Keep the Codex review and merge changes prompt-level unless a future run
   proves prompt guidance is insufficient.

## Proposed Changes

### Codex PR Review Gate Prompt

Update the Codex child prompt to make approval detection explicit:

- Check PR body reactions, issue comments, and PR review comments.
- Treat a `+1` reaction from the configured Codex bot as approval.
- Treat `eyes` from the configured Codex bot as pending.
- Do not continue waiting or rerequesting review after an approval reaction has
  been observed.

This is intentionally prompt-only for now.

### Merge Freshness Prompt

Update the child prompt before merge:

- Fetch the latest base branch.
- Rebase, merge, or otherwise update the story branch onto the latest base using
  the repository's configured workflow.
- Rerun required verification after the base update.
- If conflicts or verification failures occur, block and report the reason
  instead of merging.

This addresses sibling PR tracker conflicts without adding parent-side merge
automation.

### MCP Codex Control Tools

Add workflow-kit MCP tools for live child intervention:

- `codex_reply`
- `codex_interrupt`

Inputs should support both direct and run-resolved targeting:

- Direct: `sessionId`.
- Run-resolved: `runPath` plus `storyId`, resolved from
  `children/<story>.launch.json`.

The tools should journal durable events such as `codex-reply-sent` and
`codex-interrupt-sent` when `runPath` is provided, including `storyId`,
  `sessionId`, and redacted/summarized control metadata. They should not store
  secrets or large message bodies in run artifacts.

The tools should fail closed when:

- The run path is missing or malformed.
- The story has no linked session.
- The underlying Codex control tool is unavailable.
- The session is no longer active.

### Nonblocking Watch Shape

Keep `watch_run` as an immediate snapshot reader. Do not make it wait by default
inside MCP.

Add a nonblocking watch lifecycle:

- `watch_run_start`: creates a watch cursor for a run path and returns the
  current summary.
- `watch_run_poll`: returns meaningful changes since the cursor.
- `watch_run_stop`: releases the cursor.

The durable fallback should be cursor-based and reconstructible from run
artifacts, not only in process memory. A process-local cache is acceptable as an
optimization, but a restarted MCP server must still be able to poll using the
last returned cursor.

### Meaningful Watch Summary

Default watch output should summarize state, not stream every event.

Per story, expose:

- `storyId`
- `status`: requested, launched, active, blocked, complete, supervision_lost, or
  unknown
- `sessionId`
- `expectedBranch`
- `expectedWorktreePath`
- latest meaningful milestone
- latest progress timestamp
- plan steps done/total when discoverable
- tool counts
- subagent counts
- token totals by type

Aggregate output should include:

- run status
- active stories
- completed count
- blocked story and reason
- elapsed time
- aggregate tool counts
- aggregate subagent counts
- aggregate token totals by type

Raw event streaming remains available through JSON/debug mode or by reading
`events.ndjson`.

### Live Metrics and Run JSON Artifacts

Extract session-log metric parsing from the analyzer into a shared module. Reuse
it for:

- `analyze_run`
- live `watch_run` snapshots
- `metrics.live.json`
- child metrics JSON when a session log is linked

Metrics should include:

- `toolCounts`
- `subagentCounts`
- `tokenTotals.inputTokens`
- `tokenTotals.cachedInputTokens`
- `tokenTotals.outputTokens`
- `tokenTotals.reasoningOutputTokens`
- `tokenTotals.totalTokens`

When a child has a linked session log, live metrics should be best-effort and
monotonic. If the session log is missing, unreadable, or still being written,
the snapshot should return the previous known values and include a lightweight
metrics status rather than failing the watch.

### Parent Tracker Mutation

For worktree strategy, the parent orchestrator should not claim tracker rows by
editing the tracker in the parent checkout. The child worktree should own status
and owner changes.

Replacement reservation model:

- Use run artifacts and launch records as the parent-owned reservation source.
- Keep duplicate launch protection based on active child launch metadata,
  expected branch, expected worktree path, and stale-launch rules.
- Optionally add small reservation files under the run artifact directory if a
  stronger cross-process guard is needed.
- Do not write the canonical tracker from the parent checkout for worktree
  launches.

Branch strategy can keep existing tracker-claim behavior because there is no
separate child worktree owner for tracker edits.

The main risk is losing the cross-run reservation behavior that tracker claims
provided. Tests must prove duplicate launch protection still blocks obvious
same-story, same-branch, and same-worktree collisions without dirtying the base
checkout.

## Verification Expectations

Focused tests should cover:

- The Codex prompt includes PR body reaction approval guidance.
- The Codex prompt requires base freshness and verification before merge.
- `watch_run` returns immediately by default and does not block an MCP request.
- The new watch cursor tools can start, poll meaningful changes, and stop.
- Live metrics are populated from linked session logs for active children.
- Aggregates include tool counts, subagent counts, and token totals by type.
- Worktree strategy launches do not edit the parent tracker before child handoff.
- Duplicate launch protection still works without parent tracker claims.
- Non-JSON watch output suppresses supervisor polling and tiny progress events
  while preserving story launch, session link, completion, block, and summary
  updates.

Repository verification before handoff:

```bash
pnpm check
```

## Open Questions

- Should MCP `codex_reply` store the full reply message in artifacts, a short
  preview, or only a hash? The safer default is preview plus hash.
- Should watch cursors be persisted in the run directory, the artifacts root, or
  kept entirely client-side as an event cursor? Client-side cursors are simpler
  and more robust across MCP restarts.
- Should plan step parsing read only tracker-linked plan files, or also discover
  likely story plan files under `docs/superpowers/plans/` in child worktrees?
  Tracker-linked files should be the default; heuristic discovery should be
  opt-in or clearly marked as best effort.
