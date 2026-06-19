---
title: Pathway autopilot incident report
status: evidence
owner: codex
last-reviewed: 2026-06-18
related:
  - ../../../AGENTS.md
  - ../../../references/runtime-artifact-contract.md
  - ../../../packages/orchestrator/src/runner/ChildSupervisor.ts
  - ../../../packages/orchestrator/src/runner/RunJournal.ts
  - ../../../packages/orchestrator/src/commands/runSubscriptions.ts
  - ../../../packages/orchestrator/src/commands/handlerRuntimeUtils.ts
  - ../../../packages/orchestrator/src/drivers/codex-mcp/control.ts
  - ../../../packages/orchestrator/src/drivers/codex-mcp/toolInput.ts
---

# Pathway autopilot incident report

## Purpose

This report captures the observed behavior from a Pathway workflow-autopilot run so a new
development session can understand the incident without reading the original conversation. It is an
evidence packet, not a design proposal. It intentionally does not prescribe fixes.

The investigated parent session was:

```text
019edad2-20a9-7573-881b-776d003b3a3e
```

The run used the currently released installed agentic-workflow-kit plugin from the local Codex cache
and ran in:

```text
/Users/aryekogan/repos/pathway
```

All times below are UTC. Israel local time on 2026-06-18 was UTC+3.

## Executive summary

The POH01 story outcome was mostly correct: the run produced and merged a documentation/evidence PR
that kept POH01 blocked because protected Backend Release evidence was missing. The runtime path to
that result was not healthy.

The main runtime failures were:

- The detached subscription/watch path was not usable as live supervision.
- Child session linkage was recorded in events and transcript indexes but lost from launch artifacts.
- Live child reply/interrupt/control paths failed even when a child session id was known.
- Fresh worktree setup did not run before the child invoked `pnpm`, causing dependency hydration and
  sandboxed network failures.
- Spawned Codex children requested ungrantable escalation and then became stale.
- Operator-provided `run_story` sandbox and approval overrides did not take effect in the spawned
  child.
- Duplicate-active-launch cleanup required manual artifact edits.
- Manual out-of-band recovery completed the useful work but left WorkflowKit observability and state
  artifacts contradictory.
- Stale supervisor timers continued writing after abort/manual reconciliation.
- `analyze_run` did not flag the incident when evidence was already present.
- Nested spawned work was not represented as structured run telemetry.

## Relevant sessions and artifacts

### Parent Codex session

```text
Session id: 019edad2-20a9-7573-881b-776d003b3a3e
Session log: /Users/aryekogan/.codex/sessions/2026/06/18/rollout-2026-06-18T16-01-04-019edad2-20a9-7573-881b-776d003b3a3e.jsonl
cwd: /Users/aryekogan/repos/pathway
Codex Desktop CLI version: 0.140.0-alpha.19
```

The parent was invoked with `workflow-autopilot` and initially performed the expected dry-run and
inspection work: config status, tracker validation, eligible story selection, and a run preview. It
then launched POH01.

### First real run

```text
Run id: 2026-06-18T13-03-20-921Z
Run directory: /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-03-20-921Z
Command: run-eligible
Story: POH01
```

Important artifacts:

```text
events.ndjson
state.json
metrics.live.json
summary.json
children/POH01.launch.json
children/POH01.json
controls.ndjson
subscriptions/sub_fdb72761-fc0d-4caf-bbc1-c3418e54fe05.json
transcripts.json
```

First child:

```text
Session id: 019edad4-3a31-7eb3-ae0f-b96943d2a2eb
Session log: /Users/aryekogan/.codex/sessions/2026/06/18/rollout-2026-06-18T16-03-22-019edad4-3a31-7eb3-ae0f-b96943d2a2eb.jsonl
cwd: /Users/aryekogan/repos/pathway/.worktrees/poh01-production-release-recovery
Codex CLI version: 0.139.0
source: mcp
```

### Duplicate relaunch attempts

Two relaunch attempts failed before any child was launched:

```text
Run id: 2026-06-18T13-35-22-628Z
Status: blocked
Blocked reason: duplicate active launch for POH01

Run id: 2026-06-18T13-36-50-479Z
Status: blocked
Blocked reason: duplicate active launch for POH01
```

These were caused by stale active-launch state from the first run.

### Second real run

