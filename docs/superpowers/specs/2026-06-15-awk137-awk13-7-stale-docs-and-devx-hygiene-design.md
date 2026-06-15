---
title: AWK137 detailed technical story spec
owner: codex-2026-06-15T17-04-23Z
last-reviewed: 2026-06-15
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK137.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
---

# AWK137 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK137.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Regenerate root `CHANGELOG.md` or replace with a pointer to the package changelog? | Replace the stale root changelog body with a current-state pointer and short release-history note. Keep `packages/orchestrator/CHANGELOG.md` as the generated package release source of truth. | AWK14 owns the release changeset/version bump. A root pointer removes the stale `0.1.0` claim without duplicating generated package history that can drift again. |
| Add `docs-current-state` assertions for `SECURITY.md`/`engines` to prevent regression? | Yes. Add focused assertions for root changelog delegation, supported `0.5.x` security line, package `engines.node >=24`, getting-started repo-checkout command form, and autopilot tool-list coverage. | These are low-cost documentation/package metadata facts named by the release-readiness review and story brief. |

## Exact types/contracts

- `packages/orchestrator/package.json` gains published metadata:
  - `engines.node: ">=24"`
- Root `CHANGELOG.md` contract:
  - must not advertise `0.1.0` as the current unreleased line;
  - must point maintainers and readers to `packages/orchestrator/CHANGELOG.md`;
  - may summarize that the aligned package/plugin line is currently `0.5.x`.
- `SECURITY.md` contract:
  - supported versions table lists `0.5.x` as supported and `< 0.5` as unsupported.
- `docs/getting-started.md` contract:
  - repo-checkout CLI examples use `pnpm agentic-workflow-kit -- ...`;
  - bare `agentic-workflow-kit run ...` examples are only valid when explicitly described as installed package usage.
- `skills/workflow-autopilot/SKILL.md` and plugin mirror contract:
  - preferred MCP tools include current shipped tools: `workflow_run_*`, `workflow_child_*`, legacy tracker/run tools, watch cursor tools, `codex_reply`, `codex_interrupt`, `analyze_run`, and `workflow_driver_check`/`check_codex_mcp`.

## Exact files/modules

```text
CHANGELOG.md  Replace stale 0.1.0 unreleased entry with current root/package changelog guidance.
SECURITY.md  Update supported-versions table from 0.1.x to 0.5.x.
docs/getting-started.md  Normalize repo-checkout CLI examples and document approval/verification behavior.
packages/orchestrator/package.json  Add engines.node >=24 to published package metadata.
skills/workflow-autopilot/SKILL.md  Align preferred tool list and CLI fallback with shipped tool surface.
plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md  Mirror canonical workflow-autopilot skill exactly.
test/docs-current-state.test.ts  Add regression assertions for stale-doc and DevX facts.
test/skill-authoring.test.ts  Strengthen workflow-autopilot skill coverage for new tool names.
docs/tracks/agentic-workflow-kit-redesign/README.md  Link this detailed spec and the implementation plan, then mark complete later.
```

## Query/schema/prompt/event/component design

- No database, route, component, prompt-execution, or event schema change is required.
- The workflow-autopilot instruction prompt changes only its tool guidance:
  - prefer facade status/control/report/export tools when available;
  - retain legacy direct tools and compatibility aliases;
  - recommend `watch_run_start`/`watch_run_poll`/`watch_run_stop` for long supervision;
  - keep dry-run-first and approval language intact.
- The getting-started guide must explicitly document:
  - `/workflow-init` defaults unknown/new repos to conservative push-only behavior and auto-merge presets require explicit selection;
  - non-dry-run autonomous launches require explicit approval;
  - GitHub collaboration verification fails closed when evidence is missing.

## Tests

- Update `test/docs-current-state.test.ts`:
  - assert root `CHANGELOG.md` points to `packages/orchestrator/CHANGELOG.md`, mentions `0.5.x`, and omits stale `## [0.1.0] - Unreleased`;
  - assert `SECURITY.md` supports `0.5.x` and not `0.1.x`;
  - assert `packages/orchestrator/package.json.engines.node` is `>=24`;
  - assert repo-checkout `run status|stream|inspect` examples use `pnpm agentic-workflow-kit -- ...`;
  - assert getting-started mentions explicit approval and GitHub verification fail-closed behavior.
- Update `test/skill-authoring.test.ts`:
  - assert workflow-autopilot skill contains `watch_run_start`, `watch_run_poll`, `watch_run_stop`, `workflow_child_reply`, `workflow_child_interrupt`, `workflow_driver_check`, `codex_reply`, and `codex_interrupt`.
- Verification commands:
  - focused: `pnpm vitest run test/docs-current-state.test.ts test/skill-authoring.test.ts`
  - configured changed/full: `pnpm check`

## Migration/deploy concerns

- No runtime migration or deploy step.
- `engines.node >=24` is stricter package metadata, but it matches existing README, CI, and contributor docs.
- Root changelog pointer avoids conflicting with changeset-generated package changelog history. AWK14 can add the release changeset without editing stale duplicated root release history.
- Plugin mirror must remain byte-synced with canonical `skills/workflow-autopilot/SKILL.md`.

## Blocking technical questions

None
