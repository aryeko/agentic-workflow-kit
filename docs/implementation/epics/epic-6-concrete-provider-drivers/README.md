---
title: Epic 6 - Concrete provider drivers
epic: 6
status: "epic: ready"
depends-on-epics: [1, 2]
last-reviewed: "2026-06-22"
---

# Epic 6 - Concrete Provider Drivers

## Purpose

Epic 6 turns the SDK provider seams into real driver packages: Markdown Work Source, Local Execution
Host, GitHub Forge, and Codex Agent providers pass conformance and produce the provider evidence their
seams require.

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|
| `prov-01` Agent Execution | Implements the concrete Codex Agent driver after the SDK Agent port and testkit baseline are stable. | Codex concrete provider story group and its conformance/evidence obligations. |
| `prov-02` Forge / Collaboration | Implements the concrete GitHub Forge driver after the SDK Forge port and testkit baseline are stable. | GitHub concrete provider story group and its conformance/evidence obligations. |
| `prov-03` Work Source | Implements the concrete Markdown Work Source driver after the SDK Work Source port and testkit baseline are stable. | Markdown concrete provider story group and its conformance/evidence obligations. |
| `prov-04` Execution Host | Implements the concrete Local Execution Host driver after the SDK Execution Host port and testkit baseline are stable. | Local concrete provider story group and its conformance/evidence obligations. |

## Why this epic exists

Core can be built against SDK ports and testkit mocks, but production composition needs real drivers
that implement those ports, respect Foundation credential and workspace contracts, and prove
conformance. Epic 6 supplies those drivers without changing the SDK contracts established in Epic 2 or
the control decisions established in Epic 3 through Epic 5.

The hard dependency edge is owned by `epic-dag.md`: Epic 6 depends on Epic 1 and Epic 2, can proceed
in parallel with core after contracts are stable, and Epic 7 depends on Epic 6 for production
composition.

## Frozen inputs

- Epic 1 workspace, artifact, credential, redaction, and egress-policy foundation contracts.
- Epic 2 SDK provider ports, shared DTOs, capability attestation payloads, testkit mocks, and
  conformance helpers.
- `docs/implementation/domains/providers/prov-01-agent-execution.md`.
- `docs/implementation/domains/providers/prov-02-forge-collaboration.md`.
- `docs/implementation/domains/providers/prov-03-work-source.md`.
- `docs/implementation/domains/providers/prov-04-execution-host.md`.
- `docs/design/20-sdk-and-packaging/concrete-providers.md`.
- `docs/implementation/epic-dag.md` concrete-provider story-order guidance.

## Outputs

- Markdown Work Source provider driver that implements the SDK Work Source port and passes the Work
  Source conformance baseline.
- Local Execution Host provider driver that implements the SDK Execution Host port and passes the
  Execution Host conformance baseline.
- GitHub Forge provider driver that implements the SDK Forge port and passes the Forge conformance
  baseline.
- Codex Agent provider driver that implements the SDK Agent port and passes the Agent conformance
  baseline.
- Concrete provider capability attestations and redacted evidence artifacts required by their seams.
- Provider-specific failure and degraded evidence surfaced through the SDK provider contracts rather
  than through driver-specific core coupling.

## Scope boundaries

- In: concrete provider packages, provider conformance results, real-driver capability attestations,
  provider evidence artifacts, and Foundation credential/workspace/storage integration required by
  those drivers.
- Out: SDK provider interface redesign, testkit mock ownership, core decision semantics, completion
  or recovery policy, operator UX, and CLI/MCP production composition.
- STOP when: a concrete driver needs to change a provider port, move provider-specific behavior into
  core, expose runner-only credentials to a worker, bypass conformance, or implement operator logic.

## Per-domain expectations

Epic 6 claims only the concrete provider story group signal from each provider domain. SDK ports,
shared DTOs, attestations, mocks, and conformance helpers are owned by Epic 2.

### `prov-01` - Agent Execution

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Codex concrete provider story group after the SDK port and testkit baseline are stable. | TBD | covered |

- Evidence expectation: Epic 6 stories prove the Codex Agent provider implements the SDK Agent port
  and produces the required seam evidence without giving Forge credentials to the worker.

### `prov-02` - Forge / Collaboration

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| GitHub concrete provider story group after the SDK port and testkit baseline are stable. | TBD | covered |

- Evidence expectation: Epic 6 stories prove the GitHub Forge provider implements exact-head reads
  and writes through the SDK Forge port with credential-scoped, redacted evidence.

### `prov-03` - Work Source

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Markdown concrete provider story group after the SDK port and testkit baseline are stable. | TBD | covered |

- Evidence expectation: Epic 6 stories prove the Markdown Work Source provider preserves task status
  authority and race-safe mutation through the SDK Work Source port.

### `prov-04` - Execution Host

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Local concrete provider story group after the SDK port and testkit baseline are stable. | TBD | covered |

- Evidence expectation: Epic 6 stories prove the Local Execution Host provider captures host,
  command, injection, and termination evidence through the SDK Execution Host port.

## Epic readiness

- Epic 7 can instantiate production default providers through the SDK without embedding provider
  behavior in CLI or MCP.
- Concrete provider evidence passes the Epic 2 conformance baselines and can be consumed by Epic 5
  completion and recovery decisions.
- Provider-specific degraded and failure evidence remains redacted and expressed through SDK provider
  contracts.

## Deferred work

- SDK provider ports, shared DTOs, mocks, and conformance helpers stay owned by Epic 2.
- Completion, merge, and recovery decisions over provider evidence stay owned by Epic 5.
- CLI/MCP production composition and operator surfaces are deferred to Epic 7.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [epic charters](../README.md) · **← Prev:** [Epic 5 - story DAG](../epic-5-completion-verification-and-recovery/story-dag.md) · **Next →:** [Epic 6 - stories](./stories/README.md)

**Children:** [Epic 6 - stories](./stories/README.md) · [Epic 6 - story DAG](./story-dag.md)

<!-- /DOCS-NAV -->
