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
- Docs templates: `${CLAUDE_PLUGIN_ROOT}/references/templates/docs-style.md`, `references/templates/index/master-readme-template.md`, `references/templates/index/pillar-readme-template.md`

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

Default to `push-only` for new or unknown repos, regardless of detected CI or branch-protection
signals. This is the conservative starter preset: open a PR and stop before merge. The auto-merge
presets remain available only when the user explicitly opts into them:
canonical encoding lives in `packages/orchestrator/src/config/preset.ts` in the
agentic-workflow-kit source repo; packaged runtime behavior is owned by `@agentic-workflow-kit/orchestrator`.

- `gated-automerge` waits on CI + bot review, then auto-merges.
- `push-and-merge` opens a PR, uses best-effort local checks, and auto-merges.

State the chosen preset and the signals behind it, and let the user override before writing.

## Step 3 — Write `.workflow/config.yaml`

Copy the chosen preset verbatim, then patch detected values: `verify.full` (from the detected full
verify command), `verify.changed` (from a scoped changed gate when present), and `git.baseBranch`
(from the detected default branch). Only set `verify.changed` equal to `verify.full` when no scoped
command exists, and say that fallback explicitly in the summary. Leave everything else at the
preset's value. Presets declare the current semver config schema version, for example
`version: "0.7.0"`. Existing configs with legacy `version: 1` remain readable during the transition
window, but should be reported as upgradeable before reconciling missing keys. Validate the result
against `config.schema.json` before saving.

## Step 4 — Detect existing docs layout

Before scaffolding, inspect any existing `docs/` tree to map discovered directories onto
`docs.paths.*` config keys instead of creating duplicates. Apply these detection rules:

- If a directory named `adr/`, `adrs/`, or `decisions/` exists under `docs/` or
  `docs/architecture/`, treat it as `docs.paths.decisionsDir` and record that value.
- If a directory named `domains/` exists under `docs/` or `docs/architecture/`, treat
  it as `docs.paths.domainsDir`.
- If a directory named `designs/` or `technical-solutions/` exists under
  `docs/architecture/`, treat it as `docs.paths.designsDir`.
- If `docs/product/prds/` or `docs/prds/` exists, treat the found path as
  `docs.paths.prdsDir`.
- If `docs/product/` exists, treat it as `docs.paths.productDir`.
- If `docs/architecture/` exists, treat it as `docs.paths.architectureDir`.

Report any mappings that differ from the defaults. Do not move or rename existing
directories. Store reconciled path overrides in `.workflow/config.yaml` under `docs.paths`
so all downstream skills use the same resolved values.

## Step 5 — Scaffold the docs knowledge base (only if absent)

Using resolved `docs.*` config (from `.workflow/config.yaml` after Step 3, with any
overrides from Step 4), scaffold the docs knowledge base. All scaffolding is idempotent:
skip any file that already exists and never overwrite existing content.

### Always (lean and full presets)

Scaffold these files regardless of preset:

1. **Master index** at `docs.index` (default `docs/README.md`) — seed from
   `${CLAUDE_PLUGIN_ROOT}/references/templates/index/master-readme-template.md`. Fill
   placeholders: project name, pillar paths resolved from `docs.paths`, `docs.style` path. Fill
   frontmatter: set `owner` to `—` (or a detected repo owner when available) and `last-reviewed`
   to today's date.

2. **Docs style** at `docs.style` (default `docs/docs-style.md`) — seed from
   `${CLAUDE_PLUGIN_ROOT}/references/templates/docs-style.md`. Update the `related` links
   to match resolved paths. Fill frontmatter: set `owner` to `—` (or a detected repo owner
   when available) and `last-reviewed` to today's date.

3. **Product pillar index** at `<docs.paths.productDir>/README.md` (default
   `docs/product/README.md`) — seed from
   `${CLAUDE_PLUGIN_ROOT}/references/templates/index/pillar-readme-template.md`. Fill
   pillar name as "Product", question as "What are we building, for whom, and why?",
   and list `prdsDir` as the primary sub-directory. Fill frontmatter: set `owner` to `—` (or a
   detected repo owner when available) and `last-reviewed` to today's date.

