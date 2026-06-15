---
title: AWK1315 detailed technical story spec
owner: codex-2026-06-15T22-12-57Z
last-reviewed: 2026-06-16
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK1315.md
  - ../../tracks/agentic-workflow-kit-redesign/release-readiness-review-3.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design-3.md
---

# AWK1315 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK1315.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Clean via a `pretest` script, a vitest `globalSetup`, or v8-provider config? | Add a root `pretest` script that runs a small Node script to remove the root `coverage/` directory before `pnpm test`. | The failure is stale local coverage state before Vitest starts. A root lifecycle cleanup is explicit, provider-agnostic, CI-safe, and does not affect package tests or production code. |
| How much to raise each threshold after adding tests? | Target `statements: 85`, `branches: 76`, `functions: 90`, `lines: 88.5`, then verify against the final measured combined report. | These thresholds are above the old ratchet while leaving a small buffer under the expected post-test coverage. If the final branch number does not clear 76, add tests rather than lowering the branch target unless the exact uncovered branches are out of scope. |

## Exact types/contracts

- `package.json` root scripts:
  - add `pretest` before the existing `test` script.
  - keep `test` as `vitest run && pnpm --filter @agentic-workflow-kit/orchestrator test`.
- `scripts/clean-coverage.mjs`:
  - no exported API.
  - removes `<repo>/coverage` with `fs.rm(..., { recursive: true, force: true })`.
  - resolves paths from the script location so it is stable when invoked by `pnpm test`.
- `vitest.config.ts` coverage thresholds:
  - `statements: 85`
  - `branches: 76`
  - `functions: 90`
  - `lines: 88.5`

## Exact files/modules

```text
package.json  add root pretest lifecycle script
scripts/clean-coverage.mjs  remove stale root coverage output before test runs
vitest.config.ts  raise the unified coverage ratchet after targeted tests pass
test/*.test.ts or packages/orchestrator/tests/*.test.ts  add targeted coverage for currently thin pure/helper branches
```

## Query/schema/prompt/event/component design

No query, schema, prompt, event, component, route, or runtime behavior change is in scope.

Test additions should target existing pure/helper behavior and avoid changing product semantics:

- session log root helpers for home-present and home-missing branches.
- console/system utility behavior where currently uncovered.
- child-control target resolution error and malformed-launch branches.
- live metrics enrichment branches for missing/unreadable session logs and partial metric availability.

## Tests

- Focused:
  - `pnpm exec vitest run test/coverage-clean.test.ts packages/orchestrator/tests/session-log-roots.test.ts packages/orchestrator/tests/runtime-utilities.test.ts packages/orchestrator/tests/codex-control-execution.test.ts packages/orchestrator/tests/live-metrics.test.ts`
- Coverage:
  - `pnpm exec vitest run --coverage.reporter=json-summary --coverage.reporter=json --coverage.reporter=text`
- Stale coverage rerun:
  - create a stale `coverage/.tmp/coverage-0.json` shape in the worktree, then run `pnpm test`.
- Full gate:
  - `pnpm check`

## Migration/deploy concerns

No migrations, deploy steps, feature flags, or runtime rollout concerns. The pretest cleanup removes ignored local coverage artifacts only.

## Blocking technical questions

None
