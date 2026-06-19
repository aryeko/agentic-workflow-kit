---
title: Autopilot durability — incidents, diagnosis, and design
status: diagnosis complete; design drafted (under review)
last-reviewed: 2026-06-18
---

# Autopilot durability

Single home for the `workflow-autopilot` reliability effort: **what broke, why, and the design to fix it.**
If you are new to this, read this page top to bottom — it is the map and the context for everything in
this folder.

## TL;DR

- `/workflow-autopilot` runs an AI **child** agent to deliver a tracker story end-to-end (worktree → code
  → verify → PR → merge), supervised by an **orchestrator** agent.
- Two real runs in June 2026 — one under a **Claude** orchestrator (on-class-web), one under a **Codex**
  orchestrator (pathway) — **merged zero stories autonomously.** The useful work shipped only because a
  human recovered it by hand.
- Root cause: the *decision layer* was sound (dry-runs, gates, honest self-reports); the *execution
  substrate* failed — and failed **identically under both orchestrators**, so these are kit-level defects,
  not agent flukes.
- We distilled the evidence into **11 failure themes (A–K)** and are designing a durable fix, organized as
  an architecture **spine + 5 domains**, optimized for **safety + recoverability** (autonomous only where
  provably safe).

## How to read this folder

| Order | Doc | Why |
|---|---|---|
| 1 | This README | Context, the incident story, the theme map, the design approach. |
| 2 | [postmortems/2026-06-18-autopilot-unified-issues.md](postmortems/2026-06-18-autopilot-unified-issues.md) | The consolidated problem statement — themes A–K, severity, code locations. **The key diagnosis doc.** |
| 3 | [design/00-overview.md](design/00-overview.md) | The architecture spine: safety model, shared channel, contracts, migration. |
| 4 | design/01 … 05 | The five domain designs (see map below). |
| deep | [postmortems/2026-06-17-autopilot-rr3-runs.md](postmortems/2026-06-17-autopilot-rr3-runs.md), [postmortems/pathway-autopilot-incident-2026-06-18.md](postmortems/pathway-autopilot-incident-2026-06-18.md) | The two raw incident reports — full evidence chains, run artifacts, transcripts. |

## What the autopilot is

The `workflow-autopilot` (shipped in `agentic-workflow-kit`, this repo) automates tracker-driven delivery.
An **orchestrator** (a Claude or Codex agent) selects eligible stories from a markdown tracker, then
launches a **child** agent — via a **driver** (today Codex over MCP) — in an isolated git worktree. The
child implements the story, runs the repo's verify gate, opens a PR, responds to review, and (when repo
policy allows) merges. The orchestrator supervises: dry-run preview, permission-gating, concurrency caps,
completion gates, and recovery. Run state and evidence are written to per-run artifacts under
`.codex/agentic-workflow-kit/runs/<runId>/`.

## The two incidents

