---
title: AWK1315 implementation plan
owner: codex-2026-06-15T22-12-57Z
last-reviewed: 2026-06-16
related:
  - ../specs/2026-06-16-awk1315-coverage-headroom-and-test-devx-design.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK1315.md
---

# AWK1315 implementation plan

## Scope

Add test-only headroom and a local coverage cleanup lifecycle step. Do not change runtime product behavior.

## Steps

1. Add a root coverage cleanup script.
   - Create `scripts/clean-coverage.mjs`.
   - Add `"pretest": "node scripts/clean-coverage.mjs"` to root `package.json`.
   - Add a focused root test that creates stale coverage files, runs the script, and asserts the stale coverage directory is gone.

2. Add targeted coverage tests.
   - Add package-level tests for session-log root helpers and console/system utilities.
   - Extend `packages/orchestrator/tests/codex-control-execution.test.ts` for target resolution branches: missing target, blank session id fallback, malformed launch JSON, and launch file without a session.
   - Extend `packages/orchestrator/tests/live-metrics.test.ts` for missing/unreadable session-log enrichment and partial metric availability.

3. Run focused tests.
   - `pnpm exec vitest run test/coverage-clean.test.ts packages/orchestrator/tests/session-log-roots.test.ts packages/orchestrator/tests/runtime-utilities.test.ts packages/orchestrator/tests/codex-control-execution.test.ts packages/orchestrator/tests/live-metrics.test.ts`

4. Recompute combined coverage.
   - `pnpm exec vitest run --coverage.reporter=json-summary --coverage.reporter=json --coverage.reporter=text`
   - Confirm the final coverage clears the intended thresholds with visible branch headroom.

5. Raise `vitest.config.ts` thresholds.
   - Set `statements: 85`, `branches: 76`, `functions: 90`, `lines: 88.5` unless the measured coverage proves a tighter safe value.

6. Verify the stale-coverage local rerun case.
   - Create `coverage/.tmp/coverage-0.json` or equivalent stale coverage state.
   - Run `pnpm test` and confirm the pretest cleanup removes the stale state before Vitest starts.

7. Run the configured gate.
   - `pnpm check`

8. Prepare closeout.
   - Run the required pre-PR review.
   - Delete the transient spec and plan in the final story commit after durable details are reflected in code/tests and PR text.
   - Mark AWK1315 `done`, create the PR, wait for configured CI/Codex review, then squash-merge if gates pass.
