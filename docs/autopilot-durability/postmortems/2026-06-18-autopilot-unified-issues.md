---
title: Autopilot unified issue report (RR3 + Pathway)
status: diagnosis complete; remediation not yet designed
last-reviewed: 2026-06-18
synthesizes:
  - ./2026-06-17-autopilot-rr3-runs.md
  - ./pathway-autopilot-incident-2026-06-18.md
feeds:
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/
---

# Autopilot unified issue report — RR3 (on-class) + Pathway

**Purpose.** Merge the two `/workflow-autopilot` postmortems into one deduplicated, prioritized
problem statement that a design session can act on. It **characterizes** failures and states design
tensions; it deliberately **does not prescribe fixes** — that is the next session's job, and it should
feed the existing redesign under `docs/prds/agentic-workflow-kit-redesign/technical-solution/`.

**Scope.** All fixes land in **this repo** (`agentic-workflow-kit`). The target apps (`on-class-web`,
`pathway`) are only the scenes of the incidents; their application code is out of scope.

**Path shorthand.** `…/` = `packages/orchestrator/src/`. Code locations were re-verified against
`main` at **v0.7.0** on 2026-06-18; two cross-cutting defects are flagged **[live @0.7.0]** below.

**Source docs (read for full evidence chains):**
- Run set A — [2026-06-17-autopilot-rr3-runs.md](./2026-06-17-autopilot-rr3-runs.md) (failure modes `F1`–`F8`)
- Run set B — [pathway-autopilot-incident-2026-06-18.md](./pathway-autopilot-incident-2026-06-18.md) (issues `#1`–`#19`)

---

## 1. The two incidents at a glance

| | **Run set A — on-class-web** | **Run set B — pathway** |
|---|---|---|
| Orchestrator (parent) | **Claude Code** (Opus) | **Codex Desktop CLI** 0.140.0 |
| Child driver | `codex mcp-server` (stdio) | `codex` MCP (0.139.0) |
| Target repo | on-class-web (Next.js, pnpm) | pathway (pnpm) |
| Work scope | RR3 track, cap 4, concurrency 2, **auto-merge approved** | POH01, single story |
| Runs | Run 1 → `blocked`; Run 2 → `supervision_lost` | 2 real runs (+2 failed relaunches) |
| Kit version | 0.7.0 | 0.7.0-era released plugin |
| **Stories merged autonomously** | **0** | **0** |
| Useful work that did ship | #548, #549 — **by hand** | PR #121 — **by hand** (`codex resume`) |

**The headline both runs share:** the autopilot merged **zero** stories on its own. In each case the
*story-level outcome was actually correct* — on-class shipped two real bug fixes; pathway correctly
kept POH01 blocked with evidence — but that correctness came from **honest child self-reporting +
sidecar review + human/parent judgment**, not from the autopilot's automated gates.

---

## 2. Central finding

> **The decision layer behaved well; the execution substrate did not — and the substrate failed
> identically under two completely different orchestrators (Claude and Codex).**

What worked was *judgment*: dry-runs, permission-gating, queue-cap enforcement, a fail-closed review
gate, useful sidecar reviewers, honest "I couldn't verify, so I won't claim done" reporting.

What failed was *machinery*: sandbox networking, the approval/escalation contract, config-override
plumbing, the ability to see / control / kill a live child, run-state coherence, and post-run
analysis. **Because these reproduced under both a Claude parent and a Codex parent, they are
kit-substrate defects, not orchestrator-agent flukes.** That is the strongest signal in the data:
fixing the orchestrator prompt or model will not fix them.

A corollary worth stating plainly: in Run set A, an *honest* child (RV03 stayed `specced`) saved the
run, while a *less careful* child (RV01 set `done`) would have cleared the gate without ever running
verification (see Theme H). **The system got lucky on truthfulness.** A correct design cannot depend
on the child being honest.

---

## 3. Unified failure taxonomy

Eleven themes (A–K). Each consolidates the matching `F#` (Run A) and `#n` (Run B) findings. The
**Systemic?** column states whether the failure was observed/root-caused under **both** orchestrators
(= substrate defect) or only one. K is the meta-conclusion, not a fix target.

### A — The verify + PR path is physically impossible inside the child sandbox
- **What:** the child runs network-restricted (`sandbox: workspace-write`, writable roots only
  `.git` + `.worktrees`). For repos whose deps need a networked `pnpm install` (fresh worktrees,
  missing store tarballs) and whose flow needs `git push` + `gh`, the verify gate and the entire
  PR/merge path cannot run inside the child. In Run B the child *also* skipped the repo's
  `scripts/setup-worktree.sh` and called `pnpm` against an unhydrated worktree, compounding it.
