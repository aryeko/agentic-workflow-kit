---
title: "prov-01-s3-codex-agent-driver implementation story"
id: "prov-01-s3-codex-agent-driver"
epic: 6
status: "story: ready"
design:
  - "docs/design/30-domain-reference/providers/agent-execution/README.md"
  - "docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md"
  - "docs/design/30-domain-reference/providers/agent-execution/codex-driver.md"
---

# prov-01-s3-codex-agent-driver

## Purpose

Implement the concrete `provider-codex` Agent driver so Codex sessions satisfy the SDK
`AgentProvider` contract with versioned probes, normalized events, approval answer mapping, redacted
tool output refs, and host-parentage evidence.

## Normative Design

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
- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-04-s3-local-execution-host-driver.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `createCodexAgentProvider`, `CodexAgentProviderOptions`, and a concrete
  implementation of Epic 2 `AgentProvider`.
- Events / append intents: none. The driver yields normalized Agent events/results; the caller appends
  run events.
- Provider operations / commands: `probeCapabilities`, `startWorker`, `observe`, `answerApproval`,
  `resumeOwned`, and `stopObserving`.
- Failure and degraded tokens: consumes Epic 2 `AgentFailureReason` literals verbatim.
- Evidence records / attestations: `CapabilityAttestation<AgentCapability>[]`, version/schema probe
  evidence, real Codex smoke evidence, `AgentSession`, `AgentEvent`, redacted tool output refs,
  approval answer evidence, Guardian observation refs, and host-parentage evidence from Local.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Probe Codex protocol surfaces per driver version and map only schema-proven plus live-proven behavior
  to positive capabilities.
- Start and observe Codex sessions through an Execution Host `WorkerHandle`, emitting stable
  `linked`, progress, approval-requested, tool-observed, guardian-review, degraded, and terminal events.
- Relay approval answers from recorded `ScopedGrant` values to the narrowest provider response; park or
  degrade when persistence or denial semantics are not proven.
- Resume only owned sessions with fresh positive `canResumeOwned` evidence and stable provider session
  ids.
- Persist tool output through `AgentOutputSink`, never embedding raw output in the event stream.
- Treat Guardian as advisory observation only and never call Guardian bypass methods for automation.
- Claim `preservesHostProcessParentage` only after a joint Local/Codex probe proves worker commands are
  inside the host-owned containment scope.
- Pass Agent conformance, Codex real-driver smoke, and adversarial incident replay.

## Out of Scope

- SDK `AgentProvider` types, Agent failure catalogs, and testkit Mock Agent/conformance helper
  ownership (`prov-01-s1`, `prov-01-s2`).
- Process spawn, containment, termination, and runner-owned verify (`prov-04`, specifically
  `prov-04-s3` for the concrete Local driver).
- Approval adjudication, liveness/supervision decisions, completion/recovery decisions, local git,
  Forge actions, and Forge credentials.
- Promoting Guardian review to a gate authority or using `thread/approve_guardian_denied_action`.

## Dependencies and Frozen Inputs

- Covers signals: Codex concrete provider story group.
- Depends on: `prov-04-s3-local-execution-host-driver` for live host parentage evidence; prior frozen
  `prov-01-s1-agent-port`, `prov-01-s2-agent-testkit`, fnd-04 redaction/worker-safe credentials, and
  fnd-02 artifact refs.
- Depended on by: Epic 7 production composition and core approval/liveness consumers at runtime.
- Shared shapes consumed: `prov-01-s1/AgentProvider`, `AgentProbeScope`, `AgentSession`,
  `AgentEvent`, `AgentApprovalRequest`, `ToolObserved`, `GuardianReviewObserved`, `AgentFailureReason`,
  `AgentCapability`, `ScopedGrant`, `ApprovalAnswerResult`, `prov-00-s1/CapabilityAttestation`,
  `prov-04-s1/WorkerHandle`, `prov-04-s3` Local host parentage evidence, `fnd-02/ArtifactRef`, and
  fnd-04 redaction data.
