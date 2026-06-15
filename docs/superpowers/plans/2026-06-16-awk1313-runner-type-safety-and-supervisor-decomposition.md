---
title: AWK1313 implementation plan
owner: codex-2026-06-15T21-31-13Z
last-reviewed: 2026-06-16
related:
  - ../specs/2026-06-16-awk1313-runner-type-safety-and-supervisor-decomposition-design.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK1313.md
---

# AWK1313 implementation plan

## Goal

Remove the runner helper type-safety hole and make the child supervisor easier to review without
changing external runtime behavior.

## Steps

1. Add `packages/orchestrator/src/runner/WorkflowRunnerContext.ts`.
   - Move the shared `ChildTimer` type into this file.
   - Export `ChildSupervisorContext`, `ChildLaunchContext`, and `EligibleWorkflowContext`.
   - Import only types needed by these context contracts.

2. Replace unsafe helper boundaries.
   - In `ChildLaunchRecorder.ts`, remove the local `ChildLaunchRunner` interface and the
     `runner: unknown` parameter/cast; accept `ChildLaunchContext`.
   - In `WorkflowRunnerEligible.ts`, remove the local `EligibleWorkflowRunner` interface and the
     `runner: unknown` parameter/cast; accept `EligibleWorkflowContext`.
   - In `ChildSupervisor.ts`, remove the local `ChildSupervisorRunner` interface and the
     `runner: unknown` parameter/cast; accept `ChildSupervisorContext`.
   - In `WorkflowRunner.ts`, import `ChildTimer` from the new context module and keep existing helper calls.

3. Decompose `executeChildWithSupervisor`.
   - Keep the public export and return contract unchanged.
   - Extract the mutable supervision state into named internal methods for startup acknowledgement,
     lifecycle progress, supervisor polling, timeout racing, successful settlement, failure settlement,
     cleanup, and recovery-guard recording.
   - Preserve timeout names, event payloads, metric updates, state updates, claim-release behavior,
     and recovery guard calls.

4. Static validation.
   - Run `rg -n "runner: unknown|as [A-Za-z]+Runner" packages/orchestrator/src/runner`.
   - Expected result: no matches for the removed structural-cast pattern.

5. Focused verification.
   - Run `pnpm --dir packages/orchestrator test -- runner.test.ts`.
   - Fix any behavior regression before continuing.

6. Full verification.
   - Run configured changed/full gate: `pnpm check`.
   - Record results in the run journal and PR body.

7. Pre-PR review and closeout.
   - Run the configured read-only pre-PR review subagent with the tracker row, story brief, detailed spec,
     plan, implementation diff, and verification output.
   - Fix any blocking review findings and rerun verification.
   - Before final tracker completion, remove this transient spec/plan if durable content has no canonical
     docs change requirement; this story's durable outcome is the code/tests, not a new canonical doc.
