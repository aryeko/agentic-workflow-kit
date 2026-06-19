---
title: Autopilot durability Codex research
status: research complete; post-research design recommendations drafted
last-reviewed: 2026-06-18
related:
  - ../autopilot-durability/README.md
  - ../autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md
  - post-research-design-recommendations/README.md
---

# Autopilot durability Codex research

This folder contains the research and post-research design recommendations for hardening
`workflow-autopilot` after the June 2026 autopilot durability incidents.

It is the bridge between the incident diagnosis in
[../autopilot-durability/](../autopilot-durability/) and future implementation planning. It does not
implement code. It records what was researched, what the research found, and the recommended design
direction.

## Folder Layout

| Path | Purpose |
|---|---|
| [research-reports/](research-reports/) | Source-backed research reports, one per investigation lane. |
| [post-research-design-recommendations/](post-research-design-recommendations/) | Reader-facing design recommendation synthesis built from the reports. Start here for the recommended architecture. |

## Why This Exists

`workflow-autopilot` is supposed to let a parent/orchestrator agent deliver tracker stories end-to-end:
create an isolated worktree, run a child agent, implement and verify the story, open a PR, handle review,
and merge when policy allows.

Two real June 2026 runs, one with a Claude orchestrator and one with a Codex orchestrator, produced zero
autonomous merges. Useful work shipped only through manual recovery. The unified postmortem concluded that
the primary failures were substrate failures, not model-judgment failures:

- dependency setup, verification, push, and GitHub work were not reliably possible inside the child sandbox;
- approval requests could hang or be impossible to grant;
- sandbox and approval overrides could be shadowed;
- live children could not be reliably observed, interrupted, killed, or resumed;
- session ids and session logs could be lost from mutable launch artifacts;
- run state diverged across `state`, `summary`, `metrics`, and `launch`;
- completion and merge were not sufficiently evidence-owned by the runner;
- telemetry and analysis were lossy, manual, and hard to correlate.

The research in this folder was created to replace draft assumptions with current, sourced evidence before
implementation design proceeds.

## What Was Done

Twelve independent research lanes were run with current docs, local runtime inspection, source references,
and adjacent system patterns. Each lane produced a report with:

- executive recommendation;
- sources checked;
- factual findings separated from interpretation;
- options and tradeoffs;
- recommendation for workflow-kit;
- degraded modes;
- validation spikes;
- open questions.

The lanes were intentionally split into separate Codex research threads, using high reasoning with GPT-5.5.
Each researcher was asked to research only, not design or implement code, and to deliver findings,
recommendations, tradeoffs, justifications, validation spikes, and open questions. Completed reports were
reviewed before the synthesis was written.

After the reports were complete, the findings were synthesized into domain-level design recommendations under
[post-research-design-recommendations/](post-research-design-recommendations/).

## How To Read

For most readers:

1. Read the incident context in [../autopilot-durability/README.md](../autopilot-durability/README.md).
2. Read the recommendation synthesis:
   [post-research-design-recommendations/README.md](post-research-design-recommendations/README.md).
3. Use the domain pages under `post-research-design-recommendations/` for the design area you are working on.
4. Read the underlying report in [research-reports/](research-reports/) when you need source details,
   tradeoffs, or validation spikes.

For implementation planning, treat the recommendation synthesis as the current design input and the research
reports as supporting evidence. The earlier draft docs under `../autopilot-durability/design/` remain useful
background but are superseded where the post-research recommendations are more specific.

## Research Lanes

