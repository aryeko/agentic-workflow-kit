---
name: deep-code-review
description: "Run the workflow-kit deep code review workflow locally. Use when explicitly asked to deep review a local branch or PR-style diff before handoff, following docs/engineering/codex-github-code-review.md and adding only local invocation/comment mechanics."
---

# Deep Code Review

Run the workflow-kit code review workflow locally. This skill is review-only: do
not edit source, docs, skills, packages, lessons, or branches while using it.
Posting review comments is allowed only when the user explicitly requests it.

## Workflow

1. Read `docs/engineering/codex-github-code-review.md` first. It is the review
   contract.
2. Resolve the review target:
   - If the user names a PR, branch, commit range, or path, review that target.
   - If no target is named, determine the branch's PR/base branch from live Git
     or GitHub state, then review the current branch against that merge base and
     include staged/unstaged changes if the worktree is dirty.
   - If no PR/base branch can be determined, stop and ask for the base instead
     of guessing.
3. Follow the engineering doc for source routing, review workflow, severity, and
   output. Do not duplicate or override that contract here.
4. Local reports must include a concise "Workflow trace" before findings:
   target, base or reason base was requested, routed sources, whether subagents
   were used, finder/verifier/sweep passes completed, and any skipped pass with
   its reason. Use `docs/engineering/codex-review-execution-summary.md` for the
   execution summary format and metadata availability rules.
5. Local reports may add a separate "Non-blocking notes" section for actionable
   P2/P3 observations. Keep those notes clearly separated from P0/P1 findings
   and do not treat them as GitHub review-blocking.
6. If the user explicitly asks to post comments, first confirm the current PR
   head commit, then post inline comments and a summary review without
   approving, requesting changes, pushing, or applying fixes. Post P2/P3 notes
   only when the user explicitly asks for lower-severity comments.

## Resources

- `docs/engineering/codex-github-code-review.md`: canonical review workflow.
- `docs/engineering/codex-review-execution-summary.md`: review execution
  summary format and metadata availability rules.
- `docs/implementation-authoring/lessons-ledger.md`: authority for recurring
  workflow-kit defect patterns.
