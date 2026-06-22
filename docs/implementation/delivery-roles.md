---
title: kit-vnext — delivery roles and responsibilities
status: draft
last-reviewed: "2026-06-22"
---

# Delivery roles and responsibilities

This document defines **who does what** across the delivery system: the actors that run a
delivery, the planning artifacts that characterize the work, and the seam between them.

**Scope.** This is the operating-model companion to the
[work-item authoring guide](work-item-authoring-guide.md): the guide defines *what* each planning
artifact must deliver; this document defines *who* authors, reviews, proves, and verifies it, and the
hand-offs between them. It is **not** normative design — `docs/design/` owns the invariants and the
`docs/implementation/` artifacts own the planning "what"; when this document conflicts with either,
they win. The runtime "how" (prompts, isolation, commit mechanics) lives in the `orchestrated-delivery`
skill; this document names the responsibilities that skill must implement.

> It lives under `docs/implementation/` to keep the implementation docs together. That stretches this
> folder's stated scope, which excludes execution-process material; the boundary may be reconciled in a
> later restructure.

---

## Why this exists — the two defect buckets

Delivery churn comes from two distinct defect classes, and they must be caught in two different
places. Conflating them is what made review/fix churn recur wave after wave.

- **Bucket 1 — characterization defects.** The "what" was missing, imprecise, or internally
  inconsistent: a producer that never characterized the interface its consumer imports; a contract
  that permits an unsafe state; a public shape never required to be exported; a sweep specified as
  prose instead of a runnable recipe. These are **defects in the spec**, not the code. They must be
  caught at **planning time**, by **characterization review** — before any code is written.

- **Bucket 2 — implementation defects against a clear "what".** The spec was unambiguous and the
  builder made an honest mistake: a concurrency race, a resource leak on a throw path, a forgotten
  re-check. These are caught at **code review**. This is what review legitimately exists for; the
  goal is not to spec them away but to have a competent reviewer find them.

Every role below does exactly one of four things: **author** the what, **review** the what,
**prove** the what, **verify** the what — or **coordinate**. No role does more than one.

---

## The flow

```
ARCHITECT ─ authors ─▶ domain plan · epic plan (DAG) · story characterizations
     │
     ├─ dispatches ─▶ SPEC-REVIEWER (sub-agent)  ── assists ──┐
     │                                                         ▼
     └────────────────────── CHARACTERIZATION REVIEW (Bucket 1) ── architect owns verdict
                                          │
                                   sets `ready` flag
                                          │
                                          ▼
                              ORCHESTRATOR ── dispatches only `ready` stories, in dependency waves
                                          │
                          ┌───────────────┴───────────────┐
                          ▼                                 ▼
              IMPLEMENTER (sub-agent)            (per story, in its own worktree draft)
              realizes spec + attaches evidence
                          │
                          ▼
                 REVIEWER (sub-agent) ── verifies evidence + ACs, hunts Bucket-2 defects
                          │
                   verdict: APPROVE / BLOCKING
                          │
                          ▼
              ORCHESTRATOR ── commits the approved pathset, opens / updates the PR
```

**Two review loops, two altitudes:**
- **Characterization review** (pre-dispatch) catches **Bucket 1**. Owned by the architect; may be
  assisted by a spec-reviewer sub-agent. Its output is the binding `ready` flag.
- **Code review** (post-implementation) catches **Bucket 2**. Owned by the reviewer sub-agent
  against the implemented draft.

---

## Runtime actors

### Architect

The author and the reviewer of the **"what"**. Says what, not how.

- **Owns:** the domain implementation plan, the epic plan (DAG), and the story characterizations;
  the characterization-review verdict; the `ready` flag.
- **Does NOT:** write production code, run the delivery loop, or dictate implementation mechanics.
- **Receives → hands off:** authors characterization → reviews it (optionally via a spec-reviewer
  sub-agent) → marks stories `ready` → hands the epic plan to the orchestrator.

### Characterization review (the gate)

The new first-class checkpoint between *planning* and *dispatch*. This is the structural change that
moves Bucket 1 left to where it is cheap to fix.

- **Owns:** verifying each story characterization is **complete, internally consistent, and
  constructable** against the definition-of-ready, and that every acceptance criterion carries an
  **evidence clause** (`X holds, proven by <command → expected output>`).
- **Performed by:** a **spec-reviewer sub-agent** the architect dispatches (reviews the plan like a
  PR), with the **architect owning the final verdict**. The sub-agent assists; it does not decide.
- **Output:** the `ready` flag — which is **binding**: a story that is not `ready` is not
  dispatchable.
- **Does NOT:** review or anticipate implementation code.

### Orchestrator

Pure coordination. Moves work; never judges it.

