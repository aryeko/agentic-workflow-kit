# agentic-workflow-kit config (`.workflow/config.yaml`)

The single source of truth for how agentic-workflow-kit behaves in a repo. Every field is
optional with the default shown; `workflow-init` writes a fully-populated file. The
machine-readable mirror is `config.schema.json` (validated in CI).

## Top level

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `version` | const `1` | `1` | Schema version. Must be exactly `1`. Required. |

## `paths`

Where work lives.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `tracksDir` | string | `docs/tracks` | Trackers at `<tracksDir>/<name>/README.md`. |
| `specsDir` | string | `docs/specs` | Per-story specs. |
| `plansDir` | string | `docs/plans` | Implementation plans. |
| `archiveDir` | string | `docs/tracks/archive` | Finished trackers. |
| `prdsDir` | string | `docs/prds` | PRD directories at `<prdsDir>/<slug>/` (written by `plan-product`). |

## `statuses`

The automation-significant buckets of the status vocabulary (see `tracker-contract.md`).

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `eligible` | string[] | `[specced, plan-approved]` | A story can be picked when its status is here. |
| `inProgress` | string | `implementing` | Status a claimed story is moved to. |
| `complete` | string[] | `[done, verified]` | Satisfies a dependency / marks a story finished. |

## `tracker`

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `idPattern` | string (regex) | `^[A-Z]{2,}[0-9]+$` | Valid story IDs, e.g. `PC06`, `SP12`. |

## `verify`

Commands used as gates. Auto-detected from the package manager when unset (`null`).

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `changed` | string \| null | `null` | Fast per-task gate. |
| `full` | string \| null | `null` | Merge gate (full suite). |

## `git`

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `strategy` | `worktree` \| `branch` | `worktree` | Isolation strategy. |
| `branchPattern` | string | `{track}/{id-lc}-{slug}` | Branch name template. |
| `baseBranch` | string | `main` | Base branch for PRs. |
| `commitOnBase` | `forbid` \| `allow` | `forbid` | Whether committing on the base branch is allowed. |

## `pr` — PR + merge policy (the headline knob)

The only block that differs between a push-and-merge repo and a gated-automerge repo.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `create` | boolean | `true` | Open a PR at all? `false` pushes the branch and stops. |
| `ci.wait` | boolean | `false` | Wait for CI to be green before merging? |
| `ci.command` | string \| null | `null` | How to wait; defaults to `gh pr checks {pr} --watch`. |
| `review.wait` | `none` \| `bot` \| `human` | `none` | Whether to wait for a review before merging. |
| `review.bot` | string | `none` | Which bot (e.g. `codex`) when `review.wait: bot`. |
| `review.triageComments` | boolean | `false` | Require a reply to every bot comment before merge? |
| `merge.auto` | boolean | `false` | Auto-merge once gates pass? |
| `merge.method` | `squash` \| `merge` \| `rebase` | `squash` | Merge method. |
| `merge.deleteBranch` | boolean | `true` | Delete the branch after merge. |

## `orchestrator` (optional)

Consulted only when the orchestrator package is installed.

| Key | Type | Default | Meaning |
| --- | --- | --- | --- |
| `driver` | string | `codex-mcp` | Child-session driver. WK4 v1 supports `codex-mcp` only; future drivers may extend this value without changing tracker semantics. |
| `maxParallel` | integer | `2` | Max concurrent child sessions. |
| `stopLaunchingOnBlocked` | boolean | `true` | Stop launching when a child returns incomplete. |
| `childTimeoutMs` | integer | `1800000` | Per-child wall-clock timeout before the run is blocked with a failure record. |
