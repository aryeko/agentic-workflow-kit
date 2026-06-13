---
title: AWK12 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md
---

# AWK12 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| HC-1 | Codex plugin/MCP runtime remains a supported V1 surface. |
| HC-2 | Package/runtime boundary remains provider-neutral. |
| HC-4 | Non-GitHub/non-Codex future work is documented rather than required. |
| WF-5 | Plugin/package surfaces reflect artifact role boundaries. |
| FUT-1 | Release readiness does not require full benchmark harness. |
| FUT-2 | Package artifacts remain consumable by future tools. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Migration/deploy surfaces | Requires plugin metadata, fixtures, presets, examples, package smoke, and compatibility. |
| Testing strategy | Defines package/plugin smoke gates. |
| Architecture and domains | Plugin/package surfaces map to shared contracts and runtime package. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK09 | Public CLI/MCP surface must be stable before package/plugin fixtures are finalized. |
| AWK10 | Report/analyzer outputs must be included in package compatibility tests. |
| AWK11 | GitHub evidence behavior must be documented/tested before plugin smoke. |

## Scope boundary

**In scope**

- Update `.codex-plugin/`, `.claude-plugin/`, local marketplace fixtures, plugin manifests, MCP wiring, examples, presets, and smoke tests for the redesigned runtime surfaces.
- Ensure plugin/package version references remain consistent but do not publish a new version in this story.
- Preserve current installed 0.5.13 runtime assumption while making repo code ready for later release.
- Add package smoke and fixture tests covering the new CLI/MCP/API surface where practical.

**Out of scope**

- Creating the consolidated changeset; AWK14 owns it.
- Canonical docs rewrite; AWK13 owns it.
- Publishing to npm or plugin marketplace.

## Candidate surfaces

- **Files/modules:** `.codex-plugin/*`, `.claude-plugin/*`, `.mcp.json`, `.agents/plugins/marketplace.json`, `plugins/agentic-workflow-kit/**` if present, `packages/orchestrator/package.json`, `test/codex-plugin-smoke.vitest.ts`, `test/plugin-manifest.test.ts`, `test/plugin-runtime-bundle.test.ts`, `test/publish-readiness.test.ts`, `examples/*`, `presets/*`
- **Queries/schema:** package and manifest metadata
- **Prompts/tools:** plugin skill descriptions and MCP server instructions
- **Events/metrics:** smoke fixtures may include artifact/report outputs
- **Components/routes:** package binaries and MCP startup

## Validation expectations

- Plugin manifest/runtime smoke tests.
- `pnpm build`
- `pnpm pack:dry-run`
- `pnpm smoke:codex-plugin`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Does this repo contain a materialized `plugins/agentic-workflow-kit/` fixture in this checkout? | yes | Inspect and update if present; otherwise document absence. |
| Should old MCP tools remain visible after new API tools are added? | yes | Align with AWK01 compatibility decision and smoke tests. |
