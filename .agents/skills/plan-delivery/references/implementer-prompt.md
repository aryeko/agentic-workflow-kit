# Implementer Prompt Reference

Author `execution/prompts/<story-id>/implementer.md` as a self-contained contract for one later
implementer worker. The prompt must be decision-complete without changing the source story.

## Required Sections

### Assigned Routing

Record:

- source story id;
- source `AC-n` ids covered by this prompt;
- model class;
- effort;
- suggested-tier floor;
- reasoning tier;
- routing rationale.

Do not record provider-specific runtime model IDs.

### Exact Task

State the story id, epic slug, and single outcome the worker must deliver. Keep the task limited to
the ready story scope.

### Why It Matters

Explain the downstream contracts and DAG risk that make the story necessary. Name dependent story
ids, interfaces, behavior, or evidence that the source artifacts already name.

### Required Reading

List exact files the worker must read:

- the source story contract;
- the story DAG;
- design and engineering files named by the contract;
- committed dependency inputs or the `{{DEPENDENCY_COMMITS}}` runtime slot.

Do not send the worker to broad context or another skill to discover the story.

### Acceptance Criteria

Restate the source ACs with their original `AC-n` ids. Include failure, degraded, or validation rows
when the story contract includes them. Keep each criterion observable and tied to the expected files,
behavior, tests, or evidence named by the source contract.

Do not add ACs. Do not weaken ACs. Do not convert evidence requirements into prose-only goals.

### Allowed Writes

List the exact owned pathset from the source contract. State that every other write is forbidden,
including package files, tracker files, source planning artifacts, repo-wide cleanup, dependency
churn, and generated files outside the owned pathset.

### Dependency Inputs

Record producer story ids, shared shapes, public import paths, and dependency commit inputs named by
the source artifacts. Use runtime slots only for values that cannot exist until execution, such as
`{{DEPENDENCY_COMMITS}}`.

### Non-Goals And STOP Conditions

Copy source non-goals and STOP conditions. Add that the worker must stop and report on source gaps,
missing dependency inputs, required writes outside the owned pathset, or any need to reinterpret an
AC.

### Implementation Constraints

Include decisions already fixed by the story contract: required names, events, failure tokens,
determinism, boundary rules, import rules, conformance obligations, and safety invariants.

Do not introduce implementation choices that the source did not authorize.

### Verification

List targeted commands, required sweeps, evidence-pack items, and the repo gate exactly as sourced
from the story contract. Require exact command output or an explicit blocked reason.

### Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:

- make the gate green (`pnpm check`) before every commit;
- make an impl-done commit when the story first proves out, then one commit per fix round;
- tag each commit with a review-round trailer (`Story: <story-id>` and `Round: <n>`) so the per-round
  history is visible;
- on an orchestrator-reported merge-back conflict, rebase the story's commits onto the track branch
  `HEAD`, re-prove (gate green), and re-commit; report a real logic conflict rather than forcing a
  resolution.

The implementer commits only within its owned pathset in its own story worktree; it never pushes,
opens or updates PRs, merges, closes contexts, edits the tracker, or marks stories complete.

### Delivery Report

Require the worker report to include:

- changed files;
- AC coverage by `AC-n`;
- per-round commit hashes (impl-done + each fix round);
- tests and checks run;
- evidence pack;
- open questions;
- blockers.

The report and the per-round commits are the evidence for review and merge-back. The implementer does
not update tracker state or perform merge/PR/publication actions.

### Mutation Limits

State explicitly: the implementer commits each round within its owned pathset in its own story
worktree (gate-green, round trailer) and rebases on orchestrator request, but performs no pushes, PRs,
merges, worker closure, tracker edits, package edits, source planning edits, or writes outside allowed
paths.