```text
Run id: 2026-06-18T13-37-43-654Z
Run directory: /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-37-43-654Z
Command: run-story
Story: POH01
```

Important artifacts:

```text
events.ndjson
state.json
metrics.live.json
summary.json
children/POH01.launch.json
subscriptions/sub_d95460e7-b02c-4e56-8b68-52ac579d0ef2.json
transcripts.json
```

Second child:

```text
Session id: 019edaf3-b407-7f20-a182-bda7645881c0
Session log: /Users/aryekogan/.codex/sessions/2026/06/18/rollout-2026-06-18T16-37-45-019edaf3-b407-7f20-a182-bda7645881c0.jsonl
cwd: /Users/aryekogan/repos/pathway/.worktrees/poh01-production-release-recovery
Codex CLI version: 0.139.0
source: mcp
```

### Resulting GitHub PR

```text
PR: https://github.com/aryeko/pathway/pull/121
Title: docs: record blocked production release recovery
Commit before merge: 486be3f8e99948f73e9bfa8fc0751920a21a52e8
Merge commit: a880388932194843212267447ca8961e70848c15
Merged at: 2026-06-18T14:19:58Z
Final tracker state: POH01 blocked
```

## Timeline

### Parent setup and launch

```text
13:01:04 parent session starts in /Users/aryekogan/repos/pathway
13:02:08 workflow_config_status runs
13:02:17 workflow_tracker_validate runs
13:02:20 list_eligible identifies POH01 as eligible
13:02:27 workflow_run_preview runs
13:02:36 run_eligible dry-run runs
13:03:20 run_eligible non-dry-run launches run 2026-06-18T13-03-20-921Z
13:03:23 child session 019edad4-3a31-7eb3-ae0f-b96943d2a2eb links in events
```

The first run's `events.ndjson` records `child-session-linked` at `13:03:23.345Z` with the actual
session id and session log path.

### First child stalls on dependency setup and escalation

```text
13:04:33 child starts pnpm run ops:backend-plan
13:05:03 pnpm is still running and reports many ENOTFOUND registry fetch failures
13:05:07 child states that DNS to npm is restricted and it will request network approval
13:05:10 child calls exec_command with sandbox_permissions=require_escalated
13:05:10 first child transcript effectively stops after that function call
```

The first child did not run Pathway's fresh-worktree setup script before invoking `pnpm`.
Pathway's `AGENTS.md` says:

```text
In a fresh worktree, run scripts/setup-worktree.sh.
```

The first child's escalation request was:

```text
sandbox_permissions: require_escalated
prefix_rule: ["pnpm","run","ops:backend-plan"]
```

No successful tool output followed that request.

### User requests subscription-based supervision

```text
13:04:36 user says: subscribe to events dont poll every sec
13:04:44 parent stops foreground watch/sleep approach
13:04:50 workflow_run_subscribe creates sub_fdb72761-fc0d-4caf-bbc1-c3418e54fe05
13:05:16 parent checks for the subscription wake artifact
13:05:26 parent polls subscription once
```

The parent discovered that `fswatch` was not installed, so it could not block on native filesystem
events. It fell back to coarse sleeps plus explicit `workflow_run_subscription_poll`.

The subscription artifact ended with:

```json
{
  "status": "closed",
  "terminal": true,
  "metrics": {
    "wakeCount": 3,
    "matchedEventCount": 2,
    "coalescedEventCount": 0,
    "deliveredEventCount": 0,
    "lastWakeCursor": "events.ndjson:55",
    "lastObservedCursor": "events.ndjson:55"
  }
}
```

The subscription was not usable as sufficient supervision:

- It did not produce a terminal or blocked event when the child was stuck behind ungrantable
  escalation.
- It woke on parent `child-supervisor-poll`, which is not child progress.
- It did not provide the control target needed for reply/interrupt recovery.

### Subscription says active while child is stale

At `13:31:35`, the parent called `workflow_run_subscription_poll` for the first run with
`ackCursor: events.ndjson:56`.

The result was:

```json
{
  "events": [],
  "committedCursor": "events.ndjson:56",
  "nextCursor": "events.ndjson:56",
  "terminal": false,
  "status": "active",
  "eventsDelivered": 0
}
```

Immediately afterward, the parent inspected the child session log and found it had last changed at
local time `Jun 18 16:05:10 2026`, which corresponds to `13:05:10Z`.

