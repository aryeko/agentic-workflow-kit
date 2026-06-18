---
name: implement-next
description: Use when the user asks to pick, claim, implement, ship, or merge the next eligible agentic-workflow-kit tracker story, or names a specific tracker ID such as PC03, WK4, AR12, or TU11. Reads .workflow/config.yaml plus references/tracker-contract.md, discovers active trackers, validates dependencies and ownership, claims the row (sets status to inProgress), enriches brief-level story files in place to implementation-ready (file content only — status stays inProgress), writes implementation plans, then implements, verifies, marks done, creates PRs, handles configured CI/review gates, optional merge, and cleanup. Do not use for creating trackers (use plan-delivery-track), writing PRDs (use define-product), or non-tracker one-off work.
argument-hint: "[story-id]"
arguments: story_id
disable-model-invocation: true
user-invocable: true
---

# Pick and implement one tracker story

Run one agentic-workflow-kit tracker story end-to-end inside the current repo. The skill consumes a
tracker row produced by `plan-delivery-track`. New tracker rows link a lightweight story brief;
`implement-next` turns that brief into a detailed technical story spec, then writes the
implementation plan, then code. It is the generic execution layer between `plan-delivery-track` and
the optional orchestrator.

## Load first

Read these before changing state:

| File | Why |
|---|---|
| `.workflow/config.yaml` | Paths, statuses, verify commands, git strategy, PR/merge policy. If missing, stop and tell the user to run `/workflow-init`. |
| `references/config-schema.md` | Defaults for missing optional config keys. |
| `references/tracker-contract.md` | Eligibility rule, status matrix shape, dependency semantics, status vocabulary, and terminal promote story rule. |
| `references/story-brief-contract.md` | Story file contract (brief-level sections produced by `plan-delivery-track`). |
| `references/detailed-story-spec-contract.md` | Implementation-ready sections appended in place to the story file. |
| `references/templates/detailed-story-spec-template.md` | Template for implementation sections appended in place. |
| Repo instructions | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, technical solution docs, and local docs. These win over specs and plans. |

Apply documented defaults when optional config keys are missing. At the start of every run,
summarize the resolved policy: `paths`, `statuses`, `verify`, `git`, `implement`, and `pr`.
If the runtime exposes `workflow_config_status` or `agentic-workflow-kit config status --json`,
check config compatibility before claiming a row or writing files. For legacy upgradeable configs,
summarize the upgrade and ask whether to run `workflow_config_upgrade` or
`agentic-workflow-kit config upgrade --yes --json` first. Stop on unsupported old, unsupported new,
invalid, or missing config versions until the user resolves the compatibility issue.

## Hard rules

- One tracker row per session. Do not bundle stories.
- The tracker matrix is the source of truth for Status, Owner, Plan, and PR.
- Never infer completion from an agent's prose, a check result, or an opened PR.
- Re-read the tracker before every status transition.
- Use configured paths and commands. Do not hardcode `docs/tracks`, `docs/specs`, `docs/plans`,
  `main`, `pnpm check`, or a review bot.
- Do not add a spec-frontmatter status mirror. `plan-delivery-track` intentionally keeps status only in
  the tracker matrix.
- No implementation plan or code while the detailed technical story spec is missing or has
  blocking technical questions.
- Preserve unrelated user changes. Do not reset, discard, or overwrite unrelated work.
- Follow `pr:` exactly. Auto-merge only when configured gates are satisfied.
- Failed verification, unresolved blocking questions, dirty worktree state, exhausted pre-PR review
  loops, and exhausted PR review loops stop the flow.
- Pre-PR review happens before tracker completion and PR creation for nontrivial implementation
  work when `implement.review.prePr.enabled: true`.
- Review fixes rerun configured verification before the next review loop or PR update.
- Stop after the configured review fix-batch limit; do not silently continue with unreviewed changes.
- Use subagents only for bounded sidecar analysis/review. Do not put blocking critical-path
  implementation work in a subagent.
