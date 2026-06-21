---
title: "prov-03 - Work Source domain charter"
id: "prov-03"
layer: "providers"
status: "domain-charter: draft"
source-design: "docs/design/30-domain-reference/providers/work-source/README.md"
last-reviewed: "2026-06-22"
---

# prov-03 - Work Source

## What

Work Source is the provider seam for Tracks, Tasks, eligibility, race-safe claim/release,
TaskSnapshot production, task specs, dependencies, and task status writes.

It owns the implementation-planning boundary for the SDK `WorkSourceProvider` interface, shared task
and track DTOs, status authority DTOs, claim and snapshot result shapes, dependency signals, and Work
Source capability attestations.

For the implementation plan, the SDK owns the production provider interface and shared DTOs. Testkit
owns the scripted mock backlog, conformance helpers, and incident fixtures. The concrete Markdown
provider package comes later as a driver that implements the SDK port.

## Why

The rebuild needs a clean separation between task status authority and run activity. Work Source owns
task intake and status, while the event log owns run truth. This charter lets run lifecycle,
capability, completion, and recovery stories consume task snapshots and status results without
depending on Markdown files directly.

The seam also makes task intake testable offline through SDK contracts and testkit mocks before the
Markdown driver exists.

## Does Not Own

- Run lifecycle, run events, projections, or replay; those belong to `core-01`.
- PRDs, design documents, or document authoring; Work Source references specs but is not a document
  store.
- Local git revision discovery or workspace lifecycle; those belong to `fnd-03`.
- Remote Forge actions and collaboration evidence; those belong to `prov-02`.
- Cross-repo routing or future project routing policy above the provider seam.

## Inputs And Dependencies

- Source design: `docs/design/30-domain-reference/providers/work-source/README.md`.
- Direct domain dependency: `fnd-02` Storage & Artifacts.
- Planning inputs: `docs/implementation/domain-dag.md`, `docs/implementation/epic-dag.md`,
  `docs/design/20-sdk-and-packaging/sdk-boundary.md`,
  `docs/design/20-sdk-and-packaging/testkit-and-conformance.md`, and
  `docs/design/20-sdk-and-packaging/concrete-providers.md`.
- SDK inputs: `WorkSourceProvider`, `CapabilityAttestation`, Track and Task DTOs, TaskSnapshot DTOs,
  claim/status result DTOs, artifact reference DTOs, and simple task dependency DTOs.
- Testkit inputs: mock backlog fixtures, claim/status race scenarios, malformed task fixtures, and
  conformance helpers.

## Downstream Epics

- `Epic 2` consumes this charter for SDK Work Source provider contracts, shared DTOs, capability
  attestations, mocks, and conformance baselines.
- `Epic 3` consumes task snapshots, claim results, and Work Source attestations for run lifecycle,
  capability gates, and replayable analysis.
- `Epic 5` consumes status write outcomes and task-source facts for completion and recovery-safe
  settlement.
- `Epic 6` consumes the stable Work Source port and conformance baseline for the Markdown concrete
  provider driver.

## Story Group Signals

- SDK Work Source provider interface and Track, Task, TaskSnapshot, claim, release, and status DTOs.
- Work Source capability attestations for tracks, claim, status write, and dependencies.
- Testkit mock backlog with dependency, status, claim, stale digest, and degraded storage scenarios.
- Conformance helpers for status authority separation and race-safe task mutation.
- Markdown concrete provider story group after the SDK port and testkit baseline are stable.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [provider domain charters](./README.md) · **← Prev:** [prov-02 - Forge / Collaboration domain charter](./prov-02-forge-collaboration.md) · **Next →:** [prov-04 - Execution Host domain charter](./prov-04-execution-host.md)

<!-- /DOCS-NAV -->
