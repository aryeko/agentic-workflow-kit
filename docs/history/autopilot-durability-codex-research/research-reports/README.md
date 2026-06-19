---
title: Autopilot durability research reports
status: research complete
last-reviewed: 2026-06-18
parent:
  - ../README.md
  - ../post-research-design-recommendations/README.md
---

# Autopilot durability research reports

This directory contains the source-backed research reports behind the post-research
`workflow-autopilot` durability recommendations.

The reports were produced after the June 2026 autopilot durability incidents to test the draft design
against current Codex behavior, OS/process-control primitives, GitHub merge semantics, local filesystem
durability, approval patterns, and adjacent orchestration systems. They are evidence inputs, not
implementation plans.

For a reader-facing synthesis, start with
[../post-research-design-recommendations/README.md](../post-research-design-recommendations/README.md).
Use the individual reports when you need source detail, rejected options, tradeoffs, validation spikes,
or open questions for a specific design area.

## Report Format

Each report follows the same shape:

1. **Executive Recommendation** - the short answer and confidence level.
2. **Sources Checked** - local docs/code, current external docs, and runtime evidence used.
3. **Findings** - facts and interpretation separated as much as practical.
4. **Options and Tradeoffs** - considered approaches and why some were rejected.
5. **Recommendation** - what workflow-kit should do.
6. **Degraded Modes** - what should happen when the ideal capability is unavailable.
7. **Validation Spikes** - focused checks needed before implementation.
8. **Open Questions** - decisions still requiring product or engineering judgment.

## Lane Index

| Lane | Report | Question Answered | Feeds Recommendation |
|---|---|---|---|
| R1 | [Codex runtime control](R1-codex-runtime-control.md) | Which Codex surface can support owned sessions, approval, interrupt, resume, and session ids? | [Runtime and control](../post-research-design-recommendations/01-runtime-control.md), [Supervision and recovery](../post-research-design-recommendations/04-supervision-recovery.md) |
| R2 | [Child execution ownership and termination](R2-process-ownership-termination.md) | What does "kit owns the child process" require beyond a pid? | [Runtime and control](../post-research-design-recommendations/01-runtime-control.md), [Supervision and recovery](../post-research-design-recommendations/04-supervision-recovery.md) |
| R3 | [Approval and permission relay](R3-approval-permission-relay.md) | How should approval requests become durable, scoped, resumable run state? | [Approval and provisioning](../post-research-design-recommendations/02-approval-provisioning.md) |
| R4 | [Sandbox, dependency install, and supply chain](R4-sandbox-dependency-supply-chain.md) | How can dependency setup work without granting arbitrary network, scripts, or secrets? | [Approval and provisioning](../post-research-design-recommendations/02-approval-provisioning.md) |
| R5 | [Event-sourced run state](R5-event-sourced-run-state.md) | How should run state avoid divergent `state`, `summary`, `metrics`, and `launch` artifacts? | [State and coordination](../post-research-design-recommendations/03-state-coordination.md), [Observability and migration](../post-research-design-recommendations/06-observability-migration.md) |
| R6 | [Worker supervision and liveness](R6-worker-supervision-liveness.md) | What counts as real child progress, and how should stale supervision be detected? | [Runtime and control](../post-research-design-recommendations/01-runtime-control.md), [Supervision and recovery](../post-research-design-recommendations/04-supervision-recovery.md) |
| R7 | [Recovery, resume, and relaunch](R7-recovery-resume-relaunch.md) | When is resume safe, when is relaunch safe, and when must recovery stop? | [Supervision and recovery](../post-research-design-recommendations/04-supervision-recovery.md) |
| R8 | [Verification and completion authority](R8-verification-completion-authority.md) | What evidence should prove a story is done, independent of child prose? | [Completion and merge](../post-research-design-recommendations/05-completion-merge.md) |
| R9 | [PR, review, CI, and merge gating](R9-pr-review-ci-merge-gating.md) | How should branch protection, rulesets, CI, reviews, review threads, and merge queues gate merge? | [Completion and merge](../post-research-design-recommendations/05-completion-merge.md) |
| R10 | [Observability and incident analysis](R10-observability-analysis.md) | What telemetry and analyzer behavior are needed for diagnosable failures? | [Observability and migration](../post-research-design-recommendations/06-observability-migration.md) |
| R11 | [Config, policy, and migration](R11-config-policy-migration.md) | How should vNext expose safe defaults, capability gates, and config migration? | [Approval and provisioning](../post-research-design-recommendations/02-approval-provisioning.md), [Observability and migration](../post-research-design-recommendations/06-observability-migration.md) |
| R12 | [Distributed coordination and concurrency](R12-coordination-concurrency.md) | How should leases, claims, writer fencing, and duplicate-launch prevention work? | [State and coordination](../post-research-design-recommendations/03-state-coordination.md), [Supervision and recovery](../post-research-design-recommendations/04-supervision-recovery.md) |

## Reading Paths

| Need | Read |
|---|---|
| Understand the recommended design without every source detail | [../post-research-design-recommendations/README.md](../post-research-design-recommendations/README.md) |
| Understand process ownership, interrupt, kill, and Codex session control | [R1](R1-codex-runtime-control.md), [R2](R2-process-ownership-termination.md), [R6](R6-worker-supervision-liveness.md) |
| Understand approval, dependency install, sandbox, and policy migration | [R3](R3-approval-permission-relay.md), [R4](R4-sandbox-dependency-supply-chain.md), [R11](R11-config-policy-migration.md) |
| Understand state durability, leases, and duplicate-run prevention | [R5](R5-event-sourced-run-state.md), [R12](R12-coordination-concurrency.md) |
| Understand recovery, resume, relaunch, and stale-run handling | [R7](R7-recovery-resume-relaunch.md), [R6](R6-worker-supervision-liveness.md), [R12](R12-coordination-concurrency.md) |
| Understand verification, PR readiness, review state, CI, and merge safety | [R8](R8-verification-completion-authority.md), [R9](R9-pr-review-ci-merge-gating.md) |
| Understand telemetry, analysis, and migration sequencing | [R10](R10-observability-analysis.md), [R11](R11-config-policy-migration.md), [R5](R5-event-sourced-run-state.md) |

## Cross-Lane Conclusions

- Runtime control requires more than a session id. The kit needs ownership of the live process or transport
  handle, protocol/session identity, event stream, lifecycle timers, and termination authority.
- Process ownership means the process tree or stronger containment, not only the immediate child process.
- Approval must be a durable state machine with scoped grants, expiry, and audited decisions.
- `events.ndjson` should be the only authored run-state record; other artifacts should be projections.
- Completion and merge require runner-owned evidence tied to exact commits and external platform state.
- Recovery starts with classification. Lease expiry, missing session id, stale progress, or dirty worktree
  state is not enough to relaunch.
- Missing capability or missing evidence should produce a named degraded state, not guessed autonomy.

## Source Context

- Research folder entrypoint: [../README.md](../README.md)
- Recommendation synthesis:
  [../post-research-design-recommendations/README.md](../post-research-design-recommendations/README.md)
- Incident context: [../../autopilot-durability/README.md](../../autopilot-durability/README.md)
- Unified issue report:
  [../../autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md](../../autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md)
