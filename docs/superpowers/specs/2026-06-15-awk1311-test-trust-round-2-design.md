---
title: AWK1311 detailed technical story spec
owner: codex-2026-06-15T20-32-00Z
last-reviewed: 2026-06-15
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK1311.md
  - ../../tracks/agentic-workflow-kit-redesign/release-readiness-review-2.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design-2.md
  - ../../prds/agentic-workflow-kit-redesign/06-quality-bars.md
---

# AWK1311 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK1311.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Merge configs vs vitest workspace for one combined report? | Make the root `vitest.config.ts` the single coverage-owning config and include both `test/**/*.test.ts` and `packages/orchestrator/tests/**/*.test.ts`; keep `packages/orchestrator/vitest.config.ts` package-local without coverage thresholds. | `pnpm check` already runs root `vitest run` before package-local tests. Moving the coverage gate to the root run produces one combined number in CI without a second subset ratchet in the package run. |
| What are the re-baselined thresholds after instrumenting `test/**`? | Measure after the config change with `pnpm exec vitest run --coverage`; set each threshold just below the measured combined value and never below the existing AWK136 ratchet values unless the combined denominator proves the old subset was misleading. | The current config prevents a valid combined pre-measurement. The implementation must use the changed config to compute the true combined baseline before finalizing thresholds. |
| How should `mcp/codexControl.ts` coverage be interpreted after AWK13.8? | Test the live execution path in `packages/orchestrator/src/drivers/codex-mcp/control.ts` and keep alias/routing assertions for `packages/orchestrator/src/mcp/codexControl.ts` / `tools.ts`. | AWK13.8 turned `mcp/codexControl.ts` into a compatibility re-export. The risk now lives in the driver control implementation and MCP alias routing. |

## Exact types/contracts

- `vitest.config.ts`
  - `test.include` must include both root contract/plugin tests and orchestrator package tests:
    - `test/**/*.test.ts`
    - `packages/orchestrator/tests/**/*.test.ts`
  - `test.coverage.enabled` must be `true`.
  - `test.coverage.provider` must stay `v8`.
  - `test.coverage.thresholds` must contain `lines`, `statements`, `functions`, and `branches` values measured from the combined suite.
- `packages/orchestrator/vitest.config.ts`
  - remains valid for `pnpm --filter @agentic-workflow-kit/orchestrator test`;
  - keeps `include: ['tests/**/*.test.ts']`;
  - does not own a separate coverage ratchet that can report a package-only number as the release gate.
- End-to-end story-run test contract:
  - uses a fake `StoryRunner`;
  - uses real `WorkflowRunner`, `RunJournal`, `CompletionGate`, and `FileArtifactStore`;
  - runs against a real temporary artifact directory;
  - verifies the final returned run state and on-disk `state.json`, `summary.json`, `rows.json`, and `children/<story>.json`;
  - avoids real Codex or GitHub network calls by faking only driver and collaboration seams.
- Child-control execution test contract:
  - covers `sendChildReply`, `sendChildInterrupt`, and `controlChild`;
  - proves the implementation calls the available Codex MCP tool candidate with session/thread id plus message or reason;
  - verifies `events.ndjson` receives `child-reply-sent` and `child-interrupt-sent` records when `runPath` is provided;
  - verifies reply journaling records a SHA-256 only, not the message body.

## Exact files/modules

```text
vitest.config.ts
  Own the combined coverage gate for root and orchestrator package tests.

packages/orchestrator/vitest.config.ts
  Keep package-local test execution, remove package-only coverage thresholds.

packages/orchestrator/tests/story-run-e2e.test.ts
  Add the real-runner / real-journal / real-artifact-store story-run integration test.

packages/orchestrator/tests/codex-control-execution.test.ts
  Add direct child-control execution tests with mocked MCP Client and stdio transport.

test/mcp-codex-control.test.ts
  Keep or adjust MCP alias/routing tests only if config or routing assertions need current names.
```

## Query/schema/prompt/event/component design

- No new public schema, CLI command, MCP tool, prompt, or UI component is introduced.
- Coverage design:
  - Root `vitest run` is the release coverage gate and reports one coverage summary across both test roots.
  - Package-local `vitest run --config packages/orchestrator/vitest.config.ts` remains useful for package-scoped execution but is not a second coverage gate.
- E2E story-run design:
  - Create a temp workspace containing `.workflow/config.yaml` and a contract-compliant tracker.
  - Resolve config against that workspace or build a resolved config equivalent to existing runner tests.
  - Fake `StorySource` returns one eligible story first and a complete-status story after the fake child settles.
  - Fake `StoryRunner` emits `session-linked` lifecycle metadata and returns a successful `StoryRunResult`.
  - Fake `GitInspector` returns committed, non-base-branch evidence.
  - Use `pr.create: false` / `merge.auto: false` for this test so GitHub is not required; the value under test is the local run artifact path.
  - Assert on-disk artifacts, not only in-memory state.
- Child-control design:
  - Use Vitest module mocking for `@modelcontextprotocol/sdk/client/index.js` and `@modelcontextprotocol/sdk/client/stdio.js`.
  - The mocked client records `connect`, `listTools`, `callTool`, and `close`.
  - The tests import the control module after mocks are installed so the real execution functions use mocked transport while covering production logic.

## Tests

- Focused tests:
  - `pnpm exec vitest run --coverage`
  - `pnpm --filter @agentic-workflow-kit/orchestrator test -- --run packages/orchestrator/tests/story-run-e2e.test.ts packages/orchestrator/tests/codex-control-execution.test.ts`
  - If the filter syntax is unsupported, run `pnpm --filter @agentic-workflow-kit/orchestrator test`.
- Full gate:
  - `pnpm check`
- Expected assertions:
  - one coverage summary covers both root and package tests;
  - combined thresholds pass;
  - story-run e2e writes `state.json`, `summary.json`, `rows.json`, and child artifacts;
  - child-control execution tests verify reply and interrupt tool calls and journal records.

## Migration/deploy concerns

- No runtime migration, package version, changeset, or deploy step is needed.
- The config change affects local and CI test runtime. If duplicate package test execution makes `pnpm check` too slow, keep package-local tests but remove package-local coverage so only root coverage owns the ratchet.
- Coverage output directories may be overwritten by root and package runs. The package config should not emit a package-only coverage report during `pnpm check`.

## Blocking technical questions

None
