---
title: AWK11 detailed technical story spec
owner: codex-2026-06-13T23-54-50Z
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK11.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md
---

# AWK11 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK11.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Should parent-side helpers verify PR state directly, or should V1 remain child-evidence-first plus analyzer validation? | Keep V1 child-evidence-first and harden the prompt, structured child evidence parser, completion gate, and analyzer diagnostics. | The technical solution states GitHub workflow is child-owned in V1, while runtime artifacts and analyzer validation must make branch, PR, checks, review, merge, and cleanup evidence structured and auditable. Parent-side direct GitHub polling can be added later behind helper boundaries, but is not required for this story. |

## Exact types/contracts

Extend `ChildResultEvidence` in `packages/orchestrator/src/types.ts` with explicit optional GitHub evidence records:

```ts
export type GithubCheckConclusion = 'success' | 'failure' | 'cancelled' | 'skipped' | 'neutral' | 'timed_out' | 'action_required' | 'unknown';

export interface GithubCheckEvidence {
  command: string | null;
  status: 'passed' | 'failed' | 'skipped' | 'unknown';
  conclusion?: GithubCheckConclusion | null;
  detail?: string | null;
}

export interface GithubReviewEvidence {
  reviewer: string | null;
  signal: 'approved' | 'pending' | 'findings' | 'commented' | 'unknown';
  mechanism: 'reaction' | 'comment' | 'review-comment' | 'native-review' | 'unknown';
  triaged?: boolean | null;
  findings?: number | null;
  detail?: string | null;
}

export interface GithubMergeEvidence {
  merged: boolean;
  method?: 'squash' | 'merge' | 'rebase' | 'unknown' | null;
  commit: string | null;
  mergedAt?: string | null;
  branchDeleted?: boolean | null;
  detail?: string | null;
}

export interface GithubEvidence {
  prNumber?: number;
  prUrl?: string;
  checks?: GithubCheckEvidence[];
  review?: GithubReviewEvidence;
  merge?: GithubMergeEvidence;
}
```

`ChildResultEvidence` keeps the existing flat compatibility fields (`prNumber`, `prUrl`, `merged`, `mergedAt`, `mergeCommit`, `branchDeleted`, `prReview`) and gains `github?: GithubEvidence`. Existing artifacts remain readable. New structured evidence should populate both flat fields where applicable and the nested `github` object.

Prompt contract in `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts`:

- Require child final reports/structured output to include PR URL/number when `pr.create` is true.
- Require CI evidence when `pr.ci.wait` is true: command, pass/fail/skipped status, and detail.
- Preserve Codex bot semantics: eyes reaction means pending, thumbs-up reaction means clear, comments/review comments are findings, native approval is not required.
- Require PR review evidence when `pr.review.wait` is `bot`: mechanism, signal, reviewer/bot, findings count, triage/reply status.
- Require merge evidence when `pr.merge.auto` is true: merge method, merge commit or mergedAt evidence, and branch deletion status when configured.
- Require blockers for auth failure, missing review signal, stale base, merge conflict, failed checks, failed verification, missing PR state, or inconsistent artifacts.

Parser contract in `packages/orchestrator/src/drivers/codex-mcp/evidenceParser.ts`:

- Read `github` from structured content directly when present.
- Read compatibility aliases from structured content: `checks`, `ci`, `review`, `prReview`, `merge`, and flat merge fields.
- Parse conservative text evidence for check status, Codex review signals, review findings, merge evidence, and branch deletion.
- Do not treat eyes/pending review as approval.
- Do not treat native approval as required or sufficient for Codex review when comments/findings are present.
- Do not attach unrelated PR/story merge evidence.

Analyzer contract in `packages/orchestrator/src/analysis/runAnalyzer.ts`:

- Include nested `github` evidence in each analyzed child under existing `merge`, `verification`, and `review` summaries without breaking old artifact parsing.
- Emit issues when policy requires evidence but the child artifact lacks it:
  - `pr.create` true and no PR number/URL.
  - `pr.ci.wait` true and no check evidence, or failed/unknown check evidence.
  - `pr.review.wait: bot` and no review evidence, pending review, untriaged findings when `triageComments` is true, or unknown Codex signal.
  - `pr.merge.auto` true and no accepted merge evidence.
  - `pr.merge.deleteBranch` true and merge evidence exists but branch deletion evidence is absent or false.

Completion gate contract in `packages/orchestrator/src/runner/CompletionGate.ts`:

- Continue to accept completion only from tracker state plus commit/merge evidence.
- For auto-merge policy, accept merged base evidence from existing flat merge fields or nested `github.merge.commit` when reachable from `origin/<baseBranch>`.
- Preserve existing child-worktree completion behavior for non-auto-merge policies.

## Exact files/modules

```text
packages/orchestrator/src/types.ts  Add GitHub evidence interfaces and optional ChildResultEvidence.github.
packages/orchestrator/src/drivers/codex-mcp/toolInput.ts  Strengthen prompt requirements for PR/check/review/merge/cleanup evidence and blockers.
packages/orchestrator/src/drivers/codex-mcp/evidenceParser.ts  Parse structured and conservative text GitHub evidence into flat and nested fields.
packages/orchestrator/src/runner/CompletionGate.ts  Accept nested merge commit evidence for auto-merge completion authority.
packages/orchestrator/src/analysis/runAnalyzer.ts  Summarize nested GitHub evidence and flag missing/failed required evidence.
packages/orchestrator/tests/tool-input.test.ts  Snapshot prompt policy additions.
packages/orchestrator/tests/evidence-parser.test.ts  Cover structured GitHub evidence, Codex reactions, findings, checks, merge, and cleanup parsing.
packages/orchestrator/tests/completion-gate.test.ts  Cover nested merge evidence as auto-merge authority.
packages/orchestrator/tests/analysis.test.ts  Cover missing/failed required GitHub evidence diagnostics and successful complete evidence.
```

## Query/schema/prompt/event/component design

No database, route, or UI component changes.

The nested `github` object is additive and artifact-compatible. It is an evidence normalization layer, not a new completion authority. Existing flat fields remain the compatibility bridge for old artifacts and tests.

Evidence precedence:

1. Structured `childResult.github` / `result.github` / `evidence.github`.
2. Structured flat compatibility fields.
3. Conservative text compatibility parsing.

Structured fields override text when they directly conflict, except parser-derived flat compatibility fields may still fill missing flat fields from nested structured evidence.

## Tests

Focused tests:

```bash
pnpm vitest run packages/orchestrator/tests/tool-input.test.ts packages/orchestrator/tests/evidence-parser.test.ts packages/orchestrator/tests/completion-gate.test.ts packages/orchestrator/tests/git-inspector.test.ts packages/orchestrator/tests/analysis.test.ts
```

Full gate:

```bash
pnpm check
```

## Migration/deploy concerns

No migration is required. New fields are optional and existing run artifacts remain analyzable. Rollback is safe because old readers ignore unknown fields and new analyzer logic continues to read old flat evidence.

## Blocking technical questions

None
