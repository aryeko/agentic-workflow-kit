---
title: "T9 draft - domain DAG and catalog reorg fragments"
status: proposed
target-corpus-paths:
  - "docs/implementation/domain-dag.md"
  - "docs/design/30-domain-reference/domain-catalog.md"
---

# T9 draft - domain DAG and catalog reorg fragments

This draft proposes replacement fragments only. It does not edit the corpus.

Source basis:

- Wave-1 T3 proposes SDK-owned provider ports at
  `docs/design/20-sdk-and-packaging/provider-ports.md` and keeps driver mappings, provider evidence,
  and conformance detail in provider folders
  (`design-closure/outputs/wave-1/T3/proposal.md#decision--answer`,
  `design-closure/outputs/wave-1/T3/proposal.md#move-map`).
- Current SDK docs already state provider interfaces live in the SDK and provider packages implement
  them; the SDK never imports provider packages
  (`docs/design/20-sdk-and-packaging/provider-interface-model.md#provider-interface-model`,
  `docs/design/20-sdk-and-packaging/sdk-boundary.md#what-the-sdk-must-not-own`).
- The current DAG still points core direct dependencies at full provider domains
  (`docs/implementation/domain-dag.md#direct-dependencies`).

## Proposed seam nodes

Add explicit seam contract + mock nodes to the implementation DAG. These are implementation-planning
nodes, not new design domains:

| Node id | Label | Owned surfaces |
|---|---|---|
| `seam-work-source-contract-mock` | Work Source seam contract + mock | SDK `WorkSourceProvider` port, neutral DTOs, testkit mock/conformance fixtures |
| `seam-forge-contract-mock` | Forge seam contract + mock | SDK `ForgeProvider` port, neutral DTOs, testkit mock/conformance fixtures |
| `seam-execution-host-contract-mock` | Execution Host seam contract + mock | SDK `ExecutionHostProvider` port, neutral DTOs, testkit mock/conformance fixtures |
| `seam-agent-contract-mock` | Agent seam contract + mock | SDK `AgentProvider` port, neutral DTOs, testkit mock/conformance fixtures |

Provider domains continue to own real driver mapping, live/provider evidence, and conformance detail.
They become real-driver story buckets for `provider-markdown`, `provider-github`, `provider-local`,
and `provider-codex`, not core prerequisites.

## Proposed direct dependency table rows

Replace the core-to-provider rows in `docs/implementation/domain-dag.md#direct-dependencies` with:

| Domain or planning node | Direct dependencies |
|---|---|
| `seam-work-source-contract-mock` | `fnd-02` |
| `seam-forge-contract-mock` | `fnd-04` |
| `seam-execution-host-contract-mock` | `fnd-03`, `fnd-04` |
| `seam-agent-contract-mock` | `seam-execution-host-contract-mock`, `fnd-04` |
| `core-02` | `core-01`, `fnd-01`, `seam-agent-contract-mock`, `seam-forge-contract-mock`, `seam-work-source-contract-mock`, `seam-execution-host-contract-mock` |
| `core-03` | `core-01`, `core-02`, `fnd-01`, `seam-agent-contract-mock` |
| `core-04` | `core-01`, `seam-agent-contract-mock`, `seam-execution-host-contract-mock` |
| `core-05` | `core-01`, `core-02`, `core-03`, `fnd-01`, `fnd-03`, `seam-forge-contract-mock`, `seam-execution-host-contract-mock` |
| `core-06` | `core-01`, `core-02`, `core-04`, `core-05`, `fnd-02`, `seam-agent-contract-mock`, `seam-forge-contract-mock`, `seam-work-source-contract-mock`, `seam-execution-host-contract-mock` |
| `prov-03` | `seam-work-source-contract-mock` |
| `prov-02` | `seam-forge-contract-mock`, `fnd-04` |
| `prov-04` | `seam-execution-host-contract-mock`, `fnd-03`, `fnd-04` |
| `prov-01` | `seam-agent-contract-mock`, `seam-execution-host-contract-mock`, `fnd-04` |

