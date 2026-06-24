# Evidence and Method

## Task and Motivation

The task was to perform a retrospective on the Epic 3 implementation delivery, covering both the long
orchestrator session and the spawned implementer/reviewer sessions.

The motivation was not to narrate the transcript. The goal was to learn which parts of the
orchestration model should be preserved, which parts became costly, which mid-run lessons should be
durable, and which recommendations should inform future `workflow-kit` orchestrated-delivery operators
and skill/guide maintainers.

Success criteria used for this report:

- Separate observed facts from interpretation.
- Split orchestrator-session behavior from spawned-session behavior.
- Identify recurring defect or process classes, not just one-off bugs.
- Include planning handoff, story-wave execution, spawned sessions, mid-run skill/guide learning, PR
  #144 publication/review, repeated review fixes, final green state, and the explicit "do not merge"
  stop point.
- Avoid estimating token usage where the inspected sources do not expose usage fields.

## Scope and Handles

Primary sources inspected:

- Execution package: `/Users/aryekogan/repos/workflow-kit/.worktrees/orchestrated-epic3/docs/implementation/epics/epic-3-core-runtime-spine/execution`
- Execution plan: `/Users/aryekogan/repos/workflow-kit/.worktrees/orchestrated-epic3/docs/implementation/epics/epic-3-core-runtime-spine/execution/plan.md`
- Execution tracker: `/Users/aryekogan/repos/workflow-kit/.worktrees/orchestrated-epic3/docs/implementation/epics/epic-3-core-runtime-spine/execution/tracker.md`
- Orchestrator JSONL: `/Users/aryekogan/.codex/sessions/2026/06/23/rollout-2026-06-23T19-47-32-019ef561-420b-7391-ab8b-d87aef2ea3e9.jsonl`
- Worktree: `/Users/aryekogan/repos/workflow-kit/.worktrees/orchestrated-epic3`
- Branch: `codex/orchestrated-epic3`
- PR: <https://github.com/aryeko/agentic-workflow-kit/pull/144>
- Base branch: `origin/v-next`
- Computed git range:
  `b8d33470056052410bb6abbf549ce54bee9d56c6..2c0b260c68364a549d29a32af09d54b33d4ccc58`

Temporary retro artifacts:

- Normalized events: `/tmp/codex-epic3-retro/events.jsonl`
- Git log extract: `/tmp/codex-epic3-retro/git-log.txt`
- PR GraphQL extract: `/tmp/codex-epic3-retro/pr144.json`
- PR review data: `/tmp/codex-pr144-review-analysis/reviews.json`
- PR inline comments: `/tmp/codex-pr144-review-analysis/review-comments.json`
- PR issue comments: `/tmp/codex-pr144-review-analysis/issue-comments.json`
- Reduced review rounds: `/tmp/codex-pr144-review-analysis/codex-review-rounds.json`

## Method

The retro followed the repo-local `delivery-retro` skill and its analysis contract.

Steps executed:

1. Loaded the `delivery-retro` skill and analysis contract.
2. Verified live branch state in the Epic 3 worktree.
3. Computed the git range from `git merge-base origin/v-next HEAD..HEAD`.
4. Imported the orchestrator JSONL into normalized events under `/tmp/codex-epic3-retro/events.jsonl`.
5. Summarized normalized observability events.
6. Ran `analyze-delivery-run.mjs` with the execution package, session JSONL, normalized events, PR
   #144, worker ids, repo path, and git range.
7. Parsed the executed tracker for story status, implementer/reviewer identities, approval rounds,
   blockers, evidence, and story commit hashes.
8. Queried live PR state with GitHub CLI and `ghx`.
9. Queried PR review threads through GraphQL and reduced them into priority, path, and resolution
   counts.
10. Fetched PR reviews, inline comments, and issue comments to compute Codex review-round counts and
    severity.
11. Inspected orchestrator status messages for process milestones, watcher behavior, blocker handling,
    and final stop-state evidence.

## Results

### Delivery Result

Observed final implementation state:

- All 14 tracker stories are `done`.
- Branch `codex/orchestrated-epic3` reached `2c0b260c68364a549d29a32af09d54b33d4ccc58`.
- Git range from `origin/v-next` merge base to implementation head contains 76 commits.
- PR #144 is open against `v-next`.
- Required `check` succeeded on implementation head.
- `smoke` skipped as expected for the check workflow.
- PR review threads were all resolved.
- Final Codex comment said no major issues on `2c0b260c68`.
- The run did not merge.