- Decision inputs consumed: `AgentProbeScope.protocolSurface`, `driverVersion`, `platform`,
  `freshnessKey`, `hostAttestationIds`, schema probe result, live smoke result, provider session id,
  provider request id, answer channel persistence result, `ScopedGrant.kind`, tool exit code, output
  sink result, Guardian payload stability, host containment evidence, and injected clock.

## Acceptance Criteria

- **AC-1** The provider package exports `createCodexAgentProvider` and the returned object satisfies
  all six `AgentProvider` operations with no private SDK imports - evidence: `typecheck`
  public-import fixture `provider-codex-public.public.ts` imports the factory from `provider-codex`,
  constructs it, and assigns it to `AgentProvider`.
- **AC-2** Versioned schema probes recognize only the supported Codex protocol surface for the exact
  driver version, map app-server/MCP methods and enum values to the Agent contract, and leave
  unprobed or unstable methods capability-negative - evidence: `coverage:baseline`
  `codex-schema-probe-matrix` fixtures for `codex-app-server`, `codex-mcp-server`, unknown version,
  and missing method cases.
- **AC-3** `startWorker` and `observe` emit at most one `linked`, progress events, and exactly one
  terminal event for a stable provider session id; missing linkage, duplicate terminal, or provider
  loss emits `agent-linkage-lost` or `agent-terminal-ambiguous` - evidence: `coverage:baseline`
  fixtures `codex-linked-terminal-order`, `codex-lost-linkage`, and `codex-ambiguous-terminal`.
- **AC-4** Completed command items with `source: "agent"`, command, cwd, non-null `exitCode`, and
  redacted `outputRef` emit `ToolObserved`; missing exit code, missing output ref, or redaction failure
  emits `structured-tool-exit-missing` or `tool-output-ref-missing` and no tool observation - evidence:
  `coverage:baseline` fixtures `codex-tool-observed-output-ref`, `codex-missing-exit-code`, and
  `codex-output-ref-missing`.
- **AC-5** `answerApproval` maps each recorded `ScopedGrantKind` to the narrowest live-proven Codex
  answer, refuses broad/unsupported permission profiles, and reports `approval-relay-unattested` or
  `approval-answer-channel-lost` when relay or persistence is absent - evidence:
  `coverage:baseline` `codex-approval-answer-mapping` and `codex-approval-channel-lost`; gated
  `smoke-real` `codex-live-approval-answer`.
- **AC-6** `resumeOwned` resumes only `"owned"` or `"owned-remote"` sessions with a fresh positive
  `canResumeOwned` attestation and stable provider session id; observe-only or stale sessions return
  `agent-resume-unattested` or `agent-linkage-lost` - evidence: `coverage:baseline`
  `codex-resume-owned-matrix` and gated `smoke-real` `codex-owned-resume-smoke`.
- **AC-7** Guardian events are emitted only as advisory `guardian-review` observations with stable
  target/action/status/risk/rationale refs; missing, unstable, or unactionable Guardian payloads emit
  `guardian-review-untrusted`; and the driver never uses Guardian approval/bypass methods for
  automated gate decisions - evidence: `coverage:baseline` `codex-guardian-advisory-only` and
  `codex-guardian-review-untrusted`, plus a boundary sweep over `packages/provider-codex/src` for
  `approve_guardian_denied_action` returns zero matches.
- **AC-8** `probeCapabilities` claims `canRelayApproval`, `canPersistApprovalAnswerChannel`,
  `canResumeOwned`, `emitsStructuredToolExit`, `emitsGuardianReview`, and
  `preservesHostProcessParentage` only when the required schema and live evidence exist for driver
  version, protocol surface, platform, host attestation ids, freshness key, and evidence requirement;
  schema-only evidence cannot make live powers positive - evidence: `coverage:baseline`
  `codex-capability-attestation-matrix` plus gated `smoke-real` `codex-local-parentage-smoke`.