- Workers require disjoint write scopes and explicit `implement.subagents.allowWorkers: true`.

## Config keys

Use these keys:

- `docs.paths.prdsDir` (default `docs/product/prds`; fall back to `paths.prdsDir`, default `docs/prds`), `docs.paths.designsDir` (default `docs/architecture/designs`)
- `paths.tracksDir`, `paths.specsDir`, `paths.plansDir`, `paths.archiveDir`
- `statuses.eligible`, `statuses.inProgress`, `statuses.complete`
- `tracker.idPattern`
- `verify.changed`, `verify.full`
- `git.strategy`, `git.branchPattern`, `git.baseBranch`, `git.commitOnBase`
- `implement.review.prePr.enabled`, `implement.review.prePr.mode`, `implement.review.prePr.maxLoops`, `implement.review.prePr.loopMode`
- `implement.review.semanticChecks.enabled`
- `implement.subagents.enabled`, `implement.subagents.maxParallel`, `implement.subagents.allowWorkers`
- `pr.create`
- `pr.ci.wait`, `pr.ci.command`
- `pr.review.wait`, `pr.review.bot`, `pr.review.triageComments`, `pr.review.maxFixBatches`, `pr.review.rerequestAfterFix`, `pr.review.waitTimeoutMinutes`
- `pr.merge.auto`, `pr.merge.method`, `pr.merge.deleteBranch`

## What counts as an active tracker

Scan `<tracksDir>/*/README.md` and skip anything under `<archiveDir>`. A README is active when:

1. its frontmatter is not `status: archived`,
2. it has `## Status matrix`,
3. it has `## Dependency graph`,
4. it has `## Parallelism rules`,
5. the status matrix uses the contract columns:
   `ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR`.

## Eligibility

A row is eligible only when all are true:

1. **Status** is in `statuses.eligible`.
2. **Owner** is empty or `—`.
3. Every row listed in **Depends on** has Status in `statuses.complete`.

Rows with terminal statuses (`blocked`, `canceled`, `deferred`, `superseded`) are not eligible
unless the user explicitly asks to inspect them. Claimed rows are not eligible unless the user
explicitly overrides the owner conflict.

## Phase 0: Resolve policy and check tools

Read config, apply defaults, and print:

- active tracker glob and archive path,
- status buckets,
- git strategy, branch pattern, and base branch,
- changed/full verification commands,
- pre-PR review mode, pre-PR loop mode, pre-PR loop limit, semantic checks, subagent limits, and worker policy,
- PR creation, CI wait, review wait, merge method, and delete-branch behavior.

If the chosen policy requires a missing tool, stop before claiming a row. Examples:

- `pr.create: true` requires `git` and a usable remote plus PR tooling such as `gh`.
- `pr.ci.wait: true` with no `pr.ci.command` requires `gh pr checks`.
- `pr.merge.auto: true` requires merge tooling.

## Interactive run journal

Create an analyzable journal before claiming a story unless resuming an existing journal. The
journal lives under:

```text
.codex/agentic-workflow-kit/runs/<run-id>
```

Use an ISO timestamp run id with colons and periods replaced by hyphens. Keep these files current:

- `run.json`: run id, command `implement-next`, workspace root, artifact dir, and start time.
- `config.resolved.json`: resolved config snapshot, including `implement` and `pr` policy.
- `state.json`: current status, blocked reason, active story, and `interactive` child metadata.
- `events.ndjson`: append phase events such as `story_selected`, `claimed`, `spec_written`,
  `plan_written`, `verification_passed`, `pre_pr_review_started`, `pre_pr_review_requested`,
  `pre_pr_review_verdict`, `pre_pr_review_completed`, `pre_pr_review_fix_batch_applied`,
  `pre_pr_review_downgraded`, `pre_pr_review_blocked`,
  `pr_created`, `pr_review_started`, `pr_review_findings`, `pr_review_fix_batch_started`,
  `pr_review_fix_batch_applied`, `pr_review_thread_resolved`, `pr_review_completed`,
  `final_verification_passed`, `pr_merged`, `cleanup_complete`, and `blocked`.

