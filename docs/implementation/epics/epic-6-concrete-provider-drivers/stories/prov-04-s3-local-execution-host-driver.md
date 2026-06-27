---
title: "prov-04-s3-local-execution-host-driver implementation story"
id: "prov-04-s3-local-execution-host-driver"
epic: 6
status: "story: ready"
design:
  - "docs/design/30-domain-reference/providers/execution-host/README.md"
  - "docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md"
  - "docs/design/20-sdk-and-packaging/concrete-providers.md"
---

# prov-04-s3-local-execution-host-driver

## Purpose

Implement the concrete `provider-local` Execution Host driver so local worktrees can run runner-owned
commands and hosted workers with captured, redacted, capability-attested evidence.

## Normative Design

- `docs/design/30-domain-reference/providers/execution-host/README.md`
- `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md`
- `docs/design/20-sdk-and-packaging/provider-ports.md`
- `docs/design/20-sdk-and-packaging/concrete-providers.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s1-execution-host-port.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s2-execution-host-testkit.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-03-s2-worktree-setup.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-04-s2-injection-egress.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `createLocalExecutionHostProvider`, `LocalExecutionHostProviderOptions`, and a
  concrete implementation of Epic 2 `ExecutionHostProvider`.
- Events / append intents: none. The driver returns host observations/results; the caller appends run
  events.
- Provider operations / commands: `probeCapabilities`, `attachWorkspace`, `spawnWorker`,
  `observeWorker`, `terminateWorker`, `runCommand`, and `releaseWorkspace`.
- Failure and degraded tokens: consumes Epic 2 `HostFailureReason` literals verbatim.
- Evidence records / attestations: `CapabilityAttestation<HostCapability>[]`, redacted output refs,
  `CommandResult`, `TerminationProof`, `HostReleaseResult`, and egress negative-probe evidence.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Attach `local-worktree` workspaces only when `cwdRoot` and requested cwd remain inside the leased
  workspace.
- Spawn workers with worker-scoped `HostInjectionContext`, closed environment, and owned containment.
- Observe redacted stdout/stderr, structured tool exits, process exits, and host failures as
  `HostObservation` values.
- Run runner-owned setup/verify/diagnostic commands and capture `commandDigest`, cwd, exit/signal,
  redacted output refs, output digest, and start/finish timestamps.
- Terminate through signal, grace, force-kill when requested, reap, and prove-empty, returning the
  Epic 2 `TerminationResult` shape and surfacing `termination-unproven` through the
  `HostObservation` `"host-failure"` arm when proof is incomplete.
- Apply worker-vs-runner injection separation, redaction before persistence, and confirmed credential
  material destruction.
- Attest `canKill`, `containmentStrength`, `emitsStructuredToolExit`, and `egress-confinement` only
  from fresh Local evidence; report actual containment strength.
- Pass Execution Host conformance plus gated real-process smoke.

## Out of Scope

- SDK `ExecutionHostProvider` types and host failure catalogs (`prov-04-s1`).
- Testkit mock host and conformance helper ownership (`prov-04-s2`).
- Agent protocol, approval relay, prompts, or session resume (`prov-01`).
- Local git evidence, worktree creation, branch lifecycle, or cleanup semantics (`fnd-03`).
- Forge actions, credentials policy authorship, completion/liveness/recovery decisions, and core
  event-log append.

## Dependencies and Frozen Inputs

- Covers signals: Local concrete provider story group.
- Depends on: prior frozen `prov-04-s1-execution-host-port`, `prov-04-s2-execution-host-testkit`,
  fnd-03 workspace leases, fnd-04 injection/egress/redaction/audit, and fnd-02 artifacts.
- Depended on by: `prov-01-s3-codex-agent-driver` for live host parentage evidence; Epic 7 production
  composition.
- Shared shapes consumed: `prov-04-s1/ExecutionHostProvider`, `WorkspaceAttachment`,
  `HostWorkspaceHandle`, `WorkerHandle`, `HostObservation`, `CommandResult`, `TerminationResult`,
  `HostReleaseResult`, `HostFailureReason`, `prov-00-s1/CapabilityAttestation`,
  `fnd-03/WorktreeLease`, `fnd-04/HostInjectionContext` fields, `EgressPolicy`, `RedactionSet`,
  `CredentialUsePlanned`, `NegativeProbe`, and `fnd-02/ArtifactRef`.
- Decision inputs consumed: workspace kind/path, request `cwd`, request `party`, `injection.party`,
  `egressPolicy.audience`, `scopeDigest`, `attestationEventIds`, timeout, process exit/signal,
  output persistence result, termination policy fields, containment probe result, and injected clock.

## Acceptance Criteria

- **AC-1** The provider package exports `createLocalExecutionHostProvider` and the returned object
  satisfies all seven `ExecutionHostProvider` operations with no private SDK imports - evidence:
  `typecheck` public-import fixture `provider-local-public.public.ts` imports the factory from
  `provider-local`, constructs it, and assigns it to `ExecutionHostProvider`.
- **AC-2** `attachWorkspace` accepts `local-worktree` attachments whose cwd root stays inside the
  worktree and rejects unavailable mounts or cwd escape as `workspace-mount-unavailable` or
  `workspace-cwd-outside-mount` - evidence: `coverage:baseline` integration fixtures
  `local-attach-valid-worktree`, `local-attach-missing-worktree`, and `local-attach-cwd-escape`.
- **AC-3** `runCommand` computes the canonical `commandDigest` from `{ kind, argv, cwd,
  timeoutSeconds, injection.scopeDigest }`, runs only with matching runner injection, captures
  exit/signal and redacted stdout/stderr refs, and returns `runner-command-capture-incomplete` when
  any required capture field is missing - evidence: `coverage:baseline` integration tests
  `local-run-command-digest-stable`, `local-run-command-redacted-output`, and
  `local-run-command-incomplete-capture`.
- **AC-4** `spawnWorker` and `observeWorker` launch the worker under owned containment, preserve
  redacted output and process-exit observations, surface structured tool exits when present, and return
  `worker-spawn-failed` or `host-observation-incomplete` for failed launch or missing observation
  fields - evidence: gated `smoke-real` case `local-worker-observation-smoke` plus
  `coverage:baseline` fake-adapter tests `local-worker-spawn-failed` and
  `local-observation-incomplete`.
- **AC-5** `terminateWorker` executes the configured ladder and returns a `TerminationResult` carrying
  `TerminationProof` fields `signalSent`, `graceObserved`, `forceKillSent`, `reaped`,
  `containmentEmpty`, `evidenceRef`, and `checkedAt`; incomplete proof remains a
  `TerminationResult` and emits `termination-unproven` as a `HostObservation` `"host-failure"` arm,
  never as a `terminateWorker` return value - evidence: gated `smoke-real`
  `local-termination-prove-empty`, `coverage:baseline` fixture `local-termination-unproven`, and
  public type fixture `local-terminateworker-never-returns-hostfailure`.
- **AC-6** `probeCapabilities` reports actual `containmentStrength`, proves `canKill` from termination
  evidence, proves `egress-confinement` only when negative probes are blocked for the policy digest,
  keeps missing/stale/wrong-scope probes negative, and any operation requiring an unattested Host
  capability returns `host-capability-unattested` without proceeding on self-report - evidence: gated
  `smoke-real` `local-egress-negative-probe` plus `coverage:baseline`
  `local-capability-attestation-matrix` and `local-host-capability-unattested-refusal`.
- **AC-7** Worker and runner injection are separated: mismatched `request.party`, `injection.party`,
  `egressPolicy.audience`, expired contexts, or unmatched attestations return
  `credential-injection-rejected` / `egress-confinement-unattested`, and `releaseWorkspace` returns
  `credentialMaterialDestroyed: true` only after destruction evidence; unconfirmed destruction returns
  `HostReleaseResult` with `released: false, credentialMaterialDestroyed: false` and surfaces
  `credential-destroy-unconfirmed` on a `"host-failure"` observation, never as a `releaseWorkspace`
  return token - evidence: `coverage:baseline` fixtures `local-injection-party-mismatch`,
  `local-egress-attestation-mismatch`, `local-release-destroy-unconfirmed`, and
  `local-release-never-returns-hostfailure`.
- **AC-8** The Local subject passes Execution Host conformance and broken subjects fail for missing
  command digest, unredacted output, incomplete termination, lied-about egress, and wrong containment
  strength - evidence: `coverage:baseline` `provider-local.conformance.test.ts` cases
  `local-subject-passes` and `broken-local-subjects-fail`.
- **AC-9** Production source imports only `sdk` and Local-provider runtime dependencies; it imports no
  `testkit`, `cli`, `mcp`, peer provider package, Forge client, Agent protocol implementation, core
  decision modules, or local-git evidence module - evidence: `deps` passes and boundary sweep
  `grep -REn "from ['\\\"](testkit|cli|mcp|provider-|@kit/testkit|@kit/cli|@kit/mcp)|@octokit|createRunEventLog|recordApproval|evaluateCompletion|recordLocalGitEvidence" packages/provider-local/src`
  returns zero matches.

## Manifest Coverage

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Public factory and provider type conformance | AC-1 | `typecheck`, `type:fixtures` |
| Workspace attachment and cwd containment | AC-2 | `coverage:baseline` |
| Runner command capture and digest | AC-3 | `coverage:baseline` |
| Worker spawn/observation | AC-4 | `coverage:baseline`, gated `smoke-real` |
| Termination proof | AC-5 | `coverage:baseline`, gated `smoke-real` |
| Capability and egress attestations | AC-6 | `coverage:baseline`, gated `smoke-real` |
| Injection separation and credential destruction | AC-7 | `coverage:baseline` |
| Execution Host conformance | AC-8 | `coverage:baseline` |
| Dependency and boundary purity | AC-9 | `deps` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-2 | cwd inside workspace root | `WorkspaceAttachment.worktreePath`, `HostWorkspaceHandle.cwdRoot`, request `cwd` | fnd-03 workspace + owned path resolver | decidable |
| AC-3 | injection party matches command party | `HostCommandRequest.party`, `HostInjectionContext.party`, `EgressPolicy.audience` | request fields + fnd-04 context | decidable |
| AC-3 | command capture complete | process exit/signal, stdout/stderr refs, digest, redaction result | owned process adapter + fnd-02 artifacts | decidable |
| AC-4 | worker owned by containment | `WorkerHandle.containmentRef`, process handle, observation stream | owned process adapter | decidable |
| AC-5 | prove-empty succeeded | termination policy, signal result, reap result, containment-empty probe | owned termination resolver | decidable |
| AC-6 | egress probe matches policy | `EgressPolicy.egressPolicyDigest`, negative probe result, freshness key | fnd-04 policy + owned probe | decidable |
| AC-6 / `host-capability-unattested` | operation capability has fresh positive attestation | requested host operation, required `HostCapability`, attestation result/scope/expiry/freshness key | capability gate local to provider result mapping | decidable |
| AC-7 | credential material destroyed | temp-file/memory handle destruction result | owned release resolver | decidable |
| AC-7 / `credential-destroy-unconfirmed` | destruction proof exists | release destruction result, `HostReleaseResult` fields, `"host-failure"` observation mapper | owned release resolver | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Writer seam, if any | Verdict |
|---|---|---|---|---|
| `createLocalExecutionHostProvider` | public export | `packages/provider-local/src/index.ts` owned export | none | closed |
| `HostWorkspaceHandle` | handleId, workspace, cwdRoot, driverId, attachedAt | minted id, request workspace, containment resolver, driver config, injected clock | provider return | closed |
| `WorkerHandle` | handleId, runId, operationId, workspaceHandleId, ownershipClass, containmentRef, startedAt | minted id, request fields, containment resolver, injected clock | provider return | closed |
| `HostObservation.output` | type, handleId, stream, outputRef, digest, redactionApplied, at | worker handle, captured stream, fnd-02 artifact/redaction result, injected clock | async provider return | closed |
| `HostObservation.structured-tool-exit` | type, handleId, tool, exitCode, payloadRef, digest, at | worker handle, structured tool payload, fnd-02 artifact/digest resolver, injected clock | async provider return | closed |
| `HostObservation.process-exit` | type, handleId, exitCode, signal, at | worker handle, process exit/signal observation, injected clock | async provider return | closed |
| `HostObservation.host-failure` | type, handleId, failure, at | worker handle, owned `HostFailure` mapper, injected clock | async provider return | closed |
| `HostFailure` | reason, message, retryable, evidenceRef, at | Epic 2 `HostFailureReason` catalog, owned diagnostic mapper, artifact evidence ref, injected clock | provider return / async observation | closed |
| `CommandResult` | operationId, commandDigest, cwd, exit/signal, output refs/digest, redactionApplied, startedAt, finishedAt | request fields, canonical digest resolver, process result, artifact/redaction result, injected clock | provider return | closed |
| `TerminationResult` / `TerminationProof` | handleId, exit/signal, proof fields; incomplete proof still uses this return shape | worker handle, termination policy, process/containment probes, artifact evidence, injected clock | provider return | closed |
| `CapabilityAttestation<HostCapability>` | capability, result, evidenceRef, scope, expiry, driverVersion, platform, freshnessKey, details | probe scope, probe outcome, artifact refs, driver config, injected clock/expiry rule | provider return | closed |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `host-capability-unattested` | required host capability missing/stale/negative/wrong-scope | capability absent; dependent power off | AC-6 |
| `workspace-mount-unavailable` | workspace kind/path cannot be attached | no workspace handle | AC-2 |
| `workspace-cwd-outside-mount` | requested cwd escapes root | reject before launch/command | AC-2 |
| `credential-injection-rejected` | party/scope/expiry/audience mismatch | no process starts with invalid injection | AC-7 |
| `egress-confinement-unattested` | negative probes not proven blocked | no confined credential release | AC-6, AC-7 |
| `worker-spawn-failed` | worker process does not start under containment | no `WorkerHandle` success | AC-4 |
| `host-observation-incomplete` | output/tool/process observation lacks required fields | degraded host observation | AC-4 |
| `termination-unproven` | signal/grace/kill/reap/prove-empty incomplete | return `TerminationResult` with incomplete proof and emit a `"host-failure"` observation; never return `HostFailure` from `terminateWorker` | AC-5 |
| `runner-command-capture-incomplete` | command capture lacks digest/output/exit fields | command evidence rejected | AC-3 |
| `credential-destroy-unconfirmed` | injected material destruction cannot be proven | release reports failure; settlement blocked | AC-7 |

## Quality Bar

- Coverage scope and threshold: `packages/provider-local/src/**`, 90% minimum and 95% target over
  containment validation, command digest/capture, injection, termination, capability, and redaction
  helpers.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`; focused command
  `pnpm exec vitest run --project unit --project integration --project conformance-mock --coverage --passWithNoTests -- packages/provider-local/tests`.
- Smoke evidence: gated `vitest run --project smoke-real -- packages/provider-local/tests/**/*.smoke.test.ts`
  for real spawn, termination, and egress negative probes.
- Required tests: AC-1..AC-9 plus every failure row.
- Public exposure: `provider-local` package entrypoint exports the factory/options and public-import
  fixture imports through the package name.
- Determinism constraints: command digest excludes ambient environment/output; clocks are injected;
  probe freshness keys are input data.
- Dependency boundaries: production source imports `sdk` and Local-provider process/containment
  dependencies only; no `testkit`, executables, peer providers, core decisions, local-git evidence,
  or Forge clients.
- File-size budget: factory, workspace, command, worker, termination, capability, and injection files
  <= 260 lines each; split before 400; 800 hard cap.
- Domain non-negotiables: runner-owned command evidence is not Agent self-report; containment strength
  is actual, not aspirational.
- Unattended safety actions: none. Termination is a provider method invoked by a caller-owned decision
  and returns proof/failure only.

## Required Reading

- Execution Host design README and contracts/conformance file.
- Epic 2 Execution Host port and testkit story contracts.
- fnd-03 workspace setup story; fnd-04 injection/egress and redaction stories.
- Test lane, testing policy, and dependency-rule docs.

## Deliverable

The `packages/provider-local` driver implementation, tests, public package export, smoke evidence, and
evidence pack.

## Evidence Pack

- Test names or fixture ids from AC-1..AC-9.
- Negative fixtures for cwd escape, host capability unattested, party mismatch, egress mismatch,
  incomplete capture, spawn failure, termination unproven, `terminateWorker` return-type mismatch,
  destruction unconfirmed, and `releaseWorkspace` return-type mismatch.
- Manifest item -> AC -> gate lane matrix above.
- `pnpm check` result plus focused coverage output.
- Gated smoke-real results for process spawn, termination, and egress negative probes.
- Public import fixture `provider-local-public.public.ts`.
- Boundary sweep from AC-9 with zero-match output.
- Conformance evidence for Local subject and broken subjects.

## Gate 4 Readiness Boxes

- Proof-substrate match: runtime workspace, command, worker, termination, injection, and capability
  helpers are measured by `coverage:baseline`; live process/egress behavior is named as gated
  `smoke-real`; public type compatibility is proven by `typecheck` and `type:fixtures`.
- Predicate-input closure - relational and compound: consumed-predicate rows name both operands for cwd
  containment, injection party/audience matching, command capture, termination proof, and egress probe
  matching.
- Failure-token/catalog closure: all failure rows use Epic 2 `HostFailureReason` literals and ACs
  require exact-literal fixtures.
- Manifest coverage: every manifest item maps to an AC and standing gate lane in the matrix above.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/provider-local`.
- Owned pathset: `packages/provider-local/src/**`, `packages/provider-local/tests/**`,
  `packages/provider-local/package.json`, `packages/provider-local/tsconfig.json`.
