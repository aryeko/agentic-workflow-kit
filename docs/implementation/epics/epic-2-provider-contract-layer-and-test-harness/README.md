---
title: Epic 2 - Provider contract layer and test harness
epic: 2
status: "epic: ready"
depends-on-epics: [1]
last-reviewed: "2026-06-22"
---

# Epic 2 - Provider Contract Layer and Test Harness

## Purpose

Epic 2 gives the SDK its four provider seams and gives testkit the programmable mocks, conformance
helpers, and incident fixture inputs needed for core stories to run without concrete drivers.

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|
| `prov-01` Agent Execution | Defines the SDK Agent provider contract and mockable worker event surface. | `AgentProvider`, shared agent DTOs, Agent capability attestations, mock Agent, and conformance helpers. |
| `prov-02` Forge / Collaboration | Defines the SDK Forge provider contract and mockable remote collaboration surface. | `ForgeProvider`, exact-head evidence DTOs, Forge capability attestations, Mock Forge, and conformance helpers. |
| `prov-03` Work Source | Defines the SDK Work Source provider contract and mockable task authority surface. | `WorkSourceProvider`, Track/Task/TaskSnapshot DTOs, Work Source attestations, mock backlog, and conformance helpers. |
| `prov-04` Execution Host | Defines the SDK Execution Host provider contract and mockable process/command evidence surface. | `ExecutionHostProvider`, host DTOs, Execution Host attestations, mock host, and conformance helpers. |

## Why this epic exists

Core runtime, approval, liveness, completion, and recovery stories need provider evidence and actions
as stable SDK contracts, not as concrete Codex, GitHub, Markdown, or local-process behavior. Epic 2
creates those contracts and the testkit harness first so core can be built against recorded and mock
evidence.

The hard dependency edge is owned by `epic-dag.md`: Epic 2 depends on Epic 1, Epic 3 and Epic 4
consume Epic 2, and Epic 6 implements concrete drivers only after these ports and conformance
baselines are stable.

## Frozen inputs

- Epic 1 foundation policy, artifact, workspace, credential, redaction, and egress-policy surfaces.
- `docs/implementation/domains/providers/prov-01-agent-execution.md`.
- `docs/implementation/domains/providers/prov-02-forge-collaboration.md`.
- `docs/implementation/domains/providers/prov-03-work-source.md`.
- `docs/implementation/domains/providers/prov-04-execution-host.md`.
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`.
- `docs/design/20-sdk-and-packaging/provider-ports.md`.
- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md`.
- `docs/implementation/epic-dag.md` provider contract and concrete-driver split.

## Outputs

- SDK provider interface surfaces for Agent, Forge, Work Source, and Execution Host seams.
- Shared DTO catalogs and `CapabilityAttestation` payload contracts for all four provider seams.
- Testkit mock providers that produce positive, degraded, and adversarial provider evidence.
- Conformance helper surface for provider reads, expected-head writes, status authority separation,
  host observation, command capture, and capability freshness.
- Incident fixture inputs that let core stories exercise provider failures without concrete drivers.

## Scope boundaries

- In: SDK provider ports, shared provider DTOs, capability attestation payloads, testkit mocks,
  conformance helpers, and incident fixture inputs.
- Out: concrete Codex, GitHub, Markdown, or Local drivers; live provider probes; remote credentials;
  core decisions over provider evidence; CLI or MCP production composition.
- STOP when: a story requires concrete provider behavior, network/process execution, live credentials,
  or a core-domain decision rather than a provider contract or test harness surface.

## Per-domain expectations

For each included provider domain, Epic 2 claims only the SDK port, shared DTO, capability
attestation, mock, conformance, and fixture signals. Concrete provider signals are owned by Epic 6.