Prefer event records with both chronology fields:

```json
{
  "recordedAt": "<ISO timestamp when this event was written>",
  "eventAt": "<ISO timestamp when the action happened>",
  "type": "<event name>"
}
```

For immediate events, `recordedAt` and `eventAt` may be the same. Legacy `ts` remains accepted, but
new journals should make action time and write time explicit. Prefer automatic write-time stamping
from the journal writer and supply `eventAt` only for imported external events. `analyze-run` keeps
journal file order in the timeline while exposing both timestamps so users can spot out-of-order
caller-supplied event times.

For compatibility with `analyze-run`, `state.json` must include:

```json
{
  "runId": "<run-id>",
  "command": "implement-next",
  "workspaceRoot": "<absolute repo root>",
  "artifactDir": "<absolute run dir>",
  "status": "running",
  "maxParallel": 1,
  "startedAt": "<ISO timestamp>",
  "active": ["<ID>"],
  "completed": [],
  "blockedStoryId": null,
  "blockedReason": null,
  "interactive": {
    "storyId": "<ID>",
    "ok": false,
    "sessionId": "<current Codex/Claude session id when known>",
    "sessionLogPath": "<current Codex/Claude session log path when known, otherwise null>"
  }
}
```

When the story finishes, set `status` to `complete` or `blocked`, update `blockedReason` when
blocked, set `interactive.ok`, and append final timing/status fields when available. The analyzer
also accepts `children/<ID>.json`; use that if the host environment can write it easily. Do not
fabricate token totals or command counts. `analyze-run` derives those from real session logs when
`interactive.sessionId`, `interactive.sessionLogPath`, or the child file's session metadata points
to a known Codex JSONL session. If linkage is not available, report it as unavailable instead of
implying no commands, subagents, or tokens were used.

Report the journal path in the final report. The run must be analyzable by `analyze-run`:

```bash
agentic-workflow-kit analyze-run .codex/agentic-workflow-kit/runs/<run-id>
```

## Phase 1: Argument check or discovery

If an argument looks like a story ID, normalize common forms:

- `pc03`, `PC-03`, and `PC 03` -> `PC03`
- preserve IDs already matching `tracker.idPattern`

Find the row whose first-column ID matches. If the prefix or exact ID is not found, report the
discovered prefixes and stop.

If no ID is provided, discover all active trackers and list eligible rows grouped by tracker.
Recommend one row using these heuristics:

- prefer foundation or pilot rows that unblock downstream rollout work,
- prefer rows with the most downstream dependents,
- respect explicit tracker coordination gates,
- surface parallelism warnings from the tracker README.

Ask the user which row to pick. Do not claim anything until the user confirms.

## Phase 2: Isolate and claim

Compute the branch name from `git.branchPattern`. Supported placeholders:

- `{track}`: tracker directory basename,
- `{id}`: story ID as written,
- `{id-lc}`: lowercase story ID,
- `{slug}`: kebab-case row name.

If `git.strategy: worktree`, create a worktree from `git.baseBranch` under `git.worktreeDir`
(default `.worktrees`) relative to the workspace root. If `git.strategy: branch`, create or switch
to the branch in the current worktree. If `git.commitOnBase: forbid`, refuse to commit directly on
`git.baseBranch`.

Do not create worktrees outside the workspace root unless the repo config explicitly says so. Do not
symlink `node_modules` from another checkout. Use the package manager/store normally, and stop for
approval if dependencies require network or privileged setup.

Before editing, run a child preflight in two phases:

1. Before creating a worktree, verify the expected branch/worktree path and classify a missing
   expected worktree as `needs-create` / expected, not as a blocker.
2. After creating or entering the work checkout, verify:

- cwd,
- git top-level,
- current branch,
- the exact expected worktree path rendered in the child prompt/launch metadata,
- configured base branch.

