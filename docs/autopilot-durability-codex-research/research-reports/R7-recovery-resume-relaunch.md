# R7 - Recovery, Resume, and Relaunch

## Executive Recommendation

Adopt an evidence-classified recovery state machine with fenced recovery authority: resume the same child only
through a kit-owned live handle or kit-spawned resumed process; relaunch only after the prior child is proven
dead/reaped and branch/worktree/PR/claim state is safe; treat human-started `codex resume`, Desktop/App sessions,
unknown worktrees, ambiguous branch/PR state, and stale leases as observe-only or operator-required. Confidence:
medium-high for the safety semantics, medium for exact Codex resume/app-server implementation details because
those remain driver- and version-sensitive.

## Sources Checked

- `docs/autopilot-durability-codex-research/README.md`, checked 2026-06-18; charter and required report
  format.
- `docs/autopilot-durability/README.md`, checked 2026-06-18; incident context, safety/recoverability goal, and
  design spine summary.
- `docs/autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md`, checked 2026-06-18; failure
  themes A-K, especially D/E/F/G/H/K.
- `docs/autopilot-durability/design/00-overview.md`, checked 2026-06-18; capability gates, ownership classes,
  event log, and recovery authority invariant.
- `docs/autopilot-durability/design/02-lifecycle-and-control-plane.md`, checked 2026-06-18; owned process
  definition, resume ownership draft, linkage, and killability.
- `docs/autopilot-durability/design/04-run-state-and-recovery.md`, checked 2026-06-18; current draft recovery
  stage, duplicate-launch clearing, and worktree-gone state.
- `docs/autopilot-durability-codex-research/research-reports/R1-codex-runtime-control.md`, checked 2026-06-18; Codex
  runtime findings, especially `codex resume`, app-server `thread/resume`, `turn/interrupt`, and observe-only
  classification.
- `docs/autopilot-durability-codex-research/research-reports/R2-process-ownership-termination.md`, checked 2026-06-18;
  process containment, termination ladder, descendant proof, and parent-crash recovery.
- `docs/autopilot-durability-codex-research/research-reports/R5-event-sourced-run-state.md`, checked 2026-06-18;
  append-only event store, single writer, sequence numbers, writer epochs, terminal fencing, and projection
  invariants.
- `docs/autopilot-durability-codex-research/research-reports/R6-worker-supervision-liveness.md`, checked 2026-06-18;
  child-originated progress, idle/no-progress timers, wait cursor, and restart semantics.
- `docs/autopilot-durability-codex-research/research-reports/R12-coordination-concurrency.md`, checked 2026-06-18;
  resource leases, story launch lease, tracker authority, stale lease recovery, and fencing.
- `packages/orchestrator/src/runner/RecoveryGuard.ts`, checked 2026-06-18; current recovery guard only returns
  `safe_to_take_over` or `manual_recovery_required` from session/git/PR/tracker evidence.
- `packages/orchestrator/src/runner/DuplicateLaunchGuard.ts`, checked 2026-06-18; current stale startup launch
  ignoring behavior.
- `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`, checked 2026-06-18; current MCP
  `resumeStory` uses a reply tool on a new client rather than owning a resumed OS process.
- OpenAI Codex CLI command reference, <https://developers.openai.com/codex/cli/reference>, checked 2026-06-18;
  documents stable `codex resume`, session id behavior, inherited global flags, and `codex mcp-server`.
- OpenAI Codex app-server docs, <https://developers.openai.com/codex/app-server>, checked 2026-06-18; documents
  `thread/resume`, active turn steering, streamed events, and `turn/interrupt`.
- OpenAI Codex approvals/security docs, <https://developers.openai.com/codex/agent-approvals-security>,
  checked 2026-06-18; documents sandbox, approval, network, and risk controls.
- OpenAI Codex sandboxing docs, <https://developers.openai.com/codex/concepts/sandboxing>, checked 2026-06-18;
  documents that sandboxing and approvals are separate controls.
- Temporal Activity failure detection docs, <https://docs.temporal.io/encyclopedia/detecting-activity-failures>,
  checked 2026-06-18; established pattern for heartbeats carrying progress, timeout-driven retry/recovery, and
  cancellation delivery.