This means the subscription path reported no useful event while the child had been stale for about
26 minutes.

### Child control fails

At `13:32:01`, the parent attempted:

```text
workflow_child_reply by runPath + storyId
```

It failed:

```text
story POH01 does not have a linked Codex session
```

At `13:32:28`, the parent attempted direct `codex_reply` with the session id extracted from the log
filename:

```text
019edad4-3a31-7eb3-ae0f-b96943d2a2eb
```

The wrapper reported `ok: true`, but the raw tool result was an error:

```text
Failed to parse configuration for Codex tool: missing field `prompt`
```

At `13:32:41`, `workflow_child_reply` with the direct session id produced the same raw error shape.

At `13:32:49`, `workflow_child_interrupt` failed:

```text
Codex MCP control tool codex_interrupt is unavailable
```

This is a separate failure from the lost launch linkage. Even with the session id, direct live
control was unreliable.

### `analyze_run` misses the incident

At `13:33:08`, the parent called `analyze_run` on the first run.

The output included:

```json
{
  "status": "running",
  "derivedStatus": "running",
  "blockedReason": null,
  "issues": [],
  "children": [
    {
      "storyId": "POH01",
      "sessionId": null,
      "sessionLogPath": null,
      "linkageStatus": "unlinked",
      "status": "launched",
      "diagnosticSessionCandidates": [],
      "metricsStatus": "session_linkage_unavailable"
    }
  ]
}
```

At this point, the evidence already existed that:

- `events.ndjson` had a `child-session-linked` event.
- `transcripts.json` and metrics had a session log path.
- The child transcript had stopped after `sandbox_permissions=require_escalated`.
- The launch artifact had lost `sessionId` and `sessionLogPath`.

The analyzer did not surface those facts as issues.

### Abort and duplicate launch cleanup fail

At `13:34:18`, the parent attempted targeted abort on POH01. It returned:

```json
{
  "outcome": "unsupported",
  "childOutcomes": [
    {
      "storyId": "POH01",
      "sessionId": null,
      "outcome": "unsupported",
      "detail": "active child has no linked child session"
    }
  ]
}
```

At `13:35:54`, the parent attempted run-level abort. It returned the same unsupported child outcome.

The generated POH01 worktree was clean, so the parent manually removed it and deleted the branch.

The first relaunch attempt at `13:35:22` produced:

```text
duplicate active launch for POH01
```

The parent manually patched the first run's ignored `state.json` to mark the stale run blocked.

The second relaunch attempt at `13:36:50` still produced:

```text
duplicate active launch for POH01
```

The parent then manually patched the first run's `children/POH01.launch.json` status. Only after
that could a new run launch.

### Second run launches but profile override does not take effect

At `13:37:43`, the parent launched a new POH01 run:

```json
{
  "sandbox": "danger-full-access",
  "approvalPolicy": "never"
}
```

The second child session still started with developer instructions showing:

```text
sandbox_mode: workspace-write
Network access is restricted.
```

The second child repeated the same failure pattern:

```text
13:39:05 child starts pnpm run ops:backend-plan
13:40:16 command fails with fetch/dependency failure
13:40:20 child requests sandbox_permissions=require_escalated
```

Code inspection explains the observed override mismatch:

- `toOverrides` forwards `approvalPolicy` and `sandbox`.
- `loadResolvedConfig` puts those overrides onto `config.codex.childSession`.
- `buildCodexToolInput` chooses `profile.approvalPolicy` and `profile.sandbox` before
  `childSession.approvalPolicy` and `childSession.sandbox`.
- Pathway's configured `storyImplementer` profile was `approvalPolicy: on-request` and
  `sandbox: workspace-write`, so it shadowed the operator override.

Relevant files:

```text
packages/orchestrator/src/mcp/toolHelpers.ts
packages/orchestrator/src/config/configLoader.ts
packages/orchestrator/src/drivers/codex-mcp/toolInput.ts
```

### Parent prepares dependencies and resumes child out of band

At `13:51:51`, the parent verified that the parent environment could reach npm:

```text
curl -I --max-time 10 https://registry.npmjs.org/
HTTP/2 200
```

At `13:52:01`, the parent ran:

```text
scripts/setup-worktree.sh
```

in the POH01 worktree. It completed and installed/linked dependencies.

At `13:52:39`, the parent resumed the child directly:

```text
codex resume --no-alt-screen -s danger-full-access -a never 019edaf3-b407-7f20-a182-bda7645881c0 "<recovery prompt>"
```

This opened an interactive TUI in a dumb terminal, then entered YOLO mode after the parent confirmed
the prompt. This recovery was effective, but it was outside the orchestrator's normal control and
observability path.

### Useful POH01 work completes

After manual resume, the child produced:

```text
docs/tracks/platform-operations-hardening/README.md
docs/superpowers/specs/2026-06-18-poh01-production-release-recovery.md
docs/superpowers/plans/2026-06-18-poh01-production-release-recovery.md
docs/qa/2026-06-18-poh01-production-release-recovery.md
```

The child committed:

```text
486be3f8e99948f73e9bfa8fc0751920a21a52e8
```

and opened:

```text
https://github.com/aryeko/pathway/pull/121
```

Evidence from the child final:

- POH01 tracker status stayed `blocked`.
- `pnpm run ops:backend-plan -- --base 4111970e78907afbb03a5e36306046035de06060 --head 7cf7b56f312e7d83929fc5b058c893a224a158d9 --format json` passed and reported
  `requiresProtectedBackendRelease: true` and `requiresMigration: true`.
- Commit `7cf7b56f312e7d83929fc5b058c893a224a158d9` had no `backend-release/production` status.
- Backend Release workflow history API returned `[]`.
- `pnpm run ops:backend-status` failed because the worktree was not production Supabase-linked.
- `prettier --check` passed for touched docs.
- `git diff --check origin/main...HEAD` passed.
- Pre-push `tsc -b` passed.
- Pre-push `vitest run` passed: 129 test files, 639 tests passed, 2 skipped.
- `gh pr checks 121 --watch --fail-fast` passed.
- `chatgpt-codex-connector[bot]` left a `THUMBS_UP` reaction.
- No bot PR comments, review comments, or review threads were present.
- One pre-PR subagent Markdown table finding was fixed.

The child final explicitly said it did not merge the PR or delete the branch.

### Parent merges and manually reconciles run state

At `14:19:55`, the parent ran:

```text
gh pr merge 121 --squash --subject "docs: record blocked production release recovery"
```

At `14:19:58`, GitHub recorded the merge:

```text
Merge commit: a880388932194843212267447ca8961e70848c15
```

At `14:20:14`, the parent interrupted the child TUI.

At `14:21:04`, the parent manually patched the second run's local ignored artifacts:

```text
/Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-37-43-654Z/state.json
/Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-37-43-654Z/children/POH01.launch.json
```

The final intended run state was:

```text
status: blocked
blockedReason: POH01 merged documentation/tracker evidence as blocked: protected Backend Release evidence is still missing for the 4111970e..7cf7b56 backend-sensitive target range.
```

The parent fast-forwarded Pathway `main`, removed the generated POH01 worktree, deleted the local
branch, and verified `main` was clean.

## Runtime issues observed

### 1. Detached subscription was not an end-to-end watch replacement

The parent used `workflow_run_subscribe`, but could not actually wait on the wake file because
`fswatch` was not installed. It fell back to sleep plus `workflow_run_subscription_poll`. From an
operator perspective this was still manual polling, only at a coarser interval.

The subscription API did not provide a blocking wait primitive that the parent could use directly.

### 2. Subscription did not report the stuck child

The first child stopped after requesting escalation at `13:05:10`. Subscription poll at `13:31:35`
still reported:

```text
terminal: false
status: active
events: []
```

No subscription event conveyed:

- Child transcript has not advanced.
- Last real child progress is stale.
- Last child action was ungrantable escalation.
- Launch metadata and transcript metadata disagree.

### 3. Subscription wake signal included parent polls

The first subscription woke at `13:25:53` on `child-supervisor-poll`. The second subscription woke at
`14:00:18` on `child-supervisor-poll`.

The runtime contract says parent supervisor polls are not child progress. The subscription wake did
not make that distinction useful to the operator.

### 4. Subscription delivery metrics were confusing

The first subscription ended with:

```text
matchedEventCount: 2
deliveredEventCount: 0
```

The parent had consumed some subscription events during the run, but the artifact did not give a
clear operator-facing explanation of what was seen, what was acknowledged, and what remained.

### 5. Closing the subscription did not stop stale runtime writes

First run subscription closed at `13:34:25`, but the first run still recorded:

