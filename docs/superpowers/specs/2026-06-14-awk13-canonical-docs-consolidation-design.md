---
title: AWK13 detailed technical story spec
owner: codex-2026-06-14T02-55-42Z
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK13.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/01-architecture-and-domains.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/03-data-contracts.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/05-api-surface.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/06-delivery-inputs.md
---

# AWK13 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK13.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Which transient story specs/plans should be deleted versus folded into canonical docs? | Fold durable content from every `docs/superpowers/specs/*.md` and `docs/superpowers/plans/*.md` story file into canonical docs, then delete the story spec/plan files. Keep `docs/superpowers/README.md` and `.gitkeep` placeholders only. | The repo convention says story specs/plans are working artifacts and `main` should carry canonical docs only. Existing AWK02, AWK05, and AWK11 specs/plans contain durable profile, prompt, budget, launch, structured-output, GitHub evidence, analyzer, and verification details that belong in canonical architecture, config, runtime, package, and test-plan docs. |
| Should PRD/technical-solution docs remain as historical design docs after release? | Keep the redesign PRD and technical-solution tree as planning artifacts in `docs/prds/agentic-workflow-kit-redesign/`. Do not archive or delete them in AWK13. Update canonical docs so consumers do not need those planning docs for current usage. | The story brief says archiving is non-blocking and maintainer-directed. The PRD and technical solution still provide acceptance-criteria traceability for AWK13/AWK14, while canonical docs own current user and contributor guidance. |
| How should the previously deferred AWK13 row be represented? | Treat the user invocation as the tracker-approved manual force-run after AWK12 completion. Record the force-run in the interactive run journal, claim AWK13, create this spec and plan, then remove transient spec/plan links from the final tracker row before marking done if the files are deleted. | The tracker explicitly allows AWK13 to be force-run manually after AWK12. Avoiding final links to deleted transient artifacts keeps tracker links valid while preserving evidence in git history and the run journal. |
| Does this story create a changeset or release notes? | No changeset or release output in AWK13. Update durable docs and package/plugin README surfaces only. AWK14 owns release readiness and the consolidated changeset. | The story brief and tracker ground rules put changeset/release readiness out of scope for AWK13. |

## Exact types/contracts

No TypeScript contracts or runtime schemas change in AWK13 unless a docs test exposes a small
documentation-sync fixture issue.

The documentation contract after AWK13:

- `README.md`, `docs/README.md`, `docs/architecture.md`, `docs/getting-started.md`,
  `packages/orchestrator/README.md`, `references/*.md`, `docs/test-plan/*.md`, `skills/*.md`, and
  `plugins/agentic-workflow-kit/**` describe the current V1 behavior from canonical sources.
- `references/config-schema.md` remains the human mirror of
  `packages/orchestrator/src/config/schema.ts` and `references/config.schema.json`.
- `references/tracker-contract.md`, `references/story-brief-contract.md`, and
  `references/detailed-story-spec-contract.md` continue to distinguish PRD, technical solution,
  tracker, story brief, detailed story spec, implementation plan, and runtime artifacts.
