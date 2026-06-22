---
title: "Operating model — delivery system spec"
status: draft
last-reviewed: "2026-06-22"
---

# Operating model

> **Audience** — whoever builds or verifies the delivery engine: the `orchestrated-delivery` skill and
> the implementer / reviewer / characterization-review sub-agents.
> **This is a spec, not a runtime doc.** At runtime those agents consume the *authored artifacts* in
> [`docs/implementation/`](../../implementation/README.md) — not this corpus. This file is the contract
> the engine is **built and verified against**; the per-role specs are its children.

## Goal

Drive delivery churn to near-zero by routing each defect class to the place that catches it cheapest —
**with no new tooling** — through two binding rules.

## Background — two defect buckets

Churn comes from two distinct classes that must be caught in two different places. Conflating them is
what made review/fix churn recur wave after wave.

| | Bucket 1 — characterization | Bucket 2 — implementation |
|---|---|---|
| **What** | the "what" was missing / imprecise / inconsistent: an uncharacterized producer→consumer seam, a contract permitting an unsafe state, a public shape never required to be exported, a sweep written as prose | the "what" was clear and the builder erred: a concurrency race, a leak on a throw path, a forgotten re-check |
| **Caught at** | **characterization review** — *before any code* | **code review** — on the implemented draft |
| **Caught by** | architect (+ spec-reviewer sub-agent) | reviewer sub-agent |

## Requirements

The delivery engine must implement:

1. A **characterization-review gate** between planning and dispatch — the checkpoint that moves Bucket 1
   left to where it is cheap to fix.
2. A **binding `ready` flag** — characterization review owns it; nothing not `ready` is dispatchable.
3. **Evidence folded into ACs** — an AC is "X holds, proven by `<command → expected output>`"; satisfying
   the spec *is* producing the proof.
4. **One job per role** — every actor does exactly one of: author · review · prove · verify · coordinate.
5. **Dependency-wave dispatch** — per-story worktree isolation, owned-pathset commits, the DAG's
   suggested tier as a floor.

## Flow

```
ARCHITECT ─ authors ─▶ domain plan · epic plan (DAG) · story characterizations
   │
   └─ dispatches SPEC-REVIEWER ─▶ CHARACTERIZATION REVIEW (Bucket 1) ─ architect owns verdict
                                          │ sets `ready` (binding)
                                          ▼
                ORCHESTRATOR ─ dispatches only `ready` stories, in dependency waves
                                          │  (each story in its own worktree draft)
                                          ▼
        ╭──────────────────── per story: fix / review loop ───────────────────╮
        │                                                                      │
        ▼                                                                      │
  IMPLEMENTER ─ realizes the spec + attaches each AC's evidence                │
        │                                                                      │
        ▼                                                                      │
  REVIEWER ─ verifies evidence + ACs, hunts Bucket-2                           │
        │                                                                      │
        ├─ BLOCKING ─▶ ORCHESTRATOR routes findings back to the implementer ───╯
        │
        ▼ APPROVE
  ORCHESTRATOR ─ commits the approved pathset, opens / updates the PR
```

The implement→review step is a **loop**: the reviewer returns APPROVE or BLOCKING; the orchestrator routes
BLOCKING findings back to the implementer and re-dispatches review, iterating until APPROVE — only then is
the pathset committed.

Two review loops at two altitudes: **characterization review** (pre-dispatch, Bucket 1, architect-owned,
output = `ready`) and **code review** (post-implementation, Bucket 2, reviewer-owned).

## Design — the actors

Each role carries a child spec (goal · requirements · inputs · outputs · flow · validation · acceptance ·
refs). Every role does exactly one of author / review / prove / verify / coordinate.

| Role | Does | Spec |
|---|---|---|
| **Architect** | authors *and* reviews the "what"; owns the verdict + the `ready` flag | [architect.md](architect.md) |
| **Characterization review** | the Bucket-1 gate: each story complete, consistent, constructable, every AC carrying an evidence clause | [characterization-review.md](characterization-review.md) |
| **Orchestrator** | pure coordination: waves, worktree isolation, pathset commits, PR; refuses non-`ready` | [orchestrator.md](orchestrator.md) |
| **Implementer** | realizes one story within its pathset; proves each AC as pasted output; **fixes BLOCKING findings and re-proves each round**; stops on a bad spec | [implementer.md](implementer.md) |
| **Reviewer** | verifies evidence + ACs; owns the Bucket-2 hunt; **re-reviews each fix until APPROVE**; escalates spec gaps | [reviewer.md](reviewer.md) |

The "what" these roles consume — domain plan (entity altitude), epic DAG (work-item altitude), story
characterizations (per-story altitude) — is specified by the
[authoring standard](../authoring-standard/README.md), not here.

## Validation

The engine conforms to this spec when, on a representative epic:

- the orchestrator **refuses to dispatch** a non-`ready` story (a boolean check, not a judgment);
- a story with an uncharacterized seam is **blocked at characterization review**, not at code review;
- the implementer **stops and reports** a characterization defect rather than improvising the "what";
- the reviewer **escalates** a spec gap to the architect instead of coding around it;
- every committed change is exactly one approved pathset.

## Acceptance

The model is correctly implemented when, across waves, Bucket-1 escapes to code review trend to zero and
Bucket-2 findings are caught by review rather than shipped — tracked by the
[lessons ledger](../lessons-ledger.md) closing each retro lesson onto a gate or a role defined here.

## References

- [Authoring standard](../authoring-standard/README.md) — the "what" each artifact must deliver.
- [Lessons ledger](../lessons-ledger.md) — retro lessons → covering gate or role.
- `orchestrated-delivery` skill — the runtime "how" that implements these responsibilities.
- Design corpus [`docs/design/`](../../design/README.md) — owns the invariants; wins on conflict.
- **Grounding:** Epic 1 retro (PRs #127 / #128). The worst churn (a producer/consumer seam break) and the
  top finding (a fail-open credential contract) were both Bucket 1 that escaped to code review for lack of
  this gate; the genuine bugs (a lease race, a throw-path leak) were Bucket 2, correctly caught by review.
