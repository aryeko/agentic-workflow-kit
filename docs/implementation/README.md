---
title: kit-vnext - implementation contract
status: draft
last-reviewed: "2026-06-20"
---

# Implementation contract

This directory defines the implementation contract for building kit-vnext from the approved design
corpus. It answers what must be built, in what dependency order, and what evidence proves each item.

It does not define the execution process. Operational prompts, review-loop mechanics, PR batching,
commit policy, and session orchestration are deliberately outside this folder.

## Relationship to other docs

| Directory | Owns |
|---|---|
| [`../design/`](../design/) | Normative product, architecture, package, domain, and decision contracts. |
| [`../engineering/`](../engineering/) | Verification policy, check gate, dependency enforcement, and test lanes. |
| `./` | Implementation slicing, story contracts, readiness evidence, and migration tracking. |

When this directory conflicts with `../design/`, the design corpus wins. A story contract must be a
checkable subset of the design. If an implementation story needs a requirement that is missing from
design, the design must be amended before the story is dispatch-ready.

## Reading order

1. [`domain-dag.md`](domain-dag.md) - dependency frontiers and direct domain edges.
2. [`agent-provider-motivation.md`](agent-provider-motivation.md) - what we need from an Agent
   provider and why, before requirements; the needs and distinctions the requirements descend from.
3. [`agent-provider-requirements.md`](agent-provider-requirements.md) - functional requirements for
   researching and validating Agent provider surfaces.
4. [`package-rollout.md`](package-rollout.md) - how domain work maps onto the SDK-centered package
   target.
5. [`work-item-authoring-guide.md`](work-item-authoring-guide.md) - how to write falsifiable story
   contracts.
6. [`readiness-matrix.md`](readiness-matrix.md) - evidence-backed implementation readiness state.
7. [`frontiers/`](frontiers/) - frontier charters and, later, item/story contracts.

## Frontiers

Frontiers are dependency slices. A frontier contains the domains that become eligible after all prior
frontiers have delivered their required contract surface and evidence.

| Frontier | Name | Domains | Role |
|---|---|---|---|
| [0](frontiers/frontier-0-independent-substrate/charter.md) | Independent substrate | `fnd-01`, `fnd-02` | Establish config/policy and durable storage primitives. |
| [1](frontiers/frontier-1-foundation-dependents/charter.md) | Foundation dependents | `fnd-03`, `fnd-04`, `core-01` | Stand up workspace, credentials, and the run/event spine. |
| [2](frontiers/frontier-2-provider-seams/charter.md) | Provider seams | Work Source, Forge, and Execution Host seam ports/mocks; `prov-03`, `prov-02`, `prov-04` real-driver stories | Define first provider contracts, mocks, and conformance expectations before real-driver production readiness. |
| [3](frontiers/frontier-3-agent-and-core-gates/charter.md) | Agent and core gates | Agent seam port/mock; `core-02`, `core-07`; `prov-01` real-driver story | Add the agent seam, capability gates, and analysis surface before live Agent production readiness. |
| [4](frontiers/frontier-4-run-control/charter.md) | Run control | `core-03`, `core-04` | Add approval/escalation and liveness supervision. |
| [5](frontiers/frontier-5-completion-and-recovery/charter.md) | Completion and recovery | `core-05`, `core-06` | Add completion, merge readiness, recovery, and reconciliation. |
| [6](frontiers/frontier-6-operator-surface/charter.md) | Operator surface | `edge-01` | Expose the completed control plane through operator entry points. |

## Story contract standard

Every implementation story must define the shared contract a builder and any later verifier can grade
without private interpretation:

- normative design references;
- spec-surface manifest of required interfaces, events, DTOs, and failure tokens;
- falsifiable acceptance criteria;
- failure and degraded outcome table;
- required test lanes and commands;
- evidence pack expectations;
- explicit boundaries and STOP conditions.

Story contracts constrain DONE, not HOW. They should not dictate internal file layout, algorithms, or
session mechanics unless the design corpus itself makes that part of the normative surface.

## Current status

This folder is a bootstrap draft. Frontier charters define responsibilities and the expected story files
to author next. Per-story contracts are not present yet.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../README.md) · **← Prev:** [implementation status note](../design/IMPLEMENTATION_STATUS_NOTE.md) · **Next →:** [domain dependency DAG](./domain-dag.md)

**Children:** [domain dependency DAG](./domain-dag.md) · [Agent provider motivation and needs](./agent-provider-motivation.md) · [Agent provider functional requirements](./agent-provider-requirements.md) · [package rollout](./package-rollout.md) · [work item authoring guide](./work-item-authoring-guide.md) · [implementation readiness matrix](./readiness-matrix.md) · [Frontier 0 charter - independent substrate](./frontiers/frontier-0-independent-substrate/charter.md) · [Frontier 1 charter - foundation dependents](./frontiers/frontier-1-foundation-dependents/charter.md) · [Frontier 2 charter - provider seams](./frontiers/frontier-2-provider-seams/charter.md) · [Frontier 3 charter - agent and core gates](./frontiers/frontier-3-agent-and-core-gates/charter.md) · [Frontier 4 charter - run control](./frontiers/frontier-4-run-control/charter.md) · [Frontier 5 charter - completion and recovery](./frontiers/frontier-5-completion-and-recovery/charter.md) · [Frontier 6 charter - operator surface](./frontiers/frontier-6-operator-surface/charter.md) · [Codex app-server Agent provider research](./research/codex-app-server-agent-provider-report.md) · [Codex app-server provider-neutral assessment](./research/codex-app-server-provider-neutral-report.md) · [Codex CLI agent provider research report](./research/codex-cli-agent-provider-report.md) · [Codex CLI provider-neutral Agent provider assessment](./research/codex-cli-provider-neutral-report.md) · [Codex MCP Agent provider research report](./research/codex-mcp-agent-provider-report.md) · [Codex MCP server provider-neutral capability report](./research/codex-mcp-provider-neutral-report.md)

<!-- /DOCS-NAV -->
