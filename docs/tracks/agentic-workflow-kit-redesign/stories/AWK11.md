---
title: AWK11 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md
---

# AWK11 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| HC-3 | GitHub is the V1 collaboration target for branches, PRs, checks, reviews, merge, and cleanup. |
| RUN-4 | Runtime supports PR, CI/review, fix findings, merge, delete branch, continue. |
| RUN-6 | Review uncertainty, auth failure, merge conflict, stale base, and inconsistent artifacts stop recoverably. |
| OBS-4 | GitHub checkpoints and review/merge evidence are recorded. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Architecture and domains | Collaboration domain owns Git/GitHub evidence. |
| Runtime flows: Story runtime sequence | Child session opens PR, waits checks/reviews, merges when allowed. |
| AI, observability, and operations | Defines PR/review/check/merge events and GitHub policy tests. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK08 | Runtime policy semantics must be stable before GitHub evidence hardening. |

## Scope boundary

**In scope**

- Harden prompt/evidence handling for PR URL/number, checks, Codex review reactions/comments, fix/reply batches, merge, branch deletion, and failure states.
- Normalize GitHub evidence in child result and run artifacts.
- Preserve Codex review semantics: eyes means pending, thumbs-up means clear, comments are findings, native approval is not required.
- Add tests for prompt policy, evidence parsing, analyzer classification, and merge/cleanup outcomes.
- Pin assumption: the story is executed by installed 0.5.13; do not depend on newly edited GitHub evidence code to satisfy this story.

**Out of scope**

- Non-GitHub providers.
- Re-requesting Codex after every fix when config says `rerequestAfterFix: false`.
- UI/report presentation beyond artifact fields.

## Candidate surfaces

- **Files/modules:** `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts`, `packages/orchestrator/src/drivers/codex-mcp/evidenceParser.ts`, `packages/orchestrator/src/runner/CompletionGate.ts`, `packages/orchestrator/src/git/GitInspector.ts`, `packages/orchestrator/src/analysis/runAnalyzer.ts`
- **Queries/schema:** GitHub evidence records in artifacts
- **Prompts/tools:** child prompt PR/review policy
- **Events/metrics:** `pr-*`, `pr-checks-*`, `pr-review-*`, `merge-*`
- **Components/routes:** none

## Validation expectations

- Prompt snapshot/behavior tests, evidence parser tests, completion gate tests, analyzer tests.
- `pnpm vitest run packages/orchestrator/tests/tool-input.test.ts packages/orchestrator/tests/evidence-parser.test.ts packages/orchestrator/tests/completion-gate.test.ts packages/orchestrator/tests/git-inspector.test.ts packages/orchestrator/tests/analysis.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Should parent-side helpers verify PR state directly, or should V1 remain child-evidence-first plus analyzer validation? | no | Follow technical solution default unless implementation evidence shows a gap. |
