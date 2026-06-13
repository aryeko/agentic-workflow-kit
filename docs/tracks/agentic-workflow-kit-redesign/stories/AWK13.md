---
title: AWK13 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/06-delivery-inputs.md
---

# AWK13 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| WF-5 | Canonical docs clearly distinguish every workflow artifact and runtime artifact role. |
| HC-4 | Future providers are documented as future work. |
| FUT-1 | V1 observability expectations are documented without promising a benchmark harness. |
| FUT-2 | Future UI/eval consumers can understand artifact shape from docs. |
| POL-3 | Role/profile model is reflected in docs. |
| POL-7 | Task bindings and per-run overrides are documented. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Delivery inputs | Explicitly calls for docs/examples/package smoke as final stabilization. |
| AI, observability, and operations | Docs must reflect prompt, event, notification, rollout, and security boundaries. |
| API surface | Docs must reflect MCP/CLI resources, tools, envelopes, and errors. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK12 | All implementation and package/plugin surfaces must settle before canonical docs are updated. |

## Execution guidance

- Launch this story with extra-high, or the highest supported, reasoning effort. This story requires
  repo-wide consistency judgment across product docs, contributor docs, package docs, plugin
  fixtures, skill docs, references, examples, and release handoff material.
- This story is intentionally deferred from autopilot. After AWK12 is complete, run AWK13 manually
  in a new session by changing the tracker status back to `specced`/`plan-approved` or by
  force-running the story.
- Use a replacement-first migration order: inventory stale docs, write or update the new canonical
  docs, verify links/tests/content consistency, and only then remove or archive old docs and
  transient story specs/plans.
- Do not perform deletion-only cleanup of `docs/superpowers/`, old docs, or obsolete generated docs
  before the replacement docs are in place and verified.

## Scope boundary

**In scope**

- Audit and update every repository Markdown surface (`*.md`) that mentions workflow roles,
  runtime behavior, public APIs, config, packaging, or contributor process.
- Update root governance/readme docs, including `README.md`, `AGENTS.md`, `CONTRIBUTING.md`,
  `CHANGELOG.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and any other root `*.md` that is stale.
- Update canonical product/runtime docs: `docs/README.md`, `docs/architecture.md`,
  `docs/getting-started.md`, package README, plugin docs, config docs, contracts, examples,
  test-plan docs, and any role-model/API docs.
- Update Markdown in package/plugin distribution surfaces, including `packages/**/README.md`,
  `packages/**/CHANGELOG.md`, `plugins/agentic-workflow-kit/**/*.md`, `skills/**/*.md`,
  `references/**/*.md`, `examples/**/*.md`, and generated/materialized fixture docs when they
  must stay byte-sync with source docs.
- Fold durable decisions from all implementation story specs/plans under `docs/superpowers/` into canonical docs.
- Remove or archive transient `docs/superpowers/` story specs/plans according to repo convention,
  leaving only allowed placeholders, only after replacement docs are in place and verified.
- Remove or archive old/stale docs only after their replacement canonical docs are written,
  cross-linked, and validation has passed.
- Ensure docs reflect the new version role model, agent profiles, task bindings, budgets, runtime controls, API surface, observability/reporting, GitHub collaboration, and future work boundaries.
- Pin assumption: this story is still executed by installed 0.5.13; docs describe the version being prepared for release, not the current executor.

**Out of scope**

- Code behavior changes except small docs-test fixes.
- Creating the changeset/release; AWK14 owns it.
- Publishing.

## Candidate surfaces

- **Files/modules:** every repo `*.md`, especially root Markdown docs, `docs/**/*.md`, `references/**/*.md`, `examples/**/*.md`, `skills/**/*.md`, `packages/**/*.md`, `plugins/agentic-workflow-kit/**/*.md`, `.changeset/README.md`, `docs/superpowers/*`
- **Queries/schema:** none
- **Prompts/tools:** skill docs and examples
- **Events/metrics:** docs for run/event/report artifacts
- **Components/routes:** none

## Validation expectations

- Docs/template/example tests.
- `rg --files -g '*.md'` inventory reviewed for stale role/API/runtime/config/release wording.
- Verify replacement docs exist, are linked, and pass tests before deleting or archiving stale docs
  or transient detailed specs/plans.
- Verify no stale transient detailed specs/plans remain unless intentionally allowed after the
  replacement-first migration is complete.
- `pnpm vitest run test/docs-current-state.test.ts test/config-doc-sync.test.ts test/example-prd.test.ts test/example-tracker.test.ts test/skill-authoring.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Which transient story specs/plans should be deleted versus folded into canonical docs? | yes | Audit `docs/superpowers/` after all prior stories land. |
| Should PRD/technical-solution docs remain as historical design docs after release? | no | Recommend keeping them as planning artifacts unless maintainer requests archive. |