- **Where:** `…/config/schema.ts:134-153` (`:138-139`); `…/drivers/codex-mcp/toolInput.ts:44-72`.
- **Evidence:** A: `F1` (pnpm `ENOTFOUND registry.npmjs.org`; Claude fix-agents proved the same ops
  succeed *with* network). B: `#10` (setup script not run), `#11` (deps fail in sandbox).
- **Systemic? YES.** First thing that broke in both.
- **Tension:** sandbox isolation (safety) directly conflicts with the install/GitHub steps the child
  is told to perform. Neither obvious dial resolves it — `danger-full-access` removed isolation but
  triggered Theme D; `on-request` triggered the Theme B hang.

### B — The approval / escalation contract is unsatisfiable
- **What:** the child prompt tells it to *"stop for approval if dependencies require network or
  privileged setup"* / request `sandbox_permissions=require_escalated`, but no working approver
  exists at runtime. Under `approvalPolicy: never` there is no approver at all; under `on-request`
  the runtime cannot surface/relay the request, so it hangs.
- **Where:** `…/drivers/promptRenderer.ts:45` (the instruction — **verified present @0.7.0**) vs
  profile `approvalPolicy` at `…/config/schema.ts:138`.
- **Evidence:** A: `F2` (unsatisfiable triad); Run 2 approval-gate hang under `on-request`. B: `#11`
  (escalation ungrantable; child 1 stopped dead after `require_escalated`; child 2 looped on it).
- **Systemic? YES.**
- **Tension:** the instruction is the child's only sanctioned escape from Theme A, and that escape is
  wired to a dead end.

### C — Operator sandbox/approval overrides are silently shadowed by the profile **[live @0.7.0]**
- **What:** an operator can pass `{ sandbox, approvalPolicy }` to `run_story`/`run_eligible`; the
  schema and tool call accept them, but the spawned child does not receive them. The profile value
  wins, so the override is a silent no-op.
- **Where:** `…/drivers/codex-mcp/toolInput.ts:37-38` —
  `profile?.approvalPolicy ?? childSession.approvalPolicy` and the same for `sandbox`. Override flows
  `…/mcp/toolHelpers.ts` → `…/config/configLoader.ts` (onto `childSession.*`), then loses to
  `profile.*` here. **Confirmed in current code.**
- **Evidence:** B: `#12` (operator set `danger-full-access`; child still showed
  `sandbox_mode: workspace-write, Network access is restricted`). A: Run 2 attempted the same
  `danger-full-access` override; doc A attributes Run 2's failure to Theme D, so the override's
  effect there is **unconfirmed and a likely confound** — verify whether on-class's profile set
  `sandbox`.
- **Systemic? Confirmed B; likely-but-unconfirmed A.**
- **Tension:** this defeats the *only* workaround operators reached for in both incidents, so A/B
  cannot be escaped by hand until C is fixed.

### D — A live child cannot be seen, controlled, or killed
- **What:** the supervisor's no-progress and max-runtime timeouts only `reject()` the promise; they
  never abort the in-flight call or terminate the process. `supervision_lost` issues no
  `SIGTERM`/`SIGKILL`/`process.kill`. No `ChildProcess` handle is retained. The control plane
  (reply/interrupt) spawns a *new* `codex mcp-server` that has no channel to the live session — so
  interrupts are journaled-as-sent but never delivered. Even with a known session id, reply fails and
  interrupt is "unavailable."
- **Where:** `…/runner/ChildSupervisor.ts:118-135` (timeouts reject), `:376-390`
  (`settleSupervisionLost` — **verified: no kill @0.7.0**), `:455-458` (only *startup* aborts);
  `…/drivers/codex-mcp/CodexMcpStoryRunner.ts:163-192,262-299` (signal never aborted, no handle
  retained); `…/drivers/codex-mcp/control.ts:137-191`; `…/mcp/tools.ts:680-696` (abort-only).
- **Evidence:** A: `F4`+`F5` — two children orphaned **~94 min** (`durationMs ≈ 5.6M`), control plane
  could not stop them. B: `#7` (control reads broken artifact → "no linked session"), `#8` (reply
  returns `ok:true` wrapping raw `missing field prompt`), `#9` (`codex_interrupt is unavailable`);
  child stale ~26 min and uncontrollable.
