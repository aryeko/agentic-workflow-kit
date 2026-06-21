# T9 Proposal - Flip DAG/frontier edges and reclassify runtime attestation

## Decision / answer

Recommend a minimal implementation-planning reorg that keeps the current design-domain ids and
frontier files, but inserts explicit **seam contract + mock** planning nodes between core and
provider domains.

Core domains should depend on SDK-owned provider ports plus testkit mocks/conformance, not on the
full provider domains that also carry real drivers. Real drivers remain required production work, but
they become parallel real-driver stories gated by runtime / production attestation rather than
core-build prerequisites.

This is consistent with Wave-1 T3: T3 proposes SDK-owned provider ports at
`docs/design/20-sdk-and-packaging/provider-ports.md`, while provider folders keep driver mapping,
provider evidence, and conformance detail
(`design-closure/outputs/wave-1/T3/proposal.md#decision--answer`,
`design-closure/outputs/wave-1/T3/proposal.md#move-map`).

## Proposed artifact or change

Draft proposed corpus fragments:

- `design-closure/outputs/wave-3/T9/draft/domain-dag-and-catalog.md`
- `design-closure/outputs/wave-3/T9/draft/frontier-charters.md`
- `design-closure/outputs/wave-3/T9/draft/readiness-matrix-and-rollout.md`

The proposed published build order is:

> foundation -> seam ports & mocks (in `sdk`/`testkit`) -> core spine -> core gates -> real drivers
> (parallel) -> edge.

The proposed explicit seam contract + mock nodes are:

- `seam-work-source-contract-mock`
- `seam-forge-contract-mock`
- `seam-execution-host-contract-mock`
- `seam-agent-contract-mock`

The proposed explicit core edges are:

- `core-02` depends on `seam-agent-contract-mock`, `seam-forge-contract-mock`,
  `seam-work-source-contract-mock`, and `seam-execution-host-contract-mock`, not full provider
  domains.
- `core-03` depends on `seam-agent-contract-mock`, not `prov-01`.
- `core-04` depends on `seam-agent-contract-mock` and `seam-execution-host-contract-mock`, not
  `prov-01` or `prov-04`.
- `core-05` depends on `seam-forge-contract-mock` and `seam-execution-host-contract-mock`, not
  `prov-02` or `prov-04`.
- `core-06` depends on all four seam contract + mock nodes, not full provider domains.

Provider frontier charters should split each provider surface into:

- contract+mock stories: SDK port, neutral DTOs, testkit mock, conformance fixtures, degraded tokens,
  event-ready payloads;
- real-driver stories: concrete provider package mapping, live/provider evidence, production
  probes, runtime / production attestations.

The readiness matrix should classify runtime attestation as a **production-readiness gate** for real
drivers and live capability-dependent powers. It is not a core build/test prerequisite: SDK/core tests
run on SDK ports plus testkit mocks/fixtures with zero real processes and zero network.

## Corpus impact

Exact corpus files and sections to amend later:

- `docs/implementation/domain-dag.md#foundation-and-provider-contracts`
- `docs/implementation/domain-dag.md#run-control-and-operator-surface`
- `docs/implementation/domain-dag.md#domain-table`
- `docs/implementation/domain-dag.md#frontier-table`
- `docs/implementation/domain-dag.md#first-package-appearance`
- `docs/implementation/domain-dag.md#direct-dependencies`
- `docs/design/30-domain-reference/domain-catalog.md#index`
- `docs/design/30-domain-reference/domain-catalog.md#suggested-design-order`
- `docs/implementation/frontiers/frontier-2-provider-seams/charter.md#purpose`
- `docs/implementation/frontiers/frontier-2-provider-seams/charter.md#outputs`
- `docs/implementation/frontiers/frontier-2-provider-seams/charter.md#per-domain-responsibilities`
- `docs/implementation/frontiers/frontier-2-provider-seams/charter.md#evidence-expectations`
- `docs/implementation/frontiers/frontier-2-provider-seams/charter.md#readiness-criteria`
- `docs/implementation/frontiers/frontier-2-provider-seams/charter.md#expected-story-files-to-author-next`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md#included-domains`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md#outputs`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md#scope-boundaries`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md#per-domain-responsibilities`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md#readiness-criteria`
- `docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md#expected-story-files-to-author-next`
- `docs/implementation/frontiers/frontier-4-run-control/charter.md#dependencies-and-frozen-inputs`
- `docs/implementation/frontiers/frontier-5-completion-and-recovery/charter.md#dependencies-and-frozen-inputs`
- `docs/implementation/readiness-matrix.md#terms`
- `docs/implementation/readiness-matrix.md#domain-readiness`
- `docs/implementation/readiness-matrix.md#update-rule`
- `docs/implementation/package-rollout.md#rollout-by-frontier`
- `docs/implementation/package-rollout.md#migration-tracking`
- `docs/implementation/work-item-authoring-guide.md#evidence-pack`
- `docs/implementation/work-item-authoring-guide.md#gate-b---evidence-pack-is-complete`