Later retro-report commits on the same branch are outside the implementation-run state above. Live PR
state can drift after those documentation commits.

### Observability Result

Observed normalized event summary:

- Events inspected: 4,473.
- Turns: 2,078 total.
- User turns: 37.
- Assistant turns: 2,041.
- Worker spawns: 30.
- Worker completions: 41.
- Review completions: 18.
- Reported cumulative usage fields: 323,352,689 input, 314,029,824 cached input, 654,400 output,
  104,288 reasoning, 324,007,089 total.

Limits:

- Per-story token usage is unavailable.
- Per-story duration is reconstructed, not directly recorded.
- Worker aliases are not reliably discoverable from normalized events alone.
- The analyzer reported missing story-level `review-rounds`, `duration`, and `token-usage` fields for
  every story.

### Git Result

Observed git range:

`b8d33470056052410bb6abbf549ce54bee9d56c6..2c0b260c68364a549d29a32af09d54b33d4ccc58`

Commit count:

- 76 commits total.
- 46 `fix:` commits.

Interpretation: the post-publication review loop accounts for a large share of the final commit stack.
This is the clearest quantitative signal that the expensive part of the delivery was not initial story
execution but late defect discovery.

## Uncertainty and Limits

- The normalized analyzer did not expose story-level duration, review-round, or token fields.
  Per-story duration is reconstructed by alias/id joins.
- Worker aliases drift or differ between tracker and normalized event text for some later stories.
  Stable agent ids are stronger evidence than names.
- Git commit timestamps after rebases are not reliable for early story execution timing; normalized
  session event timestamps are used instead.
- PR priority counts are parsed from review-thread/comment bodies. Badge-bearing P1/P2/P3 counts are
  reliable from the captured text.
- The GitHub `reviewDecision` field was not used as the final source because it was empty/unstable in
  queried output. Final implementation state is based on final Codex comment, zero unresolved review
  threads, and green required check.
- Token usage is reported only as observed session-level usage fields. It should not be treated as
  per-story cost or exact billable usage.

## References

Primary local references:

- `/Users/aryekogan/repos/workflow-kit/.agents/skills/delivery-retro/SKILL.md`
- `/Users/aryekogan/repos/workflow-kit/.agents/skills/delivery-retro/references/analysis-contract.md`
- `/Users/aryekogan/repos/workflow-kit/.worktrees/orchestrated-epic3/docs/implementation/epics/epic-3-core-runtime-spine/execution/plan.md`
- `/Users/aryekogan/repos/workflow-kit/.worktrees/orchestrated-epic3/docs/implementation/epics/epic-3-core-runtime-spine/execution/tracker.md`
- `/Users/aryekogan/.codex/sessions/2026/06/23/rollout-2026-06-23T19-47-32-019ef561-420b-7391-ab8b-d87aef2ea3e9.jsonl`
- `/tmp/codex-epic3-retro/events.jsonl`
- `/tmp/codex-epic3-retro/git-log.txt`
- `/tmp/codex-epic3-retro/pr144.json`
- `/tmp/codex-pr144-review-analysis/codex-review-rounds.json`

Commands and tools used:

- `node .agents/skills/delivery-retro/scripts/import-session-observability.mjs`
- `node .agents/skills/delivery-retro/scripts/summarize-delivery-observability.mjs`
- `node .agents/skills/delivery-retro/scripts/analyze-delivery-run.mjs`
- `git merge-base origin/v-next HEAD`
- `git rev-parse HEAD`
- `git log --reverse`
- `gh pr view 144 --repo aryeko/agentic-workflow-kit`
- `gh api --paginate repos/aryeko/agentic-workflow-kit/pulls/144/reviews`
- `gh api --paginate repos/aryeko/agentic-workflow-kit/pulls/144/comments`
- `gh api --paginate repos/aryeko/agentic-workflow-kit/issues/144/comments`
- GitHub GraphQL review-thread query for PR #144
- `ghx` PR view, checks, reviews, and review-thread surfaces

External/live reference:

- PR #144: <https://github.com/aryeko/agentic-workflow-kit/pull/144>

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 Delivery Retro](./README.md) · **← Prev:** [Cause Analysis and Recommendations](./04-cause-analysis-and-recommendations.md) · **Next →:** [Epic 3 Execution Package Plan](../execution/plan.md)

<!-- /DOCS-NAV -->