- Forbidden dependencies: `cli`, `mcp`, `testkit` in production source, peer provider packages,
  GitHub/Codex protocol packages outside this provider, core decision modules, local git evidence
  modules, and Work Source status writers.
- STOP when a requirement needs a changed Execution Host port, exposes Forge credentials to workers,
  claims egress/kill from schema-only evidence, performs approval or recovery decisions, or gathers
  local git evidence.

## Characterization Review Evidence

### Design -> AC Mirror

| Frozen design obligation | Source line | Covering AC / evidence | Falsification check |
|---|---|---|---|
| Workspace attachment rejects unavailable mounts and cwd escape before work starts. | `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md:27`, `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md:94` | AC-2; fixtures `local-attach-missing-worktree`, `local-attach-cwd-escape` | A missing workspace or escaping cwd returns a successful handle. |
| Runner command capture includes digest, cwd, exit/signal, redacted refs, and injected timing. | `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md:48`, `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s1-execution-host-port.md:162` | AC-3; fixtures `local-run-command-digest-stable`, `local-run-command-incomplete-capture` | A command result is accepted without digest/output/exit evidence. |
| Worker observations are typed `HostObservation` arms and incomplete streams fail closed. | `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md:62`, `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s1-execution-host-port.md:141` | AC-4; fixtures `local-worker-spawn-failed`, `local-observation-incomplete` | Missing output/tool/process fields still produce a successful observation. |
| Termination returns `TerminationResult`; `termination-unproven` is a `"host-failure"` observation, not a return value. | `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s1-execution-host-port.md:152`, `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s1-execution-host-port.md:220` | AC-5; fixtures `local-termination-unproven`, `local-terminateworker-never-returns-hostfailure` | `terminateWorker` returns `HostFailure` or reports positive kill proof with incomplete evidence. |
| Capability and egress claims require fresh positive attestations and fail closed when absent. | `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md:128`, `docs/design/30-domain-reference/providers/execution-host/contracts-and-conformance.md:131`; `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s1-execution-host-port.md:213` | AC-6, AC-7; fixtures `local-capability-attestation-matrix`, `local-host-capability-unattested-refusal`, `local-egress-attestation-mismatch` | An operation proceeds on missing/stale/wrong-scope host or egress capability evidence. |
| Workspace release cannot claim credential destruction without proof. | `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s1-execution-host-port.md:162`, `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s1-execution-host-port.md:222` | AC-7; fixtures `local-release-destroy-unconfirmed`, `local-release-never-returns-hostfailure` | Release succeeds or returns a failure token instead of a failed `HostReleaseResult` plus observation. |

