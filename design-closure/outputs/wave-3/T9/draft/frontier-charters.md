---
title: "T9 draft - frontier charter reorg fragments"
status: proposed
target-corpus-paths:
  - "docs/implementation/frontiers/frontier-2-provider-seams/charter.md"
  - "docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md"
  - "docs/implementation/frontiers/frontier-4-run-control/charter.md"
  - "docs/implementation/frontiers/frontier-5-completion-and-recovery/charter.md"
---

# T9 draft - frontier charter reorg fragments

This draft proposes frontier charter amendments only. It keeps the current frontier files and
frontier numbers unless the architect chooses a larger rename.

## Frontier 2 - provider seams

Amend `docs/implementation/frontiers/frontier-2-provider-seams/charter.md#purpose`:

> Frontier 2 implements the first provider seam contract + mock surfaces: Work Source, Forge, and
> Execution Host. Each seam produces an SDK-owned port, neutral DTOs, testkit mocks, conformance
> fixtures, degraded outcomes, and event-ready evidence payloads. Real drivers are separate
> production-readiness stories that implement the same port but do not block core build/test work.

Amend `#outputs` to split each provider surface:

- Work Source contract + mock story: SDK `WorkSourceProvider` port, neutral `TaskSnapshot` and
  status-authority DTOs, mock driver, conformance fixtures, degraded tokens, and event-ready payloads.
- Work Source real-driver story: Markdown driver mapping, filesystem/track evidence, write
  conflict/race probes, and production capability attestations.
- Forge contract + mock story: SDK `ForgeProvider` port, exact-head DTOs, mock driver, conformance
  fixtures, degraded tokens, and event-ready payloads.
- Forge real-driver story: GitHub driver mapping, provider evidence refresh, protection/ruleset/merge
  queue probes, redaction, and production capability attestations.
- Execution Host contract + mock story: SDK `ExecutionHostProvider` port, workspace/worker/command
  capture DTOs, mock host, conformance fixtures, degraded tokens, and event-ready payloads.
- Execution Host real-driver story: Local driver process handling, termination/prove-empty,
  redaction, egress negative probes, and production capability attestations.

Amend `#expected-story-files-to-author-next`:

- Keep contract+mock stories as core-blocking:
  - `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-03-work-source-contract-and-mock.md`
  - `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-02-forge-contract-and-mock.md`
  - `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-04-execution-host-contract-and-mock.md`
- Keep real-driver stories as production-readiness, non-core-blocking:
  - `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-03-markdown-driver-conformance.md`
  - `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-02-github-driver-evidence-and-conformance.md`
  - `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-04-local-driver-command-termination-and-egress.md`

## Frontier 3 - agent and core gates

Amend `docs/implementation/frontiers/frontier-3-agent-and-core-gates/charter.md#included-domains`:

> `prov-01` participates through its Agent contract + mock/conformance surface before core gates. The
> Codex real-driver mapping and live probes remain real-driver production-readiness stories; they do
> not block `core-02` or `core-07`.

Amend the package-target paragraph:

> Runtime contracts land in `packages/sdk`; provider mocks, adversarial fixtures, and conformance
> helpers land in `packages/testkit`; concrete Codex driver work lands in `packages/provider-codex`
> only as real-driver production-readiness work. Core gate and analysis packages must not import
> `provider-codex`.

Amend `#outputs` to split Agent work:

- Agent contract + mock story: SDK `AgentProvider` port, neutral events/DTOs, output sink contract,
  failure tokens, testkit mock Agent, adversarial fixtures, and conformance cases.
- Core gate stories: `core-02` capability registry and `CapabilityGateRecord` replay logic over
  recorded attestations; `core-07` analysis contracts and replayable analysis facts.
- Agent real-driver story: Codex mapping, schema/live evidence classification, provider-specific
  redaction, and production capability probes for the pinned driver/version/surface.

Amend `#readiness-criteria`:

> Frontier 3 is implementation-ready for later core domains when Agent contract and mock fixtures can
> drive core tests with zero real processes and zero network, and when capability gate and analysis
> contracts are proven against SDK ports and recorded/mock attestations. Positive runtime
> attestations for Codex are production-readiness evidence for live Agent powers, not prerequisites
> for core build/test readiness.

## Frontier 4 - run control

Add to `docs/implementation/frontiers/frontier-4-run-control/charter.md#dependencies-and-frozen-inputs`:

> Approval and liveness implementation consumes Agent and Execution Host contract+mock surfaces for
> core tests. Live relay, resume, durable answer channels, structured tool exits, termination, and
> host-control powers remain gated by runtime capability attestations before production use.

## Frontier 5 - completion and recovery

Add to `docs/implementation/frontiers/frontier-5-completion-and-recovery/charter.md#dependencies-and-frozen-inputs`:

> Completion and recovery decision logic is tested against recorded/mock Forge, Work Source,
> Execution Host, and Agent seam evidence. Real provider evidence and capability attestations are
> production-readiness gates for live push, checks, merge, status writes, termination, and recovery
> actions; they are not SDK/core build prerequisites.
