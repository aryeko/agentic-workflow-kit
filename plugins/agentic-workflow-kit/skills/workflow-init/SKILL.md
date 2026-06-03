---
name: workflow-init
description: Use when a repo wants to adopt agentic-workflow-kit, when the user says "init agentic-workflow-kit", "set up agentic-workflow-kit", "scaffold the workflow config", or runs /workflow-init. Detects the repo's package manager, verify command, CI, default branch, and branch-protection rules; chooses a PR/merge preset; writes .workflow/config.yaml; and scaffolds a tracks index plus an example tracker. Idempotent.
argument-hint: "[instructions]"
user-invocable: true
---

# workflow-init

Scaffold agentic-workflow-kit configuration in the current repository: a single
`.workflow/config.yaml`, a tracks index, and an example tracker. Detect sensible
defaults; never clobber existing files without confirmation.

## References (read before acting)

- Config schema (human): `${CLAUDE_PLUGIN_ROOT}/references/config-schema.md`
- Config schema (machine): `${CLAUDE_PLUGIN_ROOT}/references/config.schema.json`
- Tracker contract: `${CLAUDE_PLUGIN_ROOT}/references/tracker-contract.md`
- Presets: `${CLAUDE_PLUGIN_ROOT}/presets/push-and-merge.yaml`, `gated-automerge.yaml`, `push-only.yaml`
- Example tracker: `${CLAUDE_PLUGIN_ROOT}/examples/example-tracker/README.md`

## Step 1 — Detect signals

Run these, tolerating failures (a missing tool just means "unknown"):

- **Package manager / verify command:** check for `pnpm-lock.yaml`, `package-lock.json`,
  `yarn.lock`, `bun.lockb`, `Cargo.toml`, `go.mod`, `Makefile`. If `package.json` has a
  `check` or `test` script, prefer it for `verify.full`. Detect a scoped changed gate distinct from
  the full gate when one exists (for example `nx affected`, `turbo run <task> --filter=...`,
  `lint-staged`, or a `*:changed` / `*:affected` script) and use it for `verify.changed`.
- **CI present:** any files under `.github/workflows/`.
- **Default branch:** `git symbolic-ref --short refs/remotes/origin/HEAD` (strip the
  `origin/` prefix); fall back to `main`.
- **Required reviews:** `gh api repos/{owner}/{repo}/branches/{base}/protection` — a 404
  means no branch protection (no required reviews).

## Step 2 — Choose a preset

Apply this table (canonical encoding: `packages/orchestrator/src/config/preset.ts` in the
agentic-workflow-kit source repo; packaged runtime behavior is owned by `@agentic-workflow-kit/orchestrator`):

- Required reviews → `push-only` (humans gate the merge; open a PR and stop).
- CI present, no required reviews → `gated-automerge` (wait on CI + bot review, then auto-merge).
- Neither → `push-and-merge` (open a PR, best-effort local checks, auto-merge).

State the chosen preset and the signals behind it, and let the user override before writing.

## Step 3 — Write `.workflow/config.yaml`

Copy the chosen preset verbatim, then patch detected values: `verify.full` (from the detected full
verify command), `verify.changed` (from a scoped changed gate when present), and `git.baseBranch`
(from the detected default branch). Only set `verify.changed` equal to `verify.full` when no scoped
command exists, and say that fallback explicitly in the summary. Leave everything else at the
preset's value. Validate the result against `config.schema.json` before saving.

## Step 4 — Scaffold trackers (only if absent)

- If `<tracksDir>/README.md` does not exist, create it as the tracks index: a short
  description, an "Active tracks" table (`Track | Prefix | Status | README`), an
  "Archived tracks" table, and an ID-prefix registry of reserved prefixes.
- If `<tracksDir>/example-tracker/README.md` does not exist, copy the bundled example
  tracker there as a working reference.

Never overwrite an existing index or tracker without explicit user confirmation.

## Step 5 — Summarize

Print the chosen preset (and the signals behind it), the paths written, and the next
command to run.

## Idempotency

Re-running is safe: reconcile missing keys in an existing `.workflow/config.yaml`, report
any drift from the schema, and skip scaffolding files that already exist.