- **AC-9** The Codex subject passes Agent conformance and broken subjects fail for dropped approval,
  lost linkage, no exit code, claim without evidence, duplicate terminal, unstable Guardian payload,
  and false parentage - evidence: `coverage:baseline` `provider-codex.conformance.test.ts` cases
  `codex-subject-passes` and `broken-codex-subjects-fail`.
- **AC-10** Production source imports only `sdk` and Codex-provider protocol dependencies; it imports no
  `testkit`, `cli`, `mcp`, peer provider package, Forge client, local git module, runner command
  execution helper outside Local, or core approval/liveness/recovery decision module - evidence:
  `deps` passes and boundary sweep
  `grep -REn "from ['\\\"](testkit|cli|mcp|provider-|@kit/testkit|@kit/cli|@kit/mcp)|@octokit|recordLocalGitEvidence|decideApproval|foldLiveness|classifyRecovery|runCommand\\(" packages/provider-codex/src`
  returns zero matches.

## Manifest Coverage

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Public factory and provider type conformance | AC-1 | `typecheck`, `type:fixtures` |
| Versioned schema/protocol probe | AC-2 | `coverage:baseline` |
| Session linkage and terminal invariants | AC-3 | `coverage:baseline` |
| Structured tool observation and output refs | AC-4 | `coverage:baseline` |
| Approval answer relay and persistence | AC-5 | `coverage:baseline`, gated `smoke-real` |
| Owned-session resume | AC-6 | `coverage:baseline`, gated `smoke-real` |
| Guardian advisory boundary | AC-7 | `coverage:baseline`, `deps` |
| Capability attestations and parentage | AC-8 | `coverage:baseline`, gated `smoke-real` |
| Agent conformance and broken providers | AC-9 | `coverage:baseline` |
| Dependency and boundary purity | AC-10 | `deps` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-2 | protocol/method supported | `AgentProbeScope.protocolSurface`, schema probe methods/enums, driver version | owned schema resolver | decidable |
| AC-3 | stable linkage and one terminal | provider session id, event sequence, ownership class | Codex event stream mapper | decidable |
| AC-4 | structured tool complete | provider command item source/command/cwd/exitCode/output, output sink result | Codex event + fnd-02 output sink | decidable |
| AC-5 | grant maps to narrow answer | `ScopedGrant.kind`, request kind, provider supported answer enum | Epic 2 Agent types + owned mapper | decidable |
| AC-5 | answer channel persistent | `ApprovalAnswerChannel.persistable`, live persistence probe result | provider response + smoke probe | decidable |
| AC-6 | session resumable and owned | `ownershipClass`, providerSessionId, `canResumeOwned` attestation | Agent session + capability probe | decidable |
| AC-7 | Guardian stable/advisory | Guardian payload fields, schema stability flag | Codex event mapper | decidable |
| AC-8 | parentage proven | `hostAttestationIds`, Local containment evidence, command process evidence | `prov-04-s3` Local evidence + Codex probe | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Writer seam, if any | Verdict |
|---|---|---|---|---|
| `createCodexAgentProvider` | public export | `packages/provider-codex/src/index.ts` owned export | none | closed |
| `AgentSession` | sessionId, runId, providerSessionId, providerTurnId, hostWorkerHandleId, ownershipClass, answerChannels, startedAt | minted id, request fields, provider response, host worker, answer-channel mapper, injected clock | provider return | closed |
| `AgentEvent.linked` | type, session, at | provider session response mapped to owned `AgentSession`, injected clock | async provider return | closed |
| `AgentEvent.progress` | type, sessionId, message, itemId, at | provider progress event, linked session id, injected clock | async provider return | closed |
| `AgentEvent.approval-requested` | type, sessionId, request, at | provider approval request mapped to owned `AgentApprovalRequest`, linked session id, injected clock | async provider return | closed |
| `AgentApprovalRequest` | requestId, kind, providerMethod, prompt, command, cwd, proposedGrant, answerChannel | provider approval payload, Codex kind mapper, answer-channel evidence mapper | async provider return | closed |
| `AgentEvent.tool-observed` | type, sessionId, tool, at | provider command item mapped to owned `ToolObserved`, linked session id, injected clock | async provider return | closed |
| `ToolObserved` | observationId, itemId, command, cwd, exitCode, outputRef, outputDigest, source | provider command item, minted observation id, output sink result, constant `source: "agent"` | async provider return | closed |
| `AgentEvent.guardian-review` | type, sessionId, review, at | stable Guardian payload mapped to owned `GuardianReviewObserved`, injected clock | async provider return | closed |
| `GuardianReviewObserved` | reviewId, targetItemId, actionType, status, riskLevel, rationaleRef, stable | provider Guardian payload and stability probe | async provider return | closed |
| `AgentEvent.degraded` | type, sessionId, failure, at | owned `AgentFailure` mapper, optional session id, injected clock | async provider return | closed |
| `AgentFailure` | reason, message, retryable, evidenceRef | Epic 2 `AgentFailureReason` catalog, owned diagnostic mapper, evidence artifact ref | async provider return / provider return | closed |
| `AgentEvent.terminal` | type, sessionId, reason, exitCode, at | provider terminal payload, linked session id, terminal reason mapper, injected clock | async provider return | closed |
| `ApprovalAnswerResult` | delivered, persisted, channelRef, evidenceRef, at | provider answer response, answer-channel persistence evidence, injected clock | provider return | closed |
| `AgentReleaseResult` | sessionId, released, observationStopped, evidenceRef, at | session input, provider release response, injected clock | provider return | closed |
| `CapabilityAttestation<AgentCapability>` | capability, probeMethod, result, evidenceRef, scope, expiry, driverVersion, platform, freshnessKey, at | probe scope, schema/live probe outcome, evidence ref, injected clock/expiry rule | provider return | closed |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `agent-capability-unattested` | required capability missing/stale/negative/wrong-scope | dependent power off | AC-8 |
| `agent-linkage-lost` | no stable provider session id or ownership linkage | no resume/approval answer success | AC-3, AC-6 |
| `approval-relay-unattested` | approval request observed but relay not proven | park/degrade; no synthetic answer | AC-5 |
| `approval-answer-channel-lost` | captured request cannot be answered after park/resume | delivered/persisted false | AC-5 |
| `agent-resume-unattested` | resume requested without fresh positive capability | no resume success | AC-6 |
| `structured-tool-exit-missing` | command lacks trustworthy exit code | no `ToolObserved` success | AC-4 |
| `tool-output-ref-missing` | output capture lacks redacted ref/digest | no raw output event | AC-4 |
| `guardian-review-untrusted` | Guardian payload unstable/missing/unactionable | advisory/degraded only | AC-7 |
| `host-parentage-unproven` | command process not tied to Local containment | kill-dependent powers absent | AC-8 |
| `agent-terminal-ambiguous` | no single classified terminal state | terminal degraded; no completion proof | AC-3 |

