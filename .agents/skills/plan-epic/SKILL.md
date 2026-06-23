---
name: plan-epic
description: >-
  Author the planning artifacts (Layer-3 story DAG + Layer-4 story contracts) for one epic in the
  kit-vnext / workflow-kit implementation corpus, to the authoring standard, so every story is
  `ready` and the coverage rollup closes for that epic. Use when the user says "plan epic N", "plan
  the next epic", "author the story DAG/contracts for a named epic", or hands you an epic to break
  into stories. Produces markdown planning artifacts only — never provider/feature code. Repo-bound:
  only meaningful inside the workflow-kit repo with docs/implementation + docs/implementation-authoring.
  After ready story contracts exist, hand off to $plan-delivery before $orchestrated-delivery.
---

# Plan an epic

You are the **architect**. Your job is to author the *what* (planning artifacts) for **one epic**
with zero architectural/design/requirements gray areas, so a later delivery derives the *how*. You
do **not** write feature code — `packages/` is intentionally empty; epic planning produces markdown
planning artifacts only. You also do **not** create the execution package; that is the next skill's
job.

The task argument is **the epic to plan** — a number (`2`), a slug, or a name. Resolve it to its
charter directory under `docs/implementation/epics/` in Phase 0. If the argument is ambiguous or
missing, `ls docs/implementation/epics/` and ask which one.

The load-bearing discipline is **verify before you author**. The corpus moves; never author from
memory or from this skill's examples. Phase 0 rebuilds the facts table for *this* epic against the
live repo, and every AC must trace to a real design line.

---

## Phase 0 — Discover this epic's inputs (do not skip)

Build a verified-facts table for the target epic by running these against the repo. Treat the output
as ground truth; if a command contradicts an assumption, the repo wins.

