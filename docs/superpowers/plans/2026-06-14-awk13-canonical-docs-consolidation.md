---
title: AWK13 implementation plan
owner: codex-2026-06-14T02-55-42Z
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk13-canonical-docs-consolidation-design.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK13.md
---

# AWK13 implementation plan

## Scope

Consolidate current agentic-workflow-kit behavior into canonical Markdown docs, keep mirrored plugin
fixture docs byte-synced, and remove transient story specs/plans after durable content is folded in.

Out of scope: runtime behavior changes, schema changes, release changesets, publishing, and AWK14
release handoff.

## Steps

1. Inventory Markdown surfaces.
   - Run `rg --files --hidden -g '*.md' -g '!node_modules/**' -g '!.git/**' | sort`.
   - Search for stale wording and broken lifecycle references:
     `not yet published`, old skill names, `mcp/server.mjs`, `.workflow/runs`, missing product
     facade tools, missing review continuity, and transient `docs/superpowers` links.

2. Fold durable transient content into canonical docs.
   - From AWK02, preserve named agent profiles, task bindings, prompt/structured-output refs,
     budget dimensions, resolved profile visibility, and telemetry-unavailable semantics.
   - From AWK05, preserve provider-neutral launch metadata, profile-aware Codex launch behavior,
     structured-output intent, prompt hash, and capability downgrade semantics.
   - From AWK11, preserve GitHub evidence shape, Codex review reaction/comment semantics, nested
     evidence compatibility, analyzer diagnostics, and completion-gate merge authority.

3. Update canonical user and contributor docs.
   - `README.md`, `docs/README.md`, `docs/architecture.md`, `docs/getting-started.md`,
     `packages/orchestrator/README.md`, `CONTRIBUTING.md`, and `AGENTS.md`.
   - Keep root changelog and package changelog release-history only.
   - Keep `.changeset/README.md`, `SECURITY.md`, and `.github/PULL_REQUEST_TEMPLATE.md` aligned if
     they mention stale process or release guidance.

4. Update contracts, templates, examples, skills, and test-plan docs where current behavior has
   drifted.
   - `references/*.md`, `references/templates/**/*.md`, `examples/**/*.md`, `skills/*/SKILL.md`,
     and `docs/test-plan/*.md`.
   - Do not add status mirrors to story briefs.

5. Sync the materialized Codex plugin fixture.
   - Copy changed canonical `skills/`, `references/`, and `examples/` files into
     `plugins/agentic-workflow-kit/`.
   - Keep fixture-specific metadata intact.

6. Remove transient story files after replacements are in place.
   - Delete `docs/superpowers/specs/*.md` and `docs/superpowers/plans/*.md`.
   - Keep `docs/superpowers/README.md` and `.gitkeep` placeholders.
   - Remove final tracker links to deleted transient spec/plan files so the tracker has no dangling
     Markdown links.

7. Verify.
   - Run focused docs/contract tests:

```bash
pnpm vitest run test/docs-current-state.test.ts test/config-doc-sync.test.ts test/example-prd.test.ts test/example-tracker.test.ts test/skill-authoring.test.ts
pnpm vitest run test/plugin-manifest.test.ts test/orchestrator-package.test.ts test/artifact-model.test.ts test/tracker-contract.test.ts test/story-brief-template.test.ts test/tracker-template.test.ts
```

   - Run inventory checks:

```bash
find docs/superpowers/specs docs/superpowers/plans -type f ! -name '.gitkeep' -print
rg -n "not yet published|plan-product|plan-architecture|plan-track|mcp/server\\.mjs|\\.workflow/runs|docs/superpowers/(specs|plans)/.*\\.md" .
```

   - Run full gate: `pnpm check`.

8. Pre-PR review and closeout.
   - Spawn the required read-only pre-PR review subagent with repo instructions, tracker row, story
     brief, detailed spec, plan, diff, inventory evidence, and verification output.
   - Fix required findings within the configured loop limit and rerun verification.
   - Re-read the tracker, mark AWK13 `done`, commit, push, open PR, update the PR column, wait for
     CI and Codex bot review, fix at most one PR-review batch if needed, rerun final verification,
     squash merge, delete branch, and remove the worktree.

## Verification commands

Focused:

```bash
pnpm vitest run test/docs-current-state.test.ts test/config-doc-sync.test.ts test/example-prd.test.ts test/example-tracker.test.ts test/skill-authoring.test.ts
pnpm vitest run test/plugin-manifest.test.ts test/orchestrator-package.test.ts test/artifact-model.test.ts test/tracker-contract.test.ts test/story-brief-template.test.ts test/tracker-template.test.ts
```

Required full gate:

```bash
pnpm check
```