- Kubernetes Leases docs, <https://kubernetes.io/docs/concepts/architecture/leases/>, checked 2026-06-18;
  established lease pattern for shared resource coordination, heartbeats, leader election, and holder identity.
- Git worktree docs, <https://git-scm.com/docs/git-worktree>, checked 2026-06-18; authoritative behavior for
  missing, moved, pruned, repaired, and branch-bound worktrees.
- GitHub REST pull request docs, <https://docs.github.com/en/rest/pulls/pulls>, checked 2026-06-18; PR head
  SHA, merge, update-branch, and merged-state evidence.

## Findings

Facts from primary/current sources:

- OpenAI documents `codex resume` as a stable CLI command that continues an interactive session by id or resumes
  the most recent conversation. It accepts the same global flags as `codex`, including model and sandbox
  overrides.
- OpenAI app-server docs expose a more automation-shaped continuation path: `thread/resume` reopens an existing
  thread so later `turn/start` calls append to it; `thread/read` can inspect stored thread state without loading
  or resuming it; `turn/steer` requires the active `turnId`; `turn/interrupt` requests cancellation of an
  in-flight turn and completes it as interrupted on success.
- OpenAI docs separate sandbox boundaries from approval policy. Network access is off by default in local
  workspace-write mode; Codex can request approval to cross boundaries, and network policy can constrain allowed
  destinations.
- R1 found that `codex resume` can be kit-owned only when the kit itself spawns the resumed process or controls
  the app-server connection for the resumed thread/turn. A session id alone is not a live control handle. A
  human-run TUI/Desktop/App resume is observe-only for the kit.
- R1 also found that the current MCP "control" path starts a separate server and should not be treated as a
  supported live interrupt channel to the active child.
- R2 found that termination safety requires a containment handle for the process tree, not only an immediate
  pid. Safe recovery after timeout, process death, or parent crash requires either proving the containment is
  empty or stopping in `termination-unverified`/operator-required.
- R5 found that recovery state must be reconstructed from a contiguous, fenced event log. `state`, `launch`,
  `metrics`, and `summary` are projections; stale writer events after terminal/supersession must be rejected.
- R6 found that stale detection must use child-originated progress/heartbeat/tool/approval/terminal events.
  Parent polling, watch reconnects, projection reads, and status commands cannot reset progress timers.
- R12 found that lease expiry alone must not authorize duplicate launch. Recovery must consider run-writer lease,
  story-launch lease, tracker claim, live child evidence, branch/worktree/PR state, and writer epoch fencing.
- Git worktree docs explicitly support detecting listed worktrees, pruning missing worktree metadata, and
  repairing moved worktrees. Missing or moved worktrees are normal Git states, not exceptions.
- GitHub PR docs support exact-head safety checks: merge accepts a `sha` that the PR head must match, returning
  conflict if it does not; update-branch accepts `expected_head_sha`.
- Current workflow-kit has a narrow `RecoveryGuard`: it classifies a stale/no-session, no-remote-branch,
  no-child-commit, clean-worktree, no-active-PR, not-complete-on-base case as `safe_to_take_over`; almost
  everything else becomes `manual_recovery_required`.

Interpretation for workflow-kit:

- Recovery is not one operation. It is a classification stage followed by a small set of permitted actions:
  observe, resume, terminate, relaunch, reconcile, clear claim/lease, or require operator.
- `codex resume` should not be modeled as "attach to the old process." It reconstructs or continues a stored
  conversation. The kit gets control only over the new process/connection it starts for that continuation.
- Resuming a session and relaunching a story are different safety classes. Resume preserves conversation
  context but may continue stale assumptions; relaunch gives a clean prompt but can duplicate work or trample
  unmerged changes. Both require independent branch/worktree/PR and claim checks.
- Human intervention must be observed, not overwritten. If a human manually edits the worktree, pushes a branch,
  opens/merges/closes a PR, changes tracker state, or runs `codex resume`, the kit should append observed
  evidence and reclassify. It should not clear claims, relaunch, or merge over that state automatically.
- Missing worktree is not automatically safe. It may mean successful cleanup after merge, manual deletion of
  useful unpushed work, moved worktree metadata that needs repair, or an orphaned branch/PR. It must be resolved
  through Git evidence.

