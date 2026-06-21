# Design closure — kit-vnext agent provider / core-first readiness

This folder is a **self-contained work package**. Its job: close the design gaps that block
implementing kit-vnext **core-first** (core built and tested against abstract ports + mock drivers,
with no dependency on real provider implementations). The work is split into **decision** and
**authoring** tasks across **three waves**.

You (a fresh session) were handed this folder. Read this file fully, then read the wave you were asked
to run. Everything you need is here or in the kit-vnext corpus referenced below.

---

## The single most important rule

**You produce PROPOSALS, not edits to the live design corpus.**

- **READ** the corpus read-only: `docs/design/**` and `docs/implementation/**` (relative to the
  worktree root). Cite file paths + sections for every claim.
- **WRITE only** under `design-closure/outputs/wave-<N>/`. Do **not** create, edit, move, or delete
  any file under `docs/`. Not even an obviously-correct one. The architect reviews proposals and
  applies them later.
- If a change *seems* trivially right, still write it as a proposed draft in your output folder and
  list the corpus file/section it would amend. Never touch the corpus.

A proposal that modified the corpus has failed the task regardless of how good the content is.

---

## Context (kit-vnext, in brief)

kit-vnext is a deterministic control plane that delegates bounded work to agent workers, observes
them, takes their outputs, and records evidence. The control plane is plain code — no LLM
orchestrator.

A prior readiness audit established two things that frame all of this work:

1. **The architecture is already dependency-inverted.** The four provider interfaces
   (`AgentProvider`, `ExecutionHostProvider`, `ForgeProvider`, `WorkSourceProvider`) and the storage
   ports live in `packages/sdk` (the consumer); provider packages only *implement* them. "Providers
   before core" is *mock + attestation-evidence sequencing*, not a code dependency. Core can be built
   against ports + mocks today.
2. **What blocks a clean core-first start is a focused refine-backlog**: a few untyped shared
   contracts, a few open policy decisions, and a doc/frontier reorg that makes the inversion legible.
   These tasks are that backlog.

Goal state: every core domain's blocking open-questions are closed, every type core imports is
authored in one owned location, and the build order is legibly **foundation → seam ports & mocks →
core → real drivers**.

---

## Operating rules (every session and every sub-agent)

- **Isolated working copy.** Run from a working copy that contains the restructured corpus
  (`docs/design/30-domain-reference/` must exist) — not the repo's primary checkout. A git worktree is
  ideal. For parallel multi-model comparison runs, each model runs in its **own** working copy (see
  `prompts/HOW-TO-RUN-MULTI.md`). Before writing, confirm the corpus is present and you are not in the
  primary checkout.
- **Read-only corpus, write-only outputs.** (See the rule above.)
- **Decisions are recommendations, not fiat.** For decision-type tasks (T1, T2, T6, T7, T8): propose a
  **recommended** option with rationale and the alternatives you rejected and why. The architect
  approves or amends. Do not present a decision as final/applied.
- **Evidence-cited.** Every claim references a corpus path + section. No claim from memory.
- **Falsifiable ACs.** Each task lists enumerated acceptance criteria. Your deliverable must show, per
  AC, where it is met. If an AC cannot be met, say so and why — do not paper over it.
- **No invention across the seam.** If you need a frozen decision from an earlier wave and it is
  missing or ambiguous in `outputs/`, flag it as a blocker. Do not invent it.

---

## How to run (sequential, with a review gate per wave)

1. **Wave 1** — give a fresh session `prompts/run-wave-1.md`. It orchestrates tasks T1–T4, writes
   deliverables under `outputs/wave-1/`, and writes `outputs/wave-1/WAVE-1-SUMMARY.md`. Then it stops.
2. **Architect review** of `outputs/wave-1/`. (This is the gate. Wave 2 consumes frozen Wave-1
   decisions.)
3. **Wave 2** — give a fresh session `prompts/run-wave-2.md`. It reads `outputs/wave-1/` as frozen
   input, orchestrates T5–T8, writes `outputs/wave-2/`. Stops.
4. **Wave 3** — give a fresh session `prompts/run-wave-3.md`. Orchestrates T9, writes `outputs/wave-3/`.

Each wave is handled by **one session**. If the product supports parallel sub-agents, it gives one per
task; otherwise it completes the tasks sequentially. Deliverables and acceptance criteria are identical
either way.

**For parallel multi-model runs** (the same prompt across Codex, Antigravity/Gemini, and Claude), see
`prompts/HOW-TO-RUN-MULTI.md` — it isolates each model in its own working copy so a single prompt
serves all, and `REVIEW-RUBRIC.md` for how the runs are compared.

---

## Wave / task map

| Wave | Tasks | Theme | Depends on |
|---|---|---|---|
| 1 | T1 policy contract · T2 agent-port disposition · T3 port-hoist to SDK · T4 fnd-02 typed contracts | Unblockers — fully parallel | — |
| 2 | T5 fnd-03 event types · T6 core-03 closure · T7 core-05 closure · T8 durability-per-event | Core closures + remaining types | T6←T1,T2 · T7←T1 · T8←T4 (Wave-1 outputs) |
| 3 | T9 DAG/frontier reorg + reclassify runtime attestation | Make the inversion legible | T9←T3 |

**Decision tasks (architect approves):** T1, T2, T6, T7, T8.
**Authoring tasks (mechanical once decided):** T3, T4, T5, T9.

**Execution is the orchestrator's call.** Sub-agent model/effort, parallelism, batching, tool budgets,
and intermediate steps are decided by the wave session. These specs define *what* each task must
deliver and *why* — not *how* to produce it. The non-negotiables are the constraints above (read-only
corpus, write-only outputs, proposals-not-edits, decisions-as-recommendations) and each task's
acceptance criteria.

---

## Deliverable format (every task)

Each task writes to `outputs/wave-<N>/<TASK-ID>/`:

- **`proposal.md`** — required. Contains:
  - **Decision / answer** (for decision tasks: the recommendation + alternatives rejected).
  - **Proposed artifact or change**, inline or pointing at `draft/` files.
  - **Corpus impact** — exact list of `docs/**` files + sections the proposal would amend later (so
    the architect can apply it). Paths only; do not edit them.
  - **Acceptance criteria** — each AC restated with where/how it is met (or why it is blocked).
  - **Open issues / assumptions / risk.**
- **`draft/`** — optional. Standalone draft files (e.g. a proposed typed-contract file, a proposed doc
  section). These are drafts living in the output folder, never applied to the corpus.

The orchestrator additionally writes **`outputs/wave-<N>/WAVE-<N>-SUMMARY.md`**: a table of tasks with
status, the key decisions proposed, blocking issues, and an explicit list of what the architect must
approve before the next wave. End the wave by stopping for review — do not roll into the next wave.