| | Run set A — on-class-web | Run set B — pathway |
|---|---|---|
| Date | 2026-06-17 | 2026-06-18 |
| Orchestrator | Claude (Opus) | Codex Desktop CLI |
| Scope | RR3 track, cap 4, auto-merge approved | POH01, single story |
| What happened | Run 1 blocked at the verify gate (network-restricted sandbox → `pnpm`/`git`/`gh` fail); Run 2 ended `supervision_lost` with ~94-min un-killable orphaned children | Child stalled on dependency setup + ungrantable escalation; live control/abort failed; recovered only via manual `codex resume` |
| **Autonomous merges** | **0** (2 PRs salvaged by hand) | **0** (PR #121 merged by hand) |

Both ran on kit **v0.7.0**. The story-level *outcomes* were actually correct (real fixes shipped; a real
blocker stayed blocked) — but correctness came from honest self-reporting plus human judgment, never from
the automated path.

## The 11 failure themes

Full detail and code locations in the [unified issues report](postmortems/2026-06-18-autopilot-unified-issues.md).
Severity: **S1** = blocker/safety, **S2** = defeats recovery/trust, **S3** = observability. Themes reproduced
under *both* orchestrators are kit-substrate defects.

| Theme | Sev | One-liner |
|---|---|---|
| A | S1 | Verify + PR path physically impossible inside the network-restricted child sandbox |
| B | S1 | Approval / escalation contract is unsatisfiable (prompt says "ask", policy says "never") |
| C | S1 | Operator sandbox/approval overrides silently shadowed by the profile |
| D | S1 | A live child cannot be seen, controlled, or killed |
| E | S2 | Child → session linkage lost from the launch artifact |
| F | S2 | Detached subscription / watch not usable as live supervision |
| G | S2 | Run state diverges and can't be reconciled via supported tools |
| H | S2 | Completion & merge decided by child self-report / human, not evidence or policy |
| I | S3 | Telemetry / evidence unstructured and lossy |
| J | S3 | `analyze_run` neither auto-fires on terminal/block nor correlates evidence |
| K | — | (meta) Useful work shipped only via manual out-of-band recovery |

## The design approach

**Constraints chosen for this effort:**

- **Goal when tradeoffs collide:** safety + recoverability first — autonomous where provably safe, else stop
  in a clean, diagnosable recovery state.
- **Runtime target:** a **kit-owned, controllable** child subprocess (own the pid → always killable);
  graceful interrupt is best-effort; the Codex desktop app is unsupported for autopilot (it is uncontrollable).
- **Contracts:** free to define **vNext** contracts with a migration from 0.7.0.
- **Approval:** the child **really requests approval** and then acts itself; the orchestrator relays and
  supervises, it never does the child's work. Operator-selectable **modes** — `manual` / `assisted` /
  `auto` — where `auto` adds a **risk-tiered orchestrator-decide** tier (low auto, medium opt-in, high →
  human), all audited. The default policy **pre-approves standard dependency install**; off-policy and
  privileged ops escalate. Grants are **scoped** (per-command / per-host), never blanket full-access.

**The spine (D0)** — three load-bearing ideas every domain builds on:

1. **Capability-gating ("earn autonomy"):** each autonomous power (`auto-merge`, `auto-recover`,
   `escalation-auto-grant`, `unattended-run`) is locked behind explicit runtime guarantees; if a guarantee
   can't be verified, the power is disabled and the run degrades to a safe stop. Gate results are recorded
   with evidence — decisions become evidence-gated *and* inspectable.
2. **One durable bidirectional channel** over the kit-owned process, carrying **progress** (real child
   activity), **approval** (request → decide → resume), and **control** (interrupt best-effort + guaranteed
   kill). D1's approval relay and D2's control plane are the same channel, built once.
3. **Event log is the single source of truth;** `state`/`summary`/`metrics`/`launch` become **projections**
   of it, never independently authored — making the linkage clobber (E) and state divergence (G)
   structurally impossible.

**Domain map:**

| Domain | Doc | Themes | Focus | Status |
|---|---|---|---|---|
| D0 | [design/00-overview.md](design/00-overview.md) | cross-cutting | Safety model + shared channel + vNext contracts + migration | drafted |
| D1 | [design/01-execution-substrate-and-provisioning.md](design/01-execution-substrate-and-provisioning.md) | A, B, C | Provisioning a capable, correctly-permissioned child + the tiered approval relay | drafted |
| D2 | [design/02-lifecycle-and-control-plane.md](design/02-lifecycle-and-control-plane.md) | D, E, F | Own the process: observe / interrupt / kill; append-only linkage; live supervision | drafted |
| D3 | [design/03-completion-verification-and-merge.md](design/03-completion-verification-and-merge.md) | H (+ A) | Evidence-based completion + irreversible-action (merge) safety | drafted |
| D4 | [design/04-run-state-and-recovery.md](design/04-run-state-and-recovery.md) | G, K | Coherent run state + first-class in-band recovery, no manual artifact edits | drafted |
| D5 | [design/05-observability-and-analysis.md](design/05-observability-and-analysis.md) | I, J | Structured telemetry + analysis that auto-fires and correlates | drafted |

## Status & provenance

- **Diagnosis:** complete (3 postmortems). **Design:** all six domain docs (D0–D5) drafted and
  self-consistent; under review. Open decisions to confirm are flagged in-doc (D2 §2 protocol; D3 §7 merge;
  D4 §6 recovery).
- **Runtime evidence:** the control + approval design is backed by committed findings in
  [design/notes/codex-runtime-findings.md](design/notes/codex-runtime-findings.md) (Codex 0.139.0, read-only spikes).
- Code references throughout were verified against kit **v0.7.0** `main` on 2026-06-18.
- This effort builds on, but does not replace, the existing redesign under
  [`docs/prds/agentic-workflow-kit-redesign/`](../../prds/agentic-workflow-kit-redesign/) — it reconciles that
  approved design against shipped reality and closes the gaps the incidents exposed.

## Glossary

- **Orchestrator / parent** — the agent that selects stories, launches and supervises children, and decides
  completion/merge/recovery. Orchestrates and supervises; does not do the child's work.
- **Child** — the agent that implements one story in an isolated worktree and requests approval when it needs
  elevated permission.
- **Driver** — the host-neutral adapter that launches/controls a child (Codex MCP today).
- **Run** — one autopilot execution, with durable artifacts under `.codex/agentic-workflow-kit/runs/<runId>/`.
- **Gate** — an evidence check the runner applies before acting (completion gate, capability gate).
- **Capability** — an autonomous power that is unlocked only when its guarantees hold.
- **Escalation / approval** — a child request for elevated permission (e.g. network), adjudicated by policy
  or a human.
- **Projection** — a derived view (state, metrics) recomputed from the event log, never authored directly.
