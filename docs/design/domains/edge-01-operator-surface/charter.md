---
title: "Operator & Entry Surface — charter"
id: "edge-01"
layer: "edge"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Operator & Entry Surface — charter

**Purpose.** The human-first way to drive and supervise runs, and the surface that answers
"why did / didn't the system do X." It invokes the control plane; it holds no run logic.

## Responsibilities (in scope)
- The operator-facing command surface (MCP tools + CLI) to start, preview (dry-run), inspect, and
  control runs.
- The path by which an operator's approval decision enters the Approval & Escalation relay, and
  **outbound attention/notification when a run parks for a human** (approval needed / needs-operator).
- Hand-offs and overrides: an operator can take over, override a resolved profile field, or stop a run.
- Surfacing projections, analysis, and capability-gate records so every gated action is explainable.
- The entry point for external triggers (later) — designed for, not built in v1.

## Out of scope
- Run state, gating, adjudication, analysis content — owned by the control plane (core-01…07).
- Provider specifics — never touches a driver directly.

## Requirements owned
FR-10 (human-in-the-loop), the operator side of FR-4; contributes to NFR-OBS (inspectability).

## Dependencies (Dependency Rule)
- Depends on: the control plane (core domains) only.
- Must NOT: contain run logic, author events, or import any driver.

## Required reading
Standard set (see [conventions](../../conventions.md)) + [core-02](../core-02-capability-and-safety/charter.md)
and [core-03](../core-03-approval-and-escalation/charter.md) (what the surface relays/explains).

## Deliverable
`design.md` defining: the tool + CLI command set and request/response envelope; how an operator
decision reaches the approval relay; how "why did/didn't X" is answered from capability-gate records +
analysis; identity (OS user) for audit; the external-trigger model (deferred).

## Definition of done (domain-specific)
- Every operator action maps to exactly one control-plane call and a recorded event.
- "Why did/didn't X happen" is answerable for every gated action from recorded evidence.
- No run logic leaks into the edge.

## Open questions
- CLI vs MCP feature parity. External-trigger model and auth.
