---
title: "orchestrated-delivery — charter and evals"
status: draft
last-reviewed: "2026-06-23"
---

# orchestrated-delivery

## Mandate

Execute a `ready_for_implementation` package: dispatch its `ready` stories in dependency-gated waves, run
the implementer/reviewer loop, commit each approved story's pathset, record durable tracker evidence, and
open or update PRs — stopping at the requested boundary. Bind runtime facts; author nothing.

## Why it exists

It is the orchestrator role at runtime: pure coordination. Keeping it execution-only — no scope, prompt,
AC, order, model-class, or effort decisions — is what makes a low-tier-friendly, resumable run possible
and keeps the *what* under the characterization gate rather than under execution pressure. Everything it
needs was decided upstream; its discipline is to bind facts and move work, not to think about the *what*.

## Embodies / operates on

- Role: [orchestrator](../operating-model/orchestrator.md); dispatches
  [implementer](../operating-model/implementer.md) + [reviewer](../operating-model/reviewer.md) (Bucket 2).
- Input: the execution package. It binds runtime/provider facts only.

## Input gate (refuse if unmet)

- An existing package marked `ready_for_implementation`, field- and prompt-complete, with tracker rows
  mapping to the selected stories.

Refuse, and route to the owning planning step, on a missing, incomplete, underspecified, over-risk, or
non-ready package. Structural file presence alone is not readiness.

## Output gate (done means)

- Each approved story's pathset committed after its gate; a durable tracker-evidence commit after each
  story commit; downstream stories unlock only after both commits exist.
- Source-contract blockers reported by workers are recorded durably in the affected tracker row, with no
  story commit, no dependent unlock, and an upstream route-back to the owning planning step.
- PRs opened or updated only when authorized; review waiting is detect-only; merge and cleanup only on
  explicit current instruction. Stop at the requested boundary.

## Binds at runtime (the only things it decides)

Surface capabilities, provider profile, concrete model resolved from the declared class, actual supported
effort, worker cap, completion signal, and current dependency commit hashes. These are facts, not
decisions about the work.

## Boundaries (never)

- Author or repair scope, prompts, ACs, dependency order, model class, or effort.
- Judge the *what* or improvise scope; reviewer approval is advisory, not a commit trigger.
- Let workers stage, commit, push, PR, merge, or close their own contexts.

## Evals

| ID | Requirement | Sev | Modality |
|---|---|---|---|
| OD-1 | Triggers only for an existing `ready` package; refuses missing/incomplete/underspecified/over-risk/non-ready; authors nothing. | P1 | P/T |
| OD-2 | Binds runtime/provider facts only (model from class, effort, cap, completion signal, dependency hashes); changes no package decision. | P1 | P |
| OD-3 | Dispatches only `ready` stories in dependency waves; a dependent waits for its producer's story commit + tracker-evidence commit + worker closure. | P1 | E/T |
| OD-4 | Reuses one implementer + one reviewer context per story; all fix/rereview rounds message that persistent pair incrementally; workers never stage, commit, push, PR, merge, or close. | P1 | E/T |
| OD-5 | Reviewer approval is advisory; the coordinator inspects diff, scope, and gate, and commits only the approved pathset. | P1 | E/T |
| OD-6 | Durable two-commit sequence (story commit, then tracker-evidence commit); downstream readiness needs both. | P1 | E/T |
| OD-7 | PR/merge boundary respected: detect-only review waiting; merge and cleanup only on explicit instruction; stop at the asked boundary. | P1 | E |
| OD-8 | Sparse communication; no tight polling or transcript/diff dumps. | P2 | E |
| OD-9 | Worker-reported source-contract blockers are recorded as planning blockers, not committed as story work or bypassed; dependents remain locked until planning repair. | P1 | E/T |

This skill already ships an `EVALS.md` (at `.agents/skills/orchestrated-delivery/EVALS.md`) that
operationalizes these as test cases R1–R24 with a version-pinned combined hash; that file must satisfy
OD-1…OD-9.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Delivery pipeline — the skill spec](./README.md) · **← Prev:** [plan-delivery — charter and evals](./30-plan-delivery.md) · **Next →:** [implementation lessons ledger](../lessons-ledger.md)

<!-- /DOCS-NAV -->
