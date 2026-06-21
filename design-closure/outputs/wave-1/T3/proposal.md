# T3 Proposal - Hoist provider ports and CapabilityAttestation into SDK docs

## Decision / answer

Recommend adding an SDK-owned provider port draft at
`docs/design/20-sdk-and-packaging/provider-ports.md` and moving the production type definitions for
`AgentProvider`, `ExecutionHostProvider`, `ForgeProvider`, `WorkSourceProvider`, and
`CapabilityAttestation` into that SDK section.

This is an authoring proposal, not an applied corpus change. The draft is in
`design-closure/outputs/wave-1/T3/draft/provider-ports.md`.

Rationale:

- The SDK boundary already says the SDK owns the four provider interfaces and
  `CapabilityAttestation`, along with capability gate evaluation
  (`docs/design/20-sdk-and-packaging/sdk-boundary.md#what-the-sdk-owns`).
- AD-16 already makes those interfaces and `CapabilityAttestation` SDK-owned production surface
  (`docs/design/40-decisions/accepted-decisions.md#ad-16--sdk-owns-provider-interfaces-and-capabilityattestation`).
- The provider interface model already describes the same inversion: provider packages implement SDK
  interfaces and the SDK does not import provider packages
  (`docs/design/20-sdk-and-packaging/provider-interface-model.md#provider-interface-model`).
- The provider folders currently contain much of the type detail, which makes core readers look
  sideways into provider folders for SDK-owned contracts even though the runtime ownership is already
  inverted (`docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md#contract-types`,
  `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md#contract-types`,
  `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md#contract-types`,
  `docs/design/30-domain-reference/providers/work-source/contracts-and-conformance.md#contract-types`).

## Proposed artifact or change

Create proposed corpus file:

- `docs/design/20-sdk-and-packaging/provider-ports.md`

Draft content:

- `design-closure/outputs/wave-1/T3/draft/provider-ports.md`

The draft authors:

- A single generic `CapabilityAttestation<Capability extends string>` payload matching
  `docs/design/10-architecture/capability-attestation.md#attestation-shape`.
- `AgentProvider`, renamed from the current `AgentDriver` public interface while keeping the current
  Agent contract methods and payloads from
  `docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md#contract-types`.
- `ExecutionHostProvider`, renamed from the current `ExecutionHost` public interface while keeping
  current methods and payloads from
  `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md#contract-types`.
- `ForgeProvider`, renamed from the current `ForgeContract` public interface while keeping current
  methods and payloads from
  `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md#contract-types`.
- `WorkSourceProvider`, renamed from the current `WorkSource` public interface while keeping current
  methods and payloads from
  `docs/design/30-domain-reference/providers/work-source/contracts-and-conformance.md#contract-types`.

The name changes align the type catalog with the SDK boundary and factory shape, which already name
`AgentProvider`, `ExecutionHostProvider`, `ForgeProvider`, and `WorkSourceProvider`
(`docs/design/20-sdk-and-packaging/sdk-boundary.md#factory-shape`).

## Move map

| Content | Proposed location | Stays in provider folders |
|---|---|---|
| Shared `CapabilityAttestation` payload | `docs/design/20-sdk-and-packaging/provider-ports.md` | Provider-specific capability sets, probe evidence, and conformance requirements |
| `AgentProvider` interface and neutral Agent DTOs | `docs/design/20-sdk-and-packaging/provider-ports.md` | Codex mapping, Guardian treatment, live probe status, mock incident fixtures |
| `ExecutionHostProvider` interface and neutral host DTOs | `docs/design/20-sdk-and-packaging/provider-ports.md` | Local driver mapping, containment evidence, egress probes, termination conformance |
| `ForgeProvider` interface and neutral Forge DTOs | `docs/design/20-sdk-and-packaging/provider-ports.md` | GitHub GraphQL probes, exact-head evidence, rulesets/merge-queue conformance |
| `WorkSourceProvider` interface and neutral task-source DTOs | `docs/design/20-sdk-and-packaging/provider-ports.md` | Markdown syntax, file locking details, fixture evidence, mock backlog behavior |

## Cross-reference plan

- `docs/design/20-sdk-and-packaging/README.md#read-in-order`: add the new provider ports page after
  `provider-interface-model.md`, or retitle `provider-interface-model.md` as the conceptual page and
  link it to `provider-ports.md`.