If any post-creation value does not match the resolved git policy, stop and report the mismatch
before editing.

Before editing the tracker, re-read the row and confirm it is still eligible. Then update:

- **Status** -> `statuses.inProgress`,
- **Owner** -> a clear session label.

Commit the claim:

```bash
git add <tracker README>
git commit -m "chore(<id>): claim <id>"
```

## Phase 3: Review story context

Read the row's `Spec` and `Plan` columns:

- `[story](path)`, `[brief](path)`, or a path under `<tracksDir>/<track>/stories/<ID>.md` means
  read the grow-in-place story file under `<tracksDir>/<track>/stories/<ID>.md`. If it is
  brief-level (status `specced`), the file must be enriched in place before implementation.
- Backward compatibility: a detailed spec link (not a story file) — typically under `<specsDir>` —
  means continue the legacy behavior and read it as the detailed technical story spec.
- Backward compatibility: a legacy `see <ID> + [delta](path)` link means read the referenced base
  spec plus the delta together as the detailed technical story spec.
- `[spec](path)` means inspect the path. If it points to a story file at brief-level, enrich it
  in place first. If it points to a detailed spec under `<specsDir>`, use the backward-compatible
  detailed-spec path.
- `Plan` with a link means read and assess it.
- `Plan` as `—` means a plan must be written after the story file is enriched to implementation-ready.

Also read repo contract docs and the tracker's dependency, parallelism, and coordination
sections. Produce a short brief with:

- scope,
- files likely in scope,
- spec/plan contradictions,
- risks,
- open questions.

If there is a blocker, pause for user input before planning or implementation.

## Phase 4: Enrich the story file to implementation-ready

For story files at brief-level (`status: specced`), enrich the story file in place before writing
any implementation plan or code. Enrichment is a file-content operation: the tracker row status
stays `statuses.inProgress` throughout enrichment, planning, implementation, and completion.
Do NOT revert the tracker row to `plan-approved` after enrichment — that would break Phase 8.

If the tracker row links a story file under `<tracksDir>/<track>/stories/<ID>.md` and the file is
brief-level, append the implementation-ready sections to that same file following
`references/detailed-story-spec-contract.md`. Use `references/templates/detailed-story-spec-template.md`
as the template for the appended sections. The enriched story file must include:

- exact types/contracts,
- exact files/modules,
- query/schema/prompt/event/component design,
- tests,
- migration/deploy concerns,
- decisions resolved from the story brief.

Every blocking technical question from the story file must be resolved or the story must stop as
blocked. The `## Blocking technical questions` section must say `None` before planning or code.

Update the **Spec** link in the tracker row if needed (the story file path does not change):

```markdown
[story](./stories/<ID>.md)
```

Commit (tracker row status column is unchanged — it remains `statuses.inProgress`):

```bash
git add <tracker README> <story file>
git commit -m "chore(<id>): enrich story file to implementation-ready"
```

If the row was claimed with status `plan-approved` (already enriched by a prior planning pass),
skip this phase — the file is already implementation-ready. If the row already links a detailed spec
directly (not a story file), keep the legacy path: review/refine that spec instead of enriching in
place.

## Phase 5: Write a plan when needed

If the row's **Plan** column is `—` (whether claimed at `specced` or `plan-approved`), write a plan under:

```text
<plansDir>/<YYYY-MM-DD>-<id-lc>-<slug>.md
```

The plan must be based on the detailed technical story spec, not only the story brief. It must be
specific enough for a fresh worker: files, tests, exact commands, and small steps. Use tests first
for behavior when the host repo has a test workflow. Update the tracker row's **Plan** column with a
link and commit:

```bash
git add <tracker README> <plan file>
git commit -m "chore(<id>): write implementation plan"
```

If the row already has a Plan link, use the linked plan. Do not rewrite it unless the review
found a concrete stale or unsafe step.

## Phase 6: Implement and verify locally

Execute the plan in the isolated branch or worktree. Keep the diff scoped to one story.

