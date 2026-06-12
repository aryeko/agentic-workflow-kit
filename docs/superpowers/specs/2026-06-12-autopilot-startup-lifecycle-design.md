# Autopilot Startup Lifecycle Design

## Goal

Fix workflow-autopilot child startup supervision so a durable launch artifact means the parent has either a usable child session, a bounded startup request, or a clearly failed startup. A child that never links a session, heartbeat, result, worktree activity, or prompt evidence must become retryable after a short startup timeout instead of blocking future attempts as a duplicate active launch.

## Observed Failure

Pathway run `2026-06-12T12-53-41-657Z` launched DLD01 and DLD02 concurrently. DLD02 linked a real Codex child session, made progress, opened and merged PR #104, and wrote settled child artifacts. DLD01 produced only a launch artifact and an empty Codex thread shell:

- `children/DLD01.launch.json` stayed `status: "launched"`.
- `sessionId`, `lastHeartbeatAt`, and `lastObservedChildProgressAt` remained `null`.
- There was no `children/DLD01.json` settled result.
- The Codex session JSONL contained only `session_meta` and `task_started`; it had no user prompt, tool calls, final answer, or task completion.
- Retry runs were blocked by `duplicate active launch for DLD01`.

This was not a DLD01 implementation failure. It was a parent orchestration failure: the parent wrote durable active-child metadata before the Codex child startup handshake proved the prompt had been delivered or a session was linkable.

## Root Cause

`WorkflowRunner.recordChildLaunch` currently:

1. claims the tracker row,
2. writes `children/<story>.launch.json` with `status: "launched"`,
3. adds the story to `state.active` and `state.activeChildren`,
4. records `child-launched`,
5. only then calls `storyRunner.runStory`.

`WorkflowRunner.executeChild` updates the same launch record when the runner emits `session-linked` or progress. If the Codex MCP call creates an empty thread shell but never reports a session id or useful progress, the parent artifact remains indistinguishable from a real active child until the long no-progress timeout.

`DuplicateLaunchGuard` separately scans historical launch artifacts and treats every `status: "launched"` record without a settled result as active. It does not use startup age, session linkage, heartbeat, worktree activity, or the configured timeout to distinguish a startup orphan from a live child. That makes stale startup records durable blockers.

`runEligible` also prepares an entire dispatch batch before starting child execution. With `maxParallel: 2`, multiple fragile Codex MCP startup handshakes can begin together. That preserves execution parallelism, but it gives each startup less isolation and no acknowledgement barrier.

## Desired Lifecycle

Launch artifacts should represent these states:

- `requested`: parent has claimed the story, computed prompt metadata, and is attempting to start a child, but has not observed a usable session or child progress yet.
- `launched`: parent has observed a session id or child progress and can supervise a real child.
- `startup_failed`: startup did not reach a linked/progress state within the short startup timeout and there is no evidence of live work.
- `supervision_lost`: a previously linked or progressing child stopped making progress past the normal no-progress timeout.
- `settled`: child returned a result or a non-startup execution error.

For backwards compatibility, legacy `status: "launched"` records with no session id, heartbeat, progress, settled result, or worktree activity should be analyzed as startup-stale when their age exceeds the startup timeout. Old linked/progressing launch records keep their current active or supervision-lost semantics.

## Startup Timeout

Add `orchestrator.childStartupTimeoutMs` with a default of `60000`.

This timeout applies only before the parent sees startup acknowledgement:

- session id linkage,
- MCP progress,
- observed child progress metadata,
- session log evidence,
- recent worktree activity.

After any startup acknowledgement, supervision uses the existing `childNoProgressTimeoutMs` and `childMaxRuntimeMs` contracts.

## Duplicate Launch Recovery

Duplicate detection should still block active child conflicts, including active in-memory children and launch artifacts with live evidence. It should not block stale startup orphans.

When `DuplicateLaunchGuard` sees a matching launch artifact, it should classify it:

- Block as duplicate active launch when it is linked, recently progressing, recently started inside `childStartupTimeoutMs`, has recent worktree activity, or has another active signal.
- Ignore as stale startup when it is older than `childStartupTimeoutMs`, has no session id, no heartbeat/progress timestamp, no settled result, and no available worktree activity.

The retry path should record evidence that a stale launch artifact was ignored so operators can understand why a retry was safe.

## Tracker Claim Behavior

The parent claims a tracker row before startup. If startup fails before any usable child evidence exists, the parent can safely release the tracker claim to the prior eligible state because no child should be editing the worktree or tracker.

The release must be conservative:

- Only release when the launch is still in pre-ack startup state.
- Only release the owner written by this run.
- Restore the status from the claimed story's previous status.
- Do not release if a session id, progress, heartbeat, worktree activity, or settled result exists.

If release cannot be applied safely, the run should block with clear startup-failure evidence rather than overwriting possible child progress.

## Analyzer Behavior

Analyzer output should distinguish:

- linked active child,
- settled child,
- startup-pending child,
- startup-stale or startup-failed orphan,
- empty Codex thread shell when only diagnostic session metadata exists,
- supervision-lost child with possible live evidence.

Per-child details should expose startup evidence: launch age, startup timeout, session id presence, heartbeat/progress presence, result presence, worktree activity, diagnostic session candidates, and retry safety.

## Driver Limitations

Codex MCP currently reports thread linkage through progress events or final structured output. If an empty thread shell is created before either surface is available, workflow-kit cannot deterministically know that thread id at launch time. The implementation should persist early thread ids whenever the MCP progress object exposes one and should keep best-effort analyzer diagnostics for external session candidates. Prompt-hash and launch timestamp metadata remain the recovery correlation fallback.

## Acceptance Criteria

- Config schema, loader, presets, and human docs expose `orchestrator.childStartupTimeoutMs`.
- A child launch record is written as `requested` before startup acknowledgement, then becomes `launched` on session linkage or MCP progress.
- Startup timeout marks unacknowledged children `startup_failed`, removes them from active state, records `child-startup-failed`, and safely releases the tracker claim when possible.
- `runEligible` starts child handshakes serially until each child is acknowledged or startup-failed while keeping linked child execution parallel up to `maxParallel`.
- Duplicate launch detection ignores stale startup-orphan records after `childStartupTimeoutMs` and records retry-safety evidence.
- Analyzer classifies stale startup orphans separately from live active children and supervision-lost children.
- DLD02-style linked/settled launch behavior remains active/settled and still resets the no-progress timeout.
- Regression tests cover one linked child plus one startup orphan, duplicate retry after startup timeout, analyzer startup-stale output, and serialized startup acknowledgement.
- Canonical docs and mirrored plugin fixture surfaces are updated.
- A patch changeset records the runtime behavior change.
- Verification includes focused tests, `pnpm check`, `pnpm build`, `pnpm pack:dry-run`, and `pnpm smoke:codex-plugin` unless an external prerequisite blocks one of them.
