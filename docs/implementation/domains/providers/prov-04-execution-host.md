---
title: "prov-04 - Execution Host domain charter"
id: "prov-04"
layer: "providers"
status: "domain-charter: draft"
source-design: "docs/design/30-domain-reference/providers/execution-host/README.md"
last-reviewed: "2026-06-22"
---

# prov-04 - Execution Host

## What

Execution Host is the provider seam for attaching a prepared workspace, spawning and containing the
Agent worker process, observing host output, terminating the owned process tree, and running
runner-owned setup or verify commands with captured command evidence.

It owns the implementation-planning boundary for the SDK `ExecutionHostProvider` interface, shared
host DTOs, host observations, runner command result shapes, termination proof shapes, injection
context use, and Execution Host capability attestations.

For the implementation plan, the SDK owns the production provider interface and shared DTOs. Testkit
owns the mock host, conformance helpers, and incident fixtures. The concrete Local provider package
comes later as a driver that implements the SDK port.

## Why

The Control plane needs process execution and runner-owned verification evidence without embedding
local process mechanics. This charter keeps host behavior behind a seam so Agent, supervision,
completion, capability, and recovery stories can build against SDK types and testkit mocks before a
real Local driver exists.

## Does Not Own

- Agent protocol, prompts, approval relay, or owned-session resume; those belong to `prov-01`.
- Workspace creation, local git evidence, local commits, or worktree cleanup; those belong to
  `fnd-03`.
- Credential policy, secret resolution, egress policy authorship, or redaction policy ownership;
  those belong to `fnd-04`.
- Remote branch, PR, check, review, queue, or merge actions; those belong to `prov-02`.
- Completion, liveness, or recovery decisions; those belong to core domains that consume host
  evidence.

## Inputs And Dependencies

- Source design: `docs/design/30-domain-reference/providers/execution-host/README.md`.
- Direct domain dependencies: `fnd-03` Workspace & Repository and `fnd-04` Credentials & Secrets.
- Planning inputs: `docs/implementation/domain-dag.md`, `docs/implementation/epic-dag.md`,
  `docs/design/20-sdk-and-packaging/sdk-boundary.md`,
  `docs/design/20-sdk-and-packaging/testkit-and-conformance.md`, and
  `docs/design/20-sdk-and-packaging/concrete-providers.md`.
- SDK inputs: `ExecutionHostProvider`, `CapabilityAttestation`, workspace attachment DTOs,
  injection context DTOs, host observation DTOs, command result DTOs, and termination result DTOs.
- Testkit inputs: mock host scenarios, conformance helpers, command capture fixtures, termination
  fixtures, and degraded host observation fixtures.
- Downstream domain note: `prov-01` consumes this seam because the Agent worker runs on an Execution
  Host.

## Downstream Epics

- `Epic 2` consumes this charter for SDK Execution Host provider contracts, shared DTOs, capability
  attestations, mocks, and conformance baselines.
- `Epic 4` consumes host observations and termination signals for supervision and liveness.
- `Epic 5` consumes runner-owned command evidence and termination proof signals for verification,
  completion, and recovery.
- `Epic 6` consumes the stable Execution Host port and conformance baseline for the Local concrete
  provider driver.

## Story Group Signals

- SDK Execution Host provider interface and workspace, worker, host observation, command, and
  termination DTOs.
- Execution Host capability attestations for kill, containment strength, structured tool exit, and
  egress confinement.
- Testkit mock host with positive, degraded, incomplete capture, and termination scenarios.
- Conformance helpers for host observation, command capture, injection separation, and capability
  freshness.
- Local concrete provider story group after the SDK port and testkit baseline are stable.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [provider domain charters](./README.md) · **← Prev:** [prov-03 - Work Source domain charter](./prov-03-work-source.md) · **Next →:** [core domain charters](../core/README.md)

<!-- /DOCS-NAV -->
