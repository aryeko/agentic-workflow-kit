---
title: AWK136 implementation plan
owner: codex-2026-06-15T16-51-16Z
last-reviewed: 2026-06-15
related:
  - ../specs/2026-06-15-awk136-awk13-6-test-trust-and-coverage-ratchet-design.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK136.md
---

# AWK136 implementation plan

## Scope

Add the final test-trust sweep for AWK13.6 without production behavior changes.

## Steps

1. Update `packages/orchestrator/tests/runner.test.ts` fakes:
   - Add explicit merge-call capture to `FakeCollaborationInspector`.
   - Add explicit refreshed base tracker and reachable-merge support to `FakeGitInspector`.
2. Add a runner smoke test that uses a real temp tracker, fake story runner, mocked pre-merge GitHub evidence, parent-side merge, refreshed base tracker evidence, and verified completion authority.
3. Raise `packages/orchestrator/vitest.config.ts` coverage thresholds to statements 81, branches 72, functions 85, lines 85.
4. Run focused verification:
   - `pnpm --dir packages/orchestrator test`
   - `pnpm --dir packages/orchestrator exec vitest run --config vitest.config.ts --coverage`
5. Run full verification:
   - `pnpm check`

## Review checklist

- No production behavior changes.
- The new smoke fails if parent-side collaboration verification or merge evidence is bypassed.
- Coverage thresholds are above the old floor and below the currently measured coverage.
- Tracker row is updated to `done` only after implementation, review, and verification pass.
