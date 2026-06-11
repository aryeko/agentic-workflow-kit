# Autopilot Recovery Hardening Spec

## Context

Pathway ran `personalized-learning-dashboard` stories PLD08 through PLD12 through
`workflow-autopilot` on June 11, 2026. The stories shipped, but the parent orchestrator repeatedly
reported blocked or `supervision_lost` states and required manual recovery.

Evidence came from these read-only run artifact directories in `/Users/aryekogan/repos/pathway`:

- `.codex/agentic-workflow-kit/runs/2026-06-11T01-20-24-128Z`
- `.codex/agentic-workflow-kit/runs/2026-06-11T02-10-16-504Z`
- `.codex/agentic-workflow-kit/runs/2026-06-11T02-48-57-806Z`
- `.codex/agentic-workflow-kit/runs/2026-06-11T03-14-47-713Z`

This repo already contains earlier hardening for duplicate launch records, tracker-derived
completion, merge evidence on the configured base branch, pre-PR review policy text, and analyzer
summaries. The remaining work is to make child session linkage, timeout semantics, recovery
decisions, prompt preflight, and run analysis durable enough for full PR/review/merge stories.

## Problems and Root Causes

### 1. Child session linkage is written too late

PLD10 launched a child session that continued working, but the launch artifact had
`sessionId: null` when the parent hit timeout. Current `WorkflowRunner` writes child launch metadata
before dispatch, but only updates `sessionId` after `StoryRunner.runStory()` resolves. The
`codex-mcp` driver only returns `threadId` from the final tool result.

Root cause: the `StoryRunner` boundary has no early lifecycle callback for child session metadata or
progress. The parent cannot persist the child thread id while the child is still running.

Desired behavior:

- The child runner reports launch/session metadata as soon as the driver learns it.
- `WorkflowRunner` immediately persists that metadata into the launch artifact and state.
- `analyze-run` treats launch-time/story/worktree matching as diagnostic evidence only. The primary
  durable contract remains persisted launch metadata with session id or session log path when
  available.

### 2. Recovery can race live or recently merged children

The parent recovery process overlapped child PR/review/cleanup work for PLD10 through PLD12. In one
case a follow-up PR was needed because parent and child work overlapped around review fixes and
merge.

Root cause: current duplicate/recovery safety primarily checks active launch artifacts. It does not
model a recovery lease with concrete evidence across child session activity, branch state, PR state,
tracker-on-main state, latest commit, and worktree cleanliness.

Desired behavior:

- Recovery/takeover must have an explicit guard result before any mutation.
- If child liveness, branch/PR/merge state, or worktree cleanliness is ambiguous, the orchestrator
  must report manual recovery required with evidence instead of editing a child branch/worktree.
- Analyzer output should expose parent takeover/recovery events and the authority used for the
  final completion decision.

### 3. Timeout semantics are wall-clock only

PLD10 hit the configured 30 minute timeout while the child had made progress into PR/review flow.
Current `WorkflowRunner` races the child promise against `orchestrator.childTimeoutMs`, while the
`codex-mcp` driver caps total MCP wait at the same value. Parent heartbeats are emitted on a timer,
but they do not prove child progress.

Root cause: elapsed wall-clock timeout is used as both no-progress timeout and maximum runtime. The
runner has no separate no-progress timer that can be reset by real driver progress/session events.

Desired behavior:

- Add a no-progress timeout that resets on child progress events.
- Keep a configurable maximum wall-clock timeout for truly long or hung children.
- Document larger recommended wall-clock defaults for full PR/review/merge story delivery.

### 4. Completion should reconcile stale child status with authoritative merged state

PLD09 and PLD11 merged successfully, but the parent blocked because the reread tracker status was
still `implementing`. PLD12 blocked as `complete-on-forbidden-base` even though the story was
merged.

Root cause: completion is intentionally tracker-first, but the gate has only one tracker snapshot at
child return time and one git evidence check. It needs to make the authority explicit and support a
fresh configured-base reread/merge reconciliation path when a child has already completed PR merge
and cleanup.

Desired behavior:

- Completion evaluation records which authority was used: tracker-on-current-source, tracker-on-base,
  merged PR evidence, branch deletion/merge commit, direct base commit rejection, or stale child
  return.
- A story with merged PR evidence into the configured base and complete tracker status on current
  base is complete even when child returned status is stale.
- Direct base commits remain forbidden unless merged PR evidence explains the base commit.

### 5. Worktree path construction can drift

PLD10 expected `.worktrees/pld10-recommendation-controls-ui`, while the actual checkout used
`.worktrees/personalized-learning-dashboard-pld10-recommendation-controls-ui`.

Root cause: expected branch/worktree construction exists in `launchMetadata.ts`, but the child prompt
does not require a preflight assertion against the launch metadata and configured path. Recovery and
analysis can therefore point at the wrong checkout.

Desired behavior:

