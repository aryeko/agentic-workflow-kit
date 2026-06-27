# Implementer Prompt: prov-03-s3-markdown-work-source-driver

## Assigned Routing

- Source story id: `prov-03-s3-markdown-work-source-driver`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `prov-03-s3-markdown-work-source-driver` covers `AC-1`..`AC-8` and carries a public provider package, real-driver conformance, race-safe task-status authority, capability evidence, failure-token closure, and boundary purity.

## Exact Task

Implement `prov-03-s3-markdown-work-source-driver` for epic `epic-6-concrete-provider-drivers`: deliver the concrete `provider-markdown` Work Source driver with tracker parsing, eligibility, race-safe claim/release/status mutation, TaskSnapshot artifacts, capability evidence, conformance, and evidence pack. Keep the work limited to source story `prov-03-s3-markdown-work-source-driver` and source AC ids `AC-1`..`AC-8`.

## Why It Matters

This wave 1 story produces the Markdown Work Source provider consumed by Epic 7 production composition. It must preserve the two-authorities boundary: Work Source owns task status, while run activity remains event-log authority. It consumes prior frozen Epic 2 Work Source SDK/testkit surfaces and fnd-02 lease/artifact contracts; it must not change those producers or write run-log state.

## Required Reading

- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-03-s3-markdown-work-source-driver.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`
- `docs/design/30-domain-reference/providers/work-source/README.md`
- `docs/design/30-domain-reference/providers/work-source/contracts-and-conformance.md`
- `docs/design/20-sdk-and-packaging/provider-ports.md`
- `docs/design/20-sdk-and-packaging/concrete-providers.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-03-s1-work-source-port.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-03-s2-work-source-testkit.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-02-s3-lease-store.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-02-s4-artifact-evidence.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for prior frozen Epic 1 and Epic 2 producers.

## Acceptance Criteria

Source story: `prov-03-s3-markdown-work-source-driver`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`.

- **AC-1** Export `createMarkdownWorkSourceProvider`; the returned object satisfies all seven `WorkSourceProvider` operations with no private SDK imports, proven by public-import fixture `provider-markdown-public.public.ts`.
- **AC-2** Parse stable `TrackView`/`TaskView` values from one `kit-work-source` block and task blocks; return `work-source-unavailable`, `track-malformed`, or `status-bucket-unknown` for unreadable, duplicate/malformed, or unmapped status inputs.
- **AC-3** `nextEligible` returns only tasks with complete dependencies, eligible status bucket, absent/expired claim, and matching `targetProject`; unresolved dependency cases return `dependency-unresolved`.
- **AC-4** `claim`, `release`, and `writeStatus` acquire the fnd-02 track lease, reread, compare digest/epoch preconditions, edit only the target task YAML block, fsync, reread, verify post-write digest, and fail closed with `claim-lock-unavailable`, `claim-conflict`, `status-authority-conflict`, or `status-write-unavailable`.
- **AC-5** `claim` writes a `TaskSnapshot` artifact with task fields, source path/revision, source bytes digest, inline spec digest, raw excerpt digest, and `createdAt`; artifact failure returns `snapshot-artifact-unavailable` with no claim mutation.
- **AC-6** `probeCapabilities` returns positive `CapabilityAttestation<WorkSourceCapability>[]` only from fresh positive Markdown behavior for driver version, platform, freshness key, and track scope.
- **AC-7** The Markdown subject passes Work Source conformance and broken Markdown fixtures fail for stale digests, delayed writes, missing dependencies, false status writes, and artifact failures.
- **AC-8** Production source imports only `sdk` and provider-markdown-owned parsing/filesystem utilities; `deps` and the source boundary sweep return clean.

Failure and degraded outcomes to prove exactly: `work-source-unavailable`, `track-malformed`, `dependency-unresolved`, `status-bucket-unknown`, `claim-conflict`, `claim-lock-unavailable`, `snapshot-artifact-unavailable`, `status-write-unavailable`, `status-authority-conflict`.

## Allowed Writes

Only these source-owned paths may be changed:
- `packages/provider-markdown/src/**`
- `packages/provider-markdown/tests/**`
- `packages/provider-markdown/package.json`
- `packages/provider-markdown/tsconfig.json`

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn outside the owned package, generated files outside the owned pathset, and changes to SDK/testkit contracts.

## Dependency Inputs

- Producer story ids: prior frozen `prov-03-s1-work-source-port`, `prov-03-s2-work-source-testkit`, `fnd-02-s3-lease-store`, `fnd-02-s4-artifact-evidence`; fnd-04 redaction if diagnostics or evidence include sensitive text.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import paths: `sdk` and `testkit` only where the source contract permits tests/conformance; production source must not import `testkit`.
- Shared shapes consumed: `WorkSourceProvider`, `TrackView`, `TaskView`, `TaskSnapshot`, `ClaimResult`, `StatusWriteResult`, `WorkSourceCapability`, `WorkSourceError`, `CapabilityAttestation`, `LeaseStore`, `ArtifactStore`, `ArtifactRef`.

## Non-Goals And STOP Conditions

Non-goals: SDK Work Source provider type changes, testkit mock/conformance ownership, run lifecycle/events/projections, completion/recovery decisions, PRD/design authoring, local git evidence, Forge behavior, and storage implementation changes beyond consuming fnd-02.

Source STOP conditions: stop if the story needs a Work Source port shape not present in Epic 2, writes run-log state, changes SDK/testkit contracts, or treats task status and run activity as one authority.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor deterministic parsing and mutation, lease/digest/epoch preconditions, write-once TaskSnapshot evidence, injected clocks, stable task selection order, no ambient network/process execution, no run-log writes, no private SDK imports, and no production imports from `testkit`, `cli`, `mcp`, peer providers, core event writers, GitHub/Codex/process drivers, or forbidden package paths.

## Verification

Run the targeted checks and evidence required by the source contract:
- Public import fixture `provider-markdown-public.public.ts`.
- `coverage:baseline` integration fixtures `markdown-parse-stable-track`, `markdown-source-unavailable`, `markdown-duplicate-task-id`, `markdown-status-bucket-unknown`, `markdown-eligibility-dependency-matrix`, `markdown-claim-lock-unavailable`, `markdown-claim-digest-conflict`, `markdown-release-epoch-conflict`, `markdown-status-authority-conflict`, `markdown-status-write-unavailable`, `markdown-claim-snapshot-fields`, `markdown-snapshot-artifact-unavailable`, `markdown-capability-probe-matrix`.
- Work Source conformance cases `markdown-subject-passes` and `broken-markdown-subjects-fail`.
- Focused provider coverage over `packages/provider-markdown/src/**` at the source threshold.
- Boundary sweep from AC-8 with zero-match output.
- `pnpm check`.

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:
- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: prov-03-s3-markdown-work-source-driver` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - Concrete provider drivers](../../../README.md) · **← Prev:** [Reviewer Prompt: prov-02-s3-github-forge-driver](../prov-02-s3-github-forge-driver/reviewer.md) · **Next →:** [Reviewer Prompt: prov-03-s3-markdown-work-source-driver](./reviewer.md)

<!-- /DOCS-NAV -->