Use configured verification:

- Run `verify.changed` after focused chunks when it is configured.
- Run `verify.full` before marking the row to its configured complete status when it is configured.
- If a command is `null`, state that no configured command exists and use repo-local
  instructions if they name an equivalent check.

Failures must be fixed before shipping unless the user explicitly accepts an unrelated or
pre-existing failure.

Rendered verification should use the most reliable repo-supported path. If Browser rendered
verification is unavailable, the Browser connector is missing, or local browser env is unavailable,
fall back to repo Playwright/e2e gates. Append a journal event and final-report note that record the
rendered-verification downgrade reason and evidence. Avoid ad hoc browser scripts unless the story
explicitly requires them.
If Browser rendered verification is unavailable, fall back to repo Playwright/e2e gates and record the rendered-verification downgrade reason and evidence.

## Phase 7: Pre-PR review

Run a code/spec compliance review before tracker completion and PR creation when
`implement.review.prePr.enabled: true` and implementation work is nontrivial. If
`implement.review.prePr.enabled: false`, skip pre-PR review and state that the configured policy
disabled it. `implement.review.prePr.mode` controls the reviewer:

- `inline`: perform the review in this session.
- `auto`: attempt a review subagent when `implement.subagents.enabled: true` and the host tool
  policy already permits explicit delegation. If the subagent cannot run, review inline, append a
  `pre_pr_review_downgraded` journal event with `requestedMode`, `actualMode`, and `reason`, and
  report the warning in the final handoff.
- `subagent`: require a real spawned review agent result. If explicit delegation is missing, the
  subagent tool is unavailable, or the review agent cannot run, fail closed before PR creation:
  append `pre_pr_review_blocked`, set the run blocked, and stop with this actionable wording:
  "You are explicitly authorized to delegate the pre-PR review to a read-only review subagent if configured."
- `orchestrator`: do not self-review and do not open the PR at the checkpoint. Write the review
  request packet, append `pre_pr_review_requested`, then end the turn emitting
  `structuredContent.prePrReview = { status: "awaiting_review", packetPath, loop, diffRef, summary }`.
  This is a turn-boundary yield, not a blocking pause: the supervising orchestrator session reviews
  the diff and deposits a verdict, then resumes this same thread. On resume, follow the verdict
  (recorded as `pre_pr_review_verdict`): on `PASS`, open the PR; on `BLOCK`, apply the findings,
  rerun configured verification, and yield again with an incremented `loop` (up to
  `implement.review.prePr.maxLoops`, counted orchestrator-side). Never open the PR without a `PASS`.
  This mode is gated to the `codex-mcp` driver in v1.

Never record `actualMode: "subagent"` or subagent review success unless a real spawned review agent
returns a result. A manual inline review, even if thorough, is `actualMode: "inline"`.

Semantic checks are required when `implement.review.semanticChecks.enabled: true`. The review checks:

- acceptance criteria against actual behavior,
- product semantics and visible UI states, not only code shape,
- label/value consistency,
- percent vs count/unit formatting,
- for closeout, acceptance, or "shipped" claims, proof that the claim is backed by a real production
  path or durable artifact, not only types, services, tests, or prose,
- route intent correctness,
- dashboard visible states and empty/loading/error states when applicable,
- locale-backed Hebrew copy semantics when applicable,
- architecture boundaries and repo instruction violations,
- tests covering risky behavior,
- spec and plan compliance,
- tracker hygiene,
- accidental scope expansion.

Treat the product docs, architecture docs, tracker row, story brief, detailed spec, and plan as the
scope boundary. Do not request visible UX changes unless those sources explicitly require them. For
telemetry or observability stories, requiring instrumentation of existing interactions, model
opportunities, impressions, starts, outcomes, and internal state transitions is valid; requiring new
buttons, controls, or visible flows is out of scope unless the story asks for that UI. Flag
out-of-scope additions as review findings.

For subagent/auto-subagent review, build a review context packet containing:

