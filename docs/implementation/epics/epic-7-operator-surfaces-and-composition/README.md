---
title: Epic 7 - Operator surfaces and end-to-end composition
epic: 7
status: "epic: draft"
depends-on-epics: [5, 6]
last-reviewed: "2026-06-22"
---

# Epic 7 - Operator Surfaces and End-to-End Composition

## Purpose

Epic 7 exposes the completed SDK control path through thin CLI and MCP operator surfaces, wires
default storage and concrete providers for production composition, renders attention and explanations
from recorded evidence, and leaves external triggers explicitly deferred for v1.

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|
| `edge-01` Operator & Entry Surface | Provides production operator surfaces and composition over the completed control plane. | Operator identity and audit routing, approval entry, inspect/wait/explain views, attention rendering, default CLI/MCP composition, and deferred external trigger posture. |

## Why this epic exists

The CLI and MCP must be usable entry points, but they must stay thin: operator actions call the
Control plane, provider behavior stays in concrete drivers, and run logic stays in the SDK. Epic 7
lands only after Epic 5 closes completion/recovery decisions and Epic 6 supplies concrete provider
drivers for production composition.

The hard dependency edge is owned by `epic-dag.md`: Epic 7 depends on Epic 5 and Epic 6. Epic 3 owns
only the earlier mock-backed command-envelope smoke signal; this epic owns production composition and
the remaining Edge signals.

## Frozen inputs

- Epic 3 mock-backed command-envelope smoke, run state, gate records, analysis records, and read
  models.
- Epic 4 pending approval, decision, liveness, wait, resume, and supervision facts.
- Epic 5 completion, blocker, merge-readiness, recovery, and reconciliation read models.
- Epic 6 concrete Markdown, Local, GitHub, and Codex provider drivers and conformance evidence.
- Epic 1 filesystem storage behavior, credential diagnostics, and redacted evidence refs.
- `docs/implementation/domains/edge/edge-01-operator-surface.md`.
- `docs/design/20-sdk-and-packaging/cli-and-mcp-wrappers.md`.
- `docs/implementation/epic-dag.md` Epic 7 hard dependencies and dotted smoke split.

## Outputs

- CLI executable adapter over the SDK control surface with operator input normalization, rendering,
  exit-code behavior, and no run logic.
- MCP server adapter over the same operator command envelope with tool registration, request/response
  envelopes, streaming result formatting, and no run logic.
- Shared default-composition helper that instantiates SDK control surfaces, filesystem-backed storage,
  and concrete providers without becoming a new published package.
- Operator identity, redacted parameter digest, idempotency, and attributable audit routing surface.
- Operator approval, attention acknowledgement, inspect, wait, explain, handoff, override, stop, and
  recovery-request entry surfaces as Control plane calls.
- Attention and explainability rendering sourced from recorded projections, gate records, recovery
  state, and analysis facts.
- Documented v1 external-trigger deferral that does not ship trigger auth or transport runtime.

## Scope boundaries

- In: CLI and MCP adapters, production default composition, operator input normalization, operator
  audit routing, approval entry, attention acknowledgement, inspect/wait/explain rendering, attention
  rendering, and external-trigger deferral documentation.
- Out: run lifecycle logic, event authoring outside the Control plane, provider behavior, direct
  driver calls outside composition wiring, storage implementation, credential handling, external
  trigger auth, replay defense, rate limits, and production trigger enablement.
- STOP when: a story would put run logic, gate adjudication, provider behavior, Work Source writes,
  Forge operations, storage semantics, credential handling, or external-trigger runtime into Edge.

## Per-domain expectations

Epic 7 claims the production Edge signals. The earlier CLI/MCP command-envelope smoke signal is owned
by Epic 3 so the coverage set remains exactly-once.

### `edge-01` - Operator & Entry Surface

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Operator identity capture, redacted parameter digests, idempotency, and attributable audit routing. | TBD | covered |
| Approval decision entry and attention acknowledgement as Control plane calls. | TBD | covered |
| Inspect, wait, and explain views sourced only from recorded evidence and projections. | TBD | covered |
| Outbound attention rendering for parked, blocked, stale, approval-needed, and analysis issue states. | TBD | covered |
| Default CLI/MCP composition wiring that instantiates SDK control surfaces and concrete providers without moving provider behavior or run logic into Edge. | TBD | covered |
| External trigger entry that remains deferred in v1 until trigger auth and transport contracts exist. | TBD | deferred(v1 excludes trigger auth and transport runtime, post-v1 trigger contract) |

- Evidence expectation: Epic 7 stories prove CLI and MCP are thin adapters over the SDK and concrete
  provider composition, with every operator-visible answer sourced from recorded evidence or
  projections.

## Epic readiness

- Operators can drive supported v1 flows through CLI and MCP without bypassing the SDK control path.
- Production composition uses Epic 6 concrete providers and Epic 1 filesystem-backed storage through
  a shared helper rather than duplicating provider logic.
- Operator attention, inspect, wait, explain, approval, and recovery entry points are backed by
  recorded Control plane facts.
- External triggers remain visibly deferred until trigger auth, replay defense, rate limits, transport
  contracts, and production enablement are designed.

## Deferred work

- External trigger auth, replay defense, rate limits, transport runtime, and production trigger
  enablement are deferred beyond v1 unless the design corpus is amended.
- Additional operator transports or hosted surfaces are deferred beyond this CLI/MCP milestone.
- Any provider behavior discovered during composition remains owned by the relevant Epic 6 provider
  driver story group, not by Edge.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [epic charters](../README.md) · **← Prev:** [Epic 6 - story DAG](../epic-6-concrete-provider-drivers/story-dag.md) · **Next →:** [Epic 7 - stories](./stories/README.md)

**Children:** [Epic 7 - stories](./stories/README.md) · [Epic 7 - story DAG](./story-dag.md)

<!-- /DOCS-NAV -->
