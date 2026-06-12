# Autopilot Authority And Analyzer Fixes Design

## Problem

The Pathway run `2026-06-11T19-47-30-255Z` exposed that workflow-kit can launch and let children finish successfully while the parent run still reports `blocked`. The parent kept local tracker claim snapshots (`implementing`) after child PRs merged and the authoritative base tracker moved to `done`. Analyzer output then repeated the parent blocked status without explaining the mismatch.

The same run also showed weaker supervision semantics:

- `child-session-linked` was persisted only at final return for the real Codex output shape.
- `child-heartbeat` was a parent timer tick, not observed child progress.
- `children/<story>.json` carried mostly prose and raw Codex output, so analyzer had to infer verification, PR, merge, cleanup, and review state.
- MCP `run_eligible` waited for the full child lifecycle and could exceed the host tool timeout even though dispatch succeeded.
- Review-loop and merge evidence were aggregated globally instead of being visible per story.
- The preflight contract treated pre-worktree missing paths like blockers instead of expected needs-create state.

## Goals

- Keep tracker state as the completion authority, but distinguish local parent claim snapshots from authoritative post-merge base tracker state.
- Do not use parent timer heartbeats as child progress.
- Persist real observed child progress fields and analyzer progress sources.
- Make MCP non-dry-run dispatch return quickly with `runId` and `artifactDir` after initial launch while background supervision continues in process.
- Enrich child artifacts from structured child output when available and from conservative compatibility extraction for existing Codex text output.
- Report analyzer truth per story before aggregate summaries.
- Document two-phase preflight, child progress semantics, and MCP launch/watch/analyze flow.

## Non-Goals

- Do not replace the tracker contract or accept child prose as final completion authority.
- Do not introduce a new driver.
- Do not make analyzer perform network calls to GitHub.
- Do not require absolute local Pathway paths in tests.

## Design

### Child Progress Semantics

`ActiveChildRun` and `ChildLaunchRecord` should separate:

- `lastSupervisorPollAt`: parent loop/timer liveness.
- `lastObservedChildProgressAt`: child activity observed from session linkage, MCP progress, session log growth, branch/worktree evidence, PR/review/merge events, or structured child progress.
- `progressSource`: the source that last updated observed progress.

Parent timer ticks record `child-supervisor-poll`, not `child-progress`, and do not reset no-progress timers. Session linkage and MCP progress remain real observed child activity and can reset the no-progress timer.

### Child Result Contract

`StoryRunResult` should allow optional structured fields for:

- `storyId`
- `finalStatus`
- `trackerPath`
- `trackerStatusEvidence`
- `prNumber` / `prUrl`
- `merged` / `mergedAt` / `mergeCommit`
- `branchDeleted`
- `verification`
- `prePrReview`
- `prReview`
- `downgrades`

The Codex MCP driver should read these fields from `structuredContent.childResult` or top-level `structuredContent` keys when the host exposes them. For current prose-only Codex output, compatibility extraction may populate obvious PR URL, merge commit, verification command lines, branch deletion, and downgrade notes, but runtime completion must still depend on tracker/git authority.

### Completion Authority Refresh

Before returning `tracker-status-not-complete`, `CompletionGate` should check whether the child result contains merged PR evidence or the config uses PR auto-merge. In that case it should read the tracker file from `origin/<baseBranch>` and parse the story row from that base content. If the base tracker row is complete, completion evaluation should continue with that authoritative story. The journal should record the authority source, for example `merged-pr-base-tracker`.

The parent can still write stale local snapshots for audit, but analyzer must call out the mismatch when `after-<story>.json` says in-progress while child or base evidence says merged/done.

### MCP Async Launch

MCP `run_story` and `run_eligible` with `dryRun: false` should return after initial child launch unless the caller explicitly requests synchronous watching. The returned state includes `runId`, `artifactDir`, active children, and status `running`. The runner continues supervision in the background in the same MCP process, writing the same artifacts. Callers then use `watch_run` and `analyze_run`.

CLI behavior remains synchronous by default because shell callers are not constrained by MCP tool timeouts and may pass `--watch` for event streaming.

### Analyzer

Analyzer output should add per-story fields:

- `progress`: supervisor poll time, observed child progress time, and source.
- `completionAuthority`: authority and source.
- `staleParentSnapshot`: true when run snapshots say not complete but child/base evidence indicates done or merged.
- per-story `verification`, `merge`, `prePrReview`, and `prReview` summaries.

Aggregate `review`, `verification`, and `merge` remain for compatibility, but per-story truth is primary. Review loop counts must not aggregate across stories in a way that makes one story appear to exceed `maxLoops` because another story also reviewed.

### Preflight Contract

The implement-next/autopilot prompt contract should describe two phases:

1. Before worktree creation, a missing expected worktree is `needs-create` / expected.
2. After creation, the child must verify it is in the expected worktree and branch; mismatch is a blocker.

## Test Strategy

- Add runner tests for parent supervisor poll not resetting no-progress and not updating observed progress.
- Add runner tests for accepting base tracker authority after a child reports merged PR evidence while the local snapshot is stale.
- Add MCP handler/tool tests for non-dry-run async launch returning a running state after launch.
- Add analyzer tests with minimized SSS02/SSS04-shaped artifacts covering stale parent snapshots, merged child evidence, per-story review/verification/merge, and timer poll distinction.
- Update existing heartbeat tests to the new event/field names.

## Documentation

Update canonical docs and mirrored plugin surfaces:

- `docs/architecture.md`
- `docs/getting-started.md`
- `docs/test-plan/README.md`
- `skills/workflow-autopilot/SKILL.md`
- `skills/implement-next/SKILL.md`
- `plugins/agentic-workflow-kit/...` mirrored copies
- `references/config-schema.md` and mirror only if user-visible event semantics need durable description