## Options

### Option A - Conservative observe-and-handoff recovery

On stall/crash/lost session, rebuild projections, inspect process/lease/tracker/git/PR evidence, and stop with
operator instructions unless the run is already terminal or trivially empty.

Enables:

- Strong safety with minimal new control surface.
- Avoids duplicate work, branch clobber, and accidental claim clearing.
- Useful first migration path for legacy 0.7.0 artifacts.

Cannot do:

- Does not restore autonomous delivery after common transient failures.
- Leaves useful kit-owned resume/relaunch capability unused.
- Keeps human recovery outside the main happy path.

### Option B - Resume-first recovery

Prefer continuing the linked session through app-server `thread/resume` or kit-spawned `codex resume`/`codex
exec resume` whenever a session id exists, then ask the child to reconcile and continue.

Enables:

- Preserves context and reduces duplicate planning/editing.
- Matches the successful Pathway manual recovery pattern when a session id is known.
- Can be safe for parked approvals and pre-PR review resumes if the kit owns the resumed process.

Cannot do:

- A session id does not prove no live child is still running.
- It cannot take over a human-run TUI/Desktop/App process.
- It can continue stale assumptions if branch, worktree, PR, base, or tracker state changed while the session
  was down.
- Current MCP reply-based resume does not supply process-tree ownership or a guaranteed live control handle.

### Option C - Terminate-then-relaunch recovery

On no-progress, supervision loss, or crashed parent restart, terminate any owned prior child, verify the tree is
empty, rebuild/claim state, then start a new child attempt from current tracker and Git evidence.

Enables:

- Clear process ownership and simple duplicate-prevention story.
- Avoids continuing a possibly confused session.
- Useful when no session id exists, session resume is unsupported, or the prior conversation is not trusted.

Cannot do:

- Can lose useful uncommitted/unpushed work unless worktree evidence is preserved and handed to the new child.
- Can duplicate already-pushed PR work unless branch/PR exact-head state is inspected first.
- Unsafe if termination proof is missing, the worktree is dirty, the PR is open/merged, or tracker ownership is
  ambiguous.

### Option D - Evidence-classified hybrid state machine

Classify recovery from the event log and inspectors, then select the narrowest safe action: same-handle resume,
kit-owned resume process, terminate-and-relaunch, observe-only, claim/lease clear, or operator-required.

Enables:

- Uses the strongest safe action per state rather than one global policy.
- Incorporates R1/R2/R5/R6/R12 without assuming unsupported runtime control.
- Makes every recovery decision auditable and replayable.
- Degrades safely for legacy or unknown runs.

Cannot do:

- More complex to implement and test.
- Requires driver capability probing and rich evidence inspectors.
- Still needs product decisions for which safe classes may auto-recover by default.

## Recommendation

Choose Option D: an evidence-classified hybrid recovery state machine.

The recovery command should be a fenced state transition, not a best-effort helper. It should:

1. Acquire recovery authority: run-writer lease plus story-launch lease or explicit operator takeover. Append
   `recovery-requested` with actor, reason, previous projection `{throughSeq, throughHash}`, and targeted
   story/launch/session.
2. Rebuild projections from the valid event-log prefix. Reject or park on log corruption, sequence gaps, stale
   writer events affecting the target story, or non-tail malformed events.
3. Inspect liveness from R6 evidence: last child-originated event, active approval, active tool, process
   containment, connection state, and terminal state. Parent polls do not count.
4. Inspect process ownership from R2 evidence: owned/unowned, containment id, root pid/start time, process group
   or stronger containment, and empty-tree proof.
5. Inspect coordination from R12 evidence: run-writer holder, story-launch holder, tracker row owner/status,
   lease epochs, and stale-threshold evidence. Expiry alone is never enough.
6. Inspect Git/worktree evidence: expected worktree exists/listed/missing/moved, branch exists locally/remotely,
   branch head SHA, uncommitted changes, diff against base, base freshness, and whether Git metadata needs
   `worktree repair` or `prune`.
7. Inspect PR/review/CI evidence: no PR, open PR, merged PR, closed PR, exact head SHA, base branch, CI/review
   status, unresolved review threads, and whether the PR head matches branch/worktree evidence.