### Load-Bearing Scope Decisions

| Decision | Rationale and source | Falsification criterion | Escalation path |
|---|---|---|---|
| Local owns process execution, containment, command capture, and termination evidence. | Epic 2 type-only port defers real process behavior to Epic 6 Local driver (`docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-04-s1-execution-host-port.md:97`). | Story avoids live Local evidence or delegates process evidence to Codex/core. | Keep in `prov-04-s3` or raise a design gap if Local cannot prove it. |
| Agent protocol and approval semantics stay out of Local. | Agent protocol belongs to `prov-01`; Local exposes worker/command host evidence. | Local story maps Codex approval/session events or Agent failure tokens. | Move to `prov-01-s3` or stop for seam correction. |
| Core owns liveness/recovery decisions; Local returns observations/results only. | Provider operations return host values; caller appends run events and decides. | Local story chooses completion, liveness, or recovery outcomes. | Route to core decision stories/design owner. |
| Credential material handling is evidence-producing, not policy-authoring. | fnd-04 owns credential policy; Host consumes scoped injection context. | Local story authors new credential policy or expands Forge credential scope. | Route to fnd-04 or Forge seam. |

### Regression Checks

| Known blocker pattern | Evidence in this story |
|---|---|
| Failure-row AC match | `host-capability-unattested`, `termination-unproven`, and `credential-destroy-unconfirmed` rows cite ACs that name their trigger and return/observation behavior. |
| Predicate-input closure | Consumed-predicate rows name both operands for cwd containment, injection matching, egress policy matching, termination proof, and capability freshness. |
| Producer/source closure | Produced-obligations rows name sources for every Host handle, observation arm, failure, command result, termination result, public export, and attestation field. |
| Sweep vocabulary | Boundary sweep excludes forbidden dependencies without banning Host failure literals or Local design vocabulary. |

Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - stories](./README.md) · **← Prev:** [prov-03-s3-markdown-work-source-driver implementation story](./prov-03-s3-markdown-work-source-driver.md) · **Next →:** [Epic 6 - story DAG](../story-dag.md)

<!-- /DOCS-NAV -->
