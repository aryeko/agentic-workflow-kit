# Implementer Prompt: prov-04-s3-local-execution-host-driver

## Assigned Routing

- Source story id: `prov-04-s3-local-execution-host-driver`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `prov-04-s3-local-execution-host-driver` covers `AC-1`..`AC-9` and carries a public provider package, process/containment and credential-injection safety boundary, smoke-real evidence, conformance, failure-token closure, and boundary purity.

## Exact Task

Implement `prov-04-s3-local-execution-host-driver` for epic `epic-6-concrete-provider-drivers`: deliver the concrete `provider-local` Execution Host driver with workspace attachment, runner command capture, worker spawn/observation, termination proof, credential/egress separation, capability evidence, conformance, smoke evidence, and evidence pack. Keep the work limited to source story `prov-04-s3-local-execution-host-driver` and source AC ids `AC-1`..`AC-9`.

## Why It Matters

This wave 1 story produces the Local Execution Host provider consumed by Epic 7 and by `prov-01-s3-codex-agent-driver` for Local/Codex host parentage. It is the provider boundary for local process execution, containment, command capture, and termination evidence. It must return host observations/results only; core and caller layers own liveness/recovery decisions and run-event appends.

## Required Reading

- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-04-s3-local-execution-host-driver.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`
- `docs/design/30-domain-reference/providers/execution-host/README.md`
- `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md`
- `docs/design/20-sdk-and-packaging/provider-ports.md`
- `docs/design/20-sdk-and-packaging/concrete-providers.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s1-execution-host-port.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s2-execution-host-testkit.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-03-s2-worktree-setup.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-04-s2-injection-egress.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for prior frozen Epic 1 and Epic 2 producers.

## Acceptance Criteria

