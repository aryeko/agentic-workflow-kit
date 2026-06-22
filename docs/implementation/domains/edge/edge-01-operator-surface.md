---
title: "edge-01 - Operator & Entry Surface domain charter"
id: "edge-01"
layer: "edge"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/edge/operator-surface/README.md"
last-reviewed: "2026-06-22"
---

# edge-01 - Operator & Entry Surface

## What

Edge-01 plans the operator-facing entry surface for kit-vnext: MCP tools and CLI commands that let an
Operator preview, start, inspect, wait on, approve, stop, hand off, override, recover, acknowledge,
and explain runs.

The domain is a thin adapter over the Control plane. It normalizes operator input, attaches operator
identity, calls the Control plane through the operator control port, and renders returned projections,
attention notices, explanations, event refs, and errors.

Every known operator action is planned as one Control plane call with one recorded
`OperatorActionRecorded` audit fact owned by the Control plane, not by Edge.

## Why

Edge is the human control surface for assisted operation. It turns the deterministic SDK runtime into
usable MCP and CLI entry points without creating a second orchestration path.

This domain lands late because it consumes the completed Control plane shape. It is the place where
operator attention, approval entry, and "why did/didn't this happen" inspection become accessible to
humans and calling agents.

## Does Not Own

- Run lifecycle state, event-log writing, projections, or event authoring.
- Capability gates, policy adjudication, approval outcomes, completion predicates, merge readiness,
  recovery classification, liveness refresh, or analysis content.
- Provider-specific behavior, concrete driver calls, Work Source writes, Forge operations, Execution
  Host actions, Agent channel behavior, storage implementation, or credential handling.
- External trigger auth, replay defense, rate limits, transport runtime, or production trigger
  enablement for v1.

## Inputs And Dependencies

- Source design: `docs/design/30-domain-reference/edge/operator-surface/README.md`.
- Command and attention details: the operator-surface sibling design files for command envelopes,
  attention, explainability, and deferred triggers.
- Packaging surface: `docs/design/20-sdk-and-packaging/cli-and-mcp-wrappers.md`.
- Domain ordering: `docs/implementation/domain-dag.md`, where `edge-01` depends on `core-01` through
  `core-07` and stays thin and late.
- Epic ordering: `docs/implementation/epic-dag.md`, where production Edge composition waits for
  completion, recovery, and concrete providers, with only a mock-backed executable smoke story
  eligible earlier.
- Epic prerequisites: `Epic 3` enables a mock-backed executable smoke story; `Epic 5` and `Epic 6`
  provide the production control path and concrete-provider evidence for full composition.
- Core inputs: run state and cursors; capability gate records; pending approvals and decisions;
  liveness projections; completion and merge decisions; recovery projections; observability and
  analysis facts.

## Downstream Epics

- `Epic 7` is the primary consumer: operator surfaces and end-to-end composition.

## Story Group Signals

- CLI and MCP command parity over the shared operator command envelope.
- Operator identity capture, redacted parameter digests, idempotency, and attributable audit routing.
- Approval decision entry and attention acknowledgement as Control plane calls.
- Inspect, wait, and explain views sourced only from recorded evidence and projections.
- Outbound attention rendering for parked, blocked, stale, approval-needed, and analysis issue states.
- Default CLI/MCP composition wiring that instantiates SDK control surfaces and concrete providers
  without moving provider behavior or run logic into Edge.
- External trigger entry that remains deferred in v1 until trigger auth and transport contracts exist.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [edge domain charters](./README.md) · **← Prev:** [edge domain charters](./README.md) · **Next →:** [epic charters](../../epics/README.md)

<!-- /DOCS-NAV -->
