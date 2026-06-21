# Postmortem: Workflow Autopilot — RR3 runs (2026-06-17)

**Status:** diagnosis complete; remediation **not yet designed**.
**Audience:** a developer or a fresh Claude Code session that will **design** fixes to the autopilot.
You have no memory of the investigation that produced this doc — everything needed to understand the
incident is here or behind a cited path. This report deliberately **does not prescribe solutions**;
it characterizes each failure precisely (with exact source locations) and states the design questions
and tensions, so you can design the fix yourself.

**Two repos — keep them distinct:**
- **`agentic-workflow-kit`** (this repo, `/Users/aryekogan/repos/workflow-kit`) — the autopilot. **Any fix lands here.**
- **`on-class-web`** (`/Users/aryekogan/repos/on-class-web`) — the target app the autopilot ran
  against (Next.js, pnpm, requires network to install deps). It is only the scene of the incident; its
  application code is out of scope.

> **Evidence locality.** Code references below are in *this repo* and reproducible by anyone with it.
> The *runtime artifacts* (run dirs, Codex/Claude transcripts) live on the machine where the runs
> happened (`~/.codex`, `~/.claude`, and the `on-class-web` checkout) and are cited for same-machine
> readers; they are not committed here. Appendix A explains how to read them if you have them.

---

## 1. Summary

Two `/workflow-autopilot` runs against the **RR3 track** on 2026-06-17. **Neither merged a single
story autonomously.**