8. Emit `recovery-classified` with a typed state and recommended action. Only then perform an action, and record
   `recovery-action-started` / `recovery-action-completed` / `recovery-action-blocked`.

Recommended recovery states:

| State | Meaning | Default action |
|---|---|---|
| `awaiting-approval` | Live or parked child requested approval and request is persisted | Resume same handle after decision; no relaunch |
| `approval-decision-not-consumed` | Decision recorded but no child event after SLA | Operator unless same live handle can be interrupted/terminated |
| `child-progress-stalled-owned` | Owned child has no real progress beyond timeout | Terminate/reap; then classify for resume/relaunch |
| `child-progress-stalled-unowned` | Unowned child/session appears stale | Observe-only/operator |
| `process-dead-session-resumable` | No live child; linked session id/thread id exists; state coherent | Kit-spawned resume if Git/PR/claim checks pass |
| `process-dead-no-session` | No live child and no usable session id | Relaunch only if branch/worktree/PR/claim are empty or safely reusable |
| `termination-unverified` | Kill attempted but descendants or containment proof remain uncertain | Operator-required; forbidden to clear claim/relaunch/merge |
| `worktree-dirty` | Worktree has uncommitted changes | Operator or kit-owned resume with explicit evidence handoff; no blind relaunch |
| `worktree-gone` | Expected worktree path missing or Git metadata dangling | Inspect branch/PR first; operator unless no work/PR/claim exists |
| `branch-pr-exists` | Branch or PR has durable work | Observe/update/verify; no duplicate launch without exact-head plan |
| `manual-intervention-observed` | Human changed tracker/branch/PR/worktree or ran a session | Observe-only until operator chooses takeover |
| `claim-without-launch` | Tracker claim exists but no child launch evidence | Auto-clear only if owner/run matches and no branch/worktree/PR work exists |
| `orphan-launch-reservation` | Launch lease exists without matching tracker claim | Auto-clear only if never spawned and no evidence of work |
| `already-merged` | PR merged or tracker complete on base | Reconcile/close run; do not resume/relaunch |
| `log-corrupt` | Event log cannot produce coherent projection | Operator-required |

Recovery action safety classification:

| Action | Safety class | Required evidence |
|---|---|---|
| Rebuild projections from event log | auto-safe | Valid contiguous prefix; no mutation except generated projections |
| Read session logs, Git state, PR state, leases, tracker | auto-safe | Read-only inspectors; unavailable evidence recorded as unknown |
| Append `recovery-classified` | auto-safe | Current writer lease and coherent projection |
| Resume live awaiting approval on same protocol handle | auto-safe | Same owned handle, persisted request, scoped decision, active turn/request id |
| Kit-spawned app-server `thread/resume` + `turn/start` | auto-safe only for listed safe states | No live prior child or prior child terminated/reaped; session/thread id linked; writer/story leases held; Git/PR/tracker state matches expected story |
| Kit-spawned `codex exec resume` / CLI resume process | auto-safe only if non-interactive and owned | Same as above, plus process containment handle and no interactive TUI dependency |
| Terminate owned stale child | auto-safe if policy allows stale cleanup | Owned containment identity verified; pid start time/containment matches; timeout state from child progress; termination outcome recorded |
| Relaunch from clean state | auto-safe only for empty/no-work states | No live child, prior containment empty, worktree clean or absent, no branch/PR work, tracker not complete, story-launch lease held |
| Clear stale launch reservation | auto-safe only for never-spawned reservation | Lease expired, no pid/session/progress/worktree/branch/PR evidence, writer fenced |
| Release tracker claim | auto-safe only for same-run empty claim | Claim owner/run matches, no durable work, no live child, event recorded |
| Reconcile already-merged story | auto-safe after inspection | Merged PR exact SHA or tracker complete on base; no active child |
| Resume dirty worktree | operator-required by default | Human or policy chooses continuation; child receives diff/branch/PR evidence |
| Relaunch over existing branch/PR | operator-required | Exact branch/PR head plan, no duplicate live child, replayed evidence |
| Delete/prune/repair missing worktree metadata | operator-required by default | Git `worktree list`/branch/PR evidence; destructive cleanup not inferred |
| Adopt human-run `codex resume` result | observe-only | Record logs/branch/PR/tracker changes; do not claim control |
| Desktop/App session recovery | observe-only | No kit-owned process/control handle |
| Clear claim when PR is open/merged/closed | operator-required | PR outcome decides reconciliation path |
| Relaunch while prior child may be alive | forbidden | Duplicate work and unsafe side effects |
| Clear claim after `termination-unverified` | forbidden | Could hide surviving worker |
| Auto-merge from recovered state without exact-head CI/review evidence | forbidden | Violates evidence authority |
| Treat lease expiry alone as safe takeover | forbidden | Stale holder may still be running |
| Treat child prose as recovery authority | forbidden | Recovery uses evidence only |
| Mutate `state.json`/`launch.json` by hand or tool | forbidden in vNext | Append reconciliation/recovery events instead |