Source story: `prov-04-s3-local-execution-host-driver`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`.

- **AC-1** Export `createLocalExecutionHostProvider`; the returned object satisfies all seven `ExecutionHostProvider` operations with no private SDK imports, proven by public-import fixture `provider-local-public.public.ts`.
- **AC-2** `attachWorkspace` accepts `local-worktree` attachments whose cwd root stays inside the worktree and rejects unavailable mounts or cwd escape as `workspace-mount-unavailable` or `workspace-cwd-outside-mount`.
- **AC-3** `runCommand` computes canonical `commandDigest`, uses matching runner injection, captures exit/signal and redacted stdout/stderr refs, and returns `runner-command-capture-incomplete` when required capture fields are missing.
- **AC-4** `spawnWorker` and `observeWorker` launch under owned containment, preserve redacted output and process-exit observations, surface structured tool exits when present, and return `worker-spawn-failed` or `host-observation-incomplete` on failed or incomplete evidence.
- **AC-5** `terminateWorker` executes the termination ladder and returns `TerminationResult` with `TerminationProof`; incomplete proof remains a `TerminationResult` and emits `termination-unproven` as a `HostObservation` `"host-failure"` arm, never as a `terminateWorker` return value.
- **AC-6** `probeCapabilities` reports actual `containmentStrength`, proves `canKill` and `egress-confinement` only from fresh Local evidence, keeps missing/stale/wrong-scope probes negative, and returns `host-capability-unattested` before dependent operations proceed.
- **AC-7** Worker and runner injection are separated; party/audience/expiry/attestation mismatches fail with `credential-injection-rejected` or `egress-confinement-unattested`; `releaseWorkspace` reports credential destruction only after evidence and surfaces `credential-destroy-unconfirmed` through observation semantics, not a return token.
- **AC-8** The Local subject passes Execution Host conformance and broken subjects fail for missing command digest, unredacted output, incomplete termination, lied-about egress, and wrong containment strength.
- **AC-9** Production source imports only `sdk` and Local-provider runtime dependencies; `deps` and the source boundary sweep return clean.

Failure and degraded outcomes to prove exactly: `host-capability-unattested`, `workspace-mount-unavailable`, `workspace-cwd-outside-mount`, `credential-injection-rejected`, `egress-confinement-unattested`, `worker-spawn-failed`, `host-observation-incomplete`, `termination-unproven`, `runner-command-capture-incomplete`, `credential-destroy-unconfirmed`.

## Allowed Writes

Only these source-owned paths may be changed:
- `packages/provider-local/src/**`
- `packages/provider-local/tests/**`
- `packages/provider-local/package.json`
- `packages/provider-local/tsconfig.json`

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn outside the owned package, generated files outside the owned pathset, and changes to SDK/testkit contracts.

## Dependency Inputs

- Producer story ids: prior frozen `prov-04-s1-execution-host-port`, `prov-04-s2-execution-host-testkit`, fnd-03 workspace leases, fnd-04 injection/egress/redaction/audit, and fnd-02 artifacts.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`.
- Public import paths: `sdk` and `testkit` only where the source contract permits tests/conformance; production source must not import `testkit`.
- Shared shapes consumed: `ExecutionHostProvider`, `WorkspaceAttachment`, `HostWorkspaceHandle`, `WorkerHandle`, `HostObservation`, `CommandResult`, `TerminationResult`, `HostReleaseResult`, `HostFailureReason`, `CapabilityAttestation`, `WorktreeLease`, `HostInjectionContext`, `EgressPolicy`, `RedactionSet`, `CredentialUsePlanned`, `NegativeProbe`, `ArtifactRef`.
- Dependency output consumed later: Local host-owned worker launch, containment, observation, termination evidence, and public provider entrypoint for `prov-01-s3-codex-agent-driver`.

## Non-Goals And STOP Conditions

Non-goals: SDK Execution Host type changes, testkit mock/conformance ownership, Agent protocol/approval/resume, local git evidence, worktree creation/branch lifecycle/cleanup, Forge actions, credential policy authorship, completion/liveness/recovery decisions, and core event-log append.

Source STOP conditions: stop if the story needs a changed Execution Host port, exposes Forge credentials to workers, claims egress/kill from schema-only evidence, performs approval or recovery decisions, or gathers local git evidence.

Also stop and report if dependency commits are missing, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor workspace containment, closed worker environments, worker-vs-runner injection separation, redaction before persistence, confirmed credential destruction, injected clocks, deterministic command digest, actual containment strength, no self-report capability claims, no production imports from `testkit`, `cli`, `mcp`, peer providers, Forge/Codex protocol packages outside this provider, core decision modules, local git evidence modules, or Work Source status writers.

## Verification

Run the targeted checks and evidence required by the source contract:
- Public import fixture `provider-local-public.public.ts`.
- `coverage:baseline` fixtures `local-attach-valid-worktree`, `local-attach-missing-worktree`, `local-attach-cwd-escape`, `local-run-command-digest-stable`, `local-run-command-redacted-output`, `local-run-command-incomplete-capture`, `local-worker-spawn-failed`, `local-observation-incomplete`, `local-termination-unproven`, `local-terminateworker-never-returns-hostfailure`, `local-capability-attestation-matrix`, `local-host-capability-unattested-refusal`, `local-injection-party-mismatch`, `local-egress-attestation-mismatch`, `local-release-destroy-unconfirmed`, `local-release-never-returns-hostfailure`.
- Gated `smoke-real` cases `local-worker-observation-smoke`, `local-termination-prove-empty`, and `local-egress-negative-probe`.
- Execution Host conformance cases `local-subject-passes` and `broken-local-subjects-fail`.
- Focused provider coverage over `packages/provider-local/src/**` at the source threshold.
- Boundary sweep from AC-9 with zero-match output.
- `pnpm check`.

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:
- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: prov-04-s3-local-execution-host-driver` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - Concrete provider drivers](../../../README.md) · **← Prev:** [Reviewer Prompt: prov-03-s3-markdown-work-source-driver](../prov-03-s3-markdown-work-source-driver/reviewer.md) · **Next →:** [Reviewer Prompt: prov-04-s3-local-execution-host-driver](./reviewer.md)

<!-- /DOCS-NAV -->
