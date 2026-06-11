# Common phases (surface-agnostic)

Shared steps for both the [Claude](./claude-plugin.md) and [Codex](./codex-plugin.md) smoke runs.
**Start from your surface entry** — it provides the load + invocation specifics and sends you here
for the rest. Read the [principles](./README.md#principles-apply-to-both-surfaces) first.

Throughout, `WK=~/repos/agentic-workflow-kit` is the plugin source and `SMOKE` is the throwaway repo.

## Setup & containment

```bash
WK=~/repos/agentic-workflow-kit
( cd "$WK" && pnpm install && pnpm build )      # build package dist and MCP runtime once

SMOKE="$(mktemp -d)/wk-smoke"
mkdir -p "$SMOKE/.github/workflows" && cd "$SMOKE"
git init -q
printf '{"name":"smoke","version":"0.0.0"}\n' > package.json
: > .github/workflows/ci.yml                     # gives workflow-init a "CI present" signal
git add -A && git commit -qm "init smoke repo"
# NOTE: no `git remote add` — this is the containment. Side-effectful steps must stop at "no remote".
```

Run the orchestrator CLI from the built dist (works from any cwd):

```bash
alias wk='node "$WK"/packages/orchestrator/dist/cli.js'
```

## Phase 1 — Runtime plumbing (read-only)

These have **no side effects**; run them first to prove the plumbing before spending interactive turns.
Use the plugin-provided MCP tools from plugin sessions when available; use the `wk` CLI alias as the
development fallback.

1. **MCP reachability + schema:** `wk mcp check`
   - PASS: reports the Codex `codex` tool and that its input schema validates. (Requires the `codex` CLI.)
   - This intentionally needs only the `codex` CLI and a cwd, not `.workflow/config.yaml`, so it can
     run first in a fresh repo.
2. **Discovery + parsing** (after a tracker exists — e.g. point at the bundled example or a scaffolded one):
   - `wk list-tracks` · `wk list-stories --tracks-dir docs/tracks` · `wk list-eligible --tracks-dir docs/tracks`
   - PASS: tracks/stories enumerate; eligibility matches the tracker (unowned + deps complete + eligible status).
3. **Dry-run dispatch:** `wk run-eligible --dry-run`
   - PASS: prints the stories it *would* launch and writes a dry-run state; **no child session starts**.

## Phase 2 — Authoring skills (pass criteria; invoke per your surface entry)

Invoke each skill the way your surface entry describes, then verify against these contract checks.

- **`workflow-init`** ([contract](../../references/config-schema.md))
  - Detects package manager, CI, default branch, branch protection; states the chosen preset + signals.
  - Writes a schema-valid `.workflow/config.yaml`; scaffolds the tracks index and `example-tracker/`.
  - **Idempotency (re-run it):** reconciles missing keys, reports drift, and does **not** overwrite an
    existing config or tracker without explicit confirmation.
  - **Preset coverage:** repeat in repos with different signals — required reviews → `push-only`;
    CI + no required reviews → `gated-automerge`; neither → `push-and-merge`.
- **`define-product`** ([contract](../../references/prd-contract.md))
  - Produces a multi-file PRD under `docs/prds/<slug>/` (README index + numbered sections) conforming
    to the PRD contract; adds `paths.prdsDir` only if missing; does not clobber an existing PRD.
- **`design-technical-solution`** ([contract](../../references/technical-solution-contract.md))
  - For complex technical PRDs, produces `docs/prds/<slug>/technical-solution.md` with system shape,
    modules, data/query design, AI prompts/triggers/tools, observability, migration/deploy surfaces,
    testing strategy, and tracker/story-brief inputs. For simple PRDs, records why the gate was not
    needed.
- **`plan-delivery-track`** ([contract](../../references/tracker-contract.md))
  - Requires a PRD present and requires a technical solution for complex technical PRDs. Emits a
    tracker plus story briefs; stories map back to PRD acceptance-criteria IDs and technical
    solution sections when a technical solution exists.
  - **Cross-check (the contract boundary between the two surfaces):**
    `wk list-stories --tracks-dir <produced tracksDir>` and `wk list-eligible ...`
    must parse the agent-written markdown through the strict orchestrator parser without error.

## Phase 3 — Side-effectful skill (contained)

- **`implement-next`** on a **trivial** story, in the no-remote `SMOKE` repo.
  - PASS: isolates per `git.strategy` (worktree/branch); takes completion from the **tracker row**,
    never the child's prose; marks the row to `statuses.complete[0]` (`done`); then **stops at
    "no remote"** (or with `pr.create: false`) instead of opening or merging a PR.
  - Containment: confirm no branch/commit escaped (there is no remote); inspect the worktree/branch
    it created, then discard the scratch repo.
  - Claude explicit-invocation-only skills (`implement-next`, `workflow-autopilot`) are only truly
    smoked when invoked in an interactive Claude session; dispatched/headless Claude can hand-execute
    `SKILL.md`, validating instructions but not skill invocation.
  - With `pr.create: false` and no remote, the `done` tracker row and code remain on the worktree
    branch; the base branch can still show `specced` because there is no PR/remote reconciliation.

## Phase 4 — Live orchestrator dispatch (MCP preferred, CLI fallback; costs Codex tokens)

Deepest smoke — launches a real Codex child session. Keep it bounded.

1. `run_eligible` with dry-run or `wk run-eligible --dry-run` — re-confirm the dispatch set (no side effects).
2. `wk run-story <id> --sandbox workspace-write --approval-policy on-failure`
   - PASS: a child session launches; the orchestrator **re-reads the tracker** as the completion
     authority; it **blocks** (non-zero exit, `status: blocked`) if the story returns without reaching
     a complete status; artifacts are written under `.codex/agentic-workflow-kit/runs/<runId>/`
     (`events.ndjson`, `state.json`, `metrics.live.json`, `children/`).
   - Note: `--sandbox workspace-write` is safe for worktree-strategy dispatch because the orchestrator
     automatically injects the workspace's `.git` and `.worktrees` directories as codex writable roots
     (D8 fix). The child can `git commit` and `git worktree add` without needing `danger-full-access`.
3. `wk analyze-run .codex/agentic-workflow-kit/runs/<runId>` — reconstructs tool/subagent/token metrics from
   the Codex session logs and derives review, verification, merge, cleanup, and timeline summaries
   from `events.ndjson`. The same command also accepts compatible interactive `implement-next`
   journals when `state.json` contains `command: "implement-next"` and an `interactive` child record.
   Confirm that pre-PR review execution blockers are separate from review findings, local fix
   batches are counted against `implement.review.prePr.maxLoops`, PR review threads/fix batches are
   reconstructed, child-session review subagent loops are summarized when explicit pre-PR events are
   missing, and the timeline preserves journal order while exposing recorded/action times.
4. For recovery drills, prove a child is stale before clearing or retrying anything. `supervision_lost`
   requires no settled child result, no recent heartbeat, no session linkage or discoverable session
   log, and no recent launch/activity evidence. Recent heartbeat or session evidence must keep the
   run in `running` / launched state.
5. For auto-merge drills, verify that a completed tracker row plus merge commit on the configured
   base branch is accepted when `pr.merge.auto: true`, while direct base-branch commits remain
   blocked when `git.commitOnBase: forbid`.
6. Confirm dirty-checks ignore `.codex/agentic-workflow-kit/runs/**` runtime artifacts but still
   block on unrelated uncommitted files in branch strategy.

## Evidence

For each phase, save the command output / session transcript (redact anything sensitive). Note that
agent steps are non-deterministic — record *whether the contract held*, not just the raw text. A
short results note (per surface) is enough to clear the gate.
