---
title: "Frontier 6 charter - operator surface"
frontier: 6
status: draft
last-reviewed: "2026-06-20"
included-domains:
  - edge-01-operator-and-entry-surface
---

# Frontier 6 charter - operator surface

## Purpose

Frontier 6 defines the implementation contract for the human-facing entry surface. The frontier turns the
core implementation into CLI and MCP commands that preview, start, inspect, wait, approve, stop,
handoff, override, request recovery, acknowledge attention, and explain recorded outcomes.

This charter defines what the frontier must deliver. It does not define execution workflow or external
trigger runtime.

## Included domains

| Domain | Role in this frontier | Spec basis |
|---|---|---|
| `edge-01` Operator & Entry Surface | Thin CLI/MCP adapter over the Control plane, attention rendering, approval input, and explainability. | `docs/design/30-domain-reference/edge/operator-surface/` |

Package target: CLI implementation belongs in `packages/cli`, MCP implementation belongs in
`packages/mcp`, and both call Control plane interfaces from `packages/sdk`. Provider packages are not
edge dependencies.

## Why this frontier exists

The operator surface is intentionally last because it must render and invoke completed core
contracts, not invent run logic. By Frontier 6, earlier frontiers should already define run lifecycle,
Agent evidence, gates, approvals, liveness, completion, recovery, and analysis. The edge can then be
a thin, attributable adapter that answers "what happened" and "why" from recorded facts.

## Dependencies and frozen inputs

Frozen inputs for Frontier 6:

- approved core-01 through core-07 contracts, projections, event refs, and failure states;
- approved `OperatorControlPort`, command parity table, command envelopes, result envelope, and
  `OperatorActionRecorded` payload;
- approved attention notice and explanation view contracts;
- package target with CLI and MCP as executable wrappers around SDK and providers wired outside the
  edge logic.

The frontier must not import provider contracts, concrete drivers, or Run writers. The edge sends one
typed command envelope to the Control plane and renders the returned result.

## Outputs

Frontier 6 must produce implementation artifacts equivalent to:

- MCP tools and CLI commands for the approved action set with parity over the same typed envelope;
- OS-user actor resolution, unavailable-identity representation, idempotency key, redacted parameter
  digest, and envelope error model;
- exactly one Control plane call for each known command or tool, including invalid parameter and
  identity cases;
- Control-plane-recorded `OperatorActionRecorded` audit event per action, returned as an event ref
  when writable;
- approval decision routing that supplies recorded Operator input for core-03 without answering Agent
  channels directly;
- attention rendering from recorded approval, liveness, recovery, blocked, and analysis facts;
- explanation rendering that cites recorded event/artifact refs or reports explicit missing evidence;
- tests proving no edge run logic, no provider imports, and no direct event-log writes.

## Scope Boundaries

In scope:

- CLI/MCP command parsing sufficient to build redacted command envelopes;
- command/result rendering, exit-code behavior, and MCP response shape;
- OS-user actor capture and identity failure representation;
- attention display, acknowledgement command, approval decision command, and explanation command;
- Control plane call parity and rejection path coverage.

Out of scope:

- run lifecycle, capability gate, approval adjudication, liveness, completion, recovery, and analysis
  logic;
- external trigger authentication, webhook/scheduler runtime, replay defense, and rate limits;
- provider operations, storage writes, Work Source writes, Forge writes, process management, and
  direct Run event authorship.

STOP if a story makes the edge call more than one Control plane method for one Operator action,
imports a provider/driver, obtains a `RunWriter`, evaluates a capability gate, or synthesizes an
explanation without recorded evidence.

## Per-domain responsibilities

### edge-01 Operator & Entry Surface

Deliver equivalent CLI and MCP surfaces over one `OperatorControlPort`. Every known command/tool
must normalize parameters, attach an actor, build the same logical `OperatorCommandEnvelope`, call
exactly one Control plane method, and render `OperatorCommandResult`.

The edge validates only enough transport shape to identify the command and build the envelope.
Known-command validation failures are carried in `envelopeErrors` to the Control plane so the
rejection can be audited. Unknown commands or tools are outside the action set.

