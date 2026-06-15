---
title: AWK136 detailed technical story spec
owner: codex-2026-06-15T16-51-16Z
last-reviewed: 2026-06-15
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK136.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md
---

# AWK136 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK136.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Which fakes need upgrading so they stop encoding expected answers? | Upgrade only the runner-test fakes needed for the end-to-end smoke: `FakeGitInspector` must make refreshed base-tracker content and merge-commit reachability explicit, and `FakeCollaborationInspector` must expose parent-side merge calls. Existing completion-gate and real-git tests already cover non-ancestor rejection, real git ancestry, fake merge rejection, and parent-side merge head matching. | This closes the remaining fake-driver orchestration gap without re-authoring tests already shipped by AWK13.1-AWK13.5. |
| Target coverage step for this story - straight to 90 or staged ratchet? | Stage the ratchet to the measured current floor: statements 81, branches 72, functions 85, lines 85. | Current direct coverage is statements 81.67%, branches 72.39%, functions 85.54%, lines 85.09%. These thresholds gate regressions now while leaving the long-tail 90% target for later focused coverage work. |
| Should the end-to-end smoke also run against real codex behind an opt-in flag? | Keep this story fake-driver only. Do not extend `smoke:codex-plugin`. | The brief scopes this story to a deterministic fake-driver smoke and explicitly excludes a broader evaluation or benchmark harness. |

## Exact types/contracts

- No production type or API contract changes.
- `packages/orchestrator/tests/runner.test.ts` test doubles may gain test-only fields/methods:
  - `FakeGitInspector.filesByRef: Map<string, string>` continues to map `<ref>:<path>` to tracker content.
  - `FakeGitInspector.reachableCommits: Set<string>` records merge commits that are reachable from `origin/<base>`.
  - `FakeGitInspector.refreshBaseBranch()` records refresh activity without mutating production state.
  - `FakeGitInspector.isCommitReachableFromRef()` returns true only for explicitly reachable commits.
  - `FakeCollaborationInspector.mergeCalls` records parent-side merge attempts.
  - `FakeCollaborationInspector.mergePullRequest()` returns post-merge evidence.
- `packages/orchestrator/vitest.config.ts` coverage thresholds become the ratcheted contract:
  - `statements: 81`
  - `branches: 72`
  - `functions: 85`
  - `lines: 85`

## Exact files/modules

```text
packages/orchestrator/tests/runner.test.ts        Add deterministic fake-driver story-run smoke and upgrade local fakes.
packages/orchestrator/vitest.config.ts            Raise coverage thresholds to the measured AWK136 ratchet.
docs/superpowers/specs/2026-06-15-awk136-awk13-6-test-trust-and-coverage-ratchet-design.md  This detailed spec.
docs/superpowers/plans/2026-06-15-awk136-awk13-6-test-trust-and-coverage-ratchet.md         Implementation plan.
docs/tracks/agentic-workflow-kit-redesign/README.md  Update AWK136 spec/plan/status/PR cells as the story advances.
```

## Query/schema/prompt/event/component design

No query, schema, prompt, or UI changes.

The end-to-end smoke will exercise the real `WorkflowRunner` path with:

1. A real temporary markdown tracker discovered through `discoverMarkdownTracks`.
2. A fake story runner that marks the tracker row `done`.
3. A fake Git inspector that reports a committed story branch before merge, then exposes refreshed `origin/main` tracker content and merge-commit reachability after mocked parent-side merge.
4. A fake collaboration inspector that first reports an open PR with passed checks and Codex approval, then records `mergePullRequest()` and returns verified merged PR evidence.
5. Assertions that the runner completes, writes child completion evidence, records `completion_authority: verified-merged-pr-on-base`, and calls parent-side merge with the configured squash/delete-branch policy.

## Tests

- Focused:
  - `pnpm --dir packages/orchestrator test`
  - `pnpm --dir packages/orchestrator exec vitest run --config vitest.config.ts --coverage`
- Full:
  - `pnpm check`

## Migration/deploy concerns

None. This story changes test coverage and test configuration only.

## Blocking technical questions

None
