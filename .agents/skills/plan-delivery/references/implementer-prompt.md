# Implementer Prompt Reference

Author `execution/prompts/<story-id>/implementer.md` as a self-contained worker contract for one
story. A low-tier implementer prompt must be decision-complete: the assigned worker must be able to
execute without guessing about scope, paths, inputs, behavior, verification, or delivery evidence.

Do not use "implement this story" as the prompt body. State the contract, constraints, and expected
reporting shape explicitly.

Adjacent responsibilities live in `reviewer-prompt.md`, `tracker-artifact.md`, `plan-artifact.md`,
`package-layout.md`, and `source-readiness.md`.

## Required Sections

### Assigned Model

Record the model assignment exactly as planned:

- Provider profile.
- Model class.
- Concrete model, when known.
- Effort.
- Tier.
- Rationale for why this assignment fits the story risk and complexity.

### Exact Task

State:

- Story id.
- Current epic.
- The single outcome the worker must deliver.

Keep the task narrow. Do not add adjacent cleanup, follow-up work, or optional improvements.

### Why It Matters

Explain the downstream contracts and DAG risk that make the story necessary. Name the dependent
story ids, interfaces, or behavior that this story unblocks or protects.

### Required Reading

List exact files and inputs the worker must read:

- The exact story contract.
- The story DAG.
- Design and engineering files named by the story.
- Committed dependency inputs or dependency commit hashes known at dispatch time.

Do not send the worker to broad context. If a dependency hash is not known while packaging, use an
explicit runtime slot such as `{{DEPENDENCY_COMMITS}}`.

### Acceptance Criteria

Restate the story acceptance criteria with enough detail to test pass/fail without reopening broad
context. Include failure and degraded rows from the story contract when present.

Each criterion must be concrete, observable, and tied to expected files, behavior, tests, or evidence.

### Allowed Writes

List the exact owned pathset from the story contract. State that all other writes are forbidden.

The allowed pathset is exclusive. Do not permit repo-wide cleanup, generated churn outside the owned
paths, dependency edits, tracker edits, or prompt/package rewrites.

### Dependency Inputs

Record every required dependency input:

- Producer story ids.
- Shared shapes or contracts.
- Public import paths.
- Dependency commit hashes known at dispatch time.
- Runtime slots for future hashes, such as `{{DEPENDENCY_COMMITS}}`.

The worker must build only on committed dependency inputs or explicit runtime slots supplied later.

### Non-Goals And STOP Conditions

Copy the story contract non-goals and STOP conditions. Add that unrelated cleanup is forbidden.

STOP conditions must tell the worker when to stop and report instead of guessing, widening scope, or
editing outside the allowed pathset.

### Implementation Instructions

Include all implementation decisions already fixed by the story contract:

- Required names.
- Events.
- Failure tokens.
- Deterministic behavior.
- Boundary rules.
- Import rules.
- Conformance obligations.

Do not leave gray areas for a low-tier worker. If a behavior, name, import path, or failure mode is
required, spell it out.

### Verification

List the checks the worker must run or report as blocked:

- Targeted commands.
- Required sweeps for sibling occurrences or affected contracts.
- Evidence-pack items required by the story.
- The repo gate command.

Require exact command names and expected evidence. Do not accept prose-only self-reporting as
verification.

### Delivery Format

Require the worker report to include:

- Changed files.
- Acceptance-criteria coverage.
- Tests and checks run.
- Evidence pack.
- Open questions.
- Blockers.

The worker report is evidence for later review; it is not permission to mutate delivery state.

### Mutation Limits

State these limits explicitly:

- No staging.
- No commits.
- No pushes.
- No PRs.
- No merges.
- No worker closure.
- No tracker edits.
- No writes outside allowed paths.

The implementer prompt describes future worker execution only. It must not instruct the authoring
skill, a coordinator, or the worker to perform repository delivery actions beyond the allowed story
edits and required local verification/reporting.
