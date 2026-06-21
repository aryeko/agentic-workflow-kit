---
title: Autopilot durability design recommendations
status: post-research recommendation draft
last-reviewed: 2026-06-18
depends-on:
  - ../../autopilot-durability/README.md
  - ../../autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md
  - ../README.md
---

# Autopilot durability design recommendations

This is the post-research recommendation layer for the `workflow-autopilot` durability effort.
It turns the incident diagnosis and the independent research reports into a readable design direction.

If you are new to the project, start here after the main
[autopilot durability README](../../autopilot-durability/README.md). You do not need to read every
raw postmortem or research report first; this index explains what happened, why the design must change,
and how the recommended architecture fits together.

## What happened

`workflow-autopilot` is supposed to let a parent/orchestrator agent deliver tracker stories through a
child agent: create worktree, implement, verify, open PR, handle review, and merge when policy allows.

Two June 2026 runs, one under a Claude orchestrator and one under a Codex orchestrator, produced zero
autonomous merges. Useful work shipped only through manual recovery. The diagnosis was not that the
models made poor high-level decisions. The substrate was not durable:

- children could not reliably install dependencies, verify, push, or use GitHub from the sandbox;
- approval requests could hang or be silently impossible;
- operator sandbox/approval overrides could be shadowed;
- live children could not be reliably observed, interrupted, killed, or resumed;
- session ids and log paths could be lost from mutable launch artifacts;
- run state diverged across `state`, `summary`, `metrics`, and `launch`;
- completion and merge depended too much on child self-report and human judgment;
- telemetry and analysis were lossy and manual.

The recommended design is a safety-first local orchestration system. Autonomy is allowed only when the
runner can prove the required guarantees.

## High-level recommendation

Build vNext around six load-bearing choices:

1. **Owned execution context.** A child is autonomous only when the kit owns the live execution context:
   process tree or stronger containment, protocol/session identity, event channel, lifecycle timers,
   and recovery authority.
2. **Durable event authority.** `events.ndjson` is the only authored run-state record. `state`,
   `launch`, `metrics`, `summary`, analysis, and reports are projections or derived artifacts.
3. **Capability-gated autonomy.** Every autonomous power, including approval grants, unattended run,
   auto-recover, and auto-merge, requires explicit runtime and evidence gates.
4. **Approval as a durable state machine.** Approval is not a long-lived prompt. Capture, normalize,
   persist, decide, park, expire, resume, and audit each request.
5. **Independent evidence.** Completion, review readiness, and merge safety are decided by runner-owned
   inspectors tied to exact commits, not by child prose or tracker edits alone.
6. **Safe degraded modes.** When a capability is unavailable or evidence is unknown, stop in a named,
   diagnosable state instead of guessing.

## Domain map

| Domain | Recommendation doc | Main research inputs | What it decides |
|---|---|---|---|
| Runtime and control | [01-runtime-control.md](01-runtime-control.md) | R1, R2, R6 | Which Codex surface to use, what "owned" means, how interrupt/kill/liveness work |
| Approval and provisioning | [02-approval-provisioning.md](02-approval-provisioning.md) | R3, R4, R11 | How dependency setup, approval relay, scoped grants, and config policy work |
| State and coordination | [03-state-coordination.md](03-state-coordination.md) | R5, R12 | Event store, projections, leases, writer fencing, duplicate-launch prevention |
| Supervision and recovery | [04-supervision-recovery.md](04-supervision-recovery.md) | R6, R7, R1, R2, R5, R12 | Real-progress supervision, resume/relaunch rules, recovery state machine |
| Completion and merge | [05-completion-merge.md](05-completion-merge.md) | R8, R9 | Done authority, CI/review/PR evidence, merge queue/direct merge safety |
| Observability and migration | [06-observability-migration.md](06-observability-migration.md) | R10, R11, R5 | Telemetry schema, analyzer behavior, report artifacts, vNext migration |

## Source report index

