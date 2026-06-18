---
title: D0 — Architecture spine & contracts
status: draft (approved in concept)
last-reviewed: 2026-06-18
part-of: autopilot-durability
themes: [E, G, I, "enables D", "enables H"]
---

# D0 — Architecture spine & contracts

The cross-cutting foundation every domain (D1–D5) builds on. This doc defines **how the system stays
safe and recoverable**, the **one mechanism** that makes children controllable, the **state model** that
makes divergence impossible, and the **vNext contracts** plus **migration**. Domain-specific behavior
lives in D1–D5; this is the shared spine.

See [the README](../README.md) for the incident context and the constraints this design was built under.

## Design goals & inherited principles

**Primary goal:** *safety + recoverability first.* When tradeoffs collide, prefer an action that is
reversible or stoppable; if a safe action can't be guaranteed, **stop in a clean, diagnosable recovery
state** rather than take a risky one. Autonomy is *earned* by proving guarantees, never assumed.

Inherited from the existing redesign (we reconcile, not replace):

- **P5 — evidence over prose:** completion/merge come from verifiable evidence, not child self-report.
- **P6 — recoverability is a feature:** ambiguous/stale state stops diagnosably; recovery is in-band.
- **P4 — configured autonomy:** the runtime may only do what repo policy allows.
- **P8 — provider-neutral driver:** Codex-specific code stays in the driver; the spine is host-neutral.

**Non-goals (D0):** domain mechanics (provisioning, control internals, analysis) — those are D1–D5.

---

## 1. Safety model — capability-gating ("earn autonomy")

The system exposes a small, fixed set of **autonomous capabilities**. Each is **locked behind explicit
runtime guarantees**. Before exercising a capability the runner evaluates its guarantees against current
evidence; if any fails, the capability is **disabled** and the run degrades to its declared safe fallback.

### Capability registry (initial set; finalized per domain)

| Capability | Unlocked only when (guarantees) | On guarantee failure |
|---|---|---|
| `escalation-auto-grant` | request matches the repo `escalationPolicy` allowlist | next tier (orchestrator/human) — D1 |
| `orchestrator-decide-approvals` (`auto` mode) | mode = `auto` **and** request risk-tier ≤ `autoMaxRiskTier` (low, or low+medium) | escalate to human (park) — D1 |
| `auto-merge` | CI green via independent inspector + required reviews satisfied + **child is killable (owned process)** + run-state coherent | hold merge; park recoverable — D3 |
| `auto-recover` / `auto-relaunch` | run-state coherent + no live **un-owned** child + evidence classified safe-to-take-over | stop; require operator — D4 |
| `unattended-run` | every escalation is policy-covered **or** orchestrator-decidable within risk bounds | park at first request that is neither — D1 |

> **Approval modes** (operator-selectable per run; full spec in [D1](01-execution-substrate-and-provisioning.md)): `manual` (every escalation → human) · `assisted` (policy → human) · `auto` (policy → risk-tiered orchestrator-decide → human). Default `assisted`; `auto` is opt-in.

### How it works

- Guarantees are **pure predicates over recorded evidence** (CI status, reviews, ownership flag, state
  coherence). They take no side effects, so they are deterministic and unit-testable.
- Each evaluation emits a durable **`CapabilityGateRecord`** — `{capability, decision: allow|deny,
  guarantees: [{name, ok, evidenceRef}], at}` — written to the event log.
- The operator (and `analyze_run`) can therefore always answer *"why did/didn't the autopilot do X?"* by
  reading the gate record. This is the structural antidote to themes **F3/H**: autonomous decisions become
  evidence-gated **and** inspectable.

### Conservative defaults