Optional clarifier only:

- `docs/design/10-architecture/capability-attestation.md#ownership`
- `docs/design/10-architecture/capability-attestation.md#evaluation-rules`

No corpus file was edited by this proposal.

## Acceptance criteria

1. The proposed DAG shows each core->provider edge depending on a seam contract + mock node, not the
   full provider domain, and lists edges explicitly.

   Met in `draft/domain-dag-and-catalog.md#proposed-direct-dependency-table-rows` and summarized in
   this proposal's explicit edge list.

2. Each provider frontier charter is proposed to split work into contract+mock stories vs real-driver
   stories, with core depending only on the former.

   Met in `draft/frontier-charters.md#frontier-2---provider-seams` and
   `draft/frontier-charters.md#frontier-3---agent-and-core-gates`.

3. The readiness-matrix runtime attestation axis is reclassified as a production-readiness gate, with
   a note that it is not a core build/test prerequisite.

   Met in `draft/readiness-matrix-and-rollout.md#proposed-domain-readiness-axis` and
   `draft/readiness-matrix-and-rollout.md#proposed-update-rule`.

4. The proposed published build order reads: foundation -> seam ports & mocks (in `sdk`/`testkit`) ->
   core spine -> core gates -> real drivers (parallel) -> edge.

   Met in `draft/domain-dag-and-catalog.md#proposed-frontier-table-wording` and restated above.

5. The proposal is consistent with Wave-1 T3, cites it, lists corpus files+sections to amend, and no
   corpus file is edited.

   Met. T3 is cited in the Decision section and each draft preserves T3's move map: SDK owns provider
   ports and `CapabilityAttestation`; provider folders keep driver mapping, evidence, and conformance.
   Corpus impact is listed above. Local verification should show no `docs/**` modifications.

## Minimal-change justification

No existing typed shape or field is changed. The proposal changes implementation-planning edges,
frontier story classification, and readiness-axis wording only.

The smallest sufficient change is to preserve existing domain ids (`prov-01` through `prov-04`) and
frontier files while adding seam contract + mock planning nodes. This avoids a broader domain-catalog
rename while satisfying the cited consumer requirement: core must consume SDK provider ports and
testkit mocks, not concrete provider packages
(`docs/design/20-sdk-and-packaging/provider-interface-model.md#provider-interface-model`,
`docs/design/20-sdk-and-packaging/sdk-boundary.md#what-the-sdk-must-not-own`,
`design-closure/outputs/wave-1/T3/proposal.md#decision--answer`).

Optional upgrades for architect review:

- Rename frontier labels or introduce a formal `5p` production-readiness frontier.
- Add a short architecture-level note to
  `docs/design/10-architecture/capability-attestation.md#evaluation-rules` clarifying the difference
  between mock/recorded attestation fixtures and live runtime probes.
- Create a generated checklist to keep domain frontmatter dependencies aligned with the DAG.

## Contradiction & open-choice log

Contradictions found:

- The SDK and seam docs say provider interfaces live in SDK and provider packages implement them
  (`docs/design/20-sdk-and-packaging/provider-interface-model.md#provider-interface-model`), but the
  current DAG direct-dependency table points core domains at full provider domains
  (`docs/implementation/domain-dag.md#direct-dependencies`).
- The readiness matrix applies a `runtime attestation` column to core domains
  (`docs/implementation/readiness-matrix.md#domain-readiness`), while NFR-TEST and Frontier 3 say
  core tests run on mocks with zero real processes/network
  (`docs/design/00-orientation/requirements.md#requirements`,
  `docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md#readiness-criteria`).

Open architect rulings:

- Node naming: recommend `seam-<provider>-contract-mock` ids for the implementation DAG. Alternative:
  shorter ids such as `seam-agent`, `seam-host`, `seam-forge`, `seam-work-source`.
- Frontier expression: recommend preserving current frontier files/numbers and adding story-class
  splits. Alternative: rename or introduce a formal production-readiness frontier for real drivers.
- Domain catalog representation: recommend treating seam contract + mock nodes as implementation
  planning nodes, not new design domains. Alternative: split provider domains into separate contract
  and real-driver design-domain ids.

Narrowing / removal:

- No existing provider option or capability is removed. Runtime attestation remains required for
  production live powers; it is narrowed only away from SDK/core build-test readiness.

## Open issues / assumptions / risk

- Some domain frontmatter may still list `prov-*` dependencies after the architect applies this
  proposal. The DAG maintenance rule says the table and domain frontmatter should stay aligned, so a
  follow-up corpus application should check frontmatter after amending the DAG.
- The published build order phrase is exact per T9, but existing frontier numbering has `core-01`
  before provider seam ports because `core-01` depends only on foundation. The draft treats that as a
  harmless seed of the core spine and keeps the externally visible order focused on what unblocks the
  rest of core.
- Applying this proposal should not delete real-driver story files or expectations; doing so would
  silently narrow provider production readiness.