## Quality Bar

- Coverage scope and threshold: `packages/provider-codex/src/**`, 90% minimum and 95% target over
  schema probes, event normalization, approval mapping, resume, tool output, Guardian mapping,
  capability, and failure mapping helpers.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`; focused command
  `pnpm exec vitest run --project unit --project conformance-mock --coverage --passWithNoTests -- packages/provider-codex/tests`.
- Smoke evidence: gated `vitest run --project smoke-real -- packages/provider-codex/tests/**/*.smoke.test.ts`
  for live Codex start, approval answer, resume, structured tool exit, and Local parentage.
- Required tests: AC-1..AC-10 plus every failure row.
- Public exposure: `provider-codex` package entrypoint exports factory/options and public-import
  fixture imports through the package name.
- Determinism constraints: normalized event order is derived from provider stream; clocks are injected;
  schema/live evidence is versioned by driver version, protocol surface, platform, freshness key, and
  evidence ref.
- Dependency boundaries: production source imports `sdk` and Codex-provider protocol dependencies
  only; no `testkit`, executables, peer providers, Forge clients, local git, Local process helpers
  outside the Execution Host seam, or core decision modules.
- File-size budget: factory, schema probe, event mapper, approval mapper, resume, output, capability,
  and error mapper files <= 280 lines each; split before 400; 800 hard cap.
- Domain non-negotiables: worker holds no Forge credentials; Agent observes worker tool activity but
  does not run runner-owned verify; Guardian is advisory in v1.
- Unattended safety actions: none. Approval/recovery/liveness actions remain core-owned; Codex answers
  only recorded approval decisions supplied by the caller.

## Required Reading

- Agent Execution README, contract, capability, Codex driver, and mock driver files.
- Epic 2 Agent port and testkit story contracts.
- `prov-04-s3-local-execution-host-driver` for Local parentage evidence.
- fnd-04 redaction/credential isolation story contracts.
- Test lane, testing policy, and dependency-rule docs.

## Deliverable

The `packages/provider-codex` driver implementation, tests, public package export, gated Codex/Local
smoke evidence, and evidence pack.

## Evidence Pack

- Test names or fixture ids from AC-1..AC-10.
- Negative fixtures for unknown schema, lost linkage, ambiguous terminal, missing exit code, output ref
  missing, approval channel lost, resume unattested, Guardian untrusted, parentage unproven, and false
  parentage.
- Manifest item -> AC -> gate lane matrix above.
- `pnpm check` result plus focused coverage output.
- Gated smoke-real results with versioned Codex evidence and Local parentage artifact refs.
- Public import fixture `provider-codex-public.public.ts`.
- Boundary sweeps from AC-7 and AC-10 with zero-match output.
- Conformance evidence for Codex subject and broken subjects.

## Gate 4 Readiness Boxes

- Proof-substrate match: runtime schema, event, approval, resume, output, Guardian, parentage, and
  capability helpers are measured by `coverage:baseline`; live Codex/Local behavior is named as gated
  `smoke-real`; public type compatibility is proven by `typecheck` and `type:fixtures`.
- Predicate-input closure - relational and compound: consumed-predicate rows name both operands for
  protocol support, session linkage, structured tool completeness, approval grant mapping, resume
  ownership, Guardian stability, and host-parentage proof.
- Failure-token/catalog closure: all failure rows use Epic 2 `AgentFailureReason` literals and ACs
  require exact-literal fixtures.
- Manifest coverage: every manifest item maps to an AC and standing gate lane in the matrix above.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/provider-codex`.
- Owned pathset: `packages/provider-codex/src/**`, `packages/provider-codex/tests/**`,
  `packages/provider-codex/package.json`, `packages/provider-codex/tsconfig.json`.
