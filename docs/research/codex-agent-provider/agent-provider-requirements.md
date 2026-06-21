---
title: kit-vnext - Agent provider functional requirements
status: draft
last-reviewed: "2026-06-21"
---

# Agent provider functional requirements

This document describes the high-level functionality kit-vnext needs from an Agent provider. It is
intentionally provider-neutral. A provider may be implemented through a CLI, SDK, MCP server,
app-server, remote API, local daemon, or mock runtime. The requirements describe what the control
plane needs to be able to do and observe, not how a provider must implement it.

The Agent provider is the worker conversation/runtime seam. It lets the control plane submit bounded
work to an agent, observe the agent while it runs, respond when the agent asks for input, and classify
the final outcome. It does not decide whether work is safe, complete, verified, recoverable, or
merge-ready.

## Source design

The normative design lives in:

- [`../design/30-domain-reference/providers/agent-execution/README.md`](../../design/30-domain-reference/providers/agent-execution/README.md)
- [`../design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md`](../../design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md)
- [`../design/30-domain-reference/providers/agent-execution/capabilities-and-conformance.md`](../../design/30-domain-reference/providers/agent-execution/capabilities-and-conformance.md)
- [`../design/30-domain-reference/providers/agent-execution/codex-driver.md`](../../design/30-domain-reference/providers/agent-execution/codex-driver.md)

When this brief conflicts with those files, the design corpus wins. The purpose here is to make the
provider requirements easy to research and validate without needing prior conversation context.

## Boundary

The Agent provider owns the agent conversation/protocol surface and the evidence it can expose from
that surface.

It does not own:

- process spawning, containment, hard termination, or runner-owned command execution;
- approval policy, risk scoring, or autonomous approval decisions;
- completion, verification, merge, recovery, or reconciliation decisions;
- worktree lifecycle, local git authority, remote forge authority, or PR/check/review/merge actions;
- credential issuance or broad secret access.

Those responsibilities belong to other domains. The Agent provider may observe a worker command or
request, but that observation does not by itself prove the command was safe, verified, killable, or
merge-ready.

## Conceptual model

At the highest level, an Agent provider exposes a conversation or run:

```text
configure + submit work -> provider run/thread id
observe or wait -> messages, events, requests, state changes, terminal outcome
respond when requested -> accepted, declined, rejected, or unavailable
control when needed -> interrupt, stop observing, continue, or report unsupported
reconnect or resume -> observe or continue a prior owned run when supported
```

Different provider surfaces may support different subsets of this model. The control plane must be
able to discover those subsets and fail closed when a needed capability is absent.

## Functional requirements