- **Systemic? YES.**
- **Tension / SAFETY:** Run A was configured to **auto-merge to `main`** while this control plane
  could not stop a child. Whether auto-merge may be enabled before D is fixed is an open *product*
  decision, not a settled answer.

### E — Child→session linkage is lost from the launch artifact (non-monotonic) **[live @0.7.0]**
- **What:** `events.ndjson` records `child-session-linked` (real id + log path) and `transcripts.json`
  retains the log path, but `children/<story>.launch.json` ends with `sessionId: null,
  sessionLogPath: null`. A later write from a stale in-memory record clobbers the known-good link.
- **Where:** `…/runner/RunJournal.ts:178` — `updateChildLaunch` does
  `{ ...record, ...fields, updatedAt }`: it neither re-reads the on-disk artifact nor preserves known
  non-null linkage. **Confirmed in current code.** `…/runner/ChildSupervisor.ts` writes launch
  records from several paths (startup, progress, poll, settle, supervision-lost), any of which can
  rewrite from stale data.
- **Evidence:** B: `#6` (explicit root cause). A: `F6` / Run 2 noted `sessionId` lost.
- **Systemic? Confirmed B; observed A.**
- **Note:** E is a **root cause feeding D** (control can't find the session), **J** (analyzer can't
  correlate), and **G** (artifacts disagree). Fix E before D/J can be trusted.

### F — The detached subscription / watch path is not usable as live supervision
- **What:** subscriptions require external `fswatch` (absent) to block on the wake file, so the parent
  fell back to coarse sleep + manual `subscription_poll`. The subscription reported `active` while the
  child was stale; it woke on parent `child-supervisor-poll` (not child progress); delivery metrics
  were opaque; and closing it did not stop stale supervisor writes.
- **Where:** `…/commands/runSubscriptions.ts`, `…/commands/handlers.ts`,
  `…/commands/handlerRuntimeUtils.ts`; design intent in
  `…/prds/agentic-workflow-kit-redesign/technical-solution/07-detached-realtime-subscription.md`.