### `prov-01` - Agent Execution

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| SDK Agent provider interface and shared DTO catalog. | `prov-01-s1-agent-port` | covered |
| Agent capability attestation payloads for approval relay, resume, structured tool exit, Guardian observation, and host parentage evidence. | `prov-01-s1-agent-port` + `prov-00-s1-capability-attestation` | split |
| Testkit mock Agent provider with positive, degraded, and adversarial event streams. | `prov-01-s2-agent-testkit` | covered |
| Conformance helpers for Agent provider behavior and incident replay inputs. | `prov-01-s2-agent-testkit` | covered |

- Evidence expectation: Epic 2 stories leave Agent port, mock, attestation, and conformance evidence
  that core approval, liveness, capability, and recovery stories can consume without a Codex driver.

### `prov-02` - Forge / Collaboration

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| SDK Forge provider interface and exact-head evidence DTO catalog. | `prov-02-s1-forge-port` | covered |
| Forge capability attestations for rulesets, merge queue, review-thread resolution, and protection inspection. | `prov-02-s1-forge-port` + `prov-00-s1-capability-attestation` | split |
| Testkit Mock Forge with exact-head, degraded, credential, and ambiguous-state scenarios. | `prov-02-s2-forge-testkit` | covered |
| Conformance helpers for Forge reads and expected-head write actions. | `prov-02-s2-forge-testkit` | covered |

- Evidence expectation: Epic 2 stories leave Forge port, mock, attestation, and conformance evidence
  that completion, merge readiness, and recovery stories can evaluate without a GitHub driver.

### `prov-03` - Work Source

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| SDK Work Source provider interface and Track, Task, TaskSnapshot, claim, release, and status DTOs. | `prov-03-s1-work-source-port` | covered |
| Work Source capability attestations for tracks, claim, status write, and dependencies. | `prov-03-s1-work-source-port` + `prov-00-s1-capability-attestation` | split |
| Testkit mock backlog with dependency, status, claim, stale digest, and degraded storage scenarios. | `prov-03-s2-work-source-testkit` | covered |
| Conformance helpers for status authority separation and race-safe task mutation. | `prov-03-s2-work-source-testkit` | covered |

- Evidence expectation: Epic 2 stories leave Work Source port, mock, attestation, and conformance
  evidence that run lifecycle and completion stories can consume without Markdown files.

### `prov-04` - Execution Host

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| SDK Execution Host provider interface and workspace, worker, host observation, command, and termination DTOs. | `prov-04-s1-execution-host-port` | covered |
| Execution Host capability attestations for kill, containment strength, structured tool exit, and egress confinement. | `prov-04-s1-execution-host-port` + `prov-00-s1-capability-attestation` | split |
| Testkit mock host with positive, degraded, incomplete capture, and termination scenarios. | `prov-04-s2-execution-host-testkit` | covered |
| Conformance helpers for host observation, command capture, injection separation, and capability freshness. | `prov-04-s2-execution-host-testkit` | covered |

- Evidence expectation: Epic 2 stories leave Execution Host port, mock, attestation, and conformance
  evidence that supervision, verification, completion, and recovery stories can consume without a
  Local driver.

## Epic readiness

- Epic 3 can author run lifecycle, capability, and analysis stories against provider attestations and
  testkit mocks instead of concrete providers.
- Epic 4 can author approval and liveness stories against Agent and Execution Host ports and mock
  observations.
- Epic 5 can author completion and recovery stories against Forge, Work Source, Execution Host, and
  Agent mock evidence.
- Epic 6 has a stable conformance baseline for the four concrete provider driver packages.

## Deferred work

- Codex concrete Agent provider is deferred to Epic 6.
- GitHub concrete Forge provider is deferred to Epic 6.
- Markdown concrete Work Source provider is deferred to Epic 6.
- Local concrete Execution Host provider is deferred to Epic 6.
- Core decisions over provider evidence are deferred to Epic 3 through Epic 5.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [epic charters](../README.md) · **← Prev:** [Epic 1 - story DAG](../epic-1-foundation-substrate/story-dag.md) · **Next →:** [Epic 2 - stories](./stories/README.md)

**Children:** [Epic 2 - stories](./stories/README.md) · [Epic 2 - story DAG](./story-dag.md)

<!-- /DOCS-NAV -->
