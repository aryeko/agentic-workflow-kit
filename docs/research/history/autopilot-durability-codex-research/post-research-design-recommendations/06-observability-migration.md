---
title: Observability and migration recommendations
status: post-research recommendation draft
last-reviewed: 2026-06-18
sources: [R10, R11, R5]
---

# Observability and migration

## Problem

The old system often required manual `analyze_run`, parsed free text for important facts, and could report
zeros where metrics were actually unavailable. vNext also adds new runtime powers, so migration must not
silently grant autonomy to existing repos.

## Recommendation

Use local structured telemetry as the canonical record, auto-run analysis on important transitions, and
migrate config through explicit safe policy blocks.

Sources: [R10](../research-reports/R10-observability-analysis.md),
[R11](../research-reports/R11-config-policy-migration.md),
[R5](../research-reports/R5-event-sourced-run-state.md).

## Telemetry model

Record source events for:

- lifecycle;
- child launch/session/progress;
- tool calls;
- approval;
- control/termination;
- verification;
- PR/review/merge;
- metrics and unavailable metrics;
- capability gates;
- recovery;
- analysis.

Use redacted summaries and evidence refs by default. Do not store raw sensitive tool args, prompts, tokens,
or credentials in normal reports.

## Event envelope fields

Every event should include:

- schema version;
- sequence;
- run/story/child ids;
- local trace/span ids for future OpenTelemetry mapping;
- event type/topic/level;
- source timestamp and recorded timestamp;
- source actor (`orchestrator`, `driver`, `child`, `inspector`, `analyzer`, `operator`);
- writer id/epoch;
- causation id;
- evidence refs;
- typed payload.

## Capability-gate events

Every autonomous action and skipped action needs a record:

- `capability-gate-evaluated`;
- `action-selected`;
- `action-skipped`;
- `action-applied`;
- `action-failed`.

These events answer "why did or did not autopilot act?"

Required gated actions include launch, approval grant, unattended continuation, complete story, create PR,
review fix/rerequest, merge, delete branch, interrupt/kill, recover/resume/relaunch, and clear duplicate
launch.

## Analyzer behavior

Analysis should auto-fire on:

- terminal run;
- blocked run;
- supervision lost;
- recovery decision;
- stale progress transition;
- analyzer retry/manual report request.

No terminal run should lack an analysis artifact. If analysis fails or times out, terminalization still
completes and the runner writes:

- `analysis-failed` event;
- stub `analysis.json`;
- stub `report.md`;
- analyzer error and input artifact refs;
- retry command.

The analyzer is a pure function over the event log and projections. It may use legacy transcript parsing as
compatibility enrichment, but source-structured events are authoritative.

## Initial analyzer issue taxonomy

- linkage;
- liveness;
- approval;
- control;
- state coherence;
- completion;
- review;
- merge;
- metrics;
- sandbox;
- analyzer.

Each issue should include severity, evidence refs, actionability, related capability, and regression fixture
metadata when available.

## Metric honesty

Metrics are never guessed:

- available: include value, source, observed time;
- unavailable: include unavailable reason;
- partial: include coverage and unavailable reason.

Missing failed-tool counts, token usage, subagent counts, or cost data must not become zero.

## Config migration

vNext should be additive but explicit:

- bump config schema;
- provide previewable migration;
- add explicit `provisioning`, `approval`, `escalationPolicy`, and `capabilities`;
- keep all high-autonomy capabilities default-off;
- preserve existing config values but warn on semantically dangerous legacy defaults;
- record resolved profile provenance.

Recommended safe defaults:

- `approval.mode: assisted`;
- standard dependency install auto-grant narrowly scoped;
- lifecycle scripts escalate separately;
- `autoMerge`, `autoRecover`, `autoRelaunch`, `unattendedRun`, and `orchestratorDecideApprovals` off;
- existing `pr.merge.auto: true` does not automatically enable vNext autonomous auto-merge.

## Legacy artifacts

Legacy runs with `events.ndjson` can be rebuilt into projections with warnings. Legacy runs without usable
events are read-only analysis targets. Do not mutate them as if they were coherent vNext runs.

## Degraded modes

| Gap | Behavior |
|---|---|
| provider token metrics unavailable | record unavailable reason |
| source tool telemetry missing | parse logs as fallback and mark partial |
| no transcript or source telemetry | unavailable, not zero |
| GitHub review-thread fetch fails | deny merge gates requiring it |
| analyzer crashes | write `analysis-failed` and stubs |
| old config missing vNext policy | preview migration; block behavior-changing runs unless acknowledged |
| runtime older than config | fail closed for config-dependent actions |

## Validation spikes

- Regenerate projections, analysis, and report from a vNext-only event fixture.
- Convert June incidents into analyzer regression fixtures.
- Partial telemetry fixture proves unavailable/partial instead of zero.
- Privacy fixture proves redaction.
- Config migration fixtures for push-only, push-and-merge, custom profiles, and legacy versions.
- Capability preview for default repo, auto-merge policy repo, and driver without approval relay.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [Completion and merge recommendations](./05-completion-merge.md) · **Next →:** [Autopilot durability design recommendations](./README.md)

<!-- /DOCS-NAV -->