- **Evidence:** B: `#1`–`#5`. A: the open question of whether the autopilot loop consumes the merged
  detached subscriptions (#103) or still polls — Run A predates #103 and used polling; both runs ended
  `supervision_lost`.
- **Systemic? Confirmed B; open in A.**
- **Tension:** without a usable blocking-wait + true child-progress signal, "supervision" degrades to
  manual polling regardless of orchestrator.

### G — Run state diverges and cannot be reconciled through supported tools
- **What:** after manual recovery, a stale supervisor *rewrote* the run to `supervision_lost`,
  overwriting the operator's recovery reason; final artifacts disagree
  (`state: blocked` vs `summary/metrics: running` vs `launch: launched`); the duplicate-active-launch
  guard could not be cleared by public abort and required hand-editing `state.json` then
  `launch.json`; the recovery guard later threw `spawn git ENOENT` after the worktree was removed.
  Separately, two parallel trackers diverged and caused rebase conflicts.
- **Where:** `…/runner/DuplicateLaunchGuard.ts`, `…/runner/RecoveryGuard.ts`,
  `…/runner/ChildSupervisor.ts`; tracker duplication: `docs/tracks` vs `docs/tracks-kit`.
- **Evidence:** B: `#5`, `#13`, `#15`, `#16`. A: `F8` (two trackers).
- **Systemic? YES (different facets).**
- **Tension:** state lives in multiple artifacts with no single authority, and the only way to fix it
  in practice was to edit ignored files by hand — which itself is unsupported.

### H — "Done" and "merge" are decided by self-report / human, not by evidence or policy
- **H1 — completion authority:** `CompletionGate.evaluate` blocks only when the child's *returned
  status* isn't complete (`authority: tracker-status-not-complete`); CI/PR evidence is consulted
  **only after** the child already claims complete. The prompt reinforces *"the tracker row status is
  the only completion authority; child prose is not enough."* Same blocker, opposite outcomes:
  RV01 → `done` (would clear the gate with no verification), RV03 → `specced` (honest).
  - **Where:** `…/runner/CompletionGate.ts:59-84` (`:78`/`:79` — **verified @0.7.0**), `:99-141`
    (evidence checked after); `…/drivers/promptRenderer.ts:104` (**verified @0.7.0**).
- **H2 — merge policy:** merging a blocker-evidence PR while keeping the story `blocked` is coherent,
  but it was applied by the *parent operator*, never surfaced as an explicit run/child policy.
  - **Evidence:** A: `F3`. B: `#19`.
- **Systemic? YES (two facets of one underspecified contract).**
- **Tension:** the contract is built on the child telling the truth; it should be built on observable
  evidence + an explicit policy for the block/merge boundary.

### I — Telemetry / evidence is unstructured and lossy
- **What:** the free-text evidence parser sets `command` to the first backtick pair on a line, turning
  prose tokens (`@base-ui/react`, `registry.npmjs.org`) into bogus "commands," and records the real
  reviewer ("Euler") as `reviewer: null`. Nested `spawn_agent` work isn't represented
  (`subagentCounts: {}`), so a pre-PR review finding is only discoverable in transcript text.
- **Where:** `…/drivers/codex-mcp/evidenceParser.ts:145-169` (`:162`), `:564-567`; structured schema
  already required at `…/config/schema.ts:148`.
- **Evidence:** A: `F6`. B: `#18` + the "data gaps" list.
- **Systemic? YES.**

### J — Automatic incident analysis neither fires nor correlates
- **What:** two compounding gaps. (1) `analyze_run` is a **manual** call, not auto-invoked on a
  block/terminal state — Run A's dir has neither `analysis.json` nor `report.md`. (2) When it *was*
  run (Run B), it returned `issues: []` despite `child-session-linked` in events, a log path in
  metrics/transcripts, a transcript that stopped after `require_escalated`, and a subscription still
  reporting active.
- **Where:** `…/commands/runReports.ts:23-40`, `…/mcp/tools.ts:957-976`;
  `…/analysis/runAnalyzer.ts`, `…/analysis/runAnalyzerChildren.ts`, `…/analysis/runReport.ts`.
- **Evidence:** A: `F7` (not automatic). B: `#17` (ran, found nothing).
- **Systemic? YES (complementary failures).**

### K — (Meta) Useful work shipped only via manual, out-of-band recovery
- **What:** in both incidents the autopilot's automated path stalled, and the work was completed by
  the human/parent stepping *outside* the orchestrator — A: parent pushed and opened #548/#549,
  Claude fix-agents fixed in-worktree with network; B: parent ran `setup-worktree.sh` then
  `codex resume … -s danger-full-access -a never` into a YOLO TUI, then merged by hand.
- **Evidence:** A: §3.2 salvage. B: `#14`.
- **This is the conclusion, not a fix target.** It is the proof that Themes A–J, not the agents,
  are what stand between the kit and an autonomous merge.

---

## 4. Severity & dependency view (problem prioritization — not solutions)

Severity is scored against the autopilot's core promise: **ship a verified story autonomously and
safely.** "Systemic" = reproduced under both orchestrators.

| Tier | Themes | Why |
|---|---|---|
| **S1 — Blocker / safety** | **A**, **B**, **C**, **D** | Nothing runs end-to-end (A/B), the only manual escape is a no-op (C), and a stuck child cannot be stopped — unsafe with auto-merge (D). |
| **S2 — Defeats recovery / trust** | **E**, **F**, **G**, **H** | Operator can't see/locate the session (E), can't supervise (F), can't reconcile state (G), and can't trust "done"/merge (H). |
| **S3 — Observability** | **I**, **J** | Diagnosis is degraded; compounds every tier above. |

**Dependency-aware order of attack** (consistent with Run A's §7 instinct, extended with Run B):

1. **A + B + C** — get a single child to a green verify and an open PR *at all* (and make the manual
   escape actually take effect).
2. **E → D** — restore reliable session linkage (E is a prerequisite), then the ability to see,
   control, and **kill** a child. This is also the **safety precondition** for re-enabling auto-merge.
3. **H** — make completion/merge decisions evidence- and policy-driven, not self-report-driven.
4. **F + G** — trustworthy live supervision and coherent, tool-reconcilable run state.
5. **I + J** — structured telemetry and analysis that auto-fires and actually correlates.

---

## 5. What worked — preserve through any redesign

- **Orchestrator discipline (both runs):** read the skill, dry-ran, asked before irreversible
  auto-merge, enforced the story cap, pre-empted the RV04 queue-jump.
- **Child implementation + sidecar review loop (Run A):** Cicero caught cross-tenant RLS defects
  (High) + a transaction-scope issue (Med); Euler caught a UTC-instant rollup bug (High); each child
  fixed its reviewer's findings before reporting.
- **Fail-closed gates caught real defects:** Run A's merge gate held on CI-red + Codex findings;
  Run B correctly kept POH01 `blocked` because protected Backend Release evidence was genuinely
  missing.
- **Honest self-reporting (Run A, RV03):** the child declined to claim `done` when it couldn't verify.
  Preserve the behavior — but do not *depend* on it (Theme H).

---

## 6. Consolidated open questions / design tensions

1. **Sandbox vs. network (A):** is there a model that gives the child network for `install`/`gh`
   without surrendering isolation, or does verification move out of the child? Product/security call.
2. **Controllable runtime (D):** is there any Codex runtime (vs. the desktop app) in which live
   interrupt/reply/kill actually works? If not, the design space for D narrows sharply.
3. **Auto-merge safety gate (D):** may auto-merge stay enabled before D is resolved? Open product
   decision.
4. **Subscription consumption (F):** does the current autopilot loop consume the merged detached
   subscriptions (#103, `…/commands/runSubscriptions.ts`) or still poll? Confirm against `SKILL.md`
   and the supervision path before assuming solved.
5. **Override confound (C):** did on-class Run 2's `danger-full-access` actually take effect, or was it
   shadowed like pathway's? Determines whether A's Run 2 = pure Theme D or D+C.
6. **State authority (G):** what is the single source of truth across `state/summary/metrics/launch`,
   and which trackers are authoritative (`docs/tracks` vs `docs/tracks-kit`)?

---

## 7. Cross-reference / traceability matrix

| Theme | Run A (`F#`) | Run B (`#n`) | Primary code | Sev | Systemic |
|---|---|---|---|---|---|
| A Verify/PR impossible in sandbox | F1 | #10, #11 | `config/schema.ts:138-139`; `codex-mcp/toolInput.ts:44-72` | S1 | both |
| B Approval/escalation unsatisfiable | F2 | #11 | `drivers/promptRenderer.ts:45`; `config/schema.ts:138` | S1 | both |
| C Operator overrides shadowed **[live]** | (Run2 attempt) | #12 | `codex-mcp/toolInput.ts:37-38` | S1 | B; likely A |
| D Can't see/control/kill child | F4, F5 | #7, #8, #9 | `ChildSupervisor.ts:118-135,376-390`; `codex-mcp/control.ts`; `mcp/tools.ts:680-696` | S1 | both |
| E Linkage lost from launch.json **[live]** | F6 (Run2) | #6 | `RunJournal.ts:178`; `ChildSupervisor.ts` | S2 | B; obs. A |
| F Subscription not live supervision | (open q) | #1–#5 | `commands/runSubscriptions.ts`, `handlerRuntimeUtils.ts` | S2 | B; open A |
| G State diverges, unreconcilable | F8 | #5, #13, #15, #16 | `DuplicateLaunchGuard.ts`, `RecoveryGuard.ts`, `ChildSupervisor.ts` | S2 | both |
| H Done/merge by self-report not evidence | F3 | #19 | `CompletionGate.ts:59-141`; `promptRenderer.ts:104` | S2 | both |
| I Telemetry unstructured/lossy | F6 | #18, data gaps | `codex-mcp/evidenceParser.ts:145-169,564-567` | S3 | both |
| J Auto-analysis absent + incorrect | F7 | #17 | `commands/runReports.ts:23-40`; `analysis/runAnalyzer*.ts` | S3 | both |
| K (meta) shipped only via manual recovery | §3.2 salvage | #14 | — | — | both |

---

## 8. Evidence base (same-machine readers)

- **Run A artifacts:** `on-class-web/.codex/agentic-workflow-kit/runs/2026-06-17T16-34-53-199Z/`
  (blocked) and `…21-28-31-940Z/` (supervision_lost); transcripts in `~/.codex/sessions/2026/06/17/`
  and `~/.claude/projects/-Users-aryekogan-repos-on-class-web/`. See source doc Appendix A.
- **Run B artifacts:** `pathway/.codex/agentic-workflow-kit/runs/2026-06-18T13-03-20-921Z/` and
  `…13-37-43-654Z/`; transcripts in `~/.codex/sessions/2026/06/18/`. See source doc "Evidence
  commands."
- **Do not** delete/rewrite those incident artifacts or re-run `/workflow-autopilot` against the
  target repos to investigate — the committed source docs + on-disk artifacts are sufficient.
