# Implementer Prompt: prov-01-s3-codex-agent-driver

## Assigned Routing

- Source story id: `prov-01-s3-codex-agent-driver`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.
- Model class: `strong-coder`.
- Effort: `high`.
- Suggested-tier floor: `elevated` from `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`.
- Reasoning tier: `elevated`.
- Routing rationale: source story `prov-01-s3-codex-agent-driver` covers `AC-1`..`AC-10` and carries a public provider package, Agent event normalization, approval relay safety boundary, Guardian advisory boundary, Local/Codex parentage dependency, smoke-real evidence, conformance, failure-token closure, and boundary purity.

## Exact Task

Implement `prov-01-s3-codex-agent-driver` for epic `epic-6-concrete-provider-drivers`: deliver the concrete `provider-codex` Agent driver with versioned schema probes, normalized Agent events, approval answer mapping, owned resume, redacted tool output refs, Guardian observations, Local host-parentage evidence, conformance, smoke evidence, and evidence pack. Keep the work limited to source story `prov-01-s3-codex-agent-driver` and source AC ids `AC-1`..`AC-10`.

## Why It Matters

This wave 2 story consumes merged Local driver evidence from `prov-04-s3-local-execution-host-driver` before claiming parentage-dependent powers. It supplies the real Codex Agent provider consumed by Epic 7 and core approval/liveness consumers. It must observe and relay through the Agent port without running runner-owned verify, holding Forge credentials, or treating Guardian as approval authority.

## Required Reading

- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-01-s3-codex-agent-driver.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-04-s3-local-execution-host-driver.md`
- `docs/design/30-domain-reference/providers/agent-execution/README.md`
- `docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md`
- `docs/design/30-domain-reference/providers/agent-execution/capabilities-and-conformance.md`
- `docs/design/30-domain-reference/providers/agent-execution/codex-driver.md`
- `docs/design/30-domain-reference/providers/agent-execution/mock-driver.md`
- `docs/design/20-sdk-and-packaging/provider-ports.md`
- `docs/design/20-sdk-and-packaging/concrete-providers.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-01-s1-agent-port.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-01-s2-agent-testkit.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-04-s1-credential-refs.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-04-s2-injection-egress.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-04-s3-redaction.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-04-s4-audit-failures.md`
- `docs/engineering/check-gate.md`
- `docs/engineering/test-lanes.md`
- `docs/engineering/testing-policy.md`
- `docs/engineering/dependency-rule-enforcement.md`
- Runtime dependency commits slot: `{{DEPENDENCY_COMMITS}}` for merged `prov-04-s3-local-execution-host-driver` plus prior frozen Epic 1 and Epic 2 producers.

## Acceptance Criteria

Source story: `prov-01-s3-codex-agent-driver`. Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`.

- **AC-1** Export `createCodexAgentProvider`; the returned object satisfies all six `AgentProvider` operations with no private SDK imports, proven by public-import fixture `provider-codex-public.public.ts`.
- **AC-2** Versioned schema probes recognize only the supported Codex protocol surface for exact driver version, map app-server/MCP methods and enum values to Agent contract, and leave unprobed or unstable methods capability-negative.
- **AC-3** `startWorker` and `observe` emit at most one `linked`, progress events, and exactly one terminal event for a stable provider session id; missing linkage, duplicate terminal, or provider loss emits `agent-linkage-lost` or `agent-terminal-ambiguous`.
- **AC-4** Completed agent command items with command, cwd, exit code, and redacted output refs emit `ToolObserved`; missing exit code, output ref, or redaction emits `structured-tool-exit-missing` or `tool-output-ref-missing` and no tool observation.
- **AC-5** `answerApproval` maps each recorded `ScopedGrantKind` to the narrowest live-proven Codex answer, refuses broad/unsupported permissions, and reports `approval-relay-unattested` or `approval-answer-channel-lost` when relay or persistence is absent.
- **AC-6** `resumeOwned` resumes only owned sessions with fresh positive `canResumeOwned` attestation and stable provider session id; observe-only or stale sessions return `agent-resume-unattested` or `agent-linkage-lost`.
- **AC-7** Guardian events are advisory `guardian-review` observations only; unstable payloads emit `guardian-review-untrusted`; the driver never uses Guardian approval/bypass methods for automated gate decisions.
- **AC-8** `probeCapabilities` claims live powers only when schema and live evidence exist for driver version, protocol surface, platform, host attestation ids, freshness key, and evidence requirement; absent/stale/wrong-scope capabilities return `agent-capability-unattested`; unproven Local containment returns `host-parentage-unproven`.
- **AC-9** The Codex subject passes Agent conformance and broken subjects fail for dropped approval, lost linkage, no exit code, claim without evidence, duplicate terminal, unstable Guardian payload, and false parentage.
- **AC-10** Production source imports only `sdk` and Codex-provider protocol dependencies; `deps` and the source boundary sweep return clean.

Failure and degraded outcomes to prove exactly: `agent-capability-unattested`, `agent-linkage-lost`, `approval-relay-unattested`, `approval-answer-channel-lost`, `agent-resume-unattested`, `structured-tool-exit-missing`, `tool-output-ref-missing`, `guardian-review-untrusted`, `host-parentage-unproven`, `agent-terminal-ambiguous`.