- repo instructions and relevant local docs,
- PRD/product docs from `<docs.paths.prdsDir>/<slug>/` (fall back to `<paths.prdsDir>/<slug>/`) and architecture or technical design docs from `<docs.paths.designsDir>/<slug>.md` (fall back to `<prdsDir>/<slug>/technical-solution.md`) when present,
- tracker row, story brief, detailed story spec, and implementation plan,
- implementation diff,
- latest verification commands and output.

When spawning a review subagent in Codex, send exactly one accepted tool shape: a single `message`
with the review context. Do not include `items: []` alongside `message`.
Validate `spawn_agent` payloads before calling.

Ask the reviewer to check correctness, implementation quality, spec/plan compliance,
product/spec/UI semantic correctness, label and unit semantics, architecture/repo-instruction
compliance, tests, and scope control. The reviewer output must include severity-ranked findings with
file references where applicable and a clear `PASS` or `BLOCK` verdict.
The core review question is correctness, code quality, and spec compliance.
If review downgrades to inline, use the same checklist and context packet requirements, and record
the downgrade in the final report.

Required changes are fixed and re-reviewed before proceeding. Review fixes rerun configured
verification (`verify.changed` when scoped, `verify.full` before completion) before the next review.
Record review execution failures as `pre_pr_review_blocked`. Record successful review results as
`pre_pr_review_completed` with `verdict: "PASS" | "BLOCK"`, `mode`, `agentId` when applicable,
`loop`, `findings`, and `summary`. After each local fix batch, append
`pre_pr_review_fix_batch_applied`.

Stop after `implement.review.prePr.maxLoops` local review fix batches and ask the user.
`implement.review.prePr.loopMode` controls follow-up review context:

- `incremental`: first review gets the full review context packet; follow-up loops get prior
  findings, fix summary, changed diff since the previous review, and latest verification evidence.
- `full`: every loop gets the full review context packet.

For incremental follow-up loops, prefer reusing the same review subagent/thread when the host tool
supports continuing it. If the host cannot continue the previous reviewer, spawn a new read-only
review subagent with the incremental packet; this is not a downgrade when a real subagent performs
the review. Record the continuity in review journal events with `agentId`, `previousAgentId` when
applicable, and `continuityMode: "reused-agent" | "new-agent-incremental-context" | "full-context"`.

Subagents are recommended only for bounded sidecar work: review, analysis, log inspection, or
independent test investigation. Do not delegate blocking critical-path implementation to a subagent.
Worker subagents that write files are disallowed unless `implement.subagents.allowWorkers: true`;
even then, workers require disjoint write scopes documented before dispatch and must not edit the
tracker row, PR body, or files owned by another active worker.

## Phase 8: Mark done and handle PR creation

Re-read the tracker row. If it is still owned by this session and in `statuses.inProgress`,
update:

- **Status** -> the first `statuses.complete` value (default `done`).

The implementer writes `statuses.complete[0]` (default `done`); any later complete status such as `verified` is a terminal state applied later by CI or a human.

Commit:

```bash
git add <tracker README>
git commit -m "chore(<id>): mark <id> complete"
```

If `pr.create: false`, push the branch when a remote is configured, then stop without opening a
PR. If no remote exists, stop locally and report that the configured policy wants a branch push
but no remote is available.

If `pr.create: true`, push the branch and open a PR against `git.baseBranch`. The PR body
includes:

- summary,
- tracker/spec/plan links,
- verification commands and outcomes,
- review summary,
- statement that the tracker row is marked to its configured complete status (`statuses.complete[0]`) in the PR.

After the PR exists, update the tracker's **PR** column with the PR link, commit, and push.

## Phase 9: CI and review gates

If `pr.ci.wait: true`, wait for CI. Use `pr.ci.command` when configured, replacing `{pr}` with
the PR number or URL. If no command is configured, default to:

```bash
gh pr checks {pr} --watch
```

Review behavior:

