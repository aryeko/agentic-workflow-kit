# Reviewer Prompt Reference

Write each `execution/prompts/<story-id>/reviewer.md` as a reusable review template for a later
execution run. Keep it self-contained enough for the reviewer to judge the submitted implementation
without guessing story scope, boundaries, or evidence requirements.

Adjacent responsibilities live in `implementer-prompt.md`, `plan-artifact.md`,
`tracker-artifact.md`, and `model-routing.md`.

## Required Fields

Include these sections in every reviewer prompt:

1. **Assigned model**
   - Set model class to `frontier-reviewer`.
   - State effort, reasoning tier, and a brief rationale for the reviewer assignment.

2. **Original scope**
   - State the story id.
   - List the acceptance criteria.
   - List the allowed pathset.
   - List dependencies.
   - List non-goals.
   - List STOP conditions.

3. **Runtime slots**
   - `{{IMPLEMENTER_SUMMARY}}`
   - `{{CHANGED_FILES}}`
   - `{{DIFF}}`
   - `{{TARGETED_CHECK_OUTPUT}}`
   - `{{PNPM_CHECK_OUTPUT}}`
   - `{{EVIDENCE_PACK}}`
   - `{{DEPENDENCY_COMMITS}}`

4. **Review checklist**
   - Verify acceptance-criteria coverage.
   - Check failure and degraded outcomes.
   - Check the evidence pack.
   - Check public API and import paths.
   - Check dependency boundaries.
   - Check for stale names.
   - Search for sibling occurrences of the same issue.
   - Check tests.
   - Check scope control.
   - Check repo conventions.

5. **Verdict format**
   - Return `APPROVED` only when no blocking findings remain.
   - Otherwise return severity-ordered findings.
   - For each finding, include file and line reference, required fix, and the acceptance criterion or
     boundary violated.

## Quality Standard

Keep reviewer prompts focused on judging the implementation against the original story contract and
runtime evidence. The reviewer may report findings and approval status only.

Do not ask the reviewer to commit, push, edit files, close workers, or update tracker state.
