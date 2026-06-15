---
title: AWK1313 detailed technical story spec
owner: codex-2026-06-15T21-31-13Z
last-reviewed: 2026-06-16
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK1313.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design-3.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
---

# AWK1313 detailed technical story spec

## Source story brief

docs/tracks/agentic-workflow-kit-redesign/stories/AWK1313.md

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| One shared runner-context interface, or a narrow interface per helper? | Add one type-only runner context module that exports narrow helper-specific context interfaces. | The three helper contracts have different dependencies. Narrow interfaces preserve least surface, while one module avoids duplicate local structural contracts and lets `WorkflowRunner` satisfy them without importing the concrete helper implementation types. |
| Extract supervisor collaborators into the same file or new modules under `runner/`? | Keep supervisor collaborators in `ChildSupervisor.ts` for this story, using named internal methods/classes. | This is a structural refactor with no behavior change. Keeping the code in one file minimizes import churn and preserves existing test fixtures while making the top-level orchestration readable. |

## Exact types/contracts

- Add `packages/orchestrator/src/runner/WorkflowRunnerContext.ts` as a type-only contract module.
- Export `ChildTimer` from the new module so both `WorkflowRunnerDependencies` and supervisor helpers use the same timer contract.
- Export `ChildSupervisorContext`, `ChildLaunchContext`, and `EligibleWorkflowContext`.
- `executeChildWithSupervisor` must accept `runner: ChildSupervisorContext`.
- `recordChildLaunchWithWorkspace` must accept `runner: ChildLaunchContext`.
- `runEligibleWorkflow` must accept `runner: EligibleWorkflowContext`.
- No `runner: unknown` or immediate `as <...>Runner` structural cast remains in `packages/orchestrator/src/runner/`.
- `WorkflowRunner` continues to pass `this`; TypeScript checks the class shape against the narrow helper context through method calls.
- Public CLI/MCP behavior, artifact/event names, tracker semantics, timeouts, abort propagation, recovery guard decisions, and PR/review behavior are unchanged.

## Exact files/modules

```text
packages/orchestrator/src/runner/WorkflowRunnerContext.ts  New type-only context interfaces shared by runner helper modules.
packages/orchestrator/src/runner/WorkflowRunner.ts         Import ChildTimer/context types and keep helper calls typed.
packages/orchestrator/src/runner/ChildLaunchRecorder.ts    Replace local runner interface and unknown cast with ChildLaunchContext.
packages/orchestrator/src/runner/WorkflowRunnerEligible.ts Replace local runner interface and unknown cast with EligibleWorkflowContext.
packages/orchestrator/src/runner/ChildSupervisor.ts        Replace local runner interface and unknown cast with ChildSupervisorContext; decompose executeChildWithSupervisor into named collaborators.
```

## Query/schema/prompt/event/component design

No query, schema, prompt, event, component, route, or command contract changes are introduced.

The supervisor refactor keeps the same event sequence and state transitions:

- `child-launched` and `child-session-linked` are still recorded after startup acknowledgement.
- `child-progress` remains controlled by lifecycle events and `event.journal`.
- `child-supervisor-poll` cadence remains `Math.max(1, Math.floor(noProgressTimeoutMs / 4))`.
- `child-startup-failed` still releases unacknowledged tracker claims.
- `child-supervision-lost` still records recovery-guard evidence.
- timeout errors remain `child-startup-timeout`, `child-no-progress-timeout`, and `child-max-runtime-timeout`.

The top-level `executeChildWithSupervisor` should read as orchestration over named collaborator methods for:

- startup acknowledgement and lifecycle progress handling,
- timeout and supervisor-poll setup/cleanup,
- successful child result settlement,
- startup failure, supervision-lost, and generic failure settlement,
- recovery guard inspection.

## Tests

- Focused first: `pnpm --dir packages/orchestrator test -- runner.test.ts`
- Full required gate: `pnpm check`
- Static validation: `rg -n "runner: unknown|as [A-Za-z]+Runner" packages/orchestrator/src/runner` should return no matches for the removed structural cast pattern.

Existing runner tests cover the high-risk behavior:

- provider-neutral supervision loss classification,
- no-progress timeout supervision loss,
- acknowledged child claim retention on supervision loss,
- startup timeout failure and claim release,
- supervisor polling events and launch metadata.

## Migration/deploy concerns

No migration, config, artifact, or deploy changes. The change is source-internal and type-only at the public boundary.

Rollback is a normal code revert. Existing run artifacts remain readable because artifact/event shapes are unchanged.

## Blocking technical questions

None
