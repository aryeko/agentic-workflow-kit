# Reviewer Prompt Reference

Author `execution/prompts/<story-id>/reviewer.md` as a self-contained review contract for one later
reviewer worker. The reviewer verifies implementation against the original story and runtime
evidence; it does not change code or delivery state.

## Required Sections

### Assigned Routing

Record:

- source story id;
- source `AC-n` ids covered by this prompt;
- model class `frontier-reviewer`;
- effort;
- suggested-tier floor;
- reasoning tier;
- routing rationale.

Do not record provider-specific runtime model IDs.

### Original Scope

State:

- story id and epic slug;
- acceptance criteria by original `AC-n` id;
- allowed pathset;
- dependencies and dependency inputs;
- non-goals;
- STOP conditions;
- source story contract path.

### Runtime Slots

Include these slots for execution-time evidence:

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

### Review Checklist

Require the reviewer to check:

- AC coverage by source `AC-n`;
- failure, degraded, or validation rows;
- evidence pack completeness;
- public API and import paths;
- dependency boundaries and committed dependency inputs;
- stale names and sibling occurrences;
- tests and sweeps;
- scope control against allowed writes;
- repo conventions and mutation limits.

### Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings.
For each finding, include file and line reference, required fix, and the source `AC-n` or boundary
violated.

## Limits

Do not ask the reviewer to commit, push, edit files, close workers, update tracker state, widen the
story, or repair source planning defects.