- Centralize expected branch/worktree metadata for launch artifacts, child prompts, analyzer, and
  cleanup.
- Child prompts include an explicit preflight that verifies cwd, git top-level, branch, expected
  worktree path, and base branch before edits.

### 6. Pre-PR subagent review must fail closed when configured

Pathway config required subagent pre-PR review. PLD08 through PLD11 spawned reviewers, but PLD12 did
not, and one earlier spawn call used an invalid payload shape.

Root cause: the skill prompt describes fail-closed behavior, but there is no analyzer-visible
contract for failed spawn payloads or skipped configured subagent review. Review prompt content is
not explicitly checked for the expected packet: product docs, architecture docs, story brief, spec,
plan, correctness, quality, and spec compliance.

Desired behavior:

- When `implement.review.prePr.mode: subagent`, skipping subagent review must be recorded as a
  configured blocker or an explicit configured downgrade.
- Analyzer reports failed `spawn_agent` attempts and whether subagent review ran, waited, and closed.
- Skill and child prompt text validate spawn payload shape before tool calls and define the required
  review packet.

### 7. `analyze-run` underreports review and recovery behavior

The Pathway diagnosis required manually reading session logs, PR state, and parent actions.
`analyze-run` missed or compressed failed spawn attempts, subagent waits/closes, review fix batches,
thread state, parent takeover events, and completion authority.

Root cause: `runAnalyzer.ts` summarizes a useful top-level review object, but the child shape does
not expose linkage status, failed tool calls, recovery events, or completion authority per story.

Desired behavior:

- Per-story analysis reports linkage status, subagent spawned/waited/closed counts, failed spawn
  attempts, review loop count, PR review findings/fix batches/thread states when present in logs or
  events, parent takeover events, and completion authority.
- Existing concise fields remain backward compatible.

### 8. PR review fix-batch behavior needs an auditable policy

The desired flow is one local pre-PR review loop up to its max, one external PR review pass, a bounded
number of fix batches, and no Codex rerequest after fixes when `rerequestAfterFix: false`.

Root cause: config and prompt mention the policy, but run artifacts and analyzer output do not make
the no-rerequest decision auditable.

Desired behavior:

- Journal/analyzer events show fix batch number, `rerequestAfterFix`, reply/resolve evidence when
  available, and whether another external review was requested.
- Docs clearly distinguish local pre-PR review loops from PR review fix batches.

### 9. Rendered verification fallback needs a contract

Pathway UI stories found Browser connector or local Vite/Supabase browser env unavailable. Playwright
was the reliable fallback.

Root cause: the current workflow docs do not define a durable downgrade contract for rendered
verification when Browser is unavailable.

Desired behavior:

- Docs and skill prompt state that rendered verification may fall back to repo Playwright/e2e gates
  when Browser connector or local browser env is unavailable.
- The child records the downgrade reason and verification evidence.
- Ad hoc browser scripts are discouraged unless the story explicitly requires them.

### 10. Parent status UX should reduce noisy polling

MCP calls timed out at the host boundary while children continued. Parent sessions then performed
many status polls that produced noise and manual supervision.

Root cause: watch/analyze guidance does not strongly distinguish meaningful state changes from
micro-polling, and timeout classification makes healthy long-running children look lost.

Desired behavior:

- Docs guide parent sessions to use coarse polling and meaningful state-change checkpoints.
- Analyzer/watch output should support concise wait, complete, blocked, or manual recovery required
  decisions.

## Acceptance Criteria

- Child launch artifacts can be updated with session id/session log/progress metadata before final
  child completion.
- Supervision has separate no-progress and maximum wall-clock timeout semantics, and progress resets
  only the no-progress timer.
- Recovery guard logic returns structured evidence and refuses mutation when liveness, branch, PR,
  tracker-on-base, commit, or cleanliness evidence is ambiguous.
- Completion gate records and exposes completion authority, and accepts merged PR evidence plus
  complete tracker-on-base state while still rejecting unexplained direct base commits.
- Expected branch/worktree path generation is shared by launch artifacts, prompt preflight text,
  analyzer output, and cleanup guidance.
- Configured subagent pre-PR review is fail-closed or explicitly downgraded; analyzer reports failed
  spawn attempts and subagent spawn/wait/close lifecycle.
- Analyzer reports per-story linkage, review, recovery, and completion-authority details without
  removing existing top-level fields.
- PR review fix-batch policy is documented and analyzer-visible, including `rerequestAfterFix:
  false`.
- Rendered verification fallback to Playwright/e2e gates is documented and recorded as a downgrade
  with evidence.
- User docs recommend coarse watch/analyze polling and manual recovery decisions based on evidence.
- Tests cover `WorkflowRunner`, `CompletionGate`, `runAnalyzer`, session linkage/progress,
  recovery guards, config docs/schema where changed, and child prompt generation.
- Plugin source, materialized Codex fixture, generated MCP bundle, docs, presets, and tests remain
  in sync.