4. **Architecture pillar index** at `<docs.paths.architectureDir>/README.md` (default
   `docs/architecture/README.md`) — seed from the same pillar index template. Fill pillar
   name as "Architecture", question as "How is it built — decisions, layering, conventions?",
   and list `guidelines.md`, `designs/`, `domains/`, and `decisions/` as entries
   when they are enabled. Fill frontmatter: set `owner` to `—` (or a detected repo owner when
   available) and `last-reviewed` to today's date.

5. **Architecture guidelines stub** at
   `<docs.paths.architectureDir>/guidelines.md` (default
   `docs/architecture/guidelines.md`) — create a minimal stub with required frontmatter
   (`title: Architecture guidelines`, `status: draft`, `owner: —`,
   `last-reviewed: <today>`), an H1, a one-line TL;DR, a Context section, and a
   `## Rules` placeholder. Do not overwrite if it already exists and has content beyond
   the frontmatter.

6. **Tracks directory** (`<tracksDir>/README.md`) — unchanged behavior: create the
   tracks index if absent (short description, Active tracks table, Archived tracks table,
   ID-prefix registry). Copy the bundled example tracker to
   `<tracksDir>/example-tracker/README.md` if absent.

Template resolution order for each file: `docs.templatesDir/<template-filename>` (repo
override) → kit built-in at `${CLAUDE_PLUGIN_ROOT}/references/templates/...`. Use the
repo override when present; fall back to the kit built-in.

### Additionally for `full` preset

When `docs.preset` is `full`, also scaffold:

7. **Domains directory** — create `<docs.paths.domainsDir>/README.md` (default
   `docs/architecture/domains/README.md`) when `docs.types.domain.enabled` is `true`.
   Stub content: frontmatter (`title: Domain references`, `status: draft`), H1, TL;DR
   ("One file per domain; each describes its purpose, public API, invariants, and gotchas."),
   a short Context section, and a placeholder bullet list. Reference the domain reference
   template at `${CLAUDE_PLUGIN_ROOT}/references/templates/domain-reference-template.md`.

8. **Decisions directory** — create `<docs.paths.decisionsDir>/README.md` (default
   `docs/architecture/decisions/README.md`) when `docs.types.adr.enabled` is `true`.
   Stub content: frontmatter (`title: Architecture decisions`, `status: draft`), H1,
   TL;DR ("Numbered, immutable ADRs; cite by number so references survive title renames."),
   a short Context section, and a placeholder table (`Number | Title | Status | Date`).
   Reference the ADR template at
   `${CLAUDE_PLUGIN_ROOT}/references/templates/adr-template.md`.

9. **QA directory stub** — create `qa/README.md` with frontmatter (`title: QA`,
   `status: draft`), H1, and a single-sentence Context placeholder.

10. **Runbooks directory stub** — create `runbooks/README.md` when
    `docs.types.runbook.enabled` is `true` (or when the `full` preset is active and the
    key is absent, treat it as enabled for scaffolding only). Frontmatter:
    `title: Runbooks`, `status: draft`. Stub body: H1, TL;DR ("Each runbook covers one
    recurring operational situation: symptom, diagnosis, remediation, escalation."),
    Context, and a placeholder.

Never overwrite an existing index or tracker without explicit user confirmation.

## Step 6 — Summarize

Print the chosen preset (and the signals behind it), the paths written (config and docs
knowledge base), and the next command to run.

## Idempotency

Re-running is safe: reconcile missing keys in an existing `.workflow/config.yaml`, report
any drift from the schema, and skip scaffolding files that already exist. If the runtime exposes
`workflow_config_status` or `agentic-workflow-kit config status --json`, use it before changing an
existing config. If status reports an available upgrade, summarize the change and ask before running
`workflow_config_upgrade` or `agentic-workflow-kit config upgrade --yes --json`; dry-run first when
the user has not already approved the write.