| Lane | Report | Area |
|---|---|---|
| R1 | [Codex runtime control](research-reports/R1-codex-runtime-control.md) | Codex MCP, CLI, app-server, approval, interrupt, resume, session ids |
| R2 | [Process ownership and termination](research-reports/R2-process-ownership-termination.md) | Process groups, process trees, cgroups/systemd, Windows jobs, kill/reap proof |
| R3 | [Approval and permission relay](research-reports/R3-approval-permission-relay.md) | Durable approval state machine, scoped grants, park/resume, expiry |
| R4 | [Sandbox, dependency install, and supply chain](research-reports/R4-sandbox-dependency-supply-chain.md) | Registry access, lockfile install, lifecycle scripts, secrets, egress |
| R5 | [Event-sourced run state](research-reports/R5-event-sourced-run-state.md) | Append-only log, projections, writer fencing, crash recovery |
| R6 | [Worker supervision and liveness](research-reports/R6-worker-supervision-liveness.md) | Real progress, heartbeats, event cursors, stale detection |
| R7 | [Recovery, resume, and relaunch](research-reports/R7-recovery-resume-relaunch.md) | Safe recovery classifier, kit-owned resume, observe-only human recovery |
| R8 | [Verification and completion authority](research-reports/R8-verification-completion-authority.md) | Runner-owned proof of done, verify output, git/CI/PR evidence |
| R9 | [PR, review, CI, and merge gating](research-reports/R9-pr-review-ci-merge-gating.md) | Branch protection, rulesets, reviews, review threads, merge queue |
| R10 | [Observability and analysis](research-reports/R10-observability-analysis.md) | Structured telemetry, analyzer taxonomy, auto-analysis |
| R11 | [Config, policy, and migration](research-reports/R11-config-policy-migration.md) | vNext config, safe defaults, capability flags, migration |
| R12 | [Coordination and concurrency](research-reports/R12-coordination-concurrency.md) | Leases, story claims, duplicate launch prevention, stale writers |

## High-Level Findings

The research supports six design directions:

1. **Owned execution context.** A child is controllable only when the kit owns the process tree or stronger
   containment, protocol/session identity, event stream, lifecycle timers, and recovery authority.
2. **Durable event authority.** `events.ndjson` should be the only authored run-state record. Derived files are
   projections, not sources of truth.
3. **Approval as durable state.** Approval requests must be captured, normalized, persisted, decided, parked,
   expired, resumed, and audited. Do not rely on a long-lived prompt for human latency.
4. **Evidence-owned completion and merge.** Child claims and tracker edits are hints. Runner-owned inspectors
   must prove completion and merge readiness against exact commits.
5. **Recovery is classification before action.** Lease expiry, session id, dirty worktree, or stale progress
   alone does not authorize relaunch. Recovery actions must be evidence-classified.
6. **Unknown means safe stop.** Missing runtime capability, missing external state, untrusted checks, or corrupt
   run state must produce a named degraded/blocking state, not a guess.

## Post-Research Recommendation Domains

| Domain | Recommendation |
|---|---|
| Runtime and control | [post-research-design-recommendations/01-runtime-control.md](post-research-design-recommendations/01-runtime-control.md) |
| Approval and provisioning | [post-research-design-recommendations/02-approval-provisioning.md](post-research-design-recommendations/02-approval-provisioning.md) |
| State and coordination | [post-research-design-recommendations/03-state-coordination.md](post-research-design-recommendations/03-state-coordination.md) |
| Supervision and recovery | [post-research-design-recommendations/04-supervision-recovery.md](post-research-design-recommendations/04-supervision-recovery.md) |
| Completion and merge | [post-research-design-recommendations/05-completion-merge.md](post-research-design-recommendations/05-completion-merge.md) |
| Observability and migration | [post-research-design-recommendations/06-observability-migration.md](post-research-design-recommendations/06-observability-migration.md) |

## Primary References

- Incident entrypoint: [../autopilot-durability/README.md](../autopilot-durability/README.md)
- Unified diagnosis: [../autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md](../autopilot-durability/postmortems/2026-06-18-autopilot-unified-issues.md)
- Raw incident reports:
  [2026-06-17 RR3 runs](../autopilot-durability/postmortems/2026-06-17-autopilot-rr3-runs.md),
  [Pathway incident](../autopilot-durability/postmortems/pathway-autopilot-incident-2026-06-18.md)
- Earlier draft design background: [../autopilot-durability/design/](../autopilot-durability/design/)