- `plugins/agentic-workflow-kit/` remains byte-synced with `.codex-plugin/`, `skills/`,
  `references/`, `presets/`, and `examples/`.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` contain no story Markdown files in the
  final AWK13 diff.

## Exact files/modules

```text
README.md  Consolidate user-facing current behavior, install, runtime, PR/review semantics, and docs map.
AGENTS.md  Keep repo instructions aligned with canonical docs-only and plugin fixture sync rules.
CONTRIBUTING.md  Keep contributor docs aligned with transient spec/plan lifecycle and AWK14 changeset ownership.
SECURITY.md  Verify security scope still names current package/plugin/contract surfaces.
CHANGELOG.md  Verify root changelog remains historical only; do not add release entries.
.changeset/README.md  Verify changeset ownership and AWK14 release handoff remain clear.
.github/PULL_REQUEST_TEMPLATE.md  Verify PR checklist matches docs/test/review expectations.
docs/README.md  Canonical docs hub and artifact-role map.
docs/architecture.md  Fold durable runtime, API, artifact, analyzer, review, GitHub evidence, profile, budget, and driver content.
docs/getting-started.md  Keep user workflow, CLI/MCP commands, artifact inspection, review/merge gates, and recovery guidance current.
docs/test-plan/*.md  Ensure plugin/package/manual smoke expectations reflect current CLI/MCP and fixture behavior.
docs/prds/agentic-workflow-kit-redesign/**/*.md  Keep as planning history; only fix stale current-state claims if necessary.
references/*.md  Keep contracts current and mirrored to plugin fixture.
references/templates/**/*.md  Verify templates match current artifact roles and no status-frontmatter mirror.
examples/**/*.md  Verify worked examples still match contracts.
skills/*/SKILL.md  Ensure skill docs match current config keys, review policy, run journal, and API/tool names.
packages/orchestrator/README.md  Fold durable CLI/MCP, artifact, review, report/export, and troubleshooting details.
packages/orchestrator/CHANGELOG.md  Verify package changelog remains generated release history only.
plugins/agentic-workflow-kit/**  Sync all mirrored docs from canonical source surfaces after edits.
docs/superpowers/specs/*.md  Delete story spec files after durable content is folded into canonical docs.
docs/superpowers/plans/*.md  Delete story plan files after durable content is folded into canonical docs.
```

## Query/schema/prompt/event/component design

No database queries, UI components, routes, migrations, or runtime prompt behavior change.

Documentation design:

- Audit hidden and visible Markdown with `rg --files --hidden -g '*.md' -g '!node_modules/**' -g '!.git/**'`.
- Search for stale terms and broken/current-state risks such as `not yet published`, old skill names,
  removed MCP bundle paths, old `.workflow/runs`, missing `workflow_run_*` facade tools, missing
  review-continuity semantics, missing `codex_reply`/`codex_interrupt`, missing report/export/control
  docs, and dangling transient `docs/superpowers` links.
- Update canonical docs first, then materialized plugin fixture copies.
- Remove stale transient specs/plans only after canonical docs contain the durable decisions:
  profiles/budgets/task bindings, launch metadata/capability downgrades, structured-output intent,
  GitHub evidence parsing, analyzer diagnostics, completion-gate merge authority, and verification
  commands.

## Tests

Focused checks:

```bash
pnpm vitest run test/docs-current-state.test.ts test/config-doc-sync.test.ts test/example-prd.test.ts test/example-tracker.test.ts test/skill-authoring.test.ts
pnpm vitest run test/plugin-manifest.test.ts test/orchestrator-package.test.ts test/artifact-model.test.ts test/tracker-contract.test.ts test/story-brief-template.test.ts test/tracker-template.test.ts
```

Inventory and content checks:

```bash
rg --files --hidden -g '*.md' -g '!node_modules/**' -g '!.git/**' | sort
find docs/superpowers/specs docs/superpowers/plans -type f ! -name '.gitkeep' -print
rg -n "not yet published|plan-product|plan-architecture|plan-track|mcp/server\\.mjs|\\.workflow/runs|docs/superpowers/(specs|plans)/.*\\.md" .
```

Required full gate:

```bash
pnpm check
```

Rendered/browser verification is not applicable because AWK13 has no UI surface; repo docs/tests are
the configured verification path.

## Migration/deploy concerns

No database migrations, hosted deploys, package publishing, or changeset files. AWK13 may delete
transient docs and update canonical Markdown. AWK14 owns changeset and release readiness after AWK13
lands.

Plugin fixture sync is required for any changed canonical `skills/`, `references/`, `examples/`, or
`.codex-plugin/` Markdown-adjacent surface. The materialized `plugins/agentic-workflow-kit/` copy
must remain byte-synced for tests and local marketplace installs.

## Blocking technical questions

None