```text
13:48:23 child-supervisor-poll
14:10:53 child-supervisor-poll
14:33:23 child-supervisor-poll
14:35:44 parent_takeover_blocked
14:35:44 child-supervision-lost
14:35:44 child-error
14:35:44 run-supervision-lost
```

The run was already abandoned and its generated worktree had been removed. The stale supervisor later
mutated the first run's state to `supervision_lost` with `child-no-progress-timeout`, overwriting the
operator's earlier manual recovery reason.

### 6. Child session linkage was non-monotonic

Both real runs had `child-session-linked` events with session ids and session log paths, and
`transcripts.json` later had session log paths. The corresponding launch artifacts ended with:

```json
{
  "sessionId": null,
  "sessionLogPath": null
}
```

Code surfaces implicated by this artifact pattern:

```text
packages/orchestrator/src/runner/RunJournal.ts
packages/orchestrator/src/runner/ChildSupervisor.ts
```

`RunJournal.updateChildLaunch` writes:

```ts
const updated = { ...record, ...fields, updatedAt: this.dependencies.clock.now() };
```

It does not merge with the current artifact on disk and does not preserve known non-null linkage.

`ChildSupervisor` writes launch records from several paths: startup acknowledgement, progress,
supervisor poll, settling, and supervision-lost. Stale in-memory `launch.record` data can therefore
rewrite the artifact after a link was known.

### 7. Control path used only the broken launch artifact

Run/story targeted control paths read `children/<story>.launch.json` for `sessionId`.

When that artifact had null linkage, control failed even though other artifacts had enough evidence
to identify the session.

Observed failures:

```text
workflow_child_reply by runPath/storyId: story POH01 does not have a linked Codex session
workflow_run_control abort: active child has no linked child session
```

Relevant code:

```text
packages/orchestrator/src/commands/handlerRuntimeUtils.ts
packages/orchestrator/src/drivers/codex-mcp/control.ts
```

### 8. Direct control API reported success around a raw error

Direct `codex_reply` and `workflow_child_reply` with explicit session id returned top-level `ok:
true`, but raw output contained:

```text
Failed to parse configuration for Codex tool: missing field `prompt`
```

This made control status ambiguous: the wrapper appeared successful, while the underlying Codex
control action did not accept the payload.

### 9. Interrupt control was unavailable

Direct `workflow_child_interrupt` with explicit session id failed with:

```text
Codex MCP control tool codex_interrupt is unavailable
```

The operator could not reliably reply to or interrupt the child through the MCP control surface.

### 10. Fresh worktree setup did not run before child `pnpm`

Pathway repo instructions require:

```text
scripts/setup-worktree.sh
```

in a fresh worktree. Both children invoked `pnpm run ops:backend-plan` first. `pnpm` attempted to
hydrate dependencies and hit sandboxed network failures.

### 11. Child escalation requests were ungrantable in practice

The spawned MCP children were given instructions telling them to request escalation with
`sandbox_permissions=require_escalated` when sandbox/network failures occur.

In practice, this approval path was not grantable through the released autopilot supervision flow.
The first child stopped after making the escalation request. The second repeated the request until
the parent recovered out of band.

### 12. `run_story` launch overrides were shadowed by profile values

The parent called `run_story` with:

```json
{
  "sandbox": "danger-full-access",
  "approvalPolicy": "never"
}
```

The spawned child still showed:

```text
sandbox_mode: workspace-write
Network access is restricted.
```

Code path:

```text
packages/orchestrator/src/mcp/toolHelpers.ts forwards overrides.
packages/orchestrator/src/config/configLoader.ts applies overrides to childSession.
packages/orchestrator/src/drivers/codex-mcp/toolInput.ts prefers profile.approvalPolicy/profile.sandbox over childSession values.
```

Pathway's storyImplementer profile had `approvalPolicy: on-request` and `sandbox: workspace-write`,
so it shadowed the operator override.

### 13. Duplicate-active-launch state could not be cleared by public controls

After targeted and run-level abort both returned unsupported, two relaunch attempts failed with:

```text
duplicate active launch for POH01
```

The parent had to edit ignored run artifacts manually:

- First, `state.json`.
- Then, `children/POH01.launch.json`.

Only after both stale markers were changed could the second real run launch.

### 14. Manual recovery bypassed orchestration

The parent recovered by:

