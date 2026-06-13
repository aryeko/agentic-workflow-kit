---
title: AWK08 story brief
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../README.md
  - ../../../prds/agentic-workflow-kit-redesign/README.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../prds/agentic-workflow-kit-redesign/technical-solution/02-runtime-flows.md
---

# AWK08 story brief

not implementation-ready; create a detailed technical story spec before plan/code

## PRD criteria

| Criterion | Product outcome |
| --- | --- |
| RUN-1 | One eligible story can run to verified PR/merge or clear stopped state. |
| RUN-2 | Track autopilot repeatedly dispatches eligible stories until terminal policy state. |
| RUN-3 | Story-level and track-level modes remain independent. |
| RUN-4 | Runtime supports implement, verify, PR, CI/review, fix, merge, delete branch, continue. |
| RUN-5 | Runtime can stop before PR, before merge, or after PR according to config. |
| RUN-6 | Ambiguous child/review/auth/merge/artifact state is recoverable and explicit. |
| POL-4 | Budget policy participates in runtime decisions. |
| POL-5 | Budget actions affect launches/checkpoints/abort. |

## Technical solution sections

| Section | Relevance |
| --- | --- |
| Runtime flows: Story runtime sequence | Story execution contract. |
| Runtime flows: Track autopilot sequence | Track loop semantics. |
| Runtime state and controls | Terminal and recoverable state model. |
| AI, observability, and operations | Testing and security boundaries for runtime behavior. |

## Dependencies

| Dependency | Reason |
| --- | --- |
| AWK03 | Runtime must reject invalid trackers with actionable diagnostics. |
| AWK05 | Runtime launches through the provider-neutral driver contract. |
| AWK06 | Runtime policy decisions must write normalized events/artifacts. |

## Scope boundary

**In scope**

- Harden `run_story` and `run_eligible` loops for profile-aware launch, budget decisions, stop-new-launches, checkpoint-stop, abort integration, recovery classification, and continuation.
- Preserve tracker authority for eligibility and completion.
- Ensure story-level and track-level modes remain separately invokable.
- Add fixtures for blocked, budget-stopped, startup-stale, no-progress, verification-failed, merge-conflict, and ambiguous evidence outcomes.
- Pin assumption: track execution remains on installed 0.5.13, so this story must not depend on its own runtime changes for completion.

**Out of scope**

- New public streaming surface; AWK09 owns it.
- GitHub evidence parsing details beyond runtime hooks; AWK11 owns hardening.
- Release changeset.

## Candidate surfaces

- **Files/modules:** `packages/orchestrator/src/runner/WorkflowRunner.ts`, `packages/orchestrator/src/scheduler/scheduler.ts`, `packages/orchestrator/src/runner/CompletionGate.ts`, `packages/orchestrator/src/runner/RecoveryGuard.ts`, `packages/orchestrator/src/runner/DuplicateLaunchGuard.ts`, `packages/orchestrator/src/commands/handlers.ts`
- **Queries/schema:** none
- **Prompts/tools:** child prompt may need policy wording updates
- **Events/metrics:** launch, budget, recovery, completion, blocked events
- **Components/routes:** run story/track CLI/MCP behavior

## Validation expectations

- Focused runner/scheduler/completion/recovery tests.
- `pnpm vitest run packages/orchestrator/tests/runner.test.ts packages/orchestrator/tests/scheduler.test.ts packages/orchestrator/tests/completion-gate.test.ts packages/orchestrator/tests/recovery-guard.test.ts packages/orchestrator/tests/handlers.test.ts`
- `pnpm check`

## Open technical questions

| Question | Blocking? | Resolution expected in detailed spec |
| --- | --- | --- |
| Which budget actions are enforced synchronously in runner versus classified after child settlement? | yes | Define action timing and tests. |
| How should stopLaunchingOnBlocked interact with budget stop-new-launches and checkpoint-stop? | yes | Specify precedence. |