- **Run 1** (`2026-06-17T16-34-53-199Z`) — the two Codex children implemented their stories well
  (including a sidecar self-review that caught real bugs) but **blocked at the verification/PR gate**:
  the Codex sandbox has **no network**, so `pnpm install`, `git push`, and `gh` all fail. The work was
  salvaged by hand (human + the Claude orchestrator) into two merged PRs (#548, #549).
- **Run 2** (`2026-06-17T21-28-31-940Z`) — attempted to defeat the network restriction (`on-request`,
  then `danger-full-access`) and hit two worse failures: an **approval-gate hang** and a **child
  command/PTY deadlock**, ending in `supervision_lost` with children hung ~94 minutes that the kit
  **could not kill**. Nothing was salvageable.

**One-line characterization:** the *decision layer* behaved well (dry-run, permission-gating,
queue-cap enforcement, fail-closed review gate, useful sidecar reviewers); the *execution substrate*
did not (sandbox networking, the approval contract, long-command handling, and a control plane that
cannot stop its own children).

---

## 2. Verified facts

Confirmed against `main` of this repo on 2026-06-18. Path shorthand `…/` =
`packages/orchestrator/src/`.

<verified_facts>

| Fact | Value | Re-verify with |
|---|---|---|
| Package / version | `agentic-workflow-kit` @ **0.7.0** | `grep -E '"(name|version)"' package.json` |
| Package manager | `pnpm@11.5.1` | `grep packageManager package.json` |
| Verify gate | `pnpm check` (Biome + `tsc` + Vitest); also `test`, `typecheck`, `lint`, `build` | `node -e "console.log(Object.keys(require('./package.json').scripts))"` |
| Orchestrator source root | `packages/orchestrator/src/` | `ls packages/orchestrator/src` |
| Story-implementer prompt is **rendered at runtime** (not a static file) | `…/drivers/promptRenderer.ts` (`renderStoryImplementerPrompt`) | `grep -n renderStoryImplementerPrompt …/drivers/promptRenderer.ts` |
| The approval contradiction line | `…/drivers/promptRenderer.ts:45` | `sed -n '45p' …/drivers/promptRenderer.ts` |
| "tracker status is the only completion authority" line | `…/drivers/promptRenderer.ts:104` | `sed -n '104p' …/drivers/promptRenderer.ts` |
| Child profile defaults: `approvalPolicy:'never'`, `sandbox:'workspace-write'` | `…/config/schema.ts:134-153` (`:138`, `:139`) | `sed -n '134,153p' …/config/schema.ts` |
| Sandbox writable_roots = `.git` + `.worktrees`; network restricted | `…/drivers/codex-mcp/toolInput.ts:44-72` (`:61`) | `sed -n '44,72p' …/drivers/codex-mcp/toolInput.ts` |
| Completion decided on child's **returned status**, not gate evidence | `…/runner/CompletionGate.ts:59-84` (block reason `:78`, authority `:79`) | `sed -n '59,84p' …/runner/CompletionGate.ts` |
| CI/PR evidence checked **only after** status==complete | `…/runner/CompletionGate.ts:99-141` | `sed -n '99,141p' …/runner/CompletionGate.ts` |
| `stopLaunchingOnBlocked` halts the queue | `…/runner/WorkflowRunnerEligible.ts:128-138` (`:76,:105,:136`) | `sed -n '128,138p' …/runner/WorkflowRunnerEligible.ts` |
| No-progress & max-runtime timeouts **reject the promise but never abort/kill** | `…/runner/ChildSupervisor.ts:118-135`; race `:157` | `sed -n '112,158p' …/runner/ChildSupervisor.ts` |
| Only the **startup** timeout aborts the signal | `…/runner/ChildSupervisor.ts:125-131` → `abortChildStartup` `:455-458` | `sed -n '455,458p' …/runner/ChildSupervisor.ts` |
| `supervision_lost` issues **no** SIGTERM/SIGKILL/process.kill | `…/runner/ChildSupervisor.ts:376-390` | `sed -n '376,390p' …/runner/ChildSupervisor.ts` |
| Child spawned via `codex mcp-server` stdio; **no ChildProcess handle retained** | `…/drivers/codex-mcp/CodexMcpStoryRunner.ts:286-299`, `:262-284` (close-only `:277`) | `sed -n '262,299p' …/drivers/codex-mcp/CodexMcpStoryRunner.ts` |
| In-flight `callTool` signal plumbed but never aborted on timeout | `…/drivers/codex-mcp/CodexMcpStoryRunner.ts:163-192` (`:174`) | `sed -n '163,192p' …/drivers/codex-mcp/CodexMcpStoryRunner.ts` |
| Interrupt/reply spawn a **new** `codex mcp-server` subprocess (can't reach a live desktop child) | `…/drivers/codex-mcp/control.ts:137-191` (`:162-191`) | `sed -n '137,191p' …/drivers/codex-mcp/control.ts` |
| `workflow_run_control` is abort-only; child interrupt/reply + `codex_*` aliases | `…/mcp/tools.ts:680-696`, `:881-909`, `:927-955`; dispatch `…/mcp/toolHelpers.ts:77-92` | `grep -n "registerTool('workflow_run_control\|registerTool('workflow_child\|registerTool('codex_" …/mcp/tools.ts` |
| Evidence parser sets `command` to the first backtick pair (→ bogus values); `reviewer` null fallback | `…/drivers/codex-mcp/evidenceParser.ts:162` (`reviewerFromLine` `:564-567`) | `sed -n '145,169p;560,567p' …/drivers/codex-mcp/evidenceParser.ts` |
| `analyze_run` writes `analysis.json` + `report.md` but is a **manual** call (not auto on block) | handler `…/commands/runReports.ts:23-40`; tool `…/mcp/tools.ts:957-976` | `sed -n '23,40p' …/commands/runReports.ts` |
| Detached run subscriptions **already merged** (push `notifications/progress` + poll) | `38bd0e5` (#103); `…/commands/runSubscriptions.ts`; push `…/mcp/tools.ts:566-567`, poll `:595-604` | `git log --oneline | grep -i subscription` |

</verified_facts>

---

## 3. What happened, when, why

### 3.1 The process tree (Run 1)

```
Claude orchestrator session "Workflow autopilot for RR3 track"   (06-17 16:31–18:55 UTC, Opus)
└─ run 2026-06-17T16-34-53-199Z   (status: blocked; ~22 min of actual autopilot)
   ├─ RV01 Codex child  019ed66f-898c   → returned status "done"  (returnedComplete:false)
   │   └─ "Cicero"  019ed677-81b6   (Codex explorer/reviewer, depth 1) — 1 High + 1 Med RLS findings
   └─ RV03 Codex child  019ed66f-9321   → returned status "specced" (this return blocked the run)
       └─ "Euler"   019ed679-3868   (Codex explorer/reviewer, depth 1) — 1 High blocking TZ finding
   └─ [salvage, not autopilot] 2 Claude general-purpose fix-agents in the worktrees
```

The arc spans three Claude sessions: a **setup** session (kit plugin upgrade + `workflow-init` +
building the `docs/tracks-kit` mirror tracker), **Run 1** (the titled "Workflow autopilot" session),
and **Run 2** (a second `/workflow-autopilot` invocation). Codex session filenames are UTC+3
(`…19-34-…` = `16:34` UTC).

### 3.2 Run 1 — blocked at the gate, salvaged by hand

| Time (UTC) | Event |
|---|---|
| 16:31 | User: run autopilot for RR3, cap 4 stories. Orchestrator reads `SKILL.md` + config; does not guess. |
| 16:32 | Resolves a tracker mismatch (config `tracksDir: docs/tracks-kit` vs hand-managed `docs/tracks/…`). **4 eligible:** RV01, RV03, RV05, RV06. |
| 16:33 | Clean dry-run; asks permission before irreversible auto-merge-to-`main`; user approves live + auto-merge with a hard cap. |
| 16:34 | Catches that **RV04 would queue-jump** RV05/RV06 on merge and defers it to honor the cap. Launches, concurrency 2; RV01+RV03 start, RV05/RV06 queued. |
| 16:35–16:49 | Both children implement; each spawns a sidecar reviewer and fixes its findings. |
| 16:49 | **RV03 finishes** (`task_complete`) but returns status `specced` — it deliberately did not commit/PR because the required gate could not run. |
| 16:56 | Orchestrator marks run **`blocked`** ("RV03 returned but status is specced"); `stopLaunchingOnBlocked:true` ⇒ **RV05/RV06 never launch.** RV01 finishes, returning `done` but `returnedComplete:false`. |
| ~16:56 | Root cause confirmed: sandbox is network-restricted ⇒ `pnpm install` → `ENOTFOUND registry.npmjs.org` (fresh worktrees have no `node_modules`; pnpm store missing tarballs e.g. `@base-ui/react`); `git fetch/push` + `gh pr create` → can't resolve `github.com`. Gate + PR are impossible inside a child. |
| 17:02–17:14 | User learns re-dispatch restarts a child from scratch (new Codex session, lost work). Chooses to stop after RV01; config reverted; RV04 restored. |
| 17:18–17:20 | The **parent** (has network) pushes RV01, commits+pushes RV03, opens **#548**, **#549**. |
| 17:20–17:37 | CI runs; **both PRs fail CI _and_ the Codex bot leaves findings** (not a clean +1) → correctly held. |
| 18:06–18:29 | User has two Claude fix-agents fix the PRs in-worktree; they `pnpm install` **successfully** (Claude harness has network) and root-cause real defects (Appendix B). |
| 18:30–18:51 | #548 (RV01/RR3-03a) merged `cbd06dc7`; #549 (RV03/RR3-04) rebased, CI green, merged `b2c03344`. Worktrees cleaned. |

**Net:** 2 of 4 capped stories shipped — by salvage, not by the autopilot. RV05/RV06 never ran.

### 3.3 Run 2 — supervision lost

| Time (UTC) | Event |
|---|---|
| ~18:20→ | Second `/workflow-autopilot`. To beat the network problem it tries `approvalPolicy: on-request`, then `sandbox: danger-full-access`. |
| 18:28 | Run `2026-06-17T21-28-31-940Z` launches RV04+RV05 (concurrency 2). |
| — | **Approval-gate hang:** under `on-request`, children request approval for the networked install; the runtime cannot surface/relay it ⇒ stall. |
| — | **Child command deadlock:** children run long commands (`pnpm check`, `pnpm test:integration`); the no-progress/max-runtime timeout fires but never aborts the in-flight call or kills the child. Both ran **~94 min** (`durationMs ≈ 5.6M`), `ok:false`, `sessionId` lost. |
| — | Control plane (abort/interrupt/reply) could not stop them. Status: **`supervision_lost`**, `blockedReason: child-no-progress-timeout`. |
| →06-18 14:26 | Aborted and cleaned up. **Nothing merged or salvageable.** |

---

## 4. Failure modes (diagnosis only — design the fixes yourself)

Each item is a *characterized problem*: what breaks, where it lives, and the design tensions that make
it non-trivial. **No solution is prescribed here** — that's the next session's job (Section 7).

### F1 — Network-isolated sandbox vs a repo that needs network
The child runs under `sandbox:'workspace-write'` with `approvalPolicy:'never'`
(`…/config/schema.ts:138-139`), writable roots only `.git` + `.worktrees`, network restricted
(`…/drivers/codex-mcp/toolInput.ts:44-72`). For a repo whose deps require a network `pnpm install`
(fresh worktrees, missing store tarballs) and whose flow needs `git push` + `gh`, the verify gate and
the entire PR/merge path are physically impossible inside the child. The Claude fix-agents proved the
same operations succeed *with* network — the constraint is purely the sandbox.
*Design tension:* sandbox isolation (a safety feature) directly conflicts with the install/GitHub
steps the child is told to perform. Run 2's `danger-full-access` removed isolation but introduced F2;
`on-request` introduced the approval hang — so neither of the obvious dials is a resolution.

### F2 — An unsatisfiable instruction triad in the child prompt
`…/drivers/promptRenderer.ts:45` emits *"Do not symlink node_modules … stop for approval if
dependencies require network or privileged setup"* while the profile runs under `approvalPolicy:'never'`
— so there is no approver and no offline escape. The instruction can never be satisfied as written.

### F3 — Completion is judged on the child's self-reported status, not on gate evidence
`CompletionGate.evaluate` (`…/runner/CompletionGate.ts:59-84`) blocks only when the child's *returned
status* isn't a complete status (reason `:78`, authority `tracker-status-not-complete` `:79`); CI/PR
evidence is consulted **only after** the child already claims a complete status (`:99-141`). The prompt
reinforces this: *"the tracker row status is the only completion authority"* (`promptRenderer.ts:104`).
*Observed consequence:* identical blocker, opposite outcomes — **RV01 set `done`** (would clear the
first gate without ever running the required gate), **RV03 stayed `specced`** (honest). The run was
saved by RV03's honesty, not by the design. Note `returnedComplete:false` was recorded for both but
did not gate the outcome.

### F4 — Timeouts reject but never terminate the child
`ChildSupervisor.armTurnTimeouts` (`…/runner/ChildSupervisor.ts:118-135`): the max-runtime
(`:118-123`) and no-progress (`:133-135`) timeouts only `reject(new Error(...))`; only the *startup*
timeout (`:125-131`) calls `abortChildStartup` (`:455-458`). `settleSupervisionLost` (`:376-390`) sets
state and journals but issues no `SIGTERM`/`SIGKILL`/`process.kill`. The in-flight MCP `callTool`
(`…/drivers/codex-mcp/CodexMcpStoryRunner.ts:163-192`) keeps its promise pending; the signal at `:174`
is never aborted; and no ChildProcess handle is retained (`:262-299`, cleanup is graceful
`client.close()` only). Hence the 94-minute orphaned hang.

### F5 — The control plane can't reach a live child
`sendChildInterrupt` → `callCodexControlTool` (`…/drivers/codex-mcp/control.ts:162-191`) spawns a
**new** `codex mcp-server` subprocess and calls an interrupt tool on it; that process has no channel to
the original running session (especially when the child runs in the Codex desktop app). The interrupt
is *journaled as sent* but never delivered. `workflow_run_control` is abort-only
(`…/mcp/tools.ts:680-696`).
*Safety implication to weigh in design:* Run 1 was configured to **auto-merge to `main`** while this
control plane could not stop a child. Whether auto-merge is acceptable before F4/F5 are resolved is an
open product question, not a settled answer.

### F6 — Brittle evidence extraction from free text
`verificationFromContent` (`…/drivers/codex-mcp/evidenceParser.ts:145-169`) sets `command` to the first
backtick pair on a line (`:162`) with no validation — which turned prose tokens like `@base-ui/react`
and `registry.npmjs.org` into bogus "commands" in `RV03.json`. `reviewerFromLine` (`:564-567`) returns
`'codex'` or `null`, so the real reviewer ("Euler") was recorded as `reviewer:null`. A structured
`built-in/child-run-result` schema is already required (`…/config/schema.ts:148`).

### F7 — No automatic post-run analysis on a terminal/block state
`analyze_run` produces `analysis.json` + `report.md` (`…/commands/runReports.ts:23-40`) but is a manual
MCP call (`…/mcp/tools.ts:957-976`); Run 1's dir has neither file. The kit's own postmortem artifact was
never generated for a blocked run.

### F8 — Two parallel trackers
`docs/tracks` and the `docs/tracks-kit` mirror both encode RR3 status; they diverged and produced
rebase conflicts during the salvage, plus ongoing ambiguity about which is authoritative.

### Open questions already surfaced (not yet answered)
- **Does the autopilot supervision loop consume the merged detached subscriptions (#103,
  `…/commands/runSubscriptions.ts`, push at `…/mcp/tools.ts:566-567`), or does it still poll via
  `ScheduleWakeup`/`watch_run_poll`?** The runs predate #103 and used polling; confirm current behavior
  against `SKILL.md` and the supervision path before assuming this is solved.
- **Is there any controllable Codex runtime** (vs. the desktop app) in which F5 does not occur? If not,
  the design space for F4/F5 narrows.

---

## 5. What worked (preserve these)

- **Orchestrator discipline:** read the skill, dry-ran, **asked before auto-merge**, enforced the
  4-story cap, and pre-empted the RV04 queue-jump.
- **Children's implementation + the sidecar review loop:** Cicero caught still-broken cross-tenant RLS
  paths (High) + a transaction-scope issue (Med); Euler caught `runAllFinancialRollups` still using UTC
  instants (High). Both children fixed their reviewer's findings before reporting.
- **The merge gate failed closed and caught real defects** (CI red + Codex findings on both PRs).

---

## 6. Scope & ground rules for the remediation work

<out_of_scope>

- This effort changes **the kit** (`agentic-workflow-kit`), not the `on-class-web` application — RR3-03a
  and RR3-04 already shipped (#548/#549).
- Do **not** re-run `/workflow-autopilot` against `on-class-web` as part of investigating; the artifacts
  in Appendix A are sufficient to understand the failures.
- Do **not** delete or rewrite the incident artifacts under
  `on-class-web/.codex/agentic-workflow-kit/runs/` or the transcripts — they are the evidence base.
- Treat `danger-full-access` (Run 2) as a diagnostic workaround that exposed F4, **not** as a resolution.
- Keep changes scoped: one logical change per PR; conventional commits; no AI attribution (repo convention).

</out_of_scope>

<escalation_rules>

- **Authority when docs disagree:** the design docs under
  `docs/prds/agentic-workflow-kit-redesign/technical-solution/` state intended behavior; the code is
  current reality. If they conflict, surface it rather than silently choosing.
- **Reversibility:** designing/implementing in this repo is local-reversible — proceed freely. Anything
  that runs autopilot live against a real repo, force-pushes, or enables auto-merge needs explicit
  human approval first.
- **Real blockers (stop and ask):** a fix requires changing the Codex CLI/runtime itself (outside this
  repo); F4/F5 prove impossible in the available runtime; or resolving F1 forces a security/usability
  trade-off that is a product decision (e.g., whether auto-merge stays enabled).

</escalation_rules>

---

## 7. How to use this report (next session)

1. Read Sections 1–5; open each cited file at the cited lines to ground yourself.
2. Re-verify the `<verified_facts>` (code drifts) and answer the two open questions in Section 4.
3. **Design** the remediation — recommended order of attack by severity/dependency: the verification
   path (F1/F2), the ability to terminate a child (F4) and control it (F5), the completion contract
   (F3), then F6/F7/F8. The design is yours; this report is the problem statement, not the solution.
4. Validate any change with **`pnpm check`** and add tests (the repo aims high on coverage). Use the
   project's planning/TDD skills before writing code.

---

## Appendix A — reading the evidence (same-machine readers)

- **Run metadata (authoritative):** `on-class-web/.codex/agentic-workflow-kit/runs/<runId>/` —
  `summary.json`, `state.json`, `run.json`, `metrics.live.json`, `config.resolved.json`,
  `events.ndjson`, and `children/<ID>.json`.
  - Run 1 = `2026-06-17T16-34-53-199Z` (blocked). Run 2 = `2026-06-17T21-28-31-940Z` (supervision_lost).
  - `children/RV01.json` and `RV03.json` are the most informative: each child's full self-report —
    verification evidence, the network blockers verbatim, and reviewer findings.
- **Codex child transcripts:** `~/.codex/sessions/2026/06/17/rollout-*.jsonl`. Map story→session via
  `state.json`'s `completed[].sessionId`. Line 1 is `session_meta`;
  `payload.source.subagent.thread_spawn` shows the parent and reviewer nickname (Cicero/Euler).
- **Orchestrator transcripts:** `~/.claude/projects/-Users-aryekogan-repos-on-class-web/` — Run 1 =
  `b9e620dd-…jsonl` (title "Workflow autopilot for RR3 track"); Run 2 = `099b1019-…jsonl`. The two
  salvage fix-agents are under the Run-1 session's `subagents/` subdir.

## Appendix B — the salvage fixes (real defects the gate caught)

- **#548 / RV01** — production routed `findPaymentByProviderReference` through `forEachStudioTx` →
  `findActiveStudiosWithTimezone` (`db.select().from(studios)` with no `.where()`), which the unit
  mock returned as `{where: fn}` not an array → `rows.map is not a function`. Fixed by mocking
  `findActiveStudiosWithTimezone` + `withTenantTx` (the existing `cron/class-reminders` pattern) and
  adding a fail-closed test.
- **#549 / RV03** — `savePeriodRollup` re-derived date labels from UTC instants
  (`.toISOString().slice(0,10)`), wrong for non-UTC studios. Fixed by threading studio-local date
  labels through `PeriodRollup`; also fixed pre-existing `findStudioTimezone` mock breakage (11 tsc
  errors).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [Codex runtime findings — controllability & approval protocol](../design/notes/codex-runtime-findings.md) · **Next →:** [Autopilot unified issue report (RR3 + Pathway)](./2026-06-18-autopilot-unified-issues.md)

<!-- /DOCS-NAV -->