1. Installing worktree dependencies from the parent with `scripts/setup-worktree.sh`.
2. Resuming the child directly with the Codex CLI:

```text
codex resume --no-alt-screen -s danger-full-access -a never 019edaf3-b407-7f20-a182-bda7645881c0 "<recovery prompt>"
```

This allowed useful story work to finish, but it was outside the orchestrator's normal child turn,
reply, interrupt, subscription, and result-settlement paths.

### 15. Final run artifacts disagreed

After parent reconciliation, the second run had:

```text
state.json: status blocked, active []
summary.json: status running, activeStoryIds ["POH01"]
metrics.live.json: status running, active ["POH01"]
children/POH01.launch.json: status launched
```

`workflow_run_status` returned top-level blocked state but nested metrics still said running.

### 16. Recovery guard failed after cleanup

The first run eventually emitted:

```text
parent_takeover_blocked
evidence: recovery guard could not inspect child evidence: spawn git ENOENT
```

This happened after the run had been abandoned and the generated worktree removed.

### 17. `analyze_run` did not correlate available evidence

For the first run, `analyze_run` said `issues: []` even though available artifacts showed:

- `events.ndjson` had `child-session-linked`.
- `launch.json` lost the session link.
- `metrics.live.json` had a session log path.
- `transcripts.json` had a session log path.
- The transcript stopped after `require_escalated`.
- The subscription still reported active.

The analyzer did not identify any issue or diagnostic candidate.

### 18. Nested spawned work was not structured in run telemetry

The second child used `spawn_agent` for pre-PR review. The run's `subagentCounts` remained:

```json
{}
```

with unavailable reason:

```text
session log metrics are unavailable
```

The pre-PR review finding is only discoverable by reading transcript text, not through structured
run artifacts.

### 19. Merge policy was operationally ambiguous

The child final said:

```text
I did not merge the PR or delete the branch.
```

The parent then merged PR #121 and reconciled the story as blocked.

The final outcome is coherent if the intended policy is "merge evidence-only blocker PRs while
leaving the tracker story blocked". The incident shows that this policy was applied by the parent
operator, not surfaced as an explicit run policy in the child/orchestrator result.

## POH01 story outcome

The useful story-level result was:

- PR #121 merged a blocked evidence record.
- POH01 remained blocked in the tracker.
- The blocker was real: the target backend-sensitive range still lacked protected Backend Release
  evidence.
- The merged PR did not claim production recovery was complete.
- Local Pathway main ended clean and fast-forwarded to the merge commit.
- Generated POH01 worktree and local branch were removed.

The runtime should not be judged by the successful final merge alone. Most of the successful work
depended on manual operator recovery outside the released autopilot path.

## Code reference map

These are code areas directly implicated by observed behavior. This section does not prescribe
changes.

### Launch artifact linkage

```text
packages/orchestrator/src/runner/RunJournal.ts
packages/orchestrator/src/runner/ChildSupervisor.ts
```

Observed behavior:

- `child-session-linked` event exists.
- `transcripts.json` has the session log path.
- `children/POH01.launch.json` has null linkage.

### Subscription and wake behavior

```text
packages/orchestrator/src/commands/runSubscriptions.ts
packages/orchestrator/src/commands/handlers.ts
packages/orchestrator/src/commands/handlerRuntimeUtils.ts
```

Observed behavior:

- Subscription poll reported active while child was stale.
- Wakes included parent supervisor polls.
- Wake artifact was not usable without external file-watch tooling.
- Closing subscription did not stop stale supervisor writes.

### Run/story control

```text
packages/orchestrator/src/commands/handlerRuntimeUtils.ts
packages/orchestrator/src/drivers/codex-mcp/control.ts
```

Observed behavior:

- Run/story targeted control failed when launch JSON lost session id.
- Direct reply returned wrapper success around raw tool error.
- Interrupt tool was unavailable.

### Codex child launch input

```text
packages/orchestrator/src/mcp/toolHelpers.ts
packages/orchestrator/src/config/configLoader.ts
packages/orchestrator/src/drivers/codex-mcp/toolInput.ts
```

Observed behavior:

- Operator `approvalPolicy` and `sandbox` overrides were accepted by schema/tool call.
- Spawned child did not receive those effective permissions.

### Analyzer and report