## Allowed Writes

Only these source-owned paths may be changed:
- `packages/provider-codex/src/**`
- `packages/provider-codex/tests/**`
- `packages/provider-codex/package.json`
- `packages/provider-codex/tsconfig.json`
- `tests/providers/codex-local-parentage.smoke.test.ts`

Every other write is forbidden, including execution package files, tracker files, source planning artifacts, repo-wide cleanup, dependency churn outside the owned package, generated files outside the owned pathset, and changes to SDK/testkit or Local provider contracts.

## Dependency Inputs

- Producer story ids: `prov-04-s3-local-execution-host-driver` for live host parentage evidence; prior frozen `prov-01-s1-agent-port`, `prov-01-s2-agent-testkit`, fnd-04 redaction/worker-safe credentials, and fnd-02 artifact refs.
- Dependency commit evidence: `{{DEPENDENCY_COMMITS}}`; execution must provide the merged `prov-04-s3-local-execution-host-driver` track-branch merge-back before dispatch.
- Public import paths: `sdk`, `testkit` only where the source contract permits tests/conformance, and the `provider-local` public entrypoint only from the root cross-provider smoke harness.
- Shared shapes consumed: `AgentProvider`, `AgentProbeScope`, `AgentSession`, `AgentEvent`, `AgentApprovalRequest`, `ToolObserved`, `GuardianReviewObserved`, `AgentFailureReason`, `AgentCapability`, `ScopedGrant`, `ApprovalAnswerResult`, `CapabilityAttestation`, `WorkerHandle`, Local host parentage evidence, `ArtifactRef`, and fnd-04 redaction data.

## Non-Goals And STOP Conditions

Non-goals: SDK Agent provider type changes, Agent failure catalog/testkit ownership, process spawn/containment/termination, runner-owned verify, approval adjudication, liveness/supervision decisions, completion/recovery decisions, local git, Forge actions, Forge credentials, Guardian gate authority, and Guardian bypass automation.

Source STOP conditions: stop if the story needs an Agent port change, a Codex live capability not proven by versioned schema plus smoke evidence, a Forge credential in worker scope, Guardian as approval authority, or host parentage without Local containment evidence.

Also stop and report if dependency commits are missing, the Local driver merge-back is absent, a required source value is absent, an AC requires writes outside the owned pathset, or implementation would require reinterpreting a source AC.

## Implementation Constraints

Honor versioned schema probes, normalized event ordering, injected clocks, output refs through `AgentOutputSink`, fresh capability attestations, Local parentage dependency, worker Forge credential isolation, Guardian advisory-only boundary, no runner-owned verify, no process spawning outside Execution Host seam, no production imports from `testkit`, `cli`, `mcp`, peer providers, Forge clients, local git modules, runner command helpers outside Local, or core approval/liveness/recovery decision modules.

## Verification

Run the targeted checks and evidence required by the source contract:
- Public import fixture `provider-codex-public.public.ts`.
- `coverage:baseline` fixtures `codex-schema-probe-matrix`, `codex-linked-terminal-order`, `codex-lost-linkage`, `codex-ambiguous-terminal`, `codex-tool-observed-output-ref`, `codex-missing-exit-code`, `codex-output-ref-missing`, `codex-approval-answer-mapping`, `codex-approval-channel-lost`, `codex-resume-owned-matrix`, `codex-guardian-advisory-only`, `codex-guardian-review-untrusted`, `codex-capability-attestation-matrix`, `codex-capability-unattested-refusal`, `codex-host-parentage-unproven`.
- Agent conformance cases `codex-subject-passes` and `broken-codex-subjects-fail`.
- Gated `smoke-real` cases `codex-live-approval-answer`, `codex-owned-resume-smoke`, and `codex-local-parentage-smoke`.
- Focused provider coverage over `packages/provider-codex/src/**` at the source threshold.
- Boundary sweeps from AC-7 and AC-10 with zero-match output.
- `pnpm check`.

Report exact command output or an explicit blocked reason. Do not claim AC coverage from prose alone.

## Commit Cadence

The implementer commits its own work in the story worktree, never the orchestrator:
- Make `pnpm check` green before every commit.
- Make an impl-done commit when the story first proves out, then one commit per fix round.
- Add commit trailers `Story: prov-01-s3-codex-agent-driver` and `Round: <n>`.
- On orchestrator-reported merge-back conflict, rebase the story commits onto the track branch `HEAD`, re-prove the gate, and re-commit.
- Report real logic conflicts rather than forcing a resolution.

## Delivery Report

Return changed files, AC coverage by source AC id, per-round commit hashes, tests and checks run, evidence pack, open questions, and blockers. The implementer does not update tracker state or perform merge, PR, push, publication, worker closure, package, or source-planning actions.

## Mutation Limits

The implementer commits each round within the owned pathset in its own story worktree. It performs no pushes, PRs, merges, tracker edits, package edits, source planning edits, worker closure, or writes outside allowed paths.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - Concrete provider drivers](../../../README.md) · **← Prev:** [Epic 6 Execution Package Plan](../../plan.md) · **Next →:** [Reviewer Prompt: prov-01-s3-codex-agent-driver](./reviewer.md)

<!-- /DOCS-NAV -->
