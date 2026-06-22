---
title: "prov-02 - Forge / Collaboration domain charter"
id: "prov-02"
layer: "providers"
status: "domain-charter: frozen"
source-design: "docs/design/30-domain-reference/providers/forge-collaboration/README.md"
last-reviewed: "2026-06-22"
---

# prov-02 - Forge / Collaboration

## What

Forge / Collaboration is the provider seam for remote, credentialed repository collaboration used by
the runner.

It owns the implementation-planning boundary for the SDK `ForgeProvider` interface, shared Forge DTOs,
capability attestations, exact-head remote evidence, branch push, PR create/update, PR comments,
evidence reads, update-branch, merge queue enqueue, and merge action shapes.

For the implementation plan, the SDK owns the production provider interface and shared DTOs. Testkit
owns Mock Forge, conformance helpers, and incident fixtures. The concrete GitHub provider package
comes later as a driver that implements the SDK port.

## Why

The Control plane needs remote repository evidence and irreversible remote actions to be exact,
credential-scoped, and replayable without importing GitHub behavior. This charter keeps GitHub and
other forge-specific details behind a provider seam while allowing completion, merge, capability, and
recovery stories to build against SDK types and testkit mocks.

It also protects worker/runner isolation by making remote credentials runner-owned and unavailable to
the Agent worker.

## Does Not Own

- Completion or merge readiness decisions; those belong to `core-05`.
- Local git worktree state, local commits, branch creation, or local evidence; those belong to
  `fnd-03`.
- Credential policy, scope definition, redaction rules, or audit ownership; those belong to `fnd-04`.
- Process execution, verify command capture, or worker hosting; those belong to `prov-04`.
- Work item status authority or task snapshots; those belong to `prov-03`.

## Inputs And Dependencies

- Source design: `docs/design/30-domain-reference/providers/forge-collaboration/README.md`.
- Direct domain dependency: `fnd-04` Credentials & Secrets.
- Planning inputs: `docs/implementation/domain-dag.md`, `docs/implementation/epic-dag.md`,
  `docs/design/20-sdk-and-packaging/sdk-boundary.md`,
  `docs/design/20-sdk-and-packaging/testkit-and-conformance.md`, and
  `docs/design/20-sdk-and-packaging/concrete-providers.md`.
- SDK inputs: `ForgeProvider`, `CapabilityAttestation`, credential reference DTOs, evidence reference
  DTOs, expected-head action DTOs, and Forge evidence snapshot DTOs.
- Testkit inputs: Mock Forge scenarios, conformance helpers, and adversarial fixtures for head SHA,
  checks, reviews, rulesets, queue, thread, auth, and credential failures.

## Downstream Epics

- `Epic 2` consumes this charter for SDK Forge provider contracts, shared DTOs, capability
  attestations, mocks, and conformance baselines.
- `Epic 3` consumes Forge attestations through capability gates and recorded event analysis.
- `Epic 5` consumes Forge evidence and expected-head action results for completion, verification,
  merge readiness, and recovery-safe decisions.
- `Epic 6` consumes the stable Forge port and conformance baseline for the GitHub concrete provider
  driver.

## Story Group Signals

- SDK Forge provider interface and exact-head evidence DTO catalog.
- Forge capability attestations for rulesets, merge queue, review-thread resolution, and protection
  inspection.
- Testkit Mock Forge with exact-head, degraded, credential, and ambiguous-state scenarios.
- Conformance helpers for Forge reads and expected-head write actions.
- GitHub concrete provider story group after the SDK port and testkit baseline are stable.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [provider domain charters](./README.md) · **← Prev:** [prov-01 - Agent Execution domain charter](./prov-01-agent-execution.md) · **Next →:** [prov-03 - Work Source domain charter](./prov-03-work-source.md)

<!-- /DOCS-NAV -->