- `docs/design/20-sdk-and-packaging/provider-interface-model.md#the-four-interfaces`: link from the
  conceptual table to `provider-ports.md` as the canonical type catalog.
- `docs/design/20-sdk-and-packaging/sdk-boundary.md#what-the-sdk-owns`: link the provider-interface
  bullet and `CapabilityAttestation` bullet to `provider-ports.md`.
- `docs/design/10-architecture/provider-seams.md#authoritative-references`: add
  `provider-ports.md` as the type reference and keep provider folders as seam behavior references.
- Provider folders:
  - `docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md#contract-types`
  - `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md#contract-types`
  - `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md#contract-types`
  - `docs/design/30-domain-reference/providers/work-source/contracts-and-conformance.md#contract-types`
  Replace duplicated production interface definitions with links to the SDK provider ports page, while
  keeping capability/conformance detail and any provider-specific notes in place.
- Core consumers should cite SDK ports rather than provider subfiles when they reference the abstract
  interface shape. Examples include core-03 Agent approval types and `ScopedGrant`, and core-04 Agent
  observations.

## Corpus impact

Exact corpus files and sections to amend later:

- `docs/design/20-sdk-and-packaging/README.md#read-in-order`
- `docs/design/20-sdk-and-packaging/sdk-boundary.md#what-the-sdk-owns`
- `docs/design/20-sdk-and-packaging/sdk-boundary.md#factory-shape`
- `docs/design/20-sdk-and-packaging/provider-interface-model.md#the-four-interfaces`
- `docs/design/20-sdk-and-packaging/provider-interface-model.md#capability-attestation`
- `docs/design/20-sdk-and-packaging/testkit-and-conformance.md#what-testkit-must-not-own`
- `docs/design/10-architecture/provider-seams.md#authoritative-references`
- `docs/design/10-architecture/capability-attestation.md#ownership`
- `docs/design/10-architecture/capability-attestation.md#attestation-shape`
- `docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md#contract-types`
- `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md#contract-types`
- `docs/design/30-domain-reference/providers/forge-collaboration/contracts-and-conformance.md#contract-types`
- `docs/design/30-domain-reference/providers/work-source/contracts-and-conformance.md#contract-types`
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md#interfaces-events-and-tests`
- `docs/design/30-domain-reference/core/supervision-and-liveness/README.md#design`

No corpus file was edited by this proposal.

## Acceptance criteria

1. A draft authors the four provider interface type-definitions plus a single
   `CapabilityAttestation` type as SDK-owned doc content under a proposed `20-sdk-and-packaging/`
   location.

   Met in `design-closure/outputs/wave-1/T3/draft/provider-ports.md`. The proposed corpus location is
   `docs/design/20-sdk-and-packaging/provider-ports.md`.

2. A "what moves / what stays" table: type definitions to SDK section; driver-mapping, attestation
   evidence, and conformance suites stay in provider folders.

   Met in the "Move map" table above and the draft's "Provider-folder responsibilities that stay
   put" section.

3. A cross-reference plan: provider folders link up to the SDK port; core domains reference the SDK
   location.

   Met in the "Cross-reference plan" section.

4. Confirms this is doc-only - the interfaces already target `packages/sdk`, so no code moves between
   packages.

   Met. `docs/design/20-sdk-and-packaging/sdk-boundary.md#what-the-sdk-owns`,
   `docs/design/20-sdk-and-packaging/provider-interface-model.md#provider-interface-model`, and
   AD-16 already state SDK ownership. This proposal only makes that ownership legible in docs; it
   does not propose package or code moves.

5. The proposal lists the `docs/**` files and sections to change; no corpus file is edited.

   Met in "Corpus impact". Local verification should show no tracked or untracked file under
   `docs/**` changed.

## Open issues / assumptions / risk

- The current provider contract pages use mixed public interface names (`AgentDriver`,
  `ExecutionHost`, `ForgeContract`, `WorkSource`) while SDK docs use `AgentProvider`,
  `ExecutionHostProvider`, `ForgeProvider`, and `WorkSourceProvider`. This proposal assumes the SDK
  names are canonical because they appear in the SDK boundary factory and AD-16.
- The draft preserves support DTOs with their current shapes. It does not try to resolve unrelated
  policy or provider open questions from T1 or T2.
- The draft keeps provider-specific `details` content inside generic attestation details instead of
  defining separate duplicate attestation interfaces per provider. That matches the shared
  attestation shape and avoids drift.
