---
title: AWK08 detailed technical story spec
owner: codex-2026-06-13T22-51-49Z
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK08.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
---

# AWK08 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK08.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Which budget actions are enforced synchronously in runner versus classified after child settlement? | Enforce budget actions at runner checkpoints after every live metrics write and after each child settlement. `warn` records only a warning. `stop-new-launches` prevents future track autopilot launches while allowing active children to settle. `checkpoint-stop` also prevents future launches and ends the track loop after active children settle. `abort` stops future launches and aborts active/pending children through the existing child abort signal when the limit is observed during supervision. Story-level `runStory` reports a blocked state when a limit action stronger than `warn` is reached before completion. | Current budget artifacts already classify limits from live metrics. Runner checkpoints can consume that classification without trusting child prose or adding AWK09 streaming API. |
| How should `stopLaunchingOnBlocked` interact with budget `stop-new-launches` and `checkpoint-stop`? | Blocking failures still honor `orchestrator.stopLaunchingOnBlocked`. Budget stop actions are independent control states and always stop new launches, even when `stopLaunchingOnBlocked` is `false`. Precedence is `abort` > `checkpoint-stop` > `stop-new-launches` > blocked-failure policy > continue. | Budget policy is a user-configured autonomy ceiling. It must be able to stop launches regardless of normal failure-continuation policy. |

## Exact types/contracts

- Add a runner-local budget control contract in `packages/orchestrator/src/runner/BudgetControl.ts`.
- Exported types:
  - `BudgetControlAction = "continue" | "warn" | "stop-new-launches" | "checkpoint-stop" | "abort"`.
  - `BudgetControlDecision` with `action`, `reason`, `evaluation`, `stopNewLaunches`, `checkpointStop`, and `abort`.
- Inputs use existing `BudgetEvaluation` rows from `budgets.json`; no config schema changes are required.
- Budget event semantics remain:
  - warning threshold or `action: warn` over limit records `budget-warning`.
  - over-limit actions other than `warn` record `budget-stop`.
- `RunState.status` remains unchanged for normal budget checkpoint stops unless no progress can continue; blocked runs use existing `blocked` status and `blockedReason`.
- `ChildResultEvidence.blockers` remains the place for child-reported blockers; budget policy is parent-owned evidence in `events.ndjson`, `budgets.json`, `summary.json`, and `state.json`.

## Exact files/modules

```text
packages/orchestrator/src/runner/BudgetControl.ts  Budget evaluation to runner control decision helper.
packages/orchestrator/src/runner/WorkflowRunner.ts  Consume budget controls during story and track loops; stop launches; abort active child on abort limits; record budget control events.
packages/orchestrator/src/scheduler/scheduler.ts  Accept optional attempted/excluded ids so dispatch selection remains deterministic under stop policies if needed.
packages/orchestrator/src/commands/handlers.ts  Keep story-level and track-level invocation independent; no public command split.
packages/orchestrator/tests/runner.test.ts  Focused runtime tests for budget stop, checkpoint stop, abort, blocked precedence, and story-vs-track independence.
packages/orchestrator/tests/scheduler.test.ts  Focused deterministic dispatch tests if scheduler options change.
docs/architecture.md  Fold durable AWK08 budget/autopilot policy decisions into canonical runtime architecture before final story commit.
docs/prds/agentic-workflow-kit-redesign/technical-solution/02-runtime-flows.md  Fold durable runtime precedence into canonical runtime-flow docs before final story commit.
```

## Query/schema/prompt/event/component design

- Story-level mode:
  - `runStory` validates and launches exactly one story.
  - It evaluates budget controls after run metadata writes, child launch state writes, child settlement, completion-gate evaluation, and final artifact writes.
  - If a non-warning budget limit is reached before completion is accepted, the story run stops with `blockedReason` that names the budget dimension/action and points to `budgets.json`.
- Track-level mode:
  - `runEligible` repeatedly refreshes tracker state and dispatches eligible stories up to capacity.
  - `stop-new-launches` prevents further calls to claim/launch but waits for active children to settle.
  - `checkpoint-stop` behaves the same during active children and ends the loop after the current settlement checkpoint.
  - `abort` aborts active child signals when observed during supervision and records a budget-stop/control event before finishing blocked.
- Completion authority remains tracker/GitHub evidence through `CompletionGate`; budget state never marks a story complete.
- Recovery remains conservative:
  - startup failure and supervision lost still produce the existing recovery guard evidence.
  - budget stop is not a recovery takeover signal.
  - ambiguous tracker/PR/git evidence still stops as blocked/manual recovery.
- Event design:
  - Continue existing `budget-warning` and `budget-stop`.
  - Add bounded fields to `budget-stop` records when used as control: `controlAction`, `stopNewLaunches`, `checkpointStop`, `abort`, `reason`.
  - Do not add AWK09 streaming or subscription tools.

## Tests

- `packages/orchestrator/tests/runner.test.ts`
  - track autopilot does not launch new stories after a `stop-new-launches` budget limit, even when capacity remains.
  - track autopilot lets an already active child settle under `checkpoint-stop`, then finishes without launching newly eligible downstream stories.
  - `abort` budget action aborts an active child signal and produces a blocked run with budget evidence.
  - child failure with `stopLaunchingOnBlocked: false` can continue to other eligible stories, but budget stop actions still prevent launches.
  - story-level `runStory` remains separately invokable and does not require track autopilot code paths.
  - completion is still rejected when tracker status is not complete, regardless of child result prose.
- `packages/orchestrator/tests/scheduler.test.ts`
  - dispatch remains deterministic with active ids and optional exclusion/attempted ids if scheduler options are extended.
- Focused command:
  - `pnpm vitest run packages/orchestrator/tests/runner.test.ts packages/orchestrator/tests/scheduler.test.ts`
- Required gate:
  - `pnpm check`

## Migration/deploy concerns

- No database migrations or hosted deploy changes.
- Existing configs continue to parse because budget schema already exists.
- Existing run artifacts remain analyzable; new budget-control event fields are additive.
- No plugin metadata change is required unless public command descriptions are updated.
- No changeset in this story; AWK14 owns release readiness.
- Final story commit must remove this transient spec and the AWK08 plan after durable behavior is folded into canonical docs.

## Blocking technical questions

None
