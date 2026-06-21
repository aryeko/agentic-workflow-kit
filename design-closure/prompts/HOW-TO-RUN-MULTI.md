# Running Wave 1 across multiple models (one prompt, parallel, independent)

Goal: run the **identical** Wave-1 prompt with Codex, Antigravity (Gemini), and Claude — in parallel,
independent (no run sees another's work) — then compare. This file is the **harness** (operational, for
the human). It is not a prompt, and there is no per-model prompt: all three run
`design-closure/prompts/run-wave-1.md` unchanged.

## The principle

**One prompt; isolation by working copy.** The only thing that differs per run is *which folder the
agent is launched in* — supplied at launch, never written into the prompt. Each model gets its own
working copy (a git worktree), runs the same prompt, and writes to the same *relative* path inside its
own copy. No collision, full independence.

## Steps

1. **Base branch.** This work package lives on the **`design-closure`** branch (canonical worktree
   `.worktrees/design-closure`), which already contains the corpus + this package committed. Cut the
   per-model worktrees from that branch — they inherit everything, no copying needed.

2. **Create one worktree per model**, each cut from the `design-closure` branch, on its own run branch:

   ```
   # from the repo root: /Users/aryekogan/repos/workflow-kit
   git worktree add -b closure/wave1-claude  .worktrees/closure-wave1-claude  design-closure
   git worktree add -b closure/wave1-codex   .worktrees/closure-wave1-codex   design-closure
   git worktree add -b closure/wave1-gemini  .worktrees/closure-wave1-gemini  design-closure
   ```

   Each worktree now has the full corpus + `design-closure/`, cut from the same commit (fair start).

3. **Run the same prompt in each**, with each product, CWD = that worktree:
   - Claude → in `.worktrees/closure-wave1-claude`, run `design-closure/prompts/run-wave-1.md`.
   - Codex → in `.worktrees/closure-wave1-codex`, same prompt file.
   - Antigravity/Gemini → in `.worktrees/closure-wave1-gemini`, same prompt file.

   They may run at the same time. Each writes only to its own `design-closure/outputs/wave-1/`.

4. **Collect for comparison.** Copy each run's output into the canonical worktree under a per-product
   folder (the product name is the only differentiator, and it lives in the path, not the prompt):

   ```
   # into the canonical worktree (.worktrees/design-closure)
   mkdir -p design-closure/outputs/wave-1/runs
   cp -R ../closure-wave1-claude/design-closure/outputs/wave-1  design-closure/outputs/wave-1/runs/claude
   cp -R ../closure-wave1-codex/design-closure/outputs/wave-1   design-closure/outputs/wave-1/runs/codex
   cp -R ../closure-wave1-gemini/design-closure/outputs/wave-1  design-closure/outputs/wave-1/runs/gemini
   ```

   (Or skip the copy and just give the reviewer the three worktree paths.)

5. **Review.** Hand the three result sets to the reviewer session. It compares them per
   `REVIEW-RUBRIC.md`.

## Fairness notes

- **Same prompt for all** — no per-model wording. Products differ in *how* they execute (sub-agents vs
  sequential); the prompt only fixes the deliverables and acceptance criteria, which is what is
  compared.
- **Same starting corpus** — all worktrees cut from one commit, so no run has a different input.
- **Independence** — separate worktrees mean no run can read another's `outputs/`. Don't point two
  products at the same folder.
- **Read-only corpus still holds** in every run — each writes only under its own
  `design-closure/outputs/wave-1/`. Confirm afterward that each run's `git status` shows changes only
  under `design-closure/`.

## Cleanup (after review)

```
git worktree remove .worktrees/closure-wave1-claude
git worktree remove .worktrees/closure-wave1-codex
git worktree remove .worktrees/closure-wave1-gemini
# delete the run branches if not needed: git branch -D closure/wave1-claude ...
```
