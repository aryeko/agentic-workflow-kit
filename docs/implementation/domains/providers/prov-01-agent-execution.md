---
title: "prov-01 - Agent Execution domain charter"
id: "prov-01"
layer: "providers"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/providers/agent-execution/README.md"
last-reviewed: "2026-06-22"
---

# prov-01 - Agent Execution

## What

Agent Execution is the provider seam for driving an agent worker through a host-neutral contract.

It owns the implementation-planning boundary for the SDK `AgentProvider` interface, shared agent DTOs,
normalized agent events, approval relay answer shape, owned-session resume shape, structured tool
observation shape, and Agent capability attestations.

For the implementation plan, the SDK owns the production provider interface and shared DTOs. Testkit
owns the programmable mock Agent provider, conformance helpers, and incident fixtures. The concrete
Codex provider package comes later as a driver that implements the SDK port.

## Why

The Control plane needs agent work to be observable and replayable without knowing Codex protocol
details. This charter keeps worker execution behind a seam so core runtime, approval, supervision,
capability, and recovery stories can build against SDK types and testkit mocks before the real Codex
driver exists.

It also preserves AD-12 worker/runner isolation: the worker can edit and make local commits, but it
does not receive Forge credentials or own runner actions.

## Does Not Own

- Approval adjudication, risk decisions, mode policy, park, or resume decisions; those belong to
  `core-03`.
- Supervision, liveness, stale-progress classification, or termination decisions; those belong to
  `core-04` and `prov-04`.
- Process spawn, containment, kill, runner-owned verify, and host command capture; those belong to
  `prov-04`.
- Local git evidence and workspace lifecycle; those belong to `fnd-03`.
- Remote Forge actions, PRs, checks, reviews, merge, or remote credentials; those belong to
  `prov-02` and `fnd-04`.

## Inputs And Dependencies

- Source design: `docs/design/30-domain-reference/providers/agent-execution/README.md`.
- Direct domain dependencies: `prov-04` Execution Host and `fnd-04` Credentials & Secrets.
- Planning inputs: `docs/implementation/domain-dag.md`, `docs/implementation/epic-dag.md`,
  `docs/design/20-sdk-and-packaging/sdk-boundary.md`,
  `docs/design/20-sdk-and-packaging/testkit-and-conformance.md`, and
  `docs/design/20-sdk-and-packaging/concrete-providers.md`.
- SDK inputs: `AgentProvider`, `CapabilityAttestation`, agent event DTOs, scoped grant DTOs, and
  output/artifact reference shapes.
- Testkit inputs: mock Agent scripts, adversarial incident fixtures, and provider conformance helpers.

## Downstream Epics

- `Epic 2` consumes this charter for SDK Agent provider contracts, shared DTOs, capability
  attestations, mock coverage, and conformance baselines.
- `Epic 3` consumes Agent attestations and mock events for capability gates and run analysis.
- `Epic 4` consumes Agent approval, progress, resume, terminal, and liveness-facing signals.
- `Epic 5` and `Epic 6` consume Agent evidence for recovery classification and the later Codex
  concrete provider driver.

## Story Group Signals

- SDK Agent provider interface and shared DTO catalog.
- Agent capability attestation payloads for approval relay, resume, structured tool exit, Guardian
  observation, and host parentage evidence.
- Testkit mock Agent provider with positive, degraded, and adversarial event streams.
- Conformance helpers for Agent provider behavior and incident replay inputs.
- Codex concrete provider story group after the SDK port and testkit baseline are stable.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [provider domain charters](./README.md) · **← Prev:** [provider domain charters](./README.md) · **Next →:** [prov-02 - Forge / Collaboration domain charter](./prov-02-forge-collaboration.md)

<!-- /DOCS-NAV -->