| Fact | How to get it |
|---|---|
| Repo root / base branch + HEAD | `git -C <repo> rev-parse --show-toplevel` and `git log --oneline -1` on `v-next` |
| Epic charter + status | `sed -n '1,60p' docs/implementation/epics/<epic-slug>/README.md` — confirm `status: "epic: ready"` and read `depends-on-epics`, **Included domains**, **Frozen inputs**, per-domain expectations |
| DAG + stories state | `ls docs/implementation/epics/<epic-slug>/stories/` and check `story-dag.md` — confirm they are still placeholders/stubs (don't overwrite real work) |
| Included domain charters (frozen) | the **Included domains** table → `docs/implementation/domains/.../<dom>-*.md` for each; confirm `status` closed/frozen |
| Design seam contracts (frozen) | the charter's **Primary spec surface** / **Frozen inputs** → the `docs/design/` files they name; `wc -l` them so you know the surface you must trace ACs to |
| Per-epic split rule | `grep -n -iE 'split|story contract inputs' docs/implementation/epic-dag.md` — find any rule that names **this** epic (e.g. "split SDK production interfaces from testkit mocks"); it constrains your node boundaries |
| Dependency edges | `grep -n 'Epic <N>' docs/implementation/epic-dag.md` — what this epic consumes and what consumes it (shapes producer/consumer obligations) |
| Proven prior example | the most recently completed epic's `story-dag.md` + `stories/*.md` (e.g. `epic-1-foundation-substrate/`) — copy its shape, not its content |
| Coverage rollup rows | the epic charter's **Per-domain expectations** — each `\| Story Group Signal \| Owning story \| Disposition \|` table in `docs/implementation/epics/<epic-slug>/README.md`; the `Owning story` cells reading `TBD` are the ones you backfill. (`docs/implementation/coverage.md` is a domain→epic rollup, `\| Domain \| Charter \| Owning epics \| Status \|`; it has no story-level cells — do **not** backfill there.) |
| Verify gate | `cat package.json | jq .scripts.check` — what `pnpm check` runs |

Then **read** (do not author from memory):

1. `AGENTS.md` and `CLAUDE.md` (repo root) — invariants, the `docs/design/` map, branch/worktree
   model, the `pnpm check` gate. **`AGENTS.md` wins on conflict.**
2. The authoring standard you author *against* — `docs/implementation-authoring/authoring-standard/`:
   - `40-story-dag.md` — Layer-3 shape + **Gate 3** (your primary deliverable's spec).
   - `50-story-contract.md` — Layer-4 + R1–R5 + **Gate 4** (and Gates 5–6).
   - `60-coverage.md` — exactly-once coverage (covered / deferred / split; partition ≠ deferral).
   - `_templates/story-dag.md` and `_templates/story-contract.md` — copy these to start each artifact.
   - `README.md#verifying-a-layer` — the shared close-out (independent pass before freezing a layer).
3. The operating model — `docs/implementation-authoring/operating-model/` (esp. `architect.md`,
   `characterization-review.md`) — the role and the `ready`-flag gate.

---

## Find the crux before you slice

Every epic has one part that, if gotten wrong, drives the worst downstream churn. Name it explicitly
from Phase 0 before drawing nodes:

- **Producer→consumer seam density** — an epic where one node produces a contract/type that several
  others import (a port → its mock/conformance; a shared DTO/catalog → many seams) is the high-risk
  class (the kind behind the worst prior churn). The per-epic split rule in `epic-dag.md` usually
  points straight at it.
- **Shared shapes declared once.** Any payload/DTO consumed across nodes gets a single named
  producer; consumers cite `<producer-story>/<type>` verbatim and record the **public import path**
  they use. A type a consumer can't import through its intended path is not delivered.

If the slicing approach still feels unsettled after Phase 0, use the `brainstorming` skill before
committing to a DAG. Otherwise proceed.

---

## Plan

1. **Set up.** Create a worktree off `v-next` under `<repo>/.worktrees/<name>`; confirm
   `git rev-parse --show-toplevel` is the worktree before **any** write (sub-agents on this repo have
   committed to the main checkout by mistake — the check is not optional). PR base is `v-next`
   (protected; never push to it directly).

2. **Author the story DAG** (`.../<epic-slug>/story-dag.md`) from `_templates/story-dag.md`, driven by
   the charter's per-domain expectations and the design seams. Make the epic-specific decisions
   explicit and reviewable:
   - apply this epic's **split rule** from `epic-dag.md` to node boundaries (producer vs consumer);
   - **declare each shared shape once** — name the single producer node, consumers cite the type and
     record the public import path;
   - any node with a **public-exposure AC carries a suggested tier** (mandatory at Gate 3);
   - **close coverage** — every epic signal → exactly one node or a named `split`; graph acyclic with
     labelled edges. Run the **Gate 3** checklist and the shared close-out, then **freeze** the DAG
     before authoring contracts.

3. **Characterization-review the DAG.** Dispatch a spec-reviewer sub-agent to grade it against Gate 3
   (quote the source per finding; classify story-defect vs design-defect). You own the verdict. Fix
   and re-freeze if it fails. A divergent independent verdict is signal — surface it.

4. **Author each story contract** under `stories/` from `_templates/story-contract.md`, against the
   frozen DAG. Fan out (one sub-agent per story, strong model, the template + that story's seam as the
   brief — see the `dispatching-sub-agents` skill), then review every artifact yourself. Each must
   pass **Gate 4**: enumerated self-contained ACs each with an evidence clause; spec-surface manifest
   from the design; failure/degraded table whose cited ACs actually assert the row; public-exposure AC
   + import path + public-import test for every exported shape; conformance evidence where the
   standard requires it; numeric file-size budget; constructability; runnable sweeps.

5. **Characterization-review each contract; set `ready`.** Then **backfill the epic charter README**
   (`docs/implementation/epics/<epic-slug>/README.md`) — flip this epic's `Owning story` cells in the
   **Per-domain expectations** `Story Group Signal` tables from `TBD` to real story ids (disposition
   `covered`/`split` as the signal requires); confirm no signal is double-owned. Do not edit
   `docs/implementation/coverage.md` — it tracks domain→epic ownership, not stories.

6. **Gate + PR.** Run `pnpm docs:nav` (you added files), then `pnpm check` green, commit (conventional
   commits), open the PR to `v-next`, and **stop** for review. In the closeout, include the concise
   next step: after these story contracts are ready/landed, use `$plan-delivery` for this epic or
   story batch to create the execution package before invoking `$orchestrated-delivery`.

## Delivery handoff

When the story DAG/contracts are ready, the next step is `$plan-delivery`, not implementation. It
creates the execution package consumed by `$orchestrated-delivery`: `execution/plan.md`,
`execution/tracker.md`, and per-story `execution/prompts/<story-id>/implementer.md` plus
`reviewer.md`. Do not author or patch those execution files in `$plan-epic`; report only that they
are the required next artifact before orchestrated execution.

---

## Verification gate

`pnpm check` must be green before you call any layer done — it runs `docs:nav:check` first, so re-run
`pnpm docs:nav` after adding/moving files. Show the gate output as evidence; do not assert success. If
CI fails after a clean local run, investigate before re-pushing.

---

## Out of scope (even if you notice the opportunity)

- Implementing any feature code or touching `packages/` — planning artifacts only.
- Editing `docs/design/` — frozen, wins on conflict. If a story AC can't trace to a design line,
  escalate a **design gap**; don't invent the requirement or copy design vagueness into a vague AC.
- Editing **other** epics' charters/DAGs/contracts, or the included **domain charters** — immutable.
- Editing the authoring standard under `docs/implementation-authoring/` — it's the bar. (Exception:
  if you find a genuine gate gap mid-authoring, flag it to the user rather than silently changing it.)
- Authoring the next epic — stop at the one you were given.
- Creating the `$plan-delivery` execution package (`execution/plan.md`, tracker, or dispatch prompts).
- Picking up deferred/cross-cutting items the charter explicitly defers — not this epic's job.

---

## Escalation rules

- **Design wins on conflict.** A missing or ambiguous requirement is a design gap to escalate, not a
  thing to invent or guess.
- **A divergent independent verdict is signal, not noise** — if a review sub-agent and your own read
  disagree on a story, the artifact or the rule is under-specified; surface it.
- **Ask before destructive or outward actions** — force-push, deleting branches/worktrees, anything
  touching `v-next` directly. Opening the PR is fine; merging is not (stop and hand back).
- A real blocker (a frozen input is self-contradictory, a seam has no design source) → stop and report
  with the specific file/line, rather than authoring around it.

---

## PR / commit conventions

- Conventional commits (e.g. `docs(epic-<N>): author provider-seam story DAG`); no AI attribution in
  commits or PR.
- One PR to `v-next`. Title + body summarize the DAG shape, the producer/consumer split, and the
  coverage close-out; note `pnpm check` is green.