The explicit core edges are:

- `core-02` depends on all four seam contract + mock nodes, not `prov-01`, `prov-02`, `prov-03`, or
  `prov-04`.
- `core-03` depends on the Agent seam contract + mock node, not the full Agent provider domain.
- `core-04` depends on Agent and Execution Host seam contract + mock nodes, not full provider domains.
- `core-05` depends on Forge and Execution Host seam contract + mock nodes, not full provider domains.
- `core-06` depends on all four seam contract + mock nodes, not full provider domains.

## Proposed DAG note

Add this note near `docs/implementation/domain-dag.md#foundation-and-provider-contracts`:

> Provider seam contract + mock nodes are the implementation prerequisites for core. The provider
> domain ids (`prov-01` through `prov-04`) remain the homes for real driver mapping, live evidence,
> provider-specific conformance, and production readiness. A core dependency on a provider capability
> means a dependency on the SDK port plus testkit mock/conformance fixture, never an import or build
> dependency on `provider-*`.

## Proposed frontier table wording

Replace the frontier-order rationale with this published build order:

> Published build order: foundation -> seam ports & mocks (in `sdk`/`testkit`) -> core spine -> core
> gates -> real drivers (parallel) -> edge.

Retain existing frontier numbers unless the architect chooses to rename them:

| Frontier | Label | Domains / planning nodes |
|---:|---|---|
| 0 | Independent foundation | `fnd-01`, `fnd-02` |
| 1 | Foundation dependents and core spine seed | `fnd-03`, `fnd-04`, `core-01` |
| 2 | Provider seam ports and mocks | `seam-work-source-contract-mock`, `seam-forge-contract-mock`, `seam-execution-host-contract-mock` |
| 3 | Agent seam contract and core gates | `seam-agent-contract-mock`, `core-02`, `core-07` |
| 4 | Run control | `core-03`, `core-04` |
| 5 | Completion and recovery | `core-05`, `core-06` |
| 5p | Real drivers, production readiness | `prov-03`, `prov-02`, `prov-04`, `prov-01` in parallel as their contract+mock surfaces exist |
| 6 | Operator surface | `edge-01` |

`5p` is a planning label, not a new design-domain layer. It records that real drivers can proceed in
parallel with late core story authoring once their SDK port and testkit contract exists, but no core
domain waits on live provider drivers.

## Proposed domain catalog changes

In `docs/design/30-domain-reference/domain-catalog.md#index`, amend core dependency text as follows:

| ID | Proposed key dependency wording |
|---|---|
| `core-02` | `fnd-01`; `core-01`; SDK provider ports + recorded/mock capability attestations |
| `core-03` | `core-01`, `core-02`; `fnd-01`; Agent seam contract + mock |
| `core-04` | `core-01`; Agent and Execution Host seam contracts + mocks |
| `core-05` | `core-01/02/03`; `fnd-01`; Workspace; Forge and Execution Host seam contracts + mocks |
| `core-06` | `core-01/02`; `core-04/05`; all seam contracts + mocks |

In `docs/design/30-domain-reference/domain-catalog.md#suggested-design-order`, replace the current
order with:

1. **Foundation:** `fnd-01`, `fnd-02`, `fnd-03`, `fnd-04`.
2. **Seam ports & mocks:** SDK provider ports and neutral DTOs, plus testkit mocks/conformance for
   Work Source, Forge, Execution Host, then Agent. This is the core dependency surface.
3. **Core spine:** `core-01` and the replay/event surfaces the remaining core uses.
4. **Core gates and control:** `core-02`, `core-07`, then `core-03`, `core-04`, `core-05`, and
   `core-06` against SDK ports and testkit mocks.
5. **Real drivers:** Markdown, GitHub, Local, and Codex provider driver stories in parallel where
   their contract+mock stories exist and production evidence is available.
6. **Edge:** `edge-01`.