Precise `codex resume` semantics:

- Kit-owned:
  - The kit starts the resumed execution as a child process or app-server connection.
  - The kit records the process containment handle or app-server thread/turn identifiers.
  - The resumed process is under the same writer/story lease epoch, or a new epoch with the old writer fenced.
  - The previous live child is absent, or owned and terminated/reaped before the resumed turn begins.
  - Sandbox/approval/network overrides are explicit in the launch event and checked against policy.
  - The run advertises only the capabilities actually present: app-server may support `turn/interrupt`; CLI
    resume may only support hard process kill plus streamed/final output.
- Observe-only:
  - A human runs `codex resume` in a terminal/TUI.
  - A Codex Desktop/App session is resumed outside the kit.
  - The kit discovers a session id or rollout file but has no live process, app-server connection, turn id,
    process containment handle, or writer lease authority.
  - The kit can read logs and inspect resulting Git/PR/tracker state, but cannot claim kill, interrupt, approval
    delivery, or auto-recover authority.
- What resume can unlock:
  - Conversation continuity after a dead process when no duplicate live child exists.
  - Parked pre-PR review, approval decision follow-up, or verification continuation if the child can consume the
    next turn.
  - Safer continuation of a dirty worktree than a clean relaunch, when an operator approves or the safe-state
    predicate is strong enough.
- What resume cannot unlock:
  - It cannot prove the old process is dead.
  - It cannot make an unowned session killable.
  - It cannot bypass branch/PR/CI/review gates.
  - It cannot clear stale claims or launch leases without event/log/lease evidence.
  - It cannot authorize duplicate concurrent work on the same story.

## Tradeoffs and Risks

- Safety vs autonomy: the recommended default will stop often at first. That is intentional; vNext should earn
  automatic recovery only through explicit safe classes.
- Complexity: a typed recovery state machine touches driver, process containment, event store, leases, tracker
  claims, Git inspectors, and PR inspectors. The benefit is eliminating manual artifact edits and blind
  relaunches.
- Resume staleness: resumed conversations may rely on old assumptions. Every resumed turn should include a
  current evidence packet: branch/head/base, PR state, tracker row, verification status, pending blockers, and
  the exact requested next action.
- Dirty worktree ambiguity: a dirty worktree may contain valuable child work or human edits. Automatic cleanup or
  relaunch would be dangerous. Prefer kit-owned resume or operator handoff.
- Parent crash ambiguity: process groups alone do not clean up on parent death. Startup recovery must inspect
  recorded containment and either terminate under policy, observe, or require operator.
- GitHub state drift: branch head, PR head, base branch, CI, and review threads can change during recovery.
  Decisions must be bound to exact SHAs and invalidated on head/base movement.
- Lease false expiry: machine sleep, paused processes, or overloaded filesystems can make a live worker look
  stale. Expiry starts classification; it does not grant takeover.
- Legacy artifacts: old runs may lack writer epochs, process containment ids, or valid session linkage. They
  should be read-only or operator-required unless imported evidence is unusually complete.

## Fallback and Degraded Modes

- No app-server support: use MCP/CLI only if the kit can own the process group; otherwise observe-only.
- No reliable process-tree containment: allow manual/supervised recovery, but disable auto-relaunch,
  auto-recover, and auto-merge.
- No session id/thread id: relaunch only from empty safe state; otherwise operator-required with worktree/branch/PR
  evidence.