| Id | Capability area | Requirement | Why it is required |
|---|---|---|---|
| AGP-FR-01 | Configure | A provider must accept or report the effective configuration used for a run: model/profile, workspace or context, permission posture, output mode, and correlation metadata. | Launches must be reproducible and auditable. The control plane needs to know what was actually run, not only what was requested. |
| AGP-FR-02 | Submit work | A provider must support at least one way to submit bounded work: start a new thread/run, send a turn to an existing thread, or continue a prior run. | Delegation starts by giving a worker a scoped task. The mechanism may vary, but the operation must be explicit. |
| AGP-FR-03 | Identify | A provider must expose stable identifiers for the run/thread/session and, when applicable, current turn or request. | Identity is required for correlation, observation, requests, resume, recovery, and audit. |
| AGP-FR-04 | Ownership | A provider must state whether the run is kit-owned, remote-owned, or observe-only. | The control plane must not assume it can control, resume, or terminate a run it does not own. |
| AGP-FR-05 | Observe | A provider must expose run information through one or more observation modes: snapshot, event stream, transcript, polling, or final result. | Supervision, operator UI, analysis, and evidence gates require provider state and messages. |
| AGP-FR-06 | Wait | A provider should support waiting for selected conditions when possible: completion, request, progress, terminal state, or any event after a cursor. | Efficient orchestration needs to wait for meaningful changes without confusing observer activity with worker progress. |
| AGP-FR-07 | Order and reconnect | A provider should expose event ordering, cursors, sequence ids, timestamps, or another reconnect strategy when it supports streaming or polling. | Restarting observers must not lose or duplicate important state transitions. |
| AGP-FR-08 | Classify state | A provider must let the control plane classify the run state as running, waiting for input, completed, failed, cancelled/interrupted, lost, or unknown. | Core logic needs normalized state, not provider-specific prose. |
| AGP-FR-09 | Surface requests | A provider must make worker requests observable when supported: approval, permission, user input, tool input, escalation, or blocker. | The run must park or continue based on explicit request state, not hidden prompts or transcript guesses. |
| AGP-FR-10 | Answer requests | A provider should accept structured answers to surfaced requests when the surface supports it: approve, decline, cancel, provide input, or provide a scoped grant. | Manual and assisted modes require bidirectional communication when the worker needs a decision. |
| AGP-FR-11 | Request durability | A provider must report whether a request answer channel is live-only, reconnectable, resumable, expired, or unsupported. | Human latency and parent restarts are normal. The control plane must know whether it can answer later or must park/relaunch. |
| AGP-FR-12 | Control | A provider should expose live control actions when supported: interrupt, cancel, steer, continue, or stop observing. | Operators and recovery logic need explicit control where available, but unsupported control must be visible. |
| AGP-FR-13 | Separate protocol control from process control | A provider must distinguish graceful protocol control from hard process termination. | Hard kill belongs to the Execution Host. A provider interrupt is not proof that the worker process tree is gone. |
| AGP-FR-14 | Reconnect | A provider should support reconnecting an observer to an owned running or recently running session when possible. | Parent process restarts and UI reconnects should not lose visibility when the provider can reattach. |
| AGP-FR-15 | Resume or continue | A provider should support continuing a prior owned conversation when possible, and must distinguish that from observing a human-owned session. | Recovery and parked work need continuity, but a session id alone is not ownership. |
| AGP-FR-16 | Tool activity visibility | A provider should expose worker tool activity when available: tool start, tool output, tool completion, command/cwd/status/exit code, and tool request ids. | Liveness, analysis, and evidence gates need more than final prose when provider surfaces make tool activity available. |
| AGP-FR-17 | Artifacts and evidence | A provider must make provider messages, transcripts, outputs, errors, terminal results, and effective config referencable as evidence. | Gates and audits need durable evidence references rather than large raw payloads embedded in state. |
| AGP-FR-18 | Data handling | A provider must state how raw output, transcripts, credentials, and sensitive content are exposed, redacted, or routed to artifact storage. | The event log must not become a secret dump or unbounded transcript store. |
| AGP-FR-19 | Error model | A provider must expose provider errors in a normalized way: launch failed, stream lost, request channel lost, input rejected, resume failed, control unsupported, terminal ambiguous, or provider unavailable. | Failures must be actionable and replayable, not hidden behind generic exceptions. |
| AGP-FR-20 | Capability discovery | A provider must report which functional areas it supports for the exact surface, version, platform, configuration, and ownership mode. | The same core should run against weak and strong providers by gating behavior on known capabilities. |
| AGP-FR-21 | Conformance evidence | A provider must support repeatable probes or mocks that prove positive capability claims and negative/degraded behavior. | Capabilities unlock behavior. They need evidence, not optimism. |

## Capability levels

Providers are expected to have different capability levels. The contract should support weak
providers without pretending they are strong.

| Level | Name | Provider can do | Typical use |
|---|---|---|---|
| L0 | Final-result runner | Submit work and receive a terminal result. | Simple assisted jobs, no live control. |
| L1 | Observable runner | Submit work and observe transcript, events, or progress while it runs. | Operator visibility and basic supervision. |
| L2 | Request-aware runner | Detect when the worker asks for input, approval, or escalation. | Park safely instead of hanging or guessing. |
| L3 | Bidirectional runner | Answer surfaced requests through the provider channel. | Manual/assisted approval and input flows. |
| L4 | Controllable runner | Interrupt, cancel, steer, continue, or stop observation through provider protocol. | Operator control and graceful recovery. |
| L5 | Durable runner | Reconnect, resume, and preserve relevant request/session state across restarts or human latency. | Recovery, parked approvals, and long-running workflows. |

Capability levels are descriptive, not product promises. A provider can be L4 for interrupt but L1
for tool activity, or L3 for live approvals but not L5 for durable approval answers.

## Research questions

For any candidate provider surface, research must answer these questions with evidence:

1. How is a run configured, and how can the effective config be observed after launch?
2. How is bounded work submitted: new run, new thread, new turn, follow-up, or resume?
3. What stable identifiers exist for run, thread, turn, tool call, and provider request?
4. What ownership modes are possible: kit-owned, remote-owned, or observe-only?
5. What observation modes exist: final result, transcript read, snapshot, stream, subscription,
   polling, or filtered wait?