Capabilities ship **off** until their guarantees can be satisfied. Notably `auto-merge` is disabled until
the control plane (D2) can prove a child is killable — so the unsafe Run-1 posture (auto-merge while a
child couldn't be stopped) is **unreachable by default**.

---

## 2. Keystone — one bidirectional child↔orchestrator channel

D1's approval relay and D2's control plane are **the same channel**, carried over a **kit-owned child
process**. Owning the OS process is what makes everything below reliable (verified in the controllability
spike: reliable kill is a property of process *ownership*, not of any Codex feature).

```
        ┌──────────── kit-owned process (driver retains pid) ────────────┐
 Orchestrator                                                          Child
 (supervise) │ ── control:  interrupt (best-effort) / KILL (guaranteed) ─▶ │ (actor)
             │ ◀─ progress: real tool/phase/evidence events ───────────── │
             │ ◀─ approval REQUEST ─────────────────────────────────────── │
             │ ── approval DECISION (by: policy / orchestrator / human) ──▶ │ ─▶ child resumes
             └────────────────────────────────────────────────────────────┘
  un-owned sessions (desktop app / resume-from-disk) → observe-only, surfaced "not controllable"
```

**Three message classes:**

1. **Progress (child→parent):** real child activity — tool calls, phase, evidence — *distinct from parent
   supervisor polls.* Fixes the F-class "looks active while stale" problem and feeds D5 telemetry.
2. **Approval (child↔parent):** child requests escalation; parent adjudicates via the mode ladder (policy →
   `auto`: risk-tiered orchestrator-decide → human); a **scoped** decision returns; child resumes. The relay (D1).
3. **Control (parent→child):** **two-tier** — *graceful interrupt* (best-effort; may be unsupported on a
   given runtime) layered over *guaranteed kill* (SIGTERM→SIGKILL on the owned pid). The plane never blocks
   waiting on an interrupt whose delivery is unproven; it escalates to kill on timeout. The control plane (D2).

**Ownership classes (honesty rule):** the driver classifies every child as **owned** (kit spawned it and
holds the pid → fully controllable) or **un-owned** (desktop app, resume-from-disk → observe/reconstruct
only). The control plane **refuses to promise** control over un-owned sessions rather than attempting a
kill/interrupt that physically can't land. `auto-merge` and `auto-recover` require an owned child.

**Driver contract (host-neutral) implications:** the driver must (a) own the subprocess and expose its pid
(the MCP SDK transport already exposes one; or spawn directly), (b) carry the three message classes,
(c) report an ownership class. A future true-live-interrupt path (Codex experimental `app-server` daemon +
control socket) is an **optional, flag-gated** driver capability, probed per Codex version — not a
dependency of the spine.

---

## 3. State model — event-sourced single source of truth

**The append-only event log is the only authored state.** Everything else —
`state`/`summary`/`metrics`/`launch` — becomes a **projection**: a pure function of the event log,
recomputed, never independently written.

Consequences:

- **Linkage clobber (E) becomes impossible.** `child-session-linked` is an append-only *fact*; a launch
  view derives `sessionId` from it. There is no writer that can overwrite a known-good link with a stale
  in-memory value, because views aren't written from memory at all.
- **State divergence (G) becomes impossible.** `state` and `metrics` can't disagree when both are
  projections of the same log; there is nothing to reconcile.
- **No manual artifact edits.** Operations that today require hand-editing `state.json`/`launch.json`
  (duplicate-launch clearing, recovery reconciliation) become **events** appended through supported
  controls (D4).

Mechanics: atomic append (one event = one durable line); deterministic projection rebuild from the log
(also the migration path for legacy runs); tolerance for a malformed trailing line (skip + keep
supervising). The **structured `child-run-result`** is the only completion-evidence source — retiring the
free-text evidence parser (theme **I/F6**).

---

## 4. Core vNext contracts (overview)

Defined here at the spine level; field-level detail lives with the owning domain.

| Contract | Shape (summary) | Owner |
|---|---|---|
| **Event** | `{seq, at, type, topic, level, storyId?, data}` — append-only; the source of truth | D0 |
| **Projections** | `state` / `summary` / `metrics` / `launch` — derived, read-only | D0 |
| **`CapabilityGateRecord`** | `{capability, decision, guarantees:[{name, ok, evidenceRef}], at}` | D0 |
| **`child-run-result`** | structured: changed files, verification evidence, PR refs, blockers, reviewer findings (no prose parsing) | D5 / D3 |
| **`ApprovalRequest` / `Decision` / `Outcome`** | `{requestId, kind, riskTier, command?, host?, reason}` → `{grant\|deny, by: policy\|orchestrator\|human, scope, rationale?, at}` → outcome | D1 |
| **`ControlRequest` / `Outcome`** | `{kind: interrupt|kill, target, reason}` → `{requested|applied|unsupported|already-terminal}` | D2 |
| **Config: `escalationPolicy`** | allowlist of auto-grantable escalations; **default pre-approves standard dependency install** (declared registries) | D1 |
| **Config: `approval`** | `{mode: manual\|assisted\|auto, autoMaxRiskTier: low\|medium}` — orchestrator-decide bounds | D1 |
| **Config: `capabilities`** | which autonomous powers are enabled (default off) | D0 |
| **Tool envelope** | reuse redesign's `{ok, operation, apiVersion, result, artifacts, warnings, next}`; add typed approval/control/capability results | D0 |

---

## 5. How the domains compose

- **D1** provisions an owned, correctly-permissioned child and runs the **approval** message class against
  `escalationPolicy` + the `awaiting-approval` park/resume flow.
- **D2** owns the **progress** + **control** message classes and emits `child-session-linked` (the linkage
  fact) and live supervision derived from real progress.
- **D3** consumes `child-run-result` + independent inspectors to drive the completion gate and the
  `auto-merge` capability.
- **D4** turns recovery and duplicate-launch handling into appended events over projections; defines the
  recovery states and the `auto-recover` capability.
- **D5** defines structured telemetry and an analyzer that **auto-fires on terminal/block** and correlates
  the event log (themes **I/J**).

---

## 6. Migration (0.7.0 → vNext)

- **Additive event-sourcing.** Where a legacy run has `events.ndjson`, rebuild projections from it; where it
  doesn't, mark the run **read-only/legacy** (no silent half-migration).
- **Config.** Introduce `escalationPolicy` (default **pre-approves standard dependency install** to declared
  registries; all other network/privilege escalates), `approval` (default `mode: assisted`), and
  `capabilities` (default all off; `auto-merge` stays off until its gate can pass). Override precedence is
  made deterministic — **operator overrides win** (fixes theme **C**) — and specified in D1.
- **Driver.** Add process-ownership (retain pid; terminating timeouts). The current borrowed-process path is
  retained as a **`control-degraded`** fallback that is explicitly surfaced (and blocks `auto-merge`),
  never silently relied upon.
- **Versioning.** Bump the config/runtime version surfaces already present in the kit; gate new tools behind
  the existing capability-flag inspection.

---

## 7. Open questions (D0)

1. **`app-server` daemon path:** prototype true live-interrupt behind a flag with a per-version capability
   probe? (Spike says it's the only live-control surface but is experimental and version-churny.)
2. **Exact v1 capability set:** is the four-capability registry above complete, or do we split (e.g.
   `auto-pr` vs `auto-merge`)?
3. **Projection store:** keep per-projection files (rebuilt) or a single derived snapshot? (Testability and
   `analyze_run` both favor deterministic rebuild.)

---

## 8. Testability (why this spine is verifiable)

- **Capability guarantees** are pure predicates over evidence → exhaustive unit tests per guarantee.
- **Projections** are pure functions of the event log → property tests (replay a log, assert the projection;
  fuzz event orderings to prove convergence).
- **Channel** is exercised against a **fake driver** that emits scripted progress/approval/control events,
  so D1/D2 flows (park/resume, interrupt→kill escalation, ownership classes) are testable without a real
  Codex process.
- **Migration** is testable by rebuilding projections from captured legacy `events.ndjson` fixtures
  (the real incident artifacts are available as fixtures).

---

## Themes addressed by the spine

| Theme | How D0 addresses it |
|---|---|
| E | Linkage is an append-only fact; projections derive it → clobber impossible |
| G | `state`/`summary`/`metrics` are projections of one log → divergence impossible; recovery via events, no manual edits |
| I | Structured `child-run-result` replaces free-text evidence parsing |
| D (enables) | Process ownership + two-tier control channel make a child killable; `auto-merge` gated on it |
| H/F3 (enables) | Capability gates make completion/merge evidence-gated and inspectable |
| C (sets up) | Deterministic override precedence declared here; specified in D1 |