- Session id exists but no process/control handle: read logs and inspect resulting Git state; do not resume
  automatically unless the kit starts a new owned resume process and all duplicate-work checks pass.
- Missing worktree: run Git worktree/list/branch/PR inspectors. If branch/PR work exists, operator-required. If
  no durable work exists and claim/lease belongs to this run, allow claim/lease cleanup by event.
- Worktree moved: report `worktree-moved-or-dangling` and recommend `git worktree repair`; do not delete or
  recreate automatically.
- Remote branch unknown due to auth/network failure: block auto-recovery. Unknown external state is not safe.
- PR state unknown: block auto-recovery. Open/merged/closed PR state changes the correct recovery path.
- Event log corrupt: read-only report plus operator repair. Do not reconstruct authority from snapshots.
- Stale writer append rejected: keep the newer recovery state; report stale writer identity and epoch.
- Manual recovery observed: classify as observe-only, then re-run completion/merge inspectors. The kit may close
  the run as reconciled after evidence, but should not claim it executed the recovery.

## Validation Spikes

- Kit-owned resume spike: create a Codex session, stop the process, then resume through app-server `thread/resume`
  or `codex exec resume` launched by the kit. Verify the kit records pid/containment or thread/turn identifiers,
  can terminate the resumed process, and fences event writes.
- Human resume contrast spike: run `codex resume` manually in a TUI for the same session. Verify the kit can only
  observe logs/Git/PR state and cannot satisfy killable/control capability gates.
- Duplicate-live prevention spike: start a child, let the lease expire without killing it, then attempt recovery.
  Expected result: no relaunch until the child is proven dead/reaped or operator explicitly takes over.
- Process-death relaunch spike: kill an owned child and prove containment empty. Test clean worktree/no branch/no PR
  permits relaunch, while dirty worktree, remote branch, open PR, or unknown PR blocks.
- Missing worktree matrix: delete, move, prune, and repair expected worktrees. Verify classifications:
  `worktree-gone`, `worktree-moved-or-dangling`, `already-cleaned`, and operator-required when branch/PR work
  exists.
- Branch/PR exact-head spike: create an open PR, push a new commit during recovery, and ensure stale recovery
  evidence is invalidated. Test GitHub merge with head `sha` mismatch and update-branch `expected_head_sha`
  mismatch.
- Lease-fencing spike: writer A stalls; writer B reclaims and appends recovery terminal event; writer A wakes and
  tries to append progress. Projection must reject A's event and keep recovered state.
- Approval recovery spike: persist `approval-requested`, restart parent, supply decision, and verify same-handle
  resume or decision-consumption timeout semantics. No relaunch while approval is pending.
- Legacy run import spike: feed captured 0.7.0 incident artifacts with clobbered `launch.json` and divergent
  `state`/`metrics`. Verify vNext produces read-only/observer/operator classifications rather than unsafe
  auto-recovery.
- Manual intervention spike: mutate tracker status, push branch, open/close/merge PR, and edit worktree while
  child is stale. Verify recovery records observations and requires operator unless the state is already merged
  and can be reconciled.

## Open Questions

- Which recovery states should ship with `auto-recover` enabled by default? Recommended initial set:
  projection rebuild, never-spawned reservation clear, same-run empty claim clear, already-merged reconciliation,
  and same-handle approval resume. Everything else starts operator-required.
- Should kit-owned `codex resume` use app-server `thread/resume` as the preferred implementation once app-server
  is stable, with CLI `codex exec resume` as a degraded backend?
- What exact timeout thresholds should distinguish startup stale, no-progress stale, approval SLA, decision
  consumption timeout, and stale lease? These should align with R6 and R12.
- Should an operator be allowed to mark a dirty worktree safe for automatic resumed execution, and how should
  that approval be scoped and audited?
- When a PR is merged manually while the tracker remains blocked, should recovery reconcile the story to complete,
  stay blocked-with-merged-evidence, or defer to track-specific policy?
- Should missing worktree cleanup (`prune`, branch delete, claim clear) ever be auto-safe, or always require a
  visible operator action because it changes Git administrative state?
- How much legacy 0.7.0 recovery should be supported beyond read-only analysis and operator guidance?