6. Does observation support ordering, cursors, replay, reconnect, or missed-event recovery?
7. Which observed events represent worker progress, and which represent only connection or observer
   activity?
8. How can run state be classified into running, waiting, completed, failed, interrupted, lost, or
   unknown?
9. Which worker request types can be surfaced: approval, permission, user input, tool input,
   escalation, or blocker?
10. Which request types can be answered through the provider, and what answer shapes are supported?
11. Can request answers survive human latency, disconnect, parent restart, or resume?
12. Which live control actions exist: interrupt, cancel, steer, continue, stop observing, or none?
13. Does provider control only request graceful behavior, or does it prove process termination?
14. Can the provider reconnect to an owned active session? Can it continue a prior session?
15. What tool activity is visible, if any?
16. What artifacts or references can be retained without embedding raw transcripts or raw command
    output in the event log?
17. How are secrets, credentials, tokens, paths, and raw outputs exposed or redacted?
18. What normalized errors can be distinguished?
19. Which claims are proven by schema/tool listing only, and which are proven by live behavior?
20. What exact probes are required before the provider can be used for unattended or recovery flows?

## Evidence classes

Research should classify each finding by evidence strength:

| Evidence class | Meaning |
|---|---|
| Documentation evidence | Official docs state the behavior. This explains expected semantics but may not prove local behavior. |
| Schema evidence | A method, field, enum, or event shape exists in a generated or published schema. This proves shape only. |
| Tool-list evidence | A provider advertises a command, tool, or capability. This proves availability only. |
| Local help evidence | Installed CLI/SDK help shows the local version supports a surface or flag. This proves local availability only. |
| Live smoke evidence | A bounded run proves launch, event delivery, state classification, request handling, or terminal behavior. |
| Persistence evidence | A run proves reconnect, resume, or request behavior across disconnect, restart, or human latency. |
| Ownership evidence | A run proves the provider session is kit-owned or explicitly observe-only. |
| Parentage evidence | A run proves worker process or command evidence belongs to host-owned containment. |
| Negative evidence | A probe proves a capability is unavailable, unstable, unsupported, or insufficient for a workflow. |

Schema, docs, and tool-list evidence can guide implementation. They do not by themselves prove live
request delivery, progress semantics, resume safety, process parentage, or recovery behavior.

## Research output format

For each provider surface, produce a table with:

| Field | Description |
|---|---|
| Provider surface | Runtime and protocol being evaluated. |
| Version and platform | Exact version, OS, install source, and relevant feature flags. |
| Configuration model | Requested config, effective config, and what can be observed after launch. |
| Submission model | New run/thread/turn, follow-up, resume, and supported input shapes. |
| Identity model | Run/session/thread/turn/request/tool ids and their stability. |
| Ownership model | Kit-owned, remote-owned, observe-only, and how ownership is proven. |
| Observation model | Snapshot, stream, transcript, final result, filtered wait, cursor, and reconnect behavior. |
| State model | How running, waiting, completed, failed, interrupted, lost, and unknown are represented. |
| Request model | Request kinds surfaced, answer shapes, durability, expiry, and unsupported cases. |
| Control model | Interrupt, cancel, steer, continue, stop observing, and process-control boundaries. |
| Resume/reconnect model | What can be reattached or continued, and under what ownership assumptions. |
| Tool activity model | Tool start/output/completion, command metadata, exit status, and limitations. |
| Artifact/data model | Transcript/output/error/config references, redaction, and sensitive-data handling. |
| Error model | Normalized provider errors and ambiguous states. |
| Capability level | L0-L5 per functional area, with caveats. |
| Evidence refs | Paths or URLs for docs, schemas, help output, probes, logs, transcripts, and negative evidence. |
| Required probes | Exact probes still needed before stronger claims can be made. |

The report should distinguish provider-native support from behavior that can only be created by a
wrapper. Wrappers may be useful, but they do not create provider guarantees unless the wrapper is
also owned, probed, and included in the capability claim.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../README.md) · **← Prev:** [Agent provider motivation and needs](./agent-provider-motivation.md) · **Next →:** [Codex app-server Agent provider research](./research/codex-app-server-agent-provider-report.md)

<!-- /DOCS-NAV -->