```text
packages/orchestrator/src/analysis/runAnalyzer.ts
packages/orchestrator/src/analysis/runAnalyzerChildren.ts
packages/orchestrator/src/analysis/runReport.ts
```

Observed behavior:

- Analyzer did not flag lost linkage, stale child, or ungrantable escalation.
- Analyzer did not identify diagnostic session candidates from metrics/transcripts/events.

### Duplicate active launch and recovery guard

```text
packages/orchestrator/src/runner/DuplicateLaunchGuard.ts
packages/orchestrator/src/runner/RecoveryGuard.ts
packages/orchestrator/src/runner/ChildSupervisor.ts
```

Observed behavior:

- Duplicate guard blocked relaunch after public abort controls failed.
- Recovery guard later failed with `spawn git ENOENT` after cleanup.

## Artifact consistency observations

### First run final artifact state

At the end of investigation, first run artifacts had converged to:

```text
state.json: status supervision_lost
summary.json: status supervision_lost
metrics.live.json: status supervision_lost
children/POH01.launch.json: status supervision_lost
children/POH01.json: error child-no-progress-timeout
```

This was not the state immediately after manual operator recovery. Stale supervisor activity later
rewrote the first run to `supervision_lost`.

### Second run final artifact state

At the end of investigation, second run artifacts included:

```text
state.json: blocked
summary.json: running
metrics.live.json: running
children/POH01.launch.json: launched
```

This contradiction is expected from the manual out-of-band recovery path, but it makes the run
artifact directory unreliable for a new operator without external context.

## Evidence commands for a new session

These commands reproduce the core evidence from local artifacts.

```bash
jq -r '[.recordedAt,.type,(.storyId//""),(.eventType//""),(.error//""),(.outcome//""),(.reason//"")] | @tsv' \
  /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-03-20-921Z/events.ndjson
```

```bash
jq '.' \
  /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-03-20-921Z/state.json \
  /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-03-20-921Z/children/POH01.launch.json \
  /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-03-20-921Z/transcripts.json
```

```bash
jq '.' \
  /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-37-43-654Z/state.json \
  /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-37-43-654Z/summary.json \
  /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-37-43-654Z/metrics.live.json \
  /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-37-43-654Z/children/POH01.launch.json
```

```bash
rg -n 'require_escalated|ENOTFOUND|sandbox_permissions|ops:backend-plan' \
  /Users/aryekogan/.codex/sessions/2026/06/18/rollout-2026-06-18T16-03-22-019edad4-3a31-7eb3-ae0f-b96943d2a2eb.jsonl \
  /Users/aryekogan/.codex/sessions/2026/06/18/rollout-2026-06-18T16-37-45-019edaf3-b407-7f20-a182-bda7645881c0.jsonl
```

```bash
rg -n 'workflow_run_subscribe|workflow_run_subscription_poll|workflow_child_reply|codex_reply|workflow_child_interrupt|workflow_run_control|run_story|codex resume' \
  /Users/aryekogan/.codex/sessions/2026/06/18/rollout-2026-06-18T16-01-04-019edad2-20a9-7573-881b-776d003b3a3e.jsonl
```

```bash
jq -r 'select(.type=="response_item") | .payload as $p | select($p.type=="function_call") | select(($p.arguments|tostring) | test("require_escalated|ops:backend-plan|spawn_agent")) | [.timestamp,$p.name,$p.call_id,($p.arguments|tostring)] | @tsv' \
  /Users/aryekogan/.codex/sessions/2026/06/18/rollout-2026-06-18T16-37-45-019edaf3-b407-7f20-a182-bda7645881c0.jsonl
```

## Data gaps

The following information was not available as structured runtime evidence:

- A reliable structured record of nested `spawn_agent` children.
- A structured event saying the child had requested ungrantable escalation.
- A structured result for the child after manual `codex resume`.
- A single authoritative final status snapshot reconciling state, summary, metrics, launch, and
  transcript data.
- A reliable live-control success/failure signal distinct from raw Codex tool content.
- An explicit policy marker indicating whether the parent intended to merge a blocker-evidence PR
  while keeping the story blocked.

## Non-goals for this report

This report does not:

- Propose an implementation plan.
- Decide which observed failure should be fixed first.
- Define a new runtime architecture.
- Modify the Pathway run artifacts.
- Re-open or alter PR #121.
- Claim POH01 is complete. POH01 remains blocked by missing protected Backend Release evidence.