- **Owns:** sequencing dependency waves; per-story worktree isolation; capacity planning (reserve
  reviewer/readdress slots within the agent cap); honoring the **characterized ownership** (workers
  touch only their owned pathset; the orchestrator wires coordinator-owned shared files) and the
  **characterized model tier** (the DAG's suggested tier is the floor); committing **only the
  approved pathset**; opening/updating the PR; **gating on the reviewer's verdict** and routing
  BLOCKING findings back to the implementer.
- **Hard rule:** **refuses to dispatch any story not flagged `ready`** — a boolean check, not a
  judgment.
- **Does NOT:** review code, judge the "what", inspect diffs for quality, or improvise scope.
- **Reviews against drafts, never stashed trees:** a reviewer is always pointed at the story's
  isolated worktree draft, never a tree with sibling files stashed out.

### Implementer sub-agent

Realizes one story's characterization and **proves** it.

- **Owns:** implementing strictly to the story's acceptance criteria within its owned pathset, and
  **producing each AC's evidence as pasted command output** (the test run, the sweep output, the
  coverage number, the public-import test).
- **Does NOT:** redefine or extend the "what"; touch shared / coordinator-owned files; or paper over
  a bad spec. If the characterization is missing, contradictory, or blocking, it **stops and reports
  a characterization defect** to the architect rather than improvising.
- **Receives → hands off:** the full story characterization (+ ownership, non-goals, evidence
  requirements) → returns the implementation and its attached evidence.

### Reviewer sub-agent

Verifies the implementation against the characterization, and owns **Bucket 2**.

- **Owns:** confirming each AC is met **and its evidence is present and genuine** (spot-re-runs); and
  the **Bucket-2 hunt** — concurrency, resource leaks, code-level fail-open, boundary leaks. This is
  its real value.
- **Does NOT:** re-characterize or fix. If it finds a spec gap, it **escalates a characterization
  defect to the architect** instead of silently coding around it.
- **Output:** a structured verdict — APPROVE, or BLOCKING with findings.

---

## Planning artifacts (the "what")

These are authored by the architect and gated by characterization review. They carry the
characterization at three altitudes.

### Domain implementation plan — *entity altitude*

- **Characterizes:** entity contracts, types/events, the seam **shapes** stories will expose and
  consume, and which contracts form the public SDK surface.
- **Must guarantee:** safety invariants are **intrinsic / fail-closed by construction** for
  safety-critical entities (an unsafe state is unrepresentable, not merely discouraged), and every
  contract is **constructable** (no shape that no value can satisfy).

### Epic implementation plan — *work-item altitude* (the DAG)

- **Characterizes:** waves and dependency order; per-story **owned pathsets**; **shared-file
  ownership** (every file touched by more than one story is assigned to a single owner story or
  marked coordinator-owned integration); producer→consumer **seams recorded by public import path**
  (not just by type name); a **phase-boundary readiness gate** (before phase N+1, every seam it
  consumes is exported and importable); the suggested model tier per story.

#### Story characterizations — *per-story altitude*

- **Characterizes, for each story:** acceptance criteria that each carry an **evidence clause**;
  **public SDK exposure** (export path + a public-import test); the **seam contract** including its
  import path; **constructability / internal consistency**; a **file-size budget as a number**; a
  **negative-case matrix**; the **per-story coverage command**; and non-goals.
- A story reaches `ready` only after characterization review.

### Authoring guide + story template — *the definition of complete characterization*

- **Not an actor.** This is the meta-spec: it defines what a complete domain plan, epic DAG, and
  story characterization must contain, and it **is the checklist the characterization review runs**.
- **Discipline:** new lessons are encoded as a **named characterization dimension or an AC evidence
  clause** — never as accumulated narrative. The guide should shrink toward a definition-of-ready,
  not grow.

---

## The two enforcement rules

Everything above rests on two rules. Without them the model degrades back to prose-as-process.

1. **The `ready` flag is binding.** Characterization review owns it; the orchestrator hard-refuses
   anything not `ready`. This is what makes Bucket 1 go to zero rather than merely shrink.
2. **Evidence is folded into the acceptance criteria.** An AC is never "X holds"; it is "X holds,
   proven by `<command → expected output>`". Satisfying the characterization *is* producing the
   proof — which is how enforcement works with no new tooling.

---

## Grounding

This model is derived from the Epic 1 delivery retro (PRs #127 and #128). The worst single churn
case (a producer/consumer seam break) and the highest-severity finding (a fail-open credential
contract) were both **Bucket 1** defects that escaped to code review and the PR because there was no
characterization-review gate. The genuine implementation bugs (a lease race, a leak on a throw path)
were **Bucket 2** — correctly caught by review. The split above exists to send each class to the
place that can catch it cheapest.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](./README.md) · **← Prev:** [implementation contract](./README.md) · **Next →:** [work item authoring guide](./work-item-authoring-guide.md)

<!-- /DOCS-NAV -->
