---
title: AWK08 implementation plan
owner: codex-2026-06-13T22-51-49Z
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk08-story-and-track-autopilot-policy-design.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK08.md
---

# AWK08 implementation plan

## Scope

Implement parent-runner budget/autopilot policy for story and track execution without adding the
AWK09 streaming API or AWK11 GitHub evidence parsing. Completion remains tracker/GitHub evidence
owned by `CompletionGate`.

## Steps

1. Add focused tests first.
   - Extend `packages/orchestrator/tests/runner.test.ts` for:
     - `stop-new-launches` blocks additional track launches even when `stopLaunchingOnBlocked` is `false`.
     - `checkpoint-stop` waits for active children to settle and then avoids newly eligible launches.
     - `abort` budget action aborts the active child signal and blocks with budget evidence.
     - story-level `runStory` still runs independently from track autopilot.
   - Extend `packages/orchestrator/tests/scheduler.test.ts` only if scheduler options change.

2. Add the budget-control helper.
   - Create `packages/orchestrator/src/runner/BudgetControl.ts`.
   - Implement strongest-action selection from `BudgetEvaluation[]`.
   - Precedence: `abort` > `checkpoint-stop` > `stop-new-launches` > `warn` > `continue`.
   - Return a bounded reason that includes profile, task type, dimension, status, action, and artifact hint.

3. Wire budget control into `WorkflowRunner`.
   - Change `writeLiveMetrics` to return the current budget control decision after writing artifacts/events.
   - Track `stopLaunching` reasons separately from child blocked failures in `runEligible`.
   - Before each launch batch and after every child settlement, apply budget decisions.
   - For `stop-new-launches` and `checkpoint-stop`, do not launch more children but allow active children to settle.
   - For `abort`, abort pending/active child signals when possible, record budget evidence, and finish blocked.
   - For `runStory`, stop as blocked when a non-warning budget limit prevents completion.

4. Preserve recovery and completion semantics.
   - Keep `CompletionGate` as the only acceptance path for complete stories.
   - Keep `RecoveryGuard` takeover behavior unchanged.
   - Do not treat budget stop as a duplicate-launch or recovery takeover signal.

5. Update durable docs.
   - Fold budget action timing and precedence into `docs/architecture.md`.
   - Fold track-autopilot stop policy into `docs/prds/agentic-workflow-kit-redesign/technical-solution/02-runtime-flows.md`.

6. Verify.
   - Run `pnpm vitest run packages/orchestrator/tests/runner.test.ts packages/orchestrator/tests/scheduler.test.ts`.
   - Run `pnpm check`.
   - Fix any failures before pre-PR review.

7. Final tracker hygiene.
   - Delete this plan and the AWK08 detailed spec after durable docs are updated.
   - Update AWK08 tracker row to `done` only after implementation, verification, and pre-PR review pass.
   - Create PR, update the PR column, wait for configured CI/Codex review, then auto-merge only if gates pass.