The recommendation docs synthesize these research reports:

For report-level navigation and reading paths, see the
[research reports index](../research-reports/README.md).

- [R1 Codex runtime control](../research-reports/R1-codex-runtime-control.md)
- [R2 process ownership and termination](../research-reports/R2-process-ownership-termination.md)
- [R3 approval and permission relay](../research-reports/R3-approval-permission-relay.md)
- [R4 sandbox, dependency install, and supply chain](../research-reports/R4-sandbox-dependency-supply-chain.md)
- [R5 event-sourced run state](../research-reports/R5-event-sourced-run-state.md)
- [R6 worker supervision and liveness](../research-reports/R6-worker-supervision-liveness.md)
- [R7 recovery, resume, and relaunch](../research-reports/R7-recovery-resume-relaunch.md)
- [R8 verification and completion authority](../research-reports/R8-verification-completion-authority.md)
- [R9 PR, review, CI, and merge gating](../research-reports/R9-pr-review-ci-merge-gating.md)
- [R10 observability and incident analysis](../research-reports/R10-observability-analysis.md)
- [R11 config, policy, and migration](../research-reports/R11-config-policy-migration.md)
- [R12 distributed coordination and concurrency](../research-reports/R12-coordination-concurrency.md)

The source problem statement remains the
[unified issue report](../../autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md).
The earlier draft design remains useful background under
[../../autopilot-durability/design/](../../autopilot-durability/design/), but this directory reflects the
post-research recommendations.

## Recommended implementation phases

| Phase | Goal | Required outcomes |
|---|---|---|
| 1 | Safety floor | Owned process-tree containment, durable event writer, session linkage as event, no stale writer mutation |
| 2 | Approval and provisioning | MCP elicitation Phase 0 or app-server approval path, durable pending approvals, safe dependency grants |
| 3 | Supervision and recovery | Real-progress liveness, event-cursor wait API, recovery classifier, no blind relaunch |
| 4 | Completion and merge | Runner-owned inspectors, exact-head verification/CI/review/PR evidence, fail-closed merge gate |
| 5 | Observability and migration | Auto-analysis, structured telemetry, vNext config migration, legacy read-only analysis |

## Non-negotiable invariants

- A session id is not control. Control requires a live owned process/transport/turn handle plus
  termination capability.
- A pid is not enough. Termination must cover the process tree or stronger containment.
- A child claim is not evidence. It can guide inspectors, but cannot complete a story or merge a PR.
- A lease expiry is not authority to relaunch. It starts recovery classification.
- A green check is not automatically trusted. It must be tied to the exact head SHA and configured trusted
  source/policy.
- Missing evidence fails closed. Unknown external state is not safe.
- Manual recovery is observed evidence, not retroactive proof that the kit controlled the run.

## Open decisions

The research narrows the design, but these product/engineering decisions remain:

- whether vNext should ship MCP elicitation first or app-server first;
- minimum supported Codex CLI version for the target driver;
- whether unattended/auto-merge requires kernel-level containment or accepts POSIX process groups for local
  trusted workflows;
- whether narrow dependency-install auto-grants are default-on or explicit opt-in;
- exact vNext config version and transition window for legacy `codex.childSession` / `approvalPolicy`;
- default timeout values for startup, idle, no-progress, approval SLA, and termination;
- whether unresolved but outdated review threads block by default.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [Observability and migration recommendations](./06-observability-migration.md) · **Next →:** [Runtime and control recommendations](./01-runtime-control.md)

**Children:** [Runtime and control recommendations](./01-runtime-control.md) · [Approval and provisioning recommendations](./02-approval-provisioning.md) · [State and coordination recommendations](./03-state-coordination.md) · [Supervision and recovery recommendations](./04-supervision-recovery.md) · [Completion and merge recommendations](./05-completion-merge.md) · [Observability and migration recommendations](./06-observability-migration.md)

<!-- /DOCS-NAV -->