- Forbidden dependencies: `cli`, `mcp`, `testkit` in production source, peer provider packages,
  Forge clients, local git modules, runner command execution outside Local, and core approval/liveness
  or recovery decision modules.
- STOP when a requirement needs an Agent port change, a Codex live capability not proven by versioned
  schema plus smoke evidence, a Forge credential in worker scope, Guardian as approval authority, or
  host parentage without Local containment evidence.

## Characterization Review Evidence

- Design -> AC completeness: versioned Codex probe, start/observe/linkage, approval relay/persistence,
  resume, structured tool output, Guardian advisory handling, parentage, capability evidence,
  conformance, and credential/process boundaries map to AC-1..AC-10.
- Producer closure: every produced DTO field, public symbol, and attestation field has a source row.
- Sweep vocabulary: forbidden tokens do not ban Agent failure literals or normative Codex design terms.
- Failure-token/catalog closure: all tokens consume Epic 2 `AgentFailureReason` exactly; this story
  invents none.
- Load-bearing decisions: Codex owns protocol mapping and evidence only; Local owns process evidence;
  core owns approval/liveness/recovery decisions.
- Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - stories](./README.md) · **← Prev:** [Epic 6 - stories](./README.md) · **Next →:** [prov-02-s3-github-forge-driver implementation story](./prov-02-s3-github-forge-driver.md)

<!-- /DOCS-NAV -->
