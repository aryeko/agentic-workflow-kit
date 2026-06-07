---
name: implement-next
description: Use when the user asks to pick, claim, implement, ship, or merge the next eligible agentic-workflow-kit tracker story, or names a specific tracker ID such as PC03, WK4, AR12, or TU11. Reads .workflow/config.yaml plus references/tracker-contract.md, discovers active trackers, validates dependencies and ownership, expands new story briefs into detailed technical story specs, writes implementation plans, then implements, verifies, updates tracker state, creates PRs, handles configured CI/review gates, optional merge, and cleanup. Do not use for creating trackers (use plan-delivery-track), writing PRDs (use define-product), or non-tracker one-off work.
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
| `references/tracker-contract.md` | Eligibility rule, status matrix shape, dependency semantics, and status vocabulary. |
| `references/story-brief-contract.md` | New story brief shape produced by `plan-delivery-track`. |
| `references/detailed-story-spec-contract.md` | Required detailed technical story spec content before planning/code. |
| `references/templates/detailed-story-spec-template.md` | Template for specs created from story briefs. |
| Repo instructions | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, technical solution docs, and local docs. These win over specs and plans. |

Apply documented defaults when optional config keys are missing. At the start of every run,
summarize the resolved policy: `paths`, `statuses`, `verify`, `git`, and `pr`.

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

## Config keys

Use these keys:

- `paths.tracksDir`, `paths.specsDir`, `paths.plansDir`, `paths.archiveDir`
- `statuses.eligible`, `statuses.inProgress`, `statuses.complete`
- `tracker.idPattern`
- `verify.changed`, `verify.full`
- `git.strategy`, `git.branchPattern`, `git.baseBranch`, `git.commitOnBase`
- `pr.create`
- `pr.ci.wait`, `pr.ci.command`
- `pr.review.wait`, `pr.review.bot`, `pr.review.triageComments`
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
- PR creation, CI wait, review wait, merge method, and delete-branch behavior.

If the chosen policy requires a missing tool, stop before claiming a row. Examples:

- `pr.create: true` requires `git` and a usable remote plus PR tooling such as `gh`.
- `pr.ci.wait: true` with no `pr.ci.command` requires `gh pr checks`.
- `pr.merge.auto: true` requires merge tooling.

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

If `git.strategy: worktree`, create a worktree from `git.baseBranch`. If `git.strategy: branch`,
create or switch to the branch in the current worktree. If `git.commitOnBase: forbid`, refuse to
commit directly on `git.baseBranch`.

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

- `[brief](path)` or a path under `<tracksDir>/<track>/stories/<ID>.md` means read the story brief
  under `<tracksDir>/<track>/stories/<ID>.md`.
- Backward compatibility: a detailed spec link (not a story brief) — typically under `<specsDir>` —
  means continue the legacy behavior and read it as the detailed technical story spec.
- Backward compatibility: a legacy `see <ID> + [delta](path)` link means read the referenced base
  spec plus the delta together as the detailed technical story spec.
- `[spec](path)` means inspect the path. If it points to a story brief, create/refine the detailed
  technical story spec first. If it points to a detailed spec under `<specsDir>`, use the
  backward-compatible detailed-spec path.
- `Plan` with a link means read and assess it.
- `Plan` as `—` means a plan must be written after the detailed technical story spec is ready.

Also read repo contract docs and the tracker's dependency, parallelism, and coordination
sections. Produce a short brief with:

- scope,
- files likely in scope,
- spec/plan contradictions,
- risks,
- open questions.

If there is a blocker, pause for user input before planning or implementation.

## Phase 4: Create or refine the detailed technical story spec

For story brief rows, create/refine the detailed technical story spec first.

If the tracker row links a story brief under `<tracksDir>/<track>/stories/<ID>.md`, create/refine
the detailed technical story spec before writing any implementation plan or code, under:

```text
<specsDir>/<YYYY-MM-DD>-<id-lc>-<slug>-design.md
```

Use `references/templates/detailed-story-spec-template.md` and satisfy
`references/detailed-story-spec-contract.md`. The detailed technical story spec must include:

- exact types/contracts,
- exact files/modules,
- query/schema/prompt/event/component design,
- tests,
- migration/deploy concerns,
- decisions resolved from the story brief.

Every blocking technical question from the story brief must be resolved in the detailed spec or the
story must stop as blocked. The `## Blocking technical questions` section must say `None` before
planning or code.

Update the tracker row's **Spec** column from the brief link to a combined reference, for example:

```markdown
[brief](./stories/<ID>.md) + [spec](<specsDir-relative path>)
```

Commit:

```bash
git add <tracker README> <detailed spec file>
git commit -m "chore(<id>): write detailed story spec"
```

If the row already links a detailed spec directly (not a story brief), keep the legacy path:
review/refine that spec instead of creating a duplicate.

## Phase 5: Write a plan when needed

If the row was selected with Status `specced` and Plan `—`, write a plan under:

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

If the row was already `plan-approved`, use the linked plan. Do not rewrite it unless the review
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

## Phase 7: Review

Run a code/spec compliance review before shipping. The skill should prefer a dedicated review
sub-agent or review skill when available, but it must remain usable in a plain Claude Code
installation. The review checks:

- spec and plan compliance,
- missing tests,
- repo instruction violations,
- tracker hygiene,
- accidental scope expansion.

Required changes are fixed and re-reviewed before proceeding.

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

After fixes, rerun configured verification and push again. Stop after three review-fix loops and
ask the user.

## Phase 10: Merge and cleanup

Auto-merge only when all are true:

- `pr.merge.auto: true`,
- configured CI and review gates are satisfied,
- local verification has passed on the current branch tip,
- the PR branch contains the tracker `done` update and PR link.

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
- PR URL if created,
- CI/review/merge outcome according to config,
- final tracker Status and PR columns,
- any manual next step.

## Anti-patterns

- Hardcoding paths, branches, check commands, review bots, or merge methods.
- Claiming more than one story.
- Treating `plan-approved` as an execution status to write.
- Marking done before implementation, review, and configured verification pass.
- Merging while configured gates are unsatisfied.
- Leaving the PR column empty after PR creation.
- Adding spec-frontmatter status fields.
- Trusting agent prose over the tracker matrix.