Read commands are still Control plane calls. Run-scoped sensitive reads must be attributable through
the returned audit event when the Run log is writable. `wait` delegates to Control plane wait
semantics and never refreshes liveness.

Approval decisions, protected-policy approvals, profile overrides, recovery requests, and attention
acknowledgements are Operator actions. The edge records nothing directly and never answers provider
channels.

Explanations must cite recorded evidence. For "did" questions, render causation through event refs,
gate records, decision records, provider evidence refs, and analysis refs. For "did not" questions,
render the latest recorded deny, blocked, parked, stale, or missing-evidence reason in stable order.
If evidence is degraded, answer `unknown` with missing evidence.

## Failure and degraded outcome contract

| Condition | Required outcome |
|---|---|
| OS-user identity lookup fails. | Send `os-user-unavailable` actor; Control plane records rejection for mutating actions. |
| Known command has invalid params, target, idempotency, or digest. | Send envelope with errors; Control plane records one rejected Operator action. |
| Operator audit event cannot be appended. | Requested action is not performed. |
| Control plane is unavailable. | Edge reports failure and performs no fallback provider/storage operation. |
| Attention delivery fails locally. | Run state is unchanged; attention remains sourced by recorded facts. |
| Explanation evidence is missing, degraded, or unattributable. | Return `unknown` or explicit missing evidence; do not guess. |
| External trigger entry is requested in v1. | Return `external-trigger-deferred`. |

## Evidence expectations

Each story must include:

- spec-surface manifest naming commands/tools, envelope fields, result fields, audit payload fields,
  attention/explanation views, and package boundaries touched;
- falsifiable acceptance criteria proving one command maps to one Control plane call and one audit
  event expectation;
- failure/degraded outcome table for identity failure, invalid envelope, unwritable audit event,
  unavailable Control plane, attention delivery failure, explanation gaps, and external trigger
  deferral;
- required evidence from CLI/MCP parity tests, fake `OperatorControlPort` tests, import-boundary
  checks, idempotency/digest tests, and rendering fixtures;
- explicit boundaries proving no provider imports, no Run writer usage, no local gate evaluation, and
  no direct provider fallback.

## Readiness criteria

Frontier 6 is ready when:

- every approved action kind has matching MCP tool, CLI command, Control plane call, and audit event
  expectation;
- CLI and MCP produce equivalent logical envelopes for the same command, apart from allowed
  surface/client/time/process fields;
- invalid known commands still route through the Control plane rejection path;
- approval decisions and overrides are recorded Operator input consumed by core domains;
- attention notices are derived only from recorded Control plane facts;
- explanations never exceed recorded evidence;
- external triggers are explicitly deferred rather than partially accepted.

## Expected story files to author next

- `docs/implementation/frontiers/frontier-6-operator-surface/stories/edge-01-operator-control-port.md`
- `docs/implementation/frontiers/frontier-6-operator-surface/stories/edge-01-cli-mcp-parity.md`
- `docs/implementation/frontiers/frontier-6-operator-surface/stories/edge-01-operator-identity-and-audit.md`
- `docs/implementation/frontiers/frontier-6-operator-surface/stories/edge-01-approval-decision-routing.md`
- `docs/implementation/frontiers/frontier-6-operator-surface/stories/edge-01-attention-rendering.md`
- `docs/implementation/frontiers/frontier-6-operator-surface/stories/edge-01-explainability.md`
- `docs/implementation/frontiers/frontier-6-operator-surface/stories/edge-01-external-trigger-deferral.md`

## Deferred work

- External trigger transport, authentication, replay defense, allowed actions, and rate policy.
- Notification transports beyond active MCP sessions and CLI wait/result output.
- Product decisions about explanation transcript retention and Operator reason redaction defaults.
- Any richer UI beyond CLI and MCP surfaces.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../../README.md) · **← Prev:** [Frontier 5 charter - completion and recovery](../frontier-5-completion-and-recovery/charter.md) · **Next →:** [Codex app-server Agent provider research](../../research/codex-app-server-agent-provider-report.md)

<!-- /DOCS-NAV -->
