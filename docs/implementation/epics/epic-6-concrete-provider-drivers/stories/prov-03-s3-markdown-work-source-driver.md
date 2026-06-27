---
title: "prov-03-s3-markdown-work-source-driver implementation story"
id: "prov-03-s3-markdown-work-source-driver"
epic: 6
status: "story: ready"
design:
  - "docs/design/30-domain-reference/providers/work-source/README.md"
  - "docs/design/30-domain-reference/providers/work-source/contracts-and-conformance.md"
  - "docs/design/20-sdk-and-packaging/concrete-providers.md"
---

# prov-03-s3-markdown-work-source-driver

## Purpose

Implement the concrete `provider-markdown` Work Source driver so Markdown trackers satisfy the SDK
`WorkSourceProvider` contract, preserve task-status authority, and produce capability/conformance
evidence without writing run-log state.

## Normative Design

- `docs/design/30-domain-reference/providers/work-source/README.md`
- `docs/design/30-domain-reference/providers/work-source/contracts-and-conformance.md`
- `docs/design/20-sdk-and-packaging/provider-ports.md`
- `docs/design/20-sdk-and-packaging/concrete-providers.md`
- `docs/design/20-sdk-and-packaging/dependency-rules.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-03-s1-work-source-port.md`
- `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-03-s2-work-source-testkit.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-02-s3-lease-store.md`
- `docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-02-s4-artifact-evidence.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `createMarkdownWorkSourceProvider`, `MarkdownWorkSourceProviderOptions`, and a
  concrete implementation of Epic 2 `WorkSourceProvider`.
- Events / append intents: none. Work Source returns values and artifact refs; the caller appends run
  events.
- Provider operations / commands: `probeCapabilities`, `listTracks`, `listTasks`, `nextEligible`,
  `claim`, `release`, and `writeStatus`.
- Failure and degraded tokens: consumes Epic 2 `WorkSourceError` kinds verbatim.
- Evidence records / attestations: `CapabilityAttestation<WorkSourceCapability>[]`, `TaskSnapshot`
  artifacts, parse/probe diagnostic artifacts, and status/claim evidence refs.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Parse one `kit-work-source` block per tracker file and `kit-task` blocks into stable `TrackView` and
  `TaskView` values.
- Map native statuses through deterministic `StatusBuckets`, with unmapped labels returning
  `status-bucket-unknown`.
- Gate eligibility on simple `TaskKey` dependencies, `targetProject`, track filters, status bucket,
  and claim expiry.
- Mutate only fenced task YAML blocks for claim, release, and status writes, under the
  `work-source:<workSourceId>:<trackId>` lease and digest preconditions.
- Store `TaskSnapshot` as a write-once `ArtifactRef` at claim time and refuse claims if it cannot be
  stored.
- Probe and attest `supportsTracks`, `supportsClaim`, `supportsStatusWrite`, and
  `supportsDependencies` only from fresh positive Markdown behavior.
- Pass the Epic 2 Work Source conformance suite with positive, stale, race, malformed, and degraded
  scenarios.

## Out of Scope

- SDK `WorkSourceProvider` types, `WorkSourceError`, and `WorkSourceCapability` catalogs
  (`prov-03-s1`).
- Testkit mock backlog, conformance helper ownership, and incident fixture ownership (`prov-03-s2`).
- Run lifecycle, run events, projections, completion/recovery decisions, PRD/design authoring, local
  git evidence, and Forge behavior.
- Concrete storage implementation changes beyond consuming fnd-02 `LeaseStore` and `ArtifactStore`.

## Dependencies and Frozen Inputs

- Covers signals: Markdown concrete provider story group.
- Depends on: prior frozen `prov-03-s1-work-source-port`, `prov-03-s2-work-source-testkit`, fnd-02
  leases/artifacts, and fnd-04 redaction when provider diagnostics or evidence include sensitive text.
- Depended on by: Epic 7 production composition.
- Shared shapes consumed: `prov-03-s1/WorkSourceProvider`, `TrackView`, `TaskView`, `TaskSnapshot`,
  `ClaimResult`, `StatusWriteResult`, `WorkSourceCapability`, `WorkSourceError`,
  `prov-00-s1/CapabilityAttestation`, `fnd-02/LeaseStore`, `fnd-02/ArtifactStore`,
  `fnd-02/ArtifactRef`.
- Decision inputs consumed: tracker path, parsed block fields, `statusBuckets`, `TaskKey`
  dependencies, `Claim.expiresAt`, `expectedRecordDigest`, `expectedEpoch`, `sourceRevision`,
  `targetProject`, fnd-02 lease result, artifact store result, and injected clock.

## Acceptance Criteria

- **AC-1** The provider package exports `createMarkdownWorkSourceProvider` and the returned object
  satisfies all seven `WorkSourceProvider` operations with no private SDK imports - evidence:
  `typecheck` public-import fixture `provider-markdown-public.public.ts` imports the factory from
  `provider-markdown`, constructs it, and assigns it to `WorkSourceProvider`.
- **AC-2** Tracker parsing returns stable `TrackView`/`TaskView` values from one `kit-work-source`
  block and task `kit-task` blocks, returns `work-source-unavailable` when the source root or tracker
  cannot be read, rejects duplicate task ids and malformed YAML as `track-malformed`, and maps
  unmapped native statuses to `status-bucket-unknown` - evidence: `coverage:baseline` integration
  fixtures `markdown-parse-stable-track`, `markdown-source-unavailable`,
  `markdown-duplicate-task-id`, and `markdown-status-bucket-unknown`.
- **AC-3** `nextEligible` returns only tasks whose dependencies are complete, whose status bucket is
  eligible, whose claim is absent or expired, and whose target matches `targetProject`; missing,
  malformed, blocked, unknown, or incomplete dependencies return `dependency-unresolved` - evidence:
  `coverage:baseline` integration table `markdown-eligibility-dependency-matrix` asserts each reason
  literal and the null case when no task is eligible.
- **AC-4** `claim`, `release`, and `writeStatus` acquire the fnd-02 track lease, reread the tracker,
  compare `expectedRecordDigest`/`expectedEpoch`, edit only the target task YAML block, fsync via the
  storage primitive, reread, and verify the post-write digest; unavailable leases return
  `claim-lock-unavailable` with no mutation, changed claim/release preconditions return
  `claim-conflict`, changed status preconditions return `status-authority-conflict`, and failed or
  unverifiable status persistence returns `status-write-unavailable` without `written: true` -
  evidence: `coverage:baseline` integration tests `markdown-claim-lock-unavailable`,
  `markdown-claim-digest-conflict`, `markdown-release-epoch-conflict`,
  `markdown-status-authority-conflict`, and `markdown-status-write-unavailable`.
- **AC-5** `claim` writes a `TaskSnapshot` artifact containing task fields, source path, source revision,
  source bytes digest, inline spec digest, raw excerpt digest, and `createdAt`; artifact failure returns
  `snapshot-artifact-unavailable` with no claim mutation - evidence: `coverage:baseline`
  `markdown-claim-snapshot-fields` and `markdown-snapshot-artifact-unavailable`.
- **AC-6** `probeCapabilities` returns `CapabilityAttestation<WorkSourceCapability>[]` only when the
  Markdown source can prove each requested capability for the driver version, platform, freshness key,
  and track scope; negative or stale probe evidence is not reported as positive - evidence:
  `coverage:baseline` `markdown-capability-probe-matrix` asserts the four capability literals and
  the stale/negative cases.
- **AC-7** The driver passes the Work Source conformance suite with the Markdown subject and broken
  Markdown fixtures fail the suite for stale digests, delayed writes, missing dependencies, false status
  writes, and artifact failures - evidence: `coverage:baseline` conformance-mock/integration tests
  `provider-markdown.conformance.test.ts` with cases `markdown-subject-passes` and
  `broken-markdown-subjects-fail`.
- **AC-8** Production source imports only `sdk` and provider-markdown-owned parsing/filesystem
  utilities, and imports no `testkit`, `cli`, `mcp`, peer provider package, core event writer, or
  Forge/Agent/Execution Host driver - evidence: `deps` passes and boundary sweep
  `grep -REn "from ['\\\"](testkit|cli|mcp|provider-|@kit/testkit|@kit/cli|@kit/mcp)|createRunEventLog|appendGateRecord|@octokit|execa|child_process" packages/provider-markdown/src`
  returns zero matches.

## Manifest Coverage

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Public factory and provider type conformance | AC-1 | `typecheck`, `type:fixtures` |
| Tracker and task parsing, malformed diagnostics | AC-2 | `coverage:baseline` |
| Eligibility and dependency gating | AC-3 | `coverage:baseline` |
| Race-safe claim/release/status mutation | AC-4 | `coverage:baseline` |
| TaskSnapshot artifact production | AC-5 | `coverage:baseline` |
| Work Source capability attestations | AC-6 | `coverage:baseline` |
| Real driver conformance and broken-driver failure | AC-7 | `coverage:baseline` |
| Dependency and boundary purity | AC-8 | `deps` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-2 | tracker/task structural validity | tracker bytes, YAML parse result, block counts, task ids | Markdown parser owned here | decidable |
| AC-2 | native status maps to a bucket | `TrackView.statusBuckets`, task native status | parsed tracker block | decidable |
| AC-3 | dependency complete vs unresolved | dependency `TaskKey`, dependency `TaskStatus.bucket`, dependency parse result | parsed tracker view owned here | decidable |
| AC-3 | claim active or expired | `Claim.expiresAt`, injected clock | parsed task claim + clock input | decidable |
| AC-4 | precondition changed | `expectedRecordDigest`, `expectedEpoch`, reread record digest/epoch | request fields + owned reread resolver | decidable |
| AC-5 | artifact write succeeded | `ArtifactStore.put` result | fnd-02 artifact store | decidable |
| AC-6 | capability positive/negative | parsed/probed operation result, driver version, platform, freshness key | owned probe + request scope | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Writer seam, if any | Verdict |
|---|---|---|---|---|
| `createMarkdownWorkSourceProvider` | public export | `packages/provider-markdown/src/index.ts` owned export | none | closed |
| `TrackView` | `trackId`, `workSourceId`, `statusBuckets`, `taskKeys`, `sourceRecordDigest` | `kit-work-source` block, parsed task keys, canonical track-block digest | WorkSourceProvider return | closed |
| `TaskView` | `key`, `title`, `status.native`, `status.bucket`, `target.project`, `spec.inline`, `spec.refs`, `dependencies`, `claim`, `sourceRecordDigest` | source id/config, task heading/block, status-bucket resolver, inline prose, parsed dependency keys, parsed claim, canonical task-block digest | WorkSourceProvider return | closed |
| `TaskSnapshot` | task, sourcePath, sourceRevision, sourceBytesDigest, inlineSpecDigest, rawExcerptDigest, createdAt | parsed task, tracker path, request `sourceRevision`, source/digest resolver, raw excerpt resolver, injected clock | fnd-02 `ArtifactStore.put` | closed |
| `ClaimResult` | task, snapshotRef, snapshotDigest | post-write task view, `ArtifactStore.put` ref and digest | WorkSourceProvider return | closed |
| `StatusWriteResult` | written, updatedRecordDigest, evidenceRef, auditCitation, at | verified post-write digest, request evidence/audit citation, injected clock | WorkSourceProvider return | closed |
| `WorkSourceError` variants | `kind` plus `message`, `sourceRef`, `trackId`, `diagnostic`, `task`, `dependency`, `reason`, `nativeStatus`, `expectedRecordDigest`, `observedRecordDigest`, `expectedEpoch`, `observedEpoch`, `leaseKey`, `priorClaim` | owned parser, dependency resolver, lease result, digest comparison, artifact result, status-write result | WorkSourceProvider return | closed |
| `CapabilityAttestation<WorkSourceCapability>` | capability, probeMethod, result, evidenceRef, scope, expiry, driverVersion, platform, freshnessKey, at | probe scope, probe outcome, artifact ref, injected clock/expiry rule | WorkSourceProvider return | closed |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `work-source-unavailable` | source root or tracker cannot be read | return token; no fabricated track/task list | AC-2 |
| `track-malformed` | tracker block or task YAML is malformed or duplicated | return token with deterministic diagnostic | AC-2 |
| `dependency-unresolved` | dependency is missing, malformed, blocked, unknown, or incomplete | dependent task is not eligible; return exact reason | AC-3 |
| `status-bucket-unknown` | native status has no deterministic bucket | task is ineligible; no silent mapping | AC-2 |
| `claim-conflict` | claim digest/epoch precondition changed | no claim success; return expected/observed values | AC-4 |
| `claim-lock-unavailable` | fnd-02 track lease cannot be acquired | no mutation; `supportsClaim` absent | AC-4, AC-6 |
| `snapshot-artifact-unavailable` | snapshot cannot be stored | no claim mutation; return token | AC-5 |
| `status-write-unavailable` | status write cannot be persisted or verified | no `written: true` result | AC-4 |
| `status-authority-conflict` | status write expected digest diverges | no status success; return observed digest | AC-4 |

## Quality Bar

- Coverage scope and threshold: `packages/provider-markdown/src/**`, 90% minimum and 95% target over
  parser, mutation, capability, and provider operation helpers.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`; focused command
  `pnpm exec vitest run --project integration --project conformance-mock --coverage --passWithNoTests -- packages/provider-markdown/tests`.
- Required tests: AC-1..AC-8 plus every failure row named above.
- Public exposure: `provider-markdown` package entrypoint exports `createMarkdownWorkSourceProvider`
  and options; public-import fixture imports through the package name.
- Determinism constraints: clock is injected; digests are deterministic; task selection order is stable
  by track/task order; no ambient network or process execution.
- Dependency boundaries: production source imports `sdk` and provider-owned parser/filesystem helpers
  only; no `testkit`, `cli`, `mcp`, peer provider, core writer, Forge, Agent, or Execution Host driver.
- File-size budget: parser, mapper, mutation, capability, and factory files <= 260 lines each; split
  before 400; 800 hard cap.
- Domain non-negotiables: Work Source is task-status authority only; it never writes run activity.
- Unattended safety actions: none. Claim/status writes require caller request fields and fail closed on
  lease/digest conflict.

## Required Reading

- Work Source design README and contracts/conformance file.
- Epic 2 Work Source port and testkit story contracts.
- fnd-02 lease and artifact story contracts.
- Testing lane and dependency-rule docs.

## Deliverable

The `packages/provider-markdown` driver implementation, tests, public package export, and evidence
pack.

## Evidence Pack

- Test names or fixture ids from AC-1..AC-8.
- Negative fixtures for malformed tracker, duplicate id, status-bucket unknown, dependency unresolved,
  stale digest, lease unavailable, snapshot artifact unavailable, status write unavailable, false
  status write, and boundary imports.
- Manifest item -> AC -> gate lane matrix above.
- `pnpm check` result and focused integration/conformance coverage output.
- Public import fixture `provider-markdown-public.public.ts`.
- Boundary sweep from AC-8 with zero-match output.
- Conformance evidence for the Markdown subject and broken subjects.

## Gate 4 Readiness Boxes

- Proof-substrate match: runtime driver/parser/mutation/capability helpers are measured by
  `coverage:baseline`; public type compatibility is proven by `typecheck` and `type:fixtures`.
- Predicate-input closure - relational and compound: consumed-predicate rows name both operands for
  digest, epoch, dependency, status, claim-expiry, and capability branches.
- Failure-token/catalog closure: all failure rows use Epic 2 `WorkSourceError` literals and ACs require
  exact-literal fixtures.
- Manifest coverage: every manifest item maps to an AC and standing gate lane in the matrix above.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/provider-markdown`.
- Owned pathset: `packages/provider-markdown/src/**`, `packages/provider-markdown/tests/**`,
  `packages/provider-markdown/package.json`, `packages/provider-markdown/tsconfig.json`.
- Forbidden dependencies: `cli`, `mcp`, `testkit` in production source, peer provider packages,
  core event writers, GitHub/Codex/process driver dependencies.
- STOP when a requirement needs a Work Source port shape not present in Epic 2, writes run-log state,
  changes SDK/testkit contracts, or treats task status and run activity as one authority.

## Characterization Review Evidence

### Design -> AC Mirror

| Frozen design obligation | Source line | Covering AC / evidence | Falsification check |
|---|---|---|---|
| Work Source is the task status authority and remains separate from the run event log. | `docs/design/30-domain-reference/providers/work-source/README.md:14`, `docs/design/30-domain-reference/providers/work-source/README.md:57`, `docs/design/30-domain-reference/providers/work-source/README.md:118` | AC-4, AC-8; boundary sweep excludes run-log writers | Provider writes run activity or status decisions outside task-status authority. |
| Markdown tracker parsing owns one work-source block and task blocks with deterministic buckets. | `docs/design/30-domain-reference/providers/work-source/README.md:124`, `docs/design/30-domain-reference/providers/work-source/README.md:129` | AC-2; fixtures `markdown-parse-stable-track`, `markdown-duplicate-task-id`, `markdown-status-bucket-unknown` | Duplicate/malformed/unmapped status input silently becomes a valid eligible task. |
| Eligibility depends on dependencies, status bucket, target project, and claim expiry. | `docs/design/30-domain-reference/providers/work-source/README.md:139`, `provider-ports.md:821` | AC-3; fixture table `markdown-eligibility-dependency-matrix` | Missing, malformed, blocked, unknown, or incomplete dependency is ignored. |
| Claim/release/status writes are lease-guarded and digest/epoch checked. | `docs/design/30-domain-reference/providers/work-source/README.md:131`, `docs/design/30-domain-reference/providers/work-source/README.md:134`; `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-03-s1-work-source-port.md:160` | AC-4; fixtures `markdown-claim-lock-unavailable`, `markdown-claim-digest-conflict`, `markdown-release-epoch-conflict`, `markdown-status-authority-conflict`, `markdown-status-write-unavailable` | Mutation succeeds without lease, digest/epoch match, or verified post-write digest. |
| Claim produces a write-once `TaskSnapshot` artifact and fails closed when it cannot. | `docs/design/30-domain-reference/providers/work-source/README.md:113`, `docs/design/30-domain-reference/providers/work-source/README.md:244` | AC-5; fixtures `markdown-claim-snapshot-fields`, `markdown-snapshot-artifact-unavailable` | Claim mutation succeeds without storing/verifying the snapshot artifact. |
| Capability gates treat stale, absent, or negative Work Source attestations as absent. | `docs/design/30-domain-reference/providers/work-source/README.md:249` | AC-6, AC-7; fixtures `markdown-capability-probe-matrix`, `broken-markdown-subjects-fail` | Stale/negative probe evidence yields a positive capability. |

### Load-Bearing Scope Decisions

| Decision | Rationale and source | Falsification criterion | Escalation path |
|---|---|---|---|
| Markdown owns file-backed task/status mutation, not run-log state. | Work Source is task-status authority; run activity is event-log authority (`work-source/README.md:118`). | Story appends run events or merges task status with run activity. | Route to run lifecycle/core event-log owner. |
| SDK port/testkit are prior frozen producers; this story implements only the concrete driver. | Epic 2 owns `WorkSourceProvider`, `WorkSourceError`, and testkit. | Story changes SDK Work Source types or conformance helper ownership. | Stop and amend Epic 2/design instead. |
| Local git evidence is not gathered by Work Source. | `TaskSnapshot` consumes caller-provided `sourceRevision` and does not gather local git state (`work-source/README.md:113`). | Story reads local git to infer source revision. | Route to Workspace/Repository evidence owner. |
| Status writes require caller request fields and fail closed on digest/authority conflict. | Race-safety and authority conflict are frozen in `prov-03-s1` (`docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-03-s1-work-source-port.md:160`, `docs/implementation/epics/epic-2-provider-contract-layer-and-test-harness/stories/prov-03-s1-work-source-port.md:246`). | Story permits status success without expected digest/epoch or authority proof. | Keep failure token or escalate a Work Source design gap. |

### Regression Checks

| Known blocker pattern | Evidence in this story |
|---|---|
| Failure-row AC match | Each Work Source failure row cites an AC that names the exact trigger/behavior, including `status-write-unavailable`. |
| Predicate-input closure | Consumed-predicate rows name source values for status bucket, dependency, claim expiry, digest/epoch, artifact write, and capability branches. |
| Producer/source closure | Produced-obligations rows name sources for `TrackView`, `TaskView`, `TaskSnapshot`, claim/status results, errors, public export, and attestation fields. |
| Two-authorities boundary | Out of scope, quality bar, and STOP conditions prohibit run-log writes and status/run authority merging. |

Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - stories](./README.md) · **← Prev:** [prov-02-s3-github-forge-driver implementation story](./prov-02-s3-github-forge-driver.md) · **Next →:** [prov-04-s3-local-execution-host-driver implementation story](./prov-04-s3-local-execution-host-driver.md)

<!-- /DOCS-NAV -->
