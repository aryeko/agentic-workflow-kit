---
title: kit-vnext — next-generation workflow kit (design home)
status: high-level design (scaffold)
last-reviewed: 2026-06-18
---

# kit-vnext

The design home for the next-generation workflow kit. This folder is a **fresh, greenfield
design**: it does not depend on, derive from, or modify any prior kit code or docs. Read it top
to bottom to understand the system; design a single domain by reading this plus that domain's
charter. Docs are **human-readable first** and layered **high-to-low** — read only the depth you
need (see [Documentation principles](conventions.md#documentation-principles)).

## Mission

Delegate well-scoped units of work to agent workers and land them as **reviewed, merged changes** —
safely, recoverably, and under human supervision.

## Why a new kit (motivation)

A delegated run must guarantee three things it can otherwise silently lose:

- **Control** — a running worker is observable, interruptible, and killable.
- **Recoverability** — ambiguous or stale state stops in a diagnosable place; recovery is in-band,
  never manual artifact surgery.
- **Evidence** — "done" and "merge" rest on independently gathered evidence and explicit policy,
  not a worker's self-report.

vNext makes these **architectural invariants**, not best-effort behaviors. Autonomy is *earned* by
proving guarantees; it is never assumed. When guarantees cannot be met, the system stops in a clean,
diagnosable state rather than taking a risky action.

## The identity (three reframes)

1. **Supervision-first; autonomy earned.** The human is a first-class participant, not a fallback.
   The kit's job is to make one person's judgment leverage many runs. Autonomy is a narrow set of
   capabilities, each unlocked only when its guarantees hold.
2. **Provider seams.** Everything host- or tool-specific lives behind a contract: the **Agent** (the
   model), the **Execution Host** (where/how it runs), the **Forge** (PR / merge), and the **Work
   Source** (tasks + status authority). The core depends only on the contracts.
3. **Deterministic control plane; agents are workers.** Supervision, state, gating, and recovery are
   deterministic code — not an LLM "orchestrator." Agents are rented behind the Agent seam for
   bounded judgment tasks (implement a task; adjudicate an approval).

## How to read this folder

| Order | Doc | Why |
|---|---|---|
| 1 | This README | What the system is and why. |
| 2 | [requirements.md](requirements.md) | What it must do + the quality bar, made verifiable. |
| 3 | [decisions.md](decisions.md) | The architectural decisions and their rationale. |
| 4 | [architecture.md](architecture.md) | Layers, the Dependency Rule, the capability model, diagrams, the domain map. |
| 5 | [conventions.md](conventions.md) | How every domain design is written and reviewed. |
| 6 | [glossary.md](glossary.md) | Shared vocabulary — use these terms exactly. |
| 7 | [domains/](domains/README.md) | The 13 domain charters — each is the brief for one design session. |

## Scope & status

- **Greenfield.** Local-first; remote execution is a later driver behind the Agent seam.
- This is the **high-level scaffold only.** Each domain's low-level design is produced in its own
  session, from that domain's charter, following [conventions.md](conventions.md).
- The high-level design is chief-architect-owned. Domain designs are reviewed and approved against
  their charter + conventions before they are considered done.

## Working model

A senior engineer picks up one domain. They read this README, [architecture.md](architecture.md),
[conventions.md](conventions.md), [glossary.md](glossary.md), and their domain's `charter.md` (plus
any sibling contracts the charter names). They produce a `design.md` in their domain folder using the
[domain design template](_templates/domain-design-template.md). The chief architect reviews it against
the charter and conventions. Nothing outside `docs/kit-vnext/` needs to be read.