- `pr.review.wait: none`: do not wait for review.
- `pr.review.wait: human`: stop after PR creation and configured CI; report that human review is
  required; do not auto-merge.
- `pr.review.wait: bot`: wait for `pr.review.bot`. If the bot mechanism is recognized, collect
  comments. If not recognized, stop and report that repo-specific bot handling is required.

Currently recognized bot handling is Codex-style GitHub reaction/comment review. Codex auto
review does not have to submit a native GitHub `PullRequestReview` with `APPROVED` or
`CHANGES_REQUESTED`.

For `pr.review.wait: bot` and `pr.review.bot: codex`:

- An eyes reaction on the PR body means Codex review started or is pending; it is not approval.
- A thumbs-up reaction on the PR body means Codex found no issues and the review gate is clear.
- Codex PR review comments or PR comments are findings.
- If `pr.review.triageComments: true`, every Codex finding must be fixed or explicitly replied to
  before merge.
- Mentioning `@codex` is a fallback/manual trigger only; do not require it when auto review is
  already enabled and starts normally.

Treat PR review as one external pass by default. After findings from the first external PR review
pass, fix locally, rerun configured verification, and reply/resolve findings as needed. Do not
request or wait for a fresh Codex PR review after every fix unless `pr.review.rerequestAfterFix`
is configured as `true`.
Do not re-request Codex review after fix batches when rerequestAfterFix is false.

Record the external review lifecycle with `pr_review_started`, `pr_review_findings`,
`pr_review_fix_batch_started`, `pr_review_fix_batch_applied`, `pr_review_thread_resolved`, and
`pr_review_completed` when those steps happen. After merge, append `pr_merged`; legacy `merged`
remains analyzable.

Stop after `pr.review.maxFixBatches` finding-fix batches and ask the user. Stop if no configured
review signal arrives within `pr.review.waitTimeoutMinutes`.

## Phase 10: Merge and cleanup

Auto-merge only when all are true:

- `pr.merge.auto: true`,
- configured CI and review gates are satisfied,
- local verification has passed on the current branch tip, including final verification after any PR
  review fix batch,
- the PR branch contains the tracker `done` update and PR link.

After PR review fixes, append a final verification completion event before merge. If final
verification fails, stop before merge. If event ordering suggests merge happened before required
final verification, report that as a blocker instead of treating the journal as clean.

Merge with `pr.merge.method`. Delete the branch when `pr.merge.deleteBranch: true`. For
`git.strategy: worktree`, remove the worktree only after confirming it is clean. Fast-forward
the base worktree when possible.

If `pr.merge.auto: false`, stop after the PR is ready and report the remaining manual merge
step.

## Preset behavior summary

| Preset | Behavior |
|---|---|
| `push-and-merge` | Create PR, skip CI wait, skip review wait, auto-merge. |
| `gated-automerge` | Create PR, wait for CI, wait for configured bot review, triage comments, auto-merge. |
| `push-only` | Create PR, stop before merge. |

Follow resolved config values, not preset names.

## Resume behavior

If interrupted, resume by reading:

1. current branch/worktree,
2. `git status --short`,
3. tracker row Status, Owner, Plan, and PR,
4. configured policy.

Continue from the first incomplete phase. Do not repeat already-completed commits unless the
tracker or git state shows they are missing.

## Final report

Report:

- story ID and tracker path,
- branch/worktree,
- commits made,
- verification commands and outcomes,
- interactive run journal path,
- PR URL if created,
- CI/review/merge outcome according to config,
- final tracker Status and PR columns,
- any manual next step.

## Anti-patterns

- Hardcoding paths, branches, check commands, review bots, or merge methods.
- Claiming more than one story.
- Reverting a claimed row to `plan-approved` after enrichment — enrichment is a file-content change, not a status transition.
- Marking done before implementation, review, and configured verification pass.
- Merging while configured gates are unsatisfied.
- Leaving the PR column empty after PR creation.
- Adding spec-frontmatter status fields.
- Trusting agent prose over the tracker matrix.
