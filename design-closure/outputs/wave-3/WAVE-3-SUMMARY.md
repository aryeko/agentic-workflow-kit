# Wave 3 Summary

## Status

| Task | Status | Deliverable |
|---|---|---|
| T9 - Flip DAG/frontier edges + reclassify runtime attestation | Proposed | `design-closure/outputs/wave-3/T9/proposal.md` |

## What the reorg proposes

T9 proposes adding explicit seam contract + mock planning nodes so core depends on SDK provider ports
and testkit mocks/conformance, not full provider domains:

- `seam-work-source-contract-mock`
- `seam-forge-contract-mock`
- `seam-execution-host-contract-mock`
- `seam-agent-contract-mock`

Provider domains remain the homes for real-driver mapping, live/provider evidence, provider-specific
conformance, and production readiness. Runtime attestation is reclassified as a
production-readiness gate for real drivers and live capability-dependent powers; it is not a
core build/test prerequisite.

The proposed published build order is:

> foundation -> seam ports & mocks (in `sdk`/`testkit`) -> core spine -> core gates -> real drivers
> (parallel) -> edge.

## Exact corpus files and sections to amend

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

Optional clarifier:

- `docs/design/10-architecture/capability-attestation.md#ownership`
- `docs/design/10-architecture/capability-attestation.md#evaluation-rules`

## Blockers

No blockers. Wave-1 T3 was present and unambiguous enough to consume.

## Architect rulings needed

- Approve the proposed seam node names, or choose shorter ids.
- Decide whether real drivers should remain in the current frontier files as non-core-blocking story
  classes, or get a formal production-readiness frontier label.
- Decide whether the optional architecture-level attestation clarifier should be applied.

## Design-closure complete?

Yes, with architect approval of the Wave 1, Wave 2, and Wave 3 proposals before applying them to the
live corpus. Taken together, the proposals leave the design clear enough to start writing
implementation story-contracts core-first: SDK-owned ports and typed contracts are identified, core
dependencies are re-pointed to seam ports and mocks, and real-provider runtime attestation is framed
as production readiness rather than a blocker for mock-driven core implementation.
